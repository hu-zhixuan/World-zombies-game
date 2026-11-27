// 画面层：照着规则层的状态把画面画出来（室外黄昏堡垒防线 & 室内酒馆营地），听事件播特效。这里不改任何游戏状态。
import Phaser from 'phaser';
import { game } from '../app/game';
import { ASSETS } from '../assets';
import { DRINKS, MEALS, MEATS, RYE_FALLBACK, WEAPONS, ZOMBIES, type MealId } from '../content/data';
import { ALLIES, QUALITY_META } from '../content/story';
import { BODY_Y, FORT_GUN_X, allyRole, computeGrenadeThrow, curWeapon, hasTavernUpgrade, houseBuff, nearbyCampTarget, staffDef, stoveCapacity, turretWorldPos, zombieBodyY } from '../sim/sim';
import {
  ALLY_POS, DINER_PLATE_X, DOOR_X, GROUND_Y, IN_STATIONS, LADDER_X, PORCH_MAX_X, PORCH_MIN_X, PORCH_Y,
  ROOF_MAX_X, ROOF_MIN_X, ROOF_Y, TURRET_SLOTS, VIEW_H, WALL_X, WORLD_W, type GameEvent,
} from '../sim/types';
import { floaters } from '../ui/floaters';
import { PALETTE as C } from '../ui/palette';

export { VIEW_H };

const D = { sky: 0, town: 1, back: 2, ground: 3, prop: 4, actor: 5, fx: 6, mark: 7 };
const dishIconKey = (id: MealId | 'rye', isRye?: boolean) => (isRye || id === 'rye' ? RYE_FALLBACK.icon : MEALS[id].icon);

/** 每把枪精确的握把锚点、前臂伸展距离与枪口前伸量（对齐 15x8 hero_arm 拳头中心与紧裁武器轮廓） */
const WEAPON_GRIP: Record<string, { ox: number; oy: number; reach: number; gyOff: number; muzzle: number; scale: number; kick: number; recoil: number; shake: number }> = {
  pistol:   { ox: 0.25, oy: 0.55, reach: 11.0, gyOff: 1.5,  muzzle: 14, scale: 0.90, kick: 0.2,  recoil: 4.5, shake: 0 },
  revolver: { ox: 0.28, oy: 0.42, reach: 11.0, gyOff: -0.2, muzzle: 15, scale: 0.86, kick: 0.34, recoil: 6.2, shake: 0.0022 },
  smg:      { ox: 0.24, oy: 0.56, reach: 11.5, gyOff: 1.2,  muzzle: 16, scale: 0.94, kick: 0.14, recoil: 3.4, shake: 0 },
  shotgun:  { ox: 0.28, oy: 0.58, reach: 11.5, gyOff: 1.2,  muzzle: 18, scale: 0.88, kick: 0.42, recoil: 7.4, shake: 0.0038 },
  assault:  { ox: 0.24, oy: 0.56, reach: 11.5, gyOff: 1.2,  muzzle: 16, scale: 0.90, kick: 0.18, recoil: 4.2, shake: 0.0012 },
  rifle:    { ox: 0.24, oy: 0.54, reach: 11.5, gyOff: 1.0,  muzzle: 18, scale: 0.94, kick: 0.46, recoil: 8.0, shake: 0.0044 },
  tesla:    { ox: 0.20, oy: 0.52, reach: 11.0, gyOff: 1.0,  muzzle: 21, scale: 0.82, kick: 0.2,  recoil: 4.4, shake: 0.0016 },
  rocket:   { ox: 0.28, oy: 0.62, reach: 11.5, gyOff: 1.0,  muzzle: 20, scale: 0.92, kick: 0.5,  recoil: 8.4, shake: 0.0052 },
};

interface BoltFx { pts: { x: number; y: number }[]; until: number; color: number; straight?: boolean; crit?: boolean }
interface Spark { x: number; y: number; vx: number; vy: number; g: number; life: number; max: number; size: number; col: number; bounce?: boolean }
interface Shockwave { x: number; y: number; r: number; maxR: number; col: number; life: number; max: number; width: number }
interface SlashFx { x: number; y: number; ang: number; len: number; col: number; until: number; core?: boolean }

export class GameScene extends Phaser.Scene {
  private sky!: Phaser.GameObjects.TileSprite;
  private town!: Phaser.GameObjects.TileSprite;
  private hero!: Phaser.GameObjects.Sprite;
  private heroArm!: Phaser.GameObjects.Image;
  private heroGun!: Phaser.GameObjects.Image;
  private carriedDishSprite!: Phaser.GameObjects.Image;

  // 室外与室内两组静态舞台物件（随 run.inside 快速切换可见性）
  private extObjs: { setVisible(v: boolean): void }[] = [];
  private intObjs: { setVisible(v: boolean): void }[] = [];
  private tavernPropTable6!: Phaser.GameObjects.Image;
  private tavernPropTable8!: Phaser.GameObjects.Image;
  private tavernPropPass!: Phaser.GameObjects.Image;
  private tavernPropTap!: Phaser.GameObjects.Image;
  private tavernChandObjs: { setVisible(v: boolean): void }[] = [];
  private fortKeepObjs: Phaser.GameObjects.GameObject[] = [];
  private fortCannon!: Phaser.GameObjects.Image;
  private turretSprites: (Phaser.GameObjects.Sprite | Phaser.GameObjects.Image | null)[] = [null, null, null, null];
  private turretTypes: (string | null)[] = [null, null, null, null];
  private wallTierObjs: { minLv: number; obj: Phaser.GameObjects.Image }[] = [];

  private zombies = new Map<number, Phaser.GameObjects.Sprite>();
  private allySprites = new Map<string, Phaser.GameObjects.Sprite>();
  private allyLastAtkSeq = new Map<string, number>();
  private guestSprites = new Map<string, Phaser.GameObjects.Sprite>();
  private guestDishSprites = new Map<string, Phaser.GameObjects.Image>();
  private guestBubbleIcons = new Map<string, Phaser.GameObjects.Image>();
  private staffSprites = new Map<string, Phaser.GameObjects.Sprite>();
  private staffDishSprites = new Map<string, Phaser.GameObjects.Image>();
  private dirtyPlateSprites = new Map<number, Phaser.GameObjects.Image>();
  private counterDishSprites: Phaser.GameObjects.Image[] = [];
  private barrelSprites = new Map<number, Phaser.GameObjects.Image>();
  private crates = new Map<number, Phaser.GameObjects.Image>();
  private bullets: Phaser.GameObjects.Sprite[] = [];
  private grenadeSprites: Phaser.GameObjects.Image[] = [];
  private enemyProjSprites: Phaser.GameObjects.Sprite[] = [];
  private bolts: BoltFx[] = [];
  private sparks: Spark[] = [];
  private waves: Shockwave[] = [];
  private slashes: SlashFx[] = [];

  private overlay!: Phaser.GameObjects.Graphics;
  private flashUntil = new Map<number, number>();
  private squashUntil = new Map<number, number>();
  private hitStopUntil = new Map<number, number>();
  private hitJitterUntil = new Map<number, number>();
  private hitTilt = new Map<number, number>();
  private slowMoUntil = 0;
  private heroFlashUntil = 0;
  private camX = 0;
  private camKickX = 0;
  private camZoom = 1;
  private gunRecoil = 0;
  private gunKick = 0;
  private gunPop = 1;
  private heroSquash = 0;
  private afterimageTick = -1;
  private hearthTick = 0;

  constructor() { super('game'); }

  preload() {
    for (const a of ASSETS) {
      if (a.frames > 1) this.load.spritesheet(a.key, a.url, { frameWidth: a.fw, frameHeight: a.fh });
      else this.load.image(a.key, a.url);
    }
  }

  create() {
    const anim = (key: string, fps: number, repeat = -1) => this.anims.create({ key, frames: this.anims.generateFrameNumbers(key), frameRate: fps, repeat });
    anim('hero_idle', 7); anim('hero_run', 18); anim('hero_shoot', 16); anim('hero_jump', 8); anim('hero_fall', 8); anim('hero_hurt', 10); anim('hero_crouch', 14, 0);
    for (const z of Object.values(ZOMBIES)) for (const key of z.sprites) anim(key, z.fps);
    for (const [key, fps] of [['npc_hat', 6], ['npc_bearded', 6], ['npc_woman', 7], ['npc_oldman', 7], ['npc_hat_walk', 8], ['npc_bearded_walk', 8], ['npc_woman_walk', 8], ['npc_oldman_walk', 10]] as const) anim(key, fps);
    for (const [key, fps] of [['ally_zhang', 6], ['ally_lin', 6], ['ally_qiang', 6], ['ally_zhao', 6]] as const) {
      anim(key, fps);
    }
    anim('ally_zhang_run', 10);
    anim('ally_qiang_run', 14);
    anim('ally_zhao_run', 9);
    anim('ally_zhang_atk', 15, 0);
    anim('ally_lin_atk', 15, 0);
    anim('ally_qiang_atk', 14, 0);
    anim('ally_zhao_atk', 15, 0);
    anim('z_death', 14, 0);
    anim('fx_fireball', 14); anim('fx_boom', 16, 0);
    anim('shot', 18); anim('shot_hit', 22, 0);
    anim('turret_frost', 8, -1);

    // ── 远景背景（室外与室内共用夜色天空基底） ──
    this.sky = this.add.tileSprite(0, 0, 768, 288, 'bg_sky').setOrigin(0).setScrollFactor(0).setDepth(D.sky);
    this.town = this.add.tileSprite(0, -18, 768, 288, 'bg_town').setOrigin(0).setScrollFactor(0).setDepth(D.town).setAlpha(0.56);

    const ext = <T extends { setVisible(v: boolean): void }>(o: T) => { this.extObjs.push(o); return o; };
    const prop = (key: string, x: number, y = GROUND_Y, depth = D.back, tint?: number, scale = 1) => {
      const im = ext(this.add.image(x, y, key).setOrigin(0.5, 1).setDepth(depth).setScale(scale));
      if (tint !== undefined) im.setTint(tint);
      return im;
    };

    // ── 室外：暮夜酒馆要塞 + 阶梯木跳台 + 二层房顶阵地 + 3 级壁垒 + 街道背景 ──
    ext(this.add.tileSprite(0, GROUND_Y - 13, WORLD_W, 48, 'ground').setOrigin(0).setDepth(D.ground));
    ext(this.add.tileSprite(0, GROUND_Y + 35, WORLD_W, VIEW_H - GROUND_Y - 35, 'ground_wall').setOrigin(0).setDepth(D.ground));

    // 石堡翼楼与旗帜（堡垒 Lv.2+ 显示，让堡垒真正拔地而起）
    const keepTower = ext(this.add.image(44, GROUND_Y + 2, 'fort_keep').setOrigin(0.5, 1).setDepth(D.back).setScale(1.06));
    const keepBanner = ext(this.add.image(66, GROUND_Y - 118, 'castle_banner').setOrigin(0.5, 1).setDepth(D.prop));
    const fortPlinth = ext(this.add.image(FORT_GUN_X, GROUND_Y + ROOF_Y + 2, 'crate').setOrigin(0.5, 1).setDepth(D.ground + 0.5).setScale(0.62));
    this.fortKeepObjs = [keepTower, keepBanner, fortPlinth];

    // 核心据点大屋（一楼门廊木地板与 GROUND_Y 齐平，底部石砌地窖嵌入地基，右侧实体砖墙在 HOUSE_WALL_X=246）
    prop('fort_house', 142, GROUND_Y + 55, D.ground + 0.1, undefined, 1.1);
    // 二层屋顶木栈道防守平台 (y = GROUND_Y + ROOF_Y) 与中层门廊起跳木台 (y = GROUND_Y + PORCH_Y)
    ext(this.add.image((ROOF_MIN_X + ROOF_MAX_X) / 2, GROUND_Y + ROOF_Y + 26, 'roof_deck').setOrigin(0.5, 1).setDepth(D.prop));
    ext(this.add.image((PORCH_MIN_X + PORCH_MAX_X) / 2, GROUND_Y + PORCH_Y + 48, 'porch_deck').setOrigin(0.5, 1).setDepth(D.prop));
    // 堡垒 Lv.2+ 自带屋顶守卫火炮（稳稳架在房顶木栈平台底座上，天然朝右）
    this.fortCannon = ext(this.add.image(FORT_GUN_X, GROUND_Y + ROOF_Y - 4, 'turret_cannon').setOrigin(0.5, 1).setDepth(D.prop + 0.2));

    // 大屋门廊灯、拱窗暖光、街头路灯
    for (const [lx, ly, r, it] of [
      [104, GROUND_Y - 38, 48, 0.28], [174, GROUND_Y - 38, 48, 0.28],
      [168, GROUND_Y - 76, 52, 0.25], [266, GROUND_Y - 52, 46, 0.24],
      [304, GROUND_Y - 96, 52, 0.3], [540, GROUND_Y - 96, 52, 0.3], [830, GROUND_Y - 96, 52, 0.3],
    ] as [number, number, number, number][]) {
      ext(this.add.pointlight(lx, ly, C.lamp, r, it, 0.06).setDepth(D.fx));
    }
    prop('sign', 306, GROUND_Y, D.back);
    for (const lx of [304, 540, 830]) prop('lamp', lx, GROUND_Y, D.back);
    prop('house_a', 785, GROUND_Y, D.back, C.haze);
    prop('well', 625, GROUND_Y, D.back, C.haze);
    prop('barrel', 24, GROUND_Y, D.prop);
    prop('barrel', 442, GROUND_Y, D.back);

    // 4 个炮塔槽位底座
    for (let i = 0; i < TURRET_SLOTS.length; i++) {
      const pos = turretWorldPos(i);
      ext(this.add.image(pos.x, pos.baseY + 2, 'crate')
        .setOrigin(0.5, 1).setDepth(D.ground + 0.5).setScale(pos.roof ? 0.62 : 0.64));
    }

    // 3 级路障壁垒（Lv1 荆棘木障 → Lv2 武装马车木箱壁垒 → Lv3 双层雷纹铁壁）
    const wPush = (minLv: number, key: string, x: number, y = GROUND_Y, scale = 1, depth = D.prop) => {
      const im = prop(key, x, y, depth, undefined, scale);
      this.wallTierObjs.push({ minLv, obj: im });
      return im;
    };
    wPush(1, 'crate', WALL_X - 4);
    wPush(1, 'barbed_wire', WALL_X + 16);
    wPush(2, 'wagon', WALL_X + 2, GROUND_Y, 0.72, D.back);
    wPush(2, 'barrel', WALL_X - 24, GROUND_Y, 1, D.prop);
    wPush(2, 'crate', WALL_X - 6, GROUND_Y - 26, 0.85, D.prop);
    wPush(3, 'crate_stack', WALL_X + 4, GROUND_Y, 0.72, D.back);
    wPush(3, 'barbed_wire', WALL_X + 16, GROUND_Y - 26, 1, D.prop);

    // ── 室内：哥特木石酒馆温馨剖面（扩建宽 720*1.12 ≈ 806px，支持 4 桌 8 座与 4 大件硬体实景显隐） ──
    const intAdd = <T extends { setVisible(v: boolean): void }>(o: T) => { this.intObjs.push(o); return o; };
    intAdd(this.add.image(40, GROUND_Y + 26, 'tavern_interior').setOrigin(0, 1).setScale(1.12).setDepth(D.ground));
    for (const [lx, ly, r, col] of [
      [118, GROUND_Y - 14, 58, C.ember],   // 砖窑炉口炉火暖光
      [302, GROUND_Y - 68, 72, C.lamp],    // 左拱窗与餐桌暖光
      [454, GROUND_Y - 68, 72, C.lamp],    // 中拱窗与扩建区暖光
      [606, GROUND_Y - 68, 72, C.lamp],    // 右拱窗与扩建区暖光
      [718, GROUND_Y - 46, 56, C.lamp],    // 铁砧与军械柜台暖光
    ] as [number, number, number, number][]) {
      intAdd(this.add.pointlight(lx, ly, col, r, 0.22, 0.07).setDepth(D.fx));
    }

    // 4 件实体酒馆装修升级（买入立刻现身：3/4 号扩建橡木桌、双层传菜木架、精铜酒栓吧台、暖琥珀吊灯）
    this.tavernPropTable6 = this.add.image(468, GROUND_Y, 'tavern_prop_table').setOrigin(0, 1).setScale(1.12).setDepth(D.prop - 0.1).setVisible(false);
    this.tavernPropTable8 = this.add.image(578, GROUND_Y, 'tavern_prop_table').setOrigin(0, 1).setScale(1.12).setDepth(D.prop - 0.1).setVisible(false);
    this.tavernPropPass = this.add.image(IN_STATIONS.pass + 4, GROUND_Y, 'tavern_prop_pass').setOrigin(0.5, 1).setScale(1.12).setDepth(D.prop - 0.18).setVisible(false);
    this.tavernPropTap = this.add.image(IN_STATIONS.drink - 10, GROUND_Y, 'tavern_prop_tap').setOrigin(0.5, 1).setScale(1.12).setDepth(D.prop - 0.12).setVisible(false);
    for (const cx of [290, 412, 530, 646]) {
      const ch = this.add.image(cx, GROUND_Y - 82, 'tavern_prop_chandelier').setOrigin(0.5, 0).setScale(1.12).setDepth(D.prop + 0.1).setVisible(false);
      const glow = this.add.pointlight(cx, GROUND_Y - 64, C.gold, 70, 0.28, 0.06).setDepth(D.fx).setVisible(false);
      this.tavernChandObjs.push(ch, glow);
    }

    // ── 角色、独立瞄准手臂/闲置手臂、手持武器、端菜托盘、特效与矢量层 ──
    this.hero = this.add.sprite(0, GROUND_Y, 'hero_idle').setOrigin(0.5, 1).setDepth(D.actor);
    this.hero.play('hero_idle');
    this.heroGun = this.add.image(0, GROUND_Y - 22, 'wp_pistol').setOrigin(0.26, 0.56).setDepth(D.actor + 0.08).setScale(1.04);
    this.heroArm = this.add.image(0, GROUND_Y - 32, 'hero_arm').setOrigin(0.27, 0.44).setDepth(D.actor + 0.1);
    this.carriedDishSprite = this.add.image(0, GROUND_Y, 'ic_dish_skewer').setOrigin(0.5, 1).setDepth(D.actor + 0.15).setScale(0.95).setVisible(false);
    this.overlay = this.add.graphics().setDepth(D.mark);
    this.cameras.main.setBounds(0, 0, WORLD_W, VIEW_H).setRoundPixels(true);

    const grade = this.cameras.main.postFX?.addColorMatrix();
    if (grade) grade.brightness(1.1).saturate(0.14, true);

    // 点击画面：战斗中切换优先集火目标；营地夜晚点击食客/传菜台/酒桶/炮塔位可自动走过去交互
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      const r = game.run;
      if (game.panel() !== null) return;
      if (!r.inside && r.phase === 'fight') {
        game.send({ t: 'focusTarget', x: ptr.worldX, y: ptr.worldY });
      } else if (r.phase === 'camp' && !r.pourMinigame) {
        const wx = Phaser.Math.Clamp(ptr.worldX, r.inside ? 78 : 130, r.inside ? 820 : 620);
        game.walkTo(wx, true);
      }
    });

    game.onEvent((e) => this.onEvent(e));
    this.scale.on('resize', () => this.layout());
    this.layout();
    this.camX = this.targetCamX();
  }

  private layout() {
    const w = this.scale.gameSize.width;
    this.sky.setSize(Math.max(768, w), 288);
    this.town.setSize(Math.max(768, w), 288);
  }

  private targetCamX() {
    const w = this.scale.gameSize.width, run = game.run, p = run.player;
    if (run.inside) {
      // 室内扩建宽 880（涵盖 40..846）：宽屏居中，横屏手机平滑跟随主角
      const roomSpan = 880;
      if (w >= roomSpan) return (roomSpan - w) / 2;
      return Phaser.Math.Clamp(p.x - w * 0.5, 0, roomSpan - w);
    }
    return Phaser.Math.Clamp(p.x - w * 0.3, 0, WORLD_W - w);
  }

  /** 根据主角当前动作与动画帧计算肩膀关节世界坐标与抬枪位置，确保所有姿势无缝接合、绝不穿模浮空 */
  private heroJoints(now: number) {
    const p = game.run.player;
    const animKey = this.hero.anims.currentAnim?.key ?? 'hero_idle';
    const frameIdx = this.hero.anims.currentFrame?.index ?? 1;
    let shXOff = 6;
    let shY = -32;
    if (animKey === 'hero_crouch') {
      shY = frameIdx <= 1 ? -34 : -24;
      shXOff = 6;
    } else if (animKey === 'hero_jump') {
      shY = -37;
      shXOff = 3;
    } else if (animKey === 'hero_fall') {
      shY = -38;
      shXOff = 4;
    } else if (animKey === 'hero_hurt') {
      shY = -37;
      shXOff = 8;
    } else if (animKey === 'hero_run') {
      shY = -31 + Math.sin(now / 65) * 1.1;
      shXOff = 3;
    }
    return {
      shX: p.x - p.facing * shXOff,
      shY: GROUND_Y + p.y + shY,
    };
  }

  private heroMuzzlePos(now: number, ang: number) {
    const { shX, shY } = this.heroJoints(now);
    const grip = WEAPON_GRIP[curWeapon(game.run).id] ?? WEAPON_GRIP.pistol;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const flipSign = Math.abs(ang) > Math.PI / 2 ? -1 : 1;
    const dist = Math.max(4, grip.reach - this.gunRecoil) + grip.muzzle * this.gunPop;
    return {
      x: shX + ca * dist - sa * grip.gyOff * flipSign,
      y: shY + sa * dist + ca * grip.gyOff * flipSign,
    };
  }

  private syncTurretSprites() {
    const run = game.run;
    for (let i = 0; i < run.turrets.length; i++) {
      const slot = run.turrets[i];
      const show = !run.inside && slot.type !== null;
      const curType = this.turretTypes[i];
      if (!show) {
        if (this.turretSprites[i]) this.turretSprites[i]!.setVisible(false);
        continue;
      }
      if (curType !== slot.type) {
        this.turretSprites[i]?.destroy();
        const pos = turretWorldPos(i);
        let sp: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;
        if (slot.type === 'mg') sp = this.add.image(pos.x, pos.baseY - 4, 'turret').setScale(0.66);
        else if (slot.type === 'frost') sp = this.add.sprite(pos.x, pos.baseY - 2, 'turret_frost', 0).play('turret_frost').setScale(0.42);
        else if (slot.type === 'tesla') sp = this.add.image(pos.x, pos.baseY - 4, 'turret_tesla').setScale(0.66);
        else sp = this.add.image(pos.x, pos.baseY - 4, 'turret_cannon').setScale(1);
        sp.setOrigin(0.5, 1).setDepth(D.prop + 0.2);
        this.turretSprites[i] = sp;
        this.turretTypes[i] = slot.type;
      }
      this.turretSprites[i]?.setVisible(true);
    }
  }

  private syncAllies() {
    const run = game.run, inside = run.inside, now = this.time.now;
    const seen = new Set<string>();
    for (const allyId of run.story.allies) {
      const meta = ALLIES[allyId];
      const pos = ALLY_POS[allyId];
      const rt = run.allies[allyId];
      let sp = this.allySprites.get(allyId);
      if (inside && allyRole(run, allyId) === 'dispatch') {
        sp?.setVisible(false);
        continue;
      }
      seen.add(allyId);
      if (!sp) {
        sp = this.add.sprite(0, GROUND_Y, meta.sprite).setOrigin(0.5, 1).setDepth(D.actor - 0.1).setScale(0.92);
        sp.play(meta.sprite);
        this.allySprites.set(allyId, sp);
      }
      const attacking = !inside && !!rt && rt.atkT > 0;
      const moving = !!rt && Math.abs(rt.vx) > 0.05 && allyId !== 'lin';
      const wantAnim = attacking ? `${meta.sprite}_atk` : moving ? `${meta.sprite}_run` : meta.sprite;
      const curSeq = rt?.atkSeq ?? 0;
      const prevSeq = this.allyLastAtkSeq.get(allyId) ?? 0;
      if (wantAnim === `${meta.sprite}_atk`) {
        if (curSeq !== prevSeq || sp.anims.currentAnim?.key !== wantAnim) {
          this.allyLastAtkSeq.set(allyId, curSeq);
          sp.play(wantAnim, true);
        }
      } else {
        if (sp.anims.currentAnim?.key !== wantAnim) sp.play(wantAnim, true);
      }

      const x = rt && typeof rt.x === 'number' ? rt.x : (inside ? pos.intX : pos.extX);
      const baseY = GROUND_Y + (rt && typeof rt.y === 'number' ? rt.y : (inside ? 0 : pos.extY));
      const y = allyId === 'lin' ? baseY + Math.sin(now / 110) * 1.8 : baseY;
      const flip = rt ? rt.facing < 0 : (inside ? pos.intFlip : false);
      sp.setVisible(true).setPosition(x, y).setFlipX(flip);

      if (allyId === 'lin' && !inside && rt && Math.abs(rt.vx) > 0.05 && run.tick % 18 === 0) {
        this.spawnSpark(x, y - 22, Phaser.Math.FloatBetween(-0.25, 0.25), -0.65, 0.01, 16, 2, C.ember);
      }
      if (inside && allyId === 'lin' && rt?.staffTask === 'cook' && run.tick % 24 === 0) {
        this.spawnSpark(IN_STATIONS.kitchen, GROUND_Y - 26, Phaser.Math.FloatBetween(-0.3, 0.3), -0.9, -0.01, 20, 2, C.gold);
      }
      if (!inside && allyId === 'qiang' && rt && rt.state === 'idle' && run.wall.hp > 0 && run.wall.hp < run.wall.maxHp && run.tick % 45 === 0) {
        for (let i = 0; i < 3; i++) {
          this.spawnSpark(WALL_X - 4, GROUND_Y - 18, Phaser.Math.FloatBetween(-1.2, 0.8), Phaser.Math.FloatBetween(-2.2, -0.7), 0.12, 18, 2.1, i === 0 ? C.gold : C.ember, true);
        }
      }
    }
    for (const [id, sp] of this.allySprites) {
      if (!seen.has(id)) {
        sp.destroy();
        this.allySprites.delete(id);
        this.allyLastAtkSeq.delete(id);
      }
    }
  }

  private syncStaff() {
    const run = game.run, inside = run.inside;
    const seen = new Set<string>();
    if (inside) {
      for (const st of run.diner.hiredStaff) {
        if (st.role === 'dispatch') continue;
        const def = staffDef(st.id);
        if (!def) continue;
        seen.add(st.id);
        let sp = this.staffSprites.get(st.id);
        if (!sp) {
          sp = this.add.sprite(st.x, GROUND_Y, def.sprite).setOrigin(0.5, 1).setDepth(D.actor - 0.12).setScale(0.90);
          sp.play(def.sprite);
          this.staffSprites.set(st.id, sp);
        }
        const moving = Math.abs(st.vx) > 0.05;
        const wantAnim = moving ? `${def.sprite}_walk` : def.sprite;
        if (sp.anims.currentAnim?.key !== wantAnim) sp.play(wantAnim, true);
        sp.setVisible(true).setPosition(st.x, GROUND_Y).setFlipX(st.facing < 0);

        const carryDish = st.carrying;
        let carryIm = this.staffDishSprites.get(st.id);
        if (!carryIm) {
          carryIm = this.add.image(st.x, GROUND_Y - 34, 'ic_dish_skewer').setOrigin(0.5, 0.5).setDepth(D.mark).setScale(0.75);
          this.staffDishSprites.set(st.id, carryIm);
        }
        if (carryDish) {
          carryIm.setTexture(dishIconKey(carryDish.dish, carryDish.isRye)).setVisible(true).setPosition(st.x + st.facing * 8, GROUND_Y - 26);
        } else {
          carryIm.setVisible(false);
        }
      }
    }
    for (const [id, sp] of this.staffSprites) {
      if (!seen.has(id)) {
        sp.destroy();
        this.staffSprites.delete(id);
        this.staffDishSprites.get(id)?.destroy();
        this.staffDishSprites.delete(id);
      }
    }
  }

  private syncDinerGuests() {
    const run = game.run, inside = run.inside;
    const seen = new Set<string>();
    const bob = Math.sin(this.time.now / 210) * 1.6;
    if (inside) {
      for (let i = 0; i < run.guests.length; i++) {
        const g = run.guests[i];
        seen.add(g.id);
        let sp = this.guestSprites.get(g.id);
        if (!sp) {
          sp = this.add.sprite(g.x, GROUND_Y, g.sprite).setOrigin(0.5, 1).setDepth(D.prop + 0.3).setScale(0.92);
          sp.play(g.sprite);
          this.guestSprites.set(g.id, sp);
        }
        const wantAnim = g.walkState !== 'seated' ? `${g.sprite}_walk` : g.sprite;
        if (sp.anims.currentAnim?.key !== wantAnim) sp.play(wantAnim);
        sp.setVisible(true).setPosition(g.x, GROUND_Y).setFlipX(g.facing < 0);

        const orderIcon = g.orderKind === 'drink' && g.drink ? DRINKS[g.drink].icon : dishIconKey(g.dish, g.isRye);
        const px = DINER_PLATE_X[g.seatIdx] ?? (g.x + 16);
        const py = GROUND_Y - 32;
        let dishIm = this.guestDishSprites.get(g.id);
        if (!dishIm) {
          dishIm = this.add.image(px, py, orderIcon).setOrigin(0.5, 1).setDepth(D.prop + 0.4).setScale(0.86);
          this.guestDishSprites.set(g.id, dishIm);
        }
        dishIm.setTexture(orderIcon).setVisible(g.served && g.walkState === 'seated').setPosition(px, py);

        let bubbleIm = this.guestBubbleIcons.get(g.id);
        if (!bubbleIm) {
          bubbleIm = this.add.image(g.x, GROUND_Y - 62, orderIcon).setOrigin(0.5, 0.5).setDepth(D.mark + 0.1).setScale(0.82);
          this.guestBubbleIcons.set(g.id, bubbleIm);
        }
        const isDishTarget = g.orderKind === 'dish' && !!run.carryingDish && (
          run.carryingDish.guestId === g.id
          || (!run.guests.some((o) => o.id === run.carryingDish!.guestId && !o.served && o.walkState !== 'leaving') && !g.isRye && g.dish === run.carryingDish.dish)
        );
        const isDrinkTarget = g.orderKind === 'drink' && !!run.carryingDrink && (
          run.carryingDrink.guestId === g.id || run.carryingDrink.drink === g.drink
        );
        const isDeliveryTarget = isDishTarget || isDrinkTarget;
        bubbleIm
          .setTexture(orderIcon)
          .setVisible(!g.served && g.walkState === 'seated')
          .setPosition(g.x, GROUND_Y - 62 + bob)
          .setScale(isDeliveryTarget ? 0.96 : 0.8);
      }
    }
    for (const [id, sp] of this.guestSprites) {
      if (!seen.has(id)) {
        sp.destroy();
        this.guestSprites.delete(id);
        this.guestDishSprites.get(id)?.destroy();
        this.guestDishSprites.delete(id);
        this.guestBubbleIcons.get(id)?.destroy();
        this.guestBubbleIcons.delete(id);
      }
    }

    // 同步餐桌脏盘子与橡木传菜台待送佳肴
    const seenPlates = new Set<number>();
    if (inside) {
      for (const dp of run.dinerShift.dirtyTables) {
        seenPlates.add(dp.id);
        let im = this.dirtyPlateSprites.get(dp.id);
        if (!im) {
          im = this.add.image(dp.x, GROUND_Y - 32, 'ic_dirty_plate').setOrigin(0.5, 1).setDepth(D.prop + 0.42).setScale(0.88);
          this.dirtyPlateSprites.set(dp.id, im);
        }
        im.setVisible(true).setPosition(dp.x, GROUND_Y - 32);
      }
    }
    for (const [pid, im] of this.dirtyPlateSprites) {
      if (!seenPlates.has(pid)) {
        im.destroy();
        this.dirtyPlateSprites.delete(pid);
      }
    }

    const cDishes = inside ? run.dinerShift.counterDishes.slice(0, 5) : [];
    while (this.counterDishSprites.length < cDishes.length) {
      this.counterDishSprites.push(this.add.image(IN_STATIONS.pass, GROUND_Y - 32, 'ic_dish_skewer').setOrigin(0.5, 1).setDepth(D.prop + 0.42).setScale(0.76));
    }
    this.counterDishSprites.forEach((im, i) => {
      const cd = cDishes[i];
      im.setVisible(!!cd);
      if (cd) im.setTexture(dishIconKey(cd.dish, cd.isRye)).setPosition(IN_STATIONS.pass - 14 + i * 7, GROUND_Y - 32);
    });
  }

  update(_t: number, dt: number) {
    const now = this.time.now;
    game.advance(now < this.slowMoUntil ? dt * 0.22 : dt);
    const run = game.run, p = run.player, inside = run.inside;

    // 快速切换室内 / 室外图层与 4 大件硬体装修实景显隐
    for (const o of this.extObjs) o.setVisible(!inside);
    for (const o of this.intObjs) o.setVisible(inside);
    this.tavernPropTable6.setVisible(inside && hasTavernUpgrade(run, 'tables_6'));
    this.tavernPropTable8.setVisible(inside && hasTavernUpgrade(run, 'tables_8'));
    this.tavernPropPass.setVisible(inside && hasTavernUpgrade(run, 'wide_pass'));
    this.tavernPropTap.setVisible(inside && hasTavernUpgrade(run, 'fast_tap'));
    const warmLit = inside && hasTavernUpgrade(run, 'warm_lantern');
    for (const co of this.tavernChandObjs) co.setVisible(warmLit);
    this.sky.setVisible(!inside);
    this.town.setVisible(!inside);

    if (!inside) {
      for (const k of this.fortKeepObjs) (k as Phaser.GameObjects.Image).setVisible(run.fort.level >= 2);
      this.fortCannon.setVisible(run.fort.level >= 2).setScale(run.fort.level >= 3 ? 1.12 : 1);
      const wallAlive = run.wall.hp > 0;
      for (const wt of this.wallTierObjs) {
        wt.obj.setVisible(run.wall.level >= wt.minLv && (wallAlive || wt.minLv === 1)).setAlpha(wallAlive ? 1 : 0.45);
      }
    }
    this.syncTurretSprites();
    this.syncAllies();
    this.syncStaff();
    this.syncDinerGuests();

    // 摄像机跟随 + 开火/暴击/爆炸微震推拉与镜头张力缩放
    const targetX = this.targetCamX();
    if (Math.abs(targetX - this.camX) > 220) this.camX = targetX;
    else this.camX += (targetX - this.camX) * 0.14;
    this.camKickX *= 0.72;
    this.camZoom += (1 - this.camZoom) * 0.2;
    const cam = this.cameras.main;
    if (inside && this.scale.gameSize.width >= 700) cam.setBounds(-120, 0, WORLD_W + 240, VIEW_H);
    else cam.setBounds(0, 0, WORLD_W, VIEW_H);
    cam.setZoom(this.camZoom);
    cam.scrollX = Math.round(this.camX + (inside ? 0 : this.camKickX));
    this.sky.tilePositionX = cam.scrollX * 0.08;
    this.town.tilePositionX = cam.scrollX * 0.25;

    // ── 主角 + 分层独立手臂 + 手持枪械贴图 + 闪避残影 / 绝境反骨白闪 ──
    const want = p.dodgeT > 0 ? 'hero_crouch' : p.hurtT > 10 ? 'hero_hurt' : p.vy < -0.2 ? 'hero_jump' : p.vy > 0.4 ? 'hero_fall'
      : p.shootT > 0 && Math.abs(p.vx) < 0.1 ? 'hero_shoot' : Math.abs(p.vx) > 0.1 ? 'hero_run' : 'hero_idle';
    if (this.hero.anims.currentAnim?.key !== want) this.hero.play(want);
    this.heroSquash *= 0.8;
    const hsy = 1 + this.heroSquash;
    const hsx = 1 - this.heroSquash * 0.55;
    this.hero.setPosition(p.x, GROUND_Y + p.y).setFlipX(p.facing < 0).setScale(hsx, hsy);
    this.hero.setAlpha(p.dodgeT > 0 ? 0.65 : p.hurtT > 0 && Math.floor(now / 60) % 2 ? 0.5 : 1);
    if (now < this.heroFlashUntil) this.hero.setTintFill(C.paper);
    else this.hero.clearTint();

    if (p.dodgeT > 0 && run.tick !== this.afterimageTick && run.tick % 2 === 0) {
      this.afterimageTick = run.tick;
      const ghost = this.add.sprite(p.x, GROUND_Y + p.y, want).setOrigin(0.5, 1).setFlipX(p.facing < 0).setDepth(D.actor - 0.1).setTint((p.perfectDodgeT ?? 0) > 0 ? C.gold : C.frost).setAlpha(0.58);
      this.tweens.add({ targets: ghost, alpha: 0, duration: 170, onComplete: () => ghost.destroy() });
    }

    const activeTarget = run.zombies.find((z) => z.id === run.targetId);
    const curW = curWeapon(run);
    this.gunRecoil *= 0.72;
    this.gunKick *= 0.74;
    this.gunPop += (1 - this.gunPop) * 0.25;
    const gunKey = WEAPONS[curW.id].icon;
    if (this.heroGun.texture.key !== gunKey) this.heroGun.setTexture(gunKey);

    const aliveVis = run.phase !== 'dead';
    this.heroArm.setVisible(aliveVis);
    this.heroGun.setVisible(!inside && aliveVis);
    const carryIcon = run.carryingDish
      ? dishIconKey(run.carryingDish.dish, run.carryingDish.isRye)
      : run.carryingDrink
        ? DRINKS[run.carryingDrink.drink].icon
        : null;
    const carrying = inside && aliveVis && !!carryIcon;

    if (aliveVis) {
      const { shX, shY } = this.heroJoints(now);
      if (inside) {
        // 室内脱枪，垂手轻松漫步或端盘/端酒上桌
        if (this.heroArm.texture.key !== 'hero_arm_rest') this.heroArm.setTexture('hero_arm_rest');
        if (carrying && carryIcon) {
          const bob = Math.abs(p.vx) > 0.1 ? Math.sin(now / 85) * 1.2 : 0;
          this.heroArm
            .setOrigin(0.5, 0.16)
            .setPosition(shX + p.facing * 2, shY - 2)
            .setRotation(-0.85 * p.facing)
            .setFlipX(p.facing < 0)
            .setFlipY(false)
            .setScale(1);
          this.carriedDishSprite
            .setTexture(carryIcon)
            .setPosition(p.x + p.facing * 14, GROUND_Y + p.y - 22 + bob)
            .setVisible(true);
        } else {
          const walkSwing = Math.abs(p.vx) > 0.1 ? Math.sin(now / 85) * 0.28 : Math.sin(now / 420) * 0.03;
          this.heroArm
            .setOrigin(0.5, 0.16)
            .setPosition(shX, shY - 1)
            .setRotation(walkSwing * p.facing)
            .setFlipX(p.facing < 0)
            .setFlipY(false)
            .setScale(1);
          this.carriedDishSprite.setVisible(false);
        }
      } else {
        this.carriedDishSprite.setVisible(false);
        // 室外持枪：独立袖管拳头连接肩膀与枪身，360° 全向瞄准与后坐力退移
        if (this.heroArm.texture.key !== 'hero_arm') this.heroArm.setTexture('hero_arm');
        const rawAng = activeTarget ? Math.atan2(zombieBodyY(activeTarget) - shY, activeTarget.x - shX) : (p.facing > 0 ? 0 : Math.PI);
        const flipSign = Math.abs(rawAng) > Math.PI / 2 ? -1 : 1;
        const ang = rawAng + this.gunKick * flipSign;
        const ca = Math.cos(ang), sa = Math.sin(ang);
        const grip = WEAPON_GRIP[curW.id] ?? WEAPON_GRIP.pistol;

        this.heroArm
          .setOrigin(0.27, 0.44)
          .setPosition(shX - ca * this.gunRecoil * 0.45, shY - sa * this.gunRecoil * 0.45)
          .setRotation(ang)
          .setFlipX(false)
          .setFlipY(flipSign < 0)
          .setScale(1);

        const dist = Math.max(4, grip.reach - this.gunRecoil);
        const fistX = shX + ca * dist - sa * grip.gyOff * flipSign;
        const fistY = shY + sa * dist + ca * grip.gyOff * flipSign;
        this.heroGun
          .setOrigin(grip.ox, grip.oy)
          .setPosition(fistX, fistY)
          .setRotation(ang)
          .setFlipY(flipSign < 0)
          .setScale(grip.scale * this.gunPop);
      }
    } else {
      this.carriedDishSprite.setVisible(false);
    }

    // ── 僵尸与空中魔物（含微卡肉顿帧、震颤抖动、方向性受击后仰角与水平压缩挤压） ──
    const seen = new Set<number>();
    if (!inside) {
      for (const z of run.zombies) {
        seen.add(z.id);
        const def = ZOMBIES[z.kind];
        const zy = GROUND_Y + (z.y ?? 0);
        let s = this.zombies.get(z.id);
        if (!s) {
          const key = def.sprites[z.id % def.sprites.length];
          s = this.add.sprite(z.x, zy, key).setOrigin(0.5, 1).setDepth(D.actor).setScale(def.scale);
          const frameCount = Math.max(1, this.anims.get(key)?.frames.length ?? 1);
          s.play({ key, startFrame: z.id % frameCount });
          this.zombies.set(z.id, s);
        }
        const stopped = (this.hitStopUntil.get(z.id) ?? 0) > now;
        if (s.anims.isPaused !== stopped) {
          if (stopped) s.anims.pause();
          else s.anims.resume();
        }

        const sq = (this.squashUntil.get(z.id) ?? 0) > now;
        const jit = (this.hitJitterUntil.get(z.id) ?? 0) > now
          ? Math.sin(now * 0.55) * 2.4
          : z.stunT > 0 ? Math.sin(now * 0.9 + z.id) * 1.6 : 0;
        const tilt = this.hitTilt.get(z.id) ?? 0;
        if (Math.abs(tilt) > 0.004) this.hitTilt.set(z.id, tilt * 0.78);
        else this.hitTilt.delete(z.id);

        s.setVisible(true)
          .setPosition(z.x + jit, zy)
          .setRotation(tilt)
          .setScale(def.scale * (sq ? 1.18 : 1), def.scale * (sq ? 0.84 : 1));
        if ((this.flashUntil.get(z.id) ?? 0) > now) s.setTintFill(C.paper);
        else if (z.freezeT > 0) s.setTint(C.frost);
        else if (z.stunT > 0) s.setTint(C.electric);
        else if (z.burnT > 0) s.setTint(C.ember);
        else if (z.slowT > 0) s.setTint(C.frost);
        else s.clearTint();
      }
    }
    for (const [id, s] of this.zombies) {
      if (!seen.has(id)) {
        s.destroy();
        this.zombies.delete(id);
        this.flashUntil.delete(id);
        this.squashUntil.delete(id);
        this.hitStopUntil.delete(id);
        this.hitJitterUntil.delete(id);
        this.hitTilt.delete(id);
      }
    }

    // ── 前院火油桶（可引爆物理陷阱）与空投补给伞/武器箱 ──
    const seenBarrels = new Set<number>();
    if (!inside) {
      for (const b of run.barrels) {
        seenBarrels.add(b.id);
        let im = this.barrelSprites.get(b.id);
        if (!im) {
          im = this.add.image(b.x, GROUND_Y, 'barrel').setOrigin(0.5, 1).setDepth(D.prop + 0.16).setTint(C.ember);
          this.barrelSprites.set(b.id, im);
        }
        im.setVisible(true).setPosition(b.x, GROUND_Y);
      }
    }
    for (const [id, im] of this.barrelSprites) if (!seenBarrels.has(id)) { im.destroy(); this.barrelSprites.delete(id); }

    const seenCrates = new Set<number>();
    if (!inside) {
      for (const c of run.crates) {
        seenCrates.add(c.id);
        let im = this.crates.get(c.id);
        if (!im) { im = this.add.image(c.x, GROUND_Y, 'ic_crate').setOrigin(0.5, 1).setDepth(D.actor); this.crates.set(c.id, im); }
        const cy = c.y ?? 0;
        const airborne = cy < -2;
        const sway = c.parachute && airborne ? Math.sin(now / 260 + c.id) * 5 : 0;
        const bob = airborne ? 0 : Math.abs(Math.sin(now / 260)) * 5;
        im.setVisible(true).setPosition(c.x + sway, GROUND_Y + cy - 2 - bob);
      }
    }
    for (const [id, im] of this.crates) if (!seenCrates.has(id)) { im.destroy(); this.crates.delete(id); }

    // ── 子弹、爆炎弹与敌方火球 ──
    while (this.bullets.length < run.bullets.length) this.bullets.push(this.add.sprite(0, 0, 'shot').setDepth(D.fx).play('shot'));
    this.bullets.forEach((s, i) => {
      const b = run.bullets[i];
      const vis = !inside && !!b;
      s.setVisible(vis);
      if (vis && b) {
        s.setPosition(b.x, b.y).setRotation(Math.atan2(b.vy, b.vx));
        if (b.kind === 'firebolt') s.setScale(1.36).setTint(C.ember);
        else if (b.kind === 'spear') s.setScale(1.45, 0.72).setTint(C.paper);
        else if (b.kind === 'qi') s.setScale(1.22).setTint(C.electric);
        else if (b.kind === 'frost' || b.weaponId === 'assault') s.setScale(1.18).setTint(C.frost);
        else if (b.kind === 'rocket') {
          s.setScale(1.55).setTint(C.red);
          if (run.tick % 2 === 0) this.spawnSpark(b.x - b.vx * 0.4, b.y - b.vy * 0.4, -b.vx * 0.14, Phaser.Math.FloatBetween(-0.4, 0.2), 0.02, 12, 2.2, C.ember);
        } else if (b.kind === 'cannon') s.setScale(1.45).setTint(C.copper);
        else if (b.weaponId === 'revolver') s.setScale(1.34).setTint(C.gold);
        else if (b.weaponId === 'shotgun') s.setScale(0.92).setTint(C.ember);
        else if (b.weaponId === 'smg') s.setScale(0.88).setTint(C.lamp);
        else if (b.weaponId === 'pistol') s.setScale(1.06).setTint(C.paper);
        else { s.clearTint(); s.setScale(b.from === 'turret' ? 0.72 : b.from === 'fort' ? 1.25 : 1); }
      }
    });

    while (this.grenadeSprites.length < run.grenades.length) this.grenadeSprites.push(this.add.image(0, 0, 'ic_grenade').setDepth(D.fx));
    this.grenadeSprites.forEach((im, i) => {
      const gr = run.grenades[i];
      im.setVisible(!inside && !!gr);
      if (!inside && gr) im.setPosition(gr.x, gr.y).setRotation(now / 60);
    });

    while (this.enemyProjSprites.length < run.enemyProjs.length) this.enemyProjSprites.push(this.add.sprite(0, 0, 'fx_fireball').setDepth(D.fx).play('fx_fireball'));
    this.enemyProjSprites.forEach((sp, i) => {
      const ep = run.enemyProjs[i];
      sp.setVisible(!inside && !!ep);
      if (!inside && ep) sp.setPosition(ep.x, ep.y).setRotation(Math.atan2(ep.vy, ep.vx));
    });

    // ── 叠加高亮层（冲击波、暴击斩痕、枪口火焰、像素粒子、抛物线、四角准星、血条） ──
    const g = this.overlay; g.clear();

    // 室内炉口温柔火星、餐桌微热气、传菜台/手里刚出锅热菜的「趁热金气」
    if (inside && now > this.hearthTick + 170) {
      this.hearthTick = now;
      this.spawnSpark(118 + Phaser.Math.Between(-10, 10), GROUND_Y - 14, Phaser.Math.FloatBetween(-0.18, 0.18), Phaser.Math.FloatBetween(-0.85, -0.4), -0.008, 32, 2, C.ember);
      for (const guest of run.guests) {
        if (guest.served && guest.walkState === 'seated' && Math.random() < 0.4) {
          this.spawnSpark((DINER_PLATE_X[guest.seatIdx] ?? guest.x) + Phaser.Math.Between(-6, 6), GROUND_Y - 34, 0, -0.4, -0.004, 24, 1.6, C.paper);
        }
      }
      // 传菜台刚出锅 5 秒内热菜冒金热气
      run.dinerShift.counterDishes.slice(0, 5).forEach((cd, idx) => {
        if (!cd.isRye && cd.cookedTick !== undefined && run.tick - cd.cookedTick <= 300) {
          this.spawnSpark(IN_STATIONS.pass - 14 + idx * 7 + Phaser.Math.FloatBetween(-2, 2), GROUND_Y - 40, Phaser.Math.FloatBetween(-0.12, 0.12), -0.68, -0.006, 24, 2.0, C.gold);
        }
      });
      if (run.carryingDish && !run.carryingDish.isRye && run.carryingDish.hotUntilTick !== undefined && run.tick <= run.carryingDish.hotUntilTick) {
        this.spawnSpark(p.x + p.facing * 14, GROUND_Y + p.y - 30, Phaser.Math.FloatBetween(-0.15, 0.15), -0.75, -0.006, 20, 2.0, C.gold);
      }
    }
    this.stepAndDrawSparks(g);
    this.stepAndDrawImpacts(g, now);

    if (inside) {
      // 酒馆沉浸互动：站位高亮 + 食客性格气泡/耐心条 + 脏盘/传菜台/石臼/砖灶进度指示
      const ct = nearbyCampTarget(run);
      if (ct) {
        const sx = ct.x;
        const barW = ct.kind === 'kitchen' ? 56
          : ct.kind === 'grindMortar' ? 34
          : ct.kind === 'pourStart' || ct.kind === 'pourFinish' || ct.kind === 'drink' ? 42
          : ct.kind === 'pass' || ct.kind === 'pickCounter' ? 34
          : ct.kind === 'cleanTable' ? 24
          : ct.kind === 'workshop' ? 56 : ct.kind === 'shop' ? 46 : 32;
        g.fillStyle(C.gold, 0.36).fillRoundedRect(sx - barW / 2, GROUND_Y - 4, barW, 5, 2);
        g.lineStyle(1.4, C.lamp, 0.9).strokeRoundedRect(sx - barW / 2, GROUND_Y - 4, barW, 5, 2);
      }
      // 传菜台刚出锅 5 秒内的热菜托盘金光提示
      run.dinerShift.counterDishes.slice(0, 5).forEach((cd, idx) => {
        if (!cd.isRye && cd.cookedTick !== undefined && run.tick - cd.cookedTick <= 300) {
          const hx = IN_STATIONS.pass - 14 + idx * 7;
          const pulse = 0.65 + Math.sin(now / 110 + idx) * 0.3;
          g.lineStyle(1.6, C.gold, pulse).strokeEllipse(hx, GROUND_Y - 31, 14, 5);
        }
      });
      const bob = Math.sin(now / 210) * 1.6;
      const arrowBob = Math.sin(now / 120) * 2.5;
      const rushOpen = run.dinerShift.mode === 'open';
      for (const guest of run.guests) {
        if (guest.served || guest.walkState !== 'seated') continue;
        const isDishTarget = guest.orderKind === 'dish' && !!run.carryingDish && (
          run.carryingDish.guestId === guest.id
          || (!run.guests.some((o) => o.id === run.carryingDish!.guestId && !o.served && o.walkState !== 'leaving') && !guest.isRye && guest.dish === run.carryingDish.dish)
        );
        const isDrinkTarget = guest.orderKind === 'drink' && !!run.carryingDrink && (
          run.carryingDrink.guestId === guest.id || run.carryingDrink.drink === guest.drink
        );
        const isTarget = isDishTarget || isDrinkTarget;
        const ratio = Math.max(0, Math.min(1, guest.patience / Math.max(1, guest.maxPatience)));
        const isUrgent = rushOpen && ratio < 0.25;
        const isWarOrder = !!guest.isVipRequest;
        const gx = guest.x;
        const gy = GROUND_Y - 62 + bob;
        const bw = isTarget ? 24 : isWarOrder ? 23 : 21;
        const bh = isTarget ? 20 : isWarOrder ? 19 : 18;
        // 熟客加急战备单（叛逆暗号）亮起醒目朱红边框，零新弹窗一眼可辨
        const borderCol = isTarget ? C.gold : (isUrgent || isWarOrder) ? C.red : guest.isRye ? C.grey : guest.trendMatch ? C.ember : C.copper;
        g.fillStyle(C.leather, 0.94).fillRoundedRect(gx - bw / 2, gy - bh / 2, bw, bh, 5);
        g.lineStyle(isTarget || isUrgent || isWarOrder ? 2.2 : 1.4, borderCol, 0.98).strokeRoundedRect(gx - bw / 2, gy - bh / 2, bw, bh, 5);
        if (isWarOrder) {
          const wp = 0.55 + Math.sin(now / 130) * 0.35;
          g.lineStyle(1.3, C.ember, wp).strokeRoundedRect(gx - bw / 2 - 2.5, gy - bh / 2 - 2.5, bw + 5, bh + 5, 6);
        }
        g.fillStyle(C.leather, 0.94).fillTriangle(gx - 3, gy + bh / 2 - 1, gx + 3, gy + bh / 2 - 1, gx, gy + bh / 2 + 4);
        // 加急战备单红钻角标 + 性格角标色点（急客红、老饕金、酒客琥珀）
        if (isWarOrder) {
          g.fillStyle(C.red, 1).fillCircle(gx - bw / 2 + 2, gy - bh / 2 + 2, 2.8);
          g.fillStyle(C.gold, 1).fillCircle(gx - bw / 2 + 2, gy - bh / 2 + 2, 1.1);
        }
        if (guest.personality !== 'regular') {
          const pAccent = guest.personality === 'hurried' ? C.red : guest.personality === 'gourmet' ? C.gold : C.lamp;
          g.fillStyle(pAccent, 1).fillCircle(gx + bw / 2 - 2, gy - bh / 2 + 2, 2.3);
        }
        if (rushOpen) {
          const pw = 22, py = gy + bh / 2 + 5;
          const pCol = ratio > 0.55 ? C.green : ratio > 0.25 ? C.gold : C.red;
          g.fillStyle(C.ink, 0.9).fillRoundedRect(gx - pw / 2, py, pw, 3.5, 1.5);
          g.fillStyle(pCol, 1).fillRect(gx - pw / 2 + 1, py + 0.8, Math.max(1, (pw - 2) * ratio), 2);
        }
        if (isTarget) {
          g.fillStyle(C.gold, 0.98).fillTriangle(gx - 5, gy - bh / 2 - 8 + arrowBob, gx + 5, gy - bh / 2 - 8 + arrowBob, gx, gy - bh / 2 - 2 + arrowBob);
        }
      }
      // 雇佣伙计标识环与忙碌动作条（与坐席顾客/战友一目区分）
      for (const st of run.diner.hiredStaff) {
        if (st.role === 'dispatch') continue;
        const ringCol = st.role === 'kitchen' ? C.ember : st.role === 'rest' ? C.grey : C.lamp;
        g.lineStyle(1.4, ringCol, 0.78).strokeEllipse(st.x, GROUND_Y - 1, 18, 5);
        if (rushOpen && st.taskT > 0) {
          const pct = Math.min(1, st.taskT / 38);
          g.fillStyle(C.ink, 0.9).fillRoundedRect(st.x - 10, GROUND_Y - 48, 20, 3.5, 1);
          g.fillStyle(C.green, 0.98).fillRect(st.x - 9, GROUND_Y - 47, Math.max(2, 18 * pct), 1.8);
        }
      }
      if (rushOpen && !run.carryingDish && !run.carryingDrink) {
        for (const dp of run.dinerShift.dirtyTables) {
          g.fillStyle(C.ember, 0.95).fillTriangle(dp.x - 4, GROUND_Y - 52 + arrowBob, dp.x + 4, GROUND_Y - 52 + arrowBob, dp.x, GROUND_Y - 46 + arrowBob);
        }
        if (run.dinerShift.counterDishes.length > 0) {
          const cx = IN_STATIONS.pass;
          g.fillStyle(C.gold, 0.95).fillTriangle(cx - 4, GROUND_Y - 52 + arrowBob, cx + 4, GROUND_Y - 52 + arrowBob, cx, GROUND_Y - 46 + arrowBob);
        }
      }
      // 端菜/端酒时绘制金色方向导引线直指目标食客，再也不用满屋找人
      if (run.carryingDish || run.carryingDrink) {
        const dest = run.carryingDish
          ? (run.guests.find((o) => o.id === run.carryingDish!.guestId && !o.served && o.walkState === 'seated')
            ?? run.guests.find((o) => o.orderKind === 'dish' && !o.served && o.walkState === 'seated' && !o.isRye && o.dish === run.carryingDish!.dish))
          : (run.guests.find((o) => o.id === run.carryingDrink!.guestId && !o.served && o.walkState === 'seated')
            ?? run.guests.find((o) => o.orderKind === 'drink' && !o.served && o.walkState === 'seated' && o.drink === run.carryingDrink!.drink));
        if (dest) {
          const dx = dest.x - p.x;
          const dir = dx >= 0 ? 1 : -1;
          if (Math.abs(dx) > 22) {
            const ax = p.x + dir * (22 + Math.sin(now / 110) * 3);
            const ay = GROUND_Y - 26;
            g.fillStyle(C.gold, 0.96).fillTriangle(ax + dir * 7, ay, ax - dir * 3, ay - 5, ax - dir * 3, ay + 5);
            g.lineStyle(1.4, C.gold, 0.52).lineBetween(p.x + dir * 12, GROUND_Y - 2, dest.x - dir * 12, GROUND_Y - 2);
          }
          g.lineStyle(1.8, C.gold, 0.85).strokeEllipse(dest.x, GROUND_Y - 1, 26, 7);
        }
      }
      if (game.walkTarget) {
        const wt = game.walkTarget.x;
        const pulse = 1 + Math.sin(now / 90) * 0.14;
        g.lineStyle(1.5, C.gold, 0.78).strokeEllipse(wt, GROUND_Y - 1, 18 * pulse, 5 * pulse);
      }
      // 砖灶自动烹制进度条
      if (rushOpen) {
        const s = run.dinerShift;
        const activeOrders = s.kitchenOrders.slice(0, stoveCapacity(run));
        activeOrders.forEach((o, idx) => {
          const ky = GROUND_Y - 66 - idx * 10;
          const tw = 38, th = 6;
          const left = IN_STATIONS.kitchen - tw / 2;
          const prog = Phaser.Math.Clamp(1 - o.ticksLeft / Math.max(1, o.totalTicks), 0, 1);
          g.fillStyle(C.ink, 0.92).fillRoundedRect(left - 1, ky - 1, tw + 2, th + 2, 2);
          g.fillStyle(o.isRye ? C.grey : C.ember, 0.95).fillRect(left, ky, Math.max(2, tw * prog), th);
          g.lineStyle(1, C.gold, 0.9).strokeRoundedRect(left - 1, ky - 1, tw + 2, th + 2, 2);
        });
      }
      if (run.pourMinigame) {
        const dx = IN_STATIONS.drink;
        const dy = GROUND_Y - 72;
        const tw = 58, th = 9;
        const left = dx - tw / 2;
        const fast = run.diner.upgrades.includes('fast_tap');
        const lo = fast ? 0.70 : 0.74, hi = fast ? 0.92 : 0.90;
        const f = Phaser.Math.Clamp(run.pourMinigame.fill, 0, 1);
        g.fillStyle(C.ink, 0.92).fillRoundedRect(left - 2, dy - 2, tw + 4, th + 4, 3);
        g.fillStyle(C.woodDark, 0.95).fillRoundedRect(left, dy, tw, th, 2);
        g.fillStyle(C.lamp, 0.45).fillRect(left + lo * tw, dy + 1, (hi - lo) * tw, th - 2);
        g.fillStyle(C.gold, 0.9).fillRect(left + 0.80 * tw, dy + 1, 0.04 * tw, th - 2);
        g.fillStyle(f >= lo && f <= hi ? C.gold : C.ember, 0.95).fillRect(left, dy + 1.5, f * tw, th - 3);
        g.lineStyle(1.4, C.gold, 0.95).strokeRoundedRect(left - 1, dy - 1, tw + 2, th + 2, 2);
      }
      return;
    }

    // 拖拽爆炎弹时绘制真实物理解算出的抛物线曲线与落地爆区预警圈
    if (game.grenadeAim && run.phase === 'fight' && p.grenades > 0) {
      const traj = computeGrenadeThrow(run, game.grenadeAim);
      let px = traj.sx, py = traj.sy, vx = traj.vx, vy = traj.vy;
      let landX = px, landY = GROUND_Y - 4;
      for (let f = 0; f < 84; f++) {
        px += vx; py += vy; vy += traj.g;
        landX = px;
        const hitZ = run.zombies.some((z) => z.hp > 0 && Math.abs(px - z.x) <= 18
          && py >= GROUND_Y + (z.y ?? 0) - (ZOMBIES[z.kind].boss ? 96 : z.kind === 'bat' ? 28 : 48)
          && py <= GROUND_Y + (z.y ?? 0) + 6);
        if (hitZ || py >= GROUND_Y - 4) { landY = Math.min(GROUND_Y - 4, py); break; }
        if (f % 2 === 0 && px >= 0 && px <= WORLD_W) {
          const t = Math.max(0.35, 1 - f / 90);
          g.fillStyle(C.ink, t * 0.8).fillCircle(px, py, 2.8);
          g.fillStyle(f % 4 === 0 ? C.gold : C.paper, t).fillCircle(px, py, 1.7);
        }
      }
      const pulse = 1 + Math.sin(now / 85) * 0.06;
      const blastR = 66 * pulse;
      if (landY < GROUND_Y - 10) g.lineStyle(1.2, C.gold, 0.55).lineBetween(landX, landY, landX, GROUND_Y - 1);
      g.fillStyle(C.ember, 0.16).fillEllipse(landX, GROUND_Y - 1, blastR * 2, 22 * pulse);
      g.lineStyle(2, C.gold, 0.9).strokeEllipse(landX, GROUND_Y - 1, blastR * 2, 22 * pulse);
      g.lineStyle(1.6, C.red, 0.95)
        .lineBetween(landX - 7, landY - 5, landX + 7, landY + 5)
        .lineBetween(landX - 7, landY + 5, landX + 7, landY - 5);
      for (const z of run.zombies) {
        if (Math.abs(z.x - landX) <= 66) g.lineStyle(1.6, C.gold, 0.95).strokeEllipse(z.x, GROUND_Y + (z.y ?? 0) - 1, 28, 9);
      }
    }

    // 焦土爆炎炮残余火海地面特效
    for (const f of run.fires) {
      const fade = Math.min(1, f.t / 45);
      const flick = 0.85 + Math.sin(now * 0.03 + f.x) * 0.15;
      g.fillStyle(C.ember, 0.24 * fade).fillEllipse(f.x, GROUND_Y - 1, f.r * 1.9 * flick, 11);
      g.fillStyle(C.red, 0.34 * fade).fillEllipse(f.x, GROUND_Y - 1, f.r * 1.25 * flick, 7);
      g.fillStyle(C.gold, 0.55 * fade).fillEllipse(f.x, GROUND_Y - 2, f.r * 0.55, 4);
      if (run.tick % 4 === 0) {
        this.spawnSpark(f.x + Phaser.Math.FloatBetween(-f.r * 0.7, f.r * 0.7), GROUND_Y - 2, Phaser.Math.FloatBetween(-0.25, 0.25), Phaser.Math.FloatBetween(-1.3, -0.5), -0.02, 18, 2.1, C.gold);
      }
    }

    // ── 动态黑夜天象（浓雾 / 血雨 / 狂风）纯画面氛围层 ──
    if (run.weather === 'fog') {
      const drift = (now * 0.018) % 240;
      for (let i = 0; i < 4; i++) {
        const fx = 340 + ((i * 195 + drift) % 680) - 40;
        const fy = GROUND_Y - 14 - (i % 2) * 32;
        g.fillStyle(C.haze, 0.14).fillEllipse(fx, fy, 230, 52);
      }
      g.fillStyle(C.night, 0.14).fillRect(360, 0, WORLD_W - 360, GROUND_Y + 6);
      // 屋顶与门廊煤油灯光圈更亮，提示高地暴击大幅提升
      g.fillStyle(C.lamp, 0.13).fillCircle(166, GROUND_Y + ROOF_Y - 12, 92);
      g.fillStyle(C.gold, 0.09).fillCircle(266, GROUND_Y + PORCH_Y - 10, 52);
    } else if (run.weather === 'bloodrain') {
      const camL = Math.max(0, this.camX - 30);
      const camR = camL + this.scale.gameSize.width + 60;
      g.lineStyle(1.2, C.red, 0.42);
      for (let i = 0; i < 34; i++) {
        const rx = camL + ((i * 53 + Math.floor(now * 0.22) * 3) % Math.max(120, camR - camL));
        const ry = ((i * 37 + Math.floor(now * 0.36)) % (GROUND_Y + 6)) - 6;
        g.lineBetween(rx, ry, rx - 5, ry + 13);
        if (ry > GROUND_Y - 14) {
          g.lineStyle(1, C.rose, 0.35).lineBetween(rx - 7, GROUND_Y - 1, rx - 2, GROUND_Y - 3);
          g.lineStyle(1.2, C.red, 0.42);
        }
      }
    } else if (run.weather === 'gale') {
      const camL = Math.max(0, this.camX - 40);
      const span = this.scale.gameSize.width + 80;
      for (let i = 0; i < 16; i++) {
        const wx = camL + ((i * 89 + Math.floor(now * 0.42)) % Math.max(160, span));
        const wy = 24 + (i * 19) % (GROUND_Y - 34);
        const len = 28 + (i % 3) * 14;
        g.lineStyle(1.2, i % 3 === 0 ? C.paper : C.haze, 0.28).lineBetween(wx, wy, wx + len, wy + 2);
      }
    }

    // ── 前院火油桶视觉提示（红漆危险环 + 敌怪靠近或点击锁定时脉动引爆提示）──
    for (const b of run.barrels) {
      const enemyNear = run.zombies.some((z) => z.hp > 0 && Math.abs(z.x - b.x) <= 96);
      const isPri = run.priorityBarrelId === b.id;
      const pulse = 0.65 + Math.sin(now / 110 + b.id) * 0.3;
      g.fillStyle(C.red, 0.85).fillRect(b.x - 8, GROUND_Y - 17, 16, 4);
      if (enemyNear || isPri) {
        g.lineStyle(1.8, isPri ? C.gold : C.ember, pulse).strokeEllipse(b.x, GROUND_Y - 2, 34, 9);
        g.lineStyle(1.6, isPri ? C.gold : C.red, 0.92).strokeCircle(b.x, GROUND_Y - 14, 12 + Math.sin(now / 90) * 1.6);
        if (run.tick % 6 === 0) {
          this.spawnSpark(b.x + Phaser.Math.FloatBetween(-6, 6), GROUND_Y - 22, Phaser.Math.FloatBetween(-0.2, 0.2), -0.9, -0.01, 14, 2, C.gold);
        }
      }
    }

    // ── 空投补给伞穹顶与绳索（可击落砸晕敌群）──
    for (const c of run.crates) {
      const cy = c.y ?? 0;
      if (cy >= -4) continue;
      const sway = c.parachute ? Math.sin(now / 260 + c.id) * 5 : 0;
      const cx = c.x + sway;
      const boxTopY = GROUND_Y + cy - 18;
      if (c.parachute) {
        const domeY = boxTopY - 20;
        g.lineStyle(1.2, C.paper, 0.82)
          .lineBetween(cx - 14, domeY + 2, cx - 5, boxTopY)
          .lineBetween(cx + 14, domeY + 2, cx + 5, boxTopY)
          .lineBetween(cx, domeY + 1, cx, boxTopY);
        g.fillStyle(C.paper, 0.92).fillEllipse(cx, domeY, 34, 14);
        g.fillStyle(C.red, 0.85).fillEllipse(cx, domeY - 2, 14, 11);
        g.lineStyle(1.4, C.woodDark, 0.9).strokeEllipse(cx, domeY, 34, 14);
        if (run.priorityCrateId === c.id) {
          g.lineStyle(1.8, C.gold, 0.95).strokeCircle(cx, domeY + 6, 18);
        }
      } else {
        // 伞绳已断高速砸落风痕
        g.lineStyle(1.8, C.paper, 0.72)
          .lineBetween(cx - 7, boxTopY - 16, cx - 7, boxTopY - 2)
          .lineBetween(cx + 7, boxTopY - 14, cx + 7, boxTopY - 2);
        g.lineStyle(1.5, C.gold, 0.85).strokeEllipse(c.x, GROUND_Y - 1, 36, 9);
      }
    }

    // 屋顶 / 门廊高地防守增益光环与矮墙护线 + 绝境反骨暴击弹金色光环
    const hb = houseBuff(run);
    if (run.phase !== 'dead' && hb.zone !== 'ground') {
      const col = hb.zone === 'roof' ? C.gold : C.copper;
      const pulse = 0.65 + Math.sin(now / 260) * 0.2;
      const py = GROUND_Y + (hb.zone === 'roof' ? ROOF_Y : PORCH_Y);
      const px1 = hb.zone === 'roof' ? ROOF_MIN_X + 6 : PORCH_MIN_X + 4;
      const px2 = hb.zone === 'roof' ? ROOF_MAX_X - 4 : PORCH_MAX_X - 4;
      g.lineStyle(hb.zone === 'roof' ? 2.2 : 1.5, col, 0.48 * pulse).lineBetween(px1, py - 1, px2, py - 1);
      if (hb.zone === 'roof' && run.fort.level >= 2) {
        g.lineStyle(1.4, C.lamp, 0.55 * pulse).lineBetween(px1, py - 5, px2, py - 5);
      }
      g.fillStyle(col, 0.18).fillEllipse(p.x, py - 1, 28, 7);
      g.lineStyle(1.4, col, 0.78).strokeEllipse(p.x, py - 1, 28, 7);
    }
    if (run.phase === 'fight' && (p.rebelCritShots ?? 0) > 0) {
      const py = GROUND_Y + p.y;
      const pulse = 0.7 + Math.sin(now / 80) * 0.25;
      g.lineStyle(2.0, C.gold, pulse).strokeEllipse(p.x, py - 2, 32, 9);
      for (let i = 0; i < Math.min(3, p.rebelCritShots ?? 0); i++) {
        g.fillStyle(C.gold, 0.96).fillCircle(p.x - 6 + i * 6, py - 48, 2.2);
      }
    }

    // 特色子弹拖尾（左轮金痕 / 连珠火铳炽焰弹 / 寒霜冰晶痕 / 战友银枪与苍蓝气劲）
    for (const b of run.bullets) {
      if (b.kind === 'firebolt') {
        g.lineStyle(2.4, C.ember, 0.82).lineBetween(b.x - b.vx * 1.3, b.y - b.vy * 1.3, b.x, b.y);
      } else if (b.kind === 'spear') {
        g.lineStyle(2.2, C.paper, 0.86).lineBetween(b.x - b.vx * 1.5, b.y - b.vy * 1.5, b.x, b.y);
      } else if (b.kind === 'qi') {
        g.lineStyle(2.2, C.electric, 0.84).lineBetween(b.x - b.vx * 1.3, b.y - b.vy * 1.3, b.x, b.y);
      } else if (b.weaponId === 'revolver') {
        g.lineStyle(2.0, C.gold, 0.75).lineBetween(b.x - b.vx * 1.4, b.y - b.vy * 1.4, b.x, b.y);
      } else if (b.weaponId === 'assault') {
        g.lineStyle(1.6, C.frost, 0.65).lineBetween(b.x - b.vx * 1.1, b.y - b.vy * 1.1, b.x, b.y);
      }
    }

    // 僵尸与空中魔物深冻冰壳、麻痹电弧、提灯怨灵蓄光前摇与焦骨巨尸重击蓄力预警
    for (const z of run.zombies) {
      const zy = GROUND_Y + (z.y ?? 0);
      const zh = z.kind === 'bat' ? 26 : 38;
      if (z.freezeT > 0) {
        g.fillStyle(C.frost, 0.22).fillRoundedRect(z.x - 13, zy - zh - 2, 26, zh, 4);
        g.lineStyle(1.5, C.paper, 0.75).strokeRoundedRect(z.x - 13, zy - zh - 2, 26, zh, 4);
      }
      if (z.stunT > 0 && Math.floor(now / 70 + z.id) % 2 === 0) {
        g.lineStyle(1.4, C.electric, 0.9)
          .lineBetween(z.x - 10, zy - zh * 0.85, z.x + 2, zy - zh * 0.55)
          .lineBetween(z.x + 2, zy - zh * 0.55, z.x - 6, zy - zh * 0.25);
      }
      if ((z.chargeT ?? 0) > 0) {
        const frac = Math.max(0, Math.min(1, (z.chargeT ?? 0) / Math.max(1, z.chargeMax ?? 36)));
        if (z.kind === 'ghoul') {
          // 提灯怨灵蓄光前摇：收缩翠金光圈，命中即打灯破招
          const lx = z.x - 9, ly = zy - 24;
          g.lineStyle(2.2, C.infected, 0.95).strokeCircle(lx, ly, 6 + frac * 14);
          g.fillStyle(C.gold, 0.75).fillCircle(lx, ly, 4 + (1 - frac) * 3);
        } else if (z.kind === 'bruiser') {
          // 焦骨巨尸重砸前摇：猩红脉冲警告环，重击/暴击可破防或完美闪避
          g.lineStyle(2.4, C.red, 0.92).strokeCircle(z.x, zy - 28, 12 + frac * 12);
          g.lineStyle(1.4, C.ember, 0.85).strokeEllipse(z.x, zy - 2, 34, 9);
        }
      }
    }

    // 室外电弧、圣铳符文光束与 Lv.3 雷纹铁壁火花
    this.bolts = this.bolts.filter((bf) => bf.until > now);
    for (const bf of this.bolts) {
      const alpha = Math.min(1, (bf.until - now) / 140);
      if (bf.straight && bf.pts.length >= 2) {
        const a = bf.pts[0], b = bf.pts[1];
        g.lineStyle(bf.crit ? 9 : 6, bf.color, alpha * 0.5).lineBetween(a.x, a.y, b.x, b.y);
        g.lineStyle(bf.crit ? 4 : 2.5, C.gold, alpha * 0.94).lineBetween(a.x, a.y, b.x, b.y);
        g.lineStyle(bf.crit ? 2 : 1.2, C.paper, alpha).lineBetween(a.x, a.y, b.x, b.y);
        continue;
      }
      g.lineStyle(3.2, bf.color, alpha * 0.45);
      for (let i = 0; i < bf.pts.length - 1; i++) {
        const a = bf.pts[i], b = bf.pts[i + 1];
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 + ((i % 2 ? 1 : -1) * 9);
        g.lineBetween(a.x, a.y, mx, my);
        g.lineBetween(mx, my, b.x, b.y);
      }
      g.lineStyle(1.2, C.paper, alpha);
      for (let i = 0; i < bf.pts.length - 1; i++) {
        const a = bf.pts[i], b = bf.pts[i + 1];
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 + ((i % 2 ? 1 : -1) * 9);
        g.lineBetween(a.x, a.y, mx, my);
        g.lineBetween(mx, my, b.x, b.y);
      }
    }
    if (run.wall.level >= 3 && run.wall.hp > 0) {
      const flick = (Math.floor(now / 90) % 2 === 0);
      g.lineStyle(1.5, C.electric, flick ? 0.85 : 0.4).lineBetween(WALL_X - 4, GROUND_Y - 48, WALL_X + 26, GROUND_Y - 14);
    }

    // 营地夜晚室外标识（房门进屋、战友脚底高亮、4 处炮塔等级点）
    for (let i = 0; i < run.turrets.length; i++) {
      const sl = run.turrets[i], pos = turretWorldPos(i);
      if (sl.type) {
        for (let lv = 0; lv < sl.level; lv++) g.fillStyle(C.gold, 0.95).fillCircle(pos.x - 4 + lv * 4, pos.baseY + 4, 1.5);
      } else if (run.phase === 'camp') {
        g.lineStyle(1, C.copper, 0.55).strokeRect(pos.x - 10, pos.baseY - 12, 20, 12);
      }
    }
    if (run.phase === 'camp') {
      const bob = Math.sin(now / 180) * 3;
      g.fillStyle(C.lamp, 0.9).fillTriangle(DOOR_X - 5, GROUND_Y - 54 + bob, DOOR_X + 5, GROUND_Y - 54 + bob, DOOR_X, GROUND_Y - 46 + bob);
      g.fillStyle(C.lamp, 0.9).fillTriangle(LADDER_X - 5, GROUND_Y + PORCH_Y - 42 + bob, LADDER_X + 5, GROUND_Y + PORCH_Y - 42 + bob, LADDER_X, GROUND_Y + PORCH_Y - 34 + bob);
      const extCt = nearbyCampTarget(run);
      if (extCt) {
        const ey = extCt.kind === 'allyTalk' ? GROUND_Y + ALLY_POS[extCt.ally].extY
          : (extCt.kind === 'turretSlot' || extCt.kind === 'wallSpot' || extCt.kind === 'fortSpot') ? GROUND_Y + extCt.y
          : GROUND_Y;
        const bw = extCt.kind === 'wallSpot' || extCt.kind === 'fortSpot' ? 42 : 34;
        g.fillStyle(C.gold, 0.36).fillRoundedRect(extCt.x - bw / 2, ey - 4, bw, 5, 2);
        g.lineStyle(1.6, C.lamp, 0.95).strokeRoundedRect(extCt.x - bw / 2, ey - 4, bw, 5, 2);
        if (extCt.kind === 'turretSlot' || extCt.kind === 'wallSpot' || extCt.kind === 'fortSpot') {
          g.fillStyle(C.gold, 0.96).fillTriangle(extCt.x - 5, ey - 32 + bob, extCt.x + 5, ey - 32 + bob, extCt.x, ey - 24 + bob);
        }
      }
      if (game.walkTarget) {
        const wt = game.walkTarget.x;
        const pulse = 1 + Math.sin(now / 90) * 0.14;
        g.lineStyle(1.5, C.gold, 0.78).strokeEllipse(wt, GROUND_Y + p.y - 1, 18 * pulse, 5 * pulse);
      }
    }

    // 元气骑士式锁定准星（四角收缩锁敌框 + 脚底/翼底脉动光圈，优先集火目标镶金色外环）
    const target = run.zombies.find((z) => z.id === run.targetId);
    if (target) {
      const ty = GROUND_Y + (target.y ?? 0);
      const sp = this.zombies.get(target.id);
      const h = sp?.displayHeight ?? (target.kind === 'bat' ? 28 : 46);
      const w = ZOMBIES[target.kind].boss ? 22 : 13;
      const isPri = target.id === run.priorityId;
      const col = isPri ? C.gold : C.red;
      const pulse = Math.sin(now / 110) * 2;
      const rx = w + pulse, top = ty - h - pulse, bot = ty - 2 + pulse * 0.5, arm = 5;
      g.lineStyle(1.8, col, 0.92).strokeEllipse(target.x, ty - 1, (w * 2 + 4) + pulse * 2, 9);
      g.lineStyle(2, col, 0.98)
        .lineBetween(target.x - rx, top, target.x - rx + arm, top).lineBetween(target.x - rx, top, target.x - rx, top + arm)
        .lineBetween(target.x + rx, top, target.x + rx - arm, top).lineBetween(target.x + rx, top, target.x + rx, top + arm)
        .lineBetween(target.x - rx, bot, target.x - rx + arm, bot).lineBetween(target.x - rx, bot, target.x - rx, bot - arm)
        .lineBetween(target.x + rx, bot, target.x + rx - arm, bot).lineBetween(target.x + rx, bot, target.x + rx, bot - arm);
      g.fillStyle(col, 0.95).fillTriangle(target.x - 4, top - 8, target.x + 4, top - 8, target.x, top - 2);
    }
    for (const z of run.zombies) {
      const isBoss = ZOMBIES[z.kind].boss;
      if (!isBoss && z.hp >= z.maxHp) continue;
      const w = isBoss ? 44 : 22;
      const zy = GROUND_Y + (z.y ?? 0);
      const y = zy - (this.zombies.get(z.id)?.displayHeight ?? (z.kind === 'bat' ? 28 : 46)) - 8;
      g.fillStyle(C.ink, 0.88).fillRect(z.x - w / 2, y, w, isBoss ? 5 : 4);
      g.fillStyle(isBoss ? C.gold : C.red, 1).fillRect(z.x - w / 2 + 1, y + 1, (w - 2) * Math.max(0, z.hp / z.maxHp), isBoss ? 3 : 2);
    }
  }

  private spawnSpark(x: number, y: number, vx: number, vy: number, g: number, max: number, size: number, col: number, bounce = false) {
    if (this.sparks.length >= 160) this.sparks.shift();
    this.sparks.push({ x, y, vx, vy, g, life: max, max, size, col, bounce });
  }

  private stepAndDrawSparks(g: Phaser.GameObjects.Graphics) {
    const out: Spark[] = [];
    for (const s of this.sparks) {
      s.x += s.vx; s.y += s.vy; s.vy += s.g; s.life--;
      if (s.bounce && s.y >= GROUND_Y - 1 && s.vy > 0) { s.y = GROUND_Y - 1; s.vy *= -0.45; s.vx *= 0.72; }
      if (s.life <= 0) continue;
      g.fillStyle(s.col, Math.min(1, s.life / (s.max * 0.45))).fillRect(s.x - s.size * 0.5, s.y - s.size * 0.5, s.size, s.size);
      out.push(s);
    }
    this.sparks = out;
  }

  private stepAndDrawImpacts(g: Phaser.GameObjects.Graphics, now: number) {
    const nextW: Shockwave[] = [];
    for (const wv of this.waves) {
      wv.life--;
      if (wv.life <= 0) continue;
      const t = 1 - wv.life / wv.max;
      const curR = wv.r + (wv.maxR - wv.r) * (1 - (1 - t) * (1 - t));
      const alpha = (1 - t) * 0.9;
      g.lineStyle(Math.max(1, wv.width * (1 - t * 0.65)), wv.col, alpha).strokeCircle(wv.x, wv.y, curR);
      nextW.push(wv);
    }
    this.waves = nextW;

    this.slashes = this.slashes.filter((sl) => sl.until > now);
    for (const sl of this.slashes) {
      const a = Math.min(1, (sl.until - now) / 95);
      const dx = Math.cos(sl.ang) * sl.len, dy = Math.sin(sl.ang) * sl.len;
      g.lineStyle(4.2, sl.col, a * 0.55).lineBetween(sl.x - dx * 0.35, sl.y - dy * 0.35, sl.x + dx, sl.y + dy);
      if (sl.core !== false) {
        g.lineStyle(1.6, C.paper, a).lineBetween(sl.x - dx * 0.15, sl.y - dy * 0.15, sl.x + dx * 0.85, sl.y + dy * 0.85);
      }
    }
  }

  private burst(key: string, x: number, y: number, scale = 1) {
    const s = this.add.sprite(x, y, key).setDepth(D.fx).setScale(scale);
    s.play(key); s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => s.destroy());
    return s;
  }

  private onEvent(e: GameEvent) {
    const now = this.time.now;
    switch (e.t) {
      case 'shot':
        if (game.run.inside) return;
        if (e.from === 'player') {
          const wId = e.weapon ?? 'pistol';
          const grip = WEAPON_GRIP[wId] ?? WEAPON_GRIP.pistol;
          const ang = e.ang ?? (game.run.player.facing > 0 ? 0 : Math.PI);
          const tip = this.heroMuzzlePos(now, ang);
          this.burst('shot_hit', tip.x, tip.y, wId === 'smg' ? (e.hot ? 1.25 : 0.9) : 1.15);
          // 枪口爆焰斜线 + 后坐力 + 退壳 + 方向性机位推拉
          const flashCol = wId === 'tesla' ? C.electric : wId === 'assault' ? C.frost : wId === 'rifle' ? C.red : e.hot || wId === 'shotgun' ? C.ember : C.gold;
          this.slashes.push({ x: tip.x, y: tip.y, ang, len: wId === 'shotgun' || wId === 'rifle' ? 15 : e.hot ? 12 : 9, col: flashCol, until: now + 75 });
          this.slashes.push({ x: tip.x, y: tip.y, ang: ang + (wId === 'shotgun' ? 0.5 : 0.35), len: wId === 'shotgun' ? 9 : 6, col: wId === 'shotgun' ? C.ember : C.lamp, until: now + 60, core: false });
          this.slashes.push({ x: tip.x, y: tip.y, ang: ang - (wId === 'shotgun' ? 0.5 : 0.35), len: wId === 'shotgun' ? 9 : 6, col: wId === 'shotgun' ? C.ember : C.lamp, until: now + 60, core: false });
          this.gunRecoil = grip.recoil;
          this.gunKick = -grip.kick;
          this.camKickX = -Math.cos(ang) * (wId === 'smg' ? (e.hot ? 2.4 : 1.4) : wId === 'shotgun' || wId === 'rifle' || wId === 'rocket' ? 5.2 : 2.8);
          const shellCol = wId === 'tesla' ? C.electric : wId === 'rifle' ? C.red : e.hot ? C.ember : C.gold;
          this.spawnSpark(
            tip.x - Math.cos(ang) * 8, tip.y - 1,
            -game.run.player.facing * Phaser.Math.FloatBetween(1.1, 2.2), Phaser.Math.FloatBetween(-2.8, -1.6),
            0.14, 30, 2.2, shellCol, true,
          );
          if (grip.shake > 0) this.cameras.main.shake(wId === 'rocket' || wId === 'rifle' ? 75 : 50, grip.shake);
        } else {
          this.burst('shot_hit', e.x + 6, e.y, 0.78);
          if (e.from === 'ally' && e.ally) {
            const sp = this.allySprites.get(e.ally);
            const rt = game.run.allies[e.ally];
            if (sp && !game.run.inside) {
              if (e.ally === 'qiang') {
                const qx = rt?.x ?? ALLY_POS.qiang.extX;
                const qy = GROUND_Y + (rt?.y ?? ALLY_POS.qiang.extY) - 22;
                this.waves.push({ x: qx, y: qy, r: 8, maxR: 54, col: C.ember, life: 12, max: 12, width: 2.6 });
                this.slashes.push({ x: e.x, y: e.y - 4, ang: e.ang ?? 0, len: 24, col: C.gold, until: now + 110 });
                this.cameras.main.shake(55, 0.0022);
              } else if (e.ally === 'lin') {
                this.waves.push({ x: e.x, y: e.y, r: 5, maxR: 20, col: C.ember, life: 11, max: 11, width: 2 });
                for (let i = 0; i < 4; i++) {
                  this.spawnSpark(e.x, e.y, Phaser.Math.FloatBetween(-1.2, 1.2), Phaser.Math.FloatBetween(-1.6, 0.4), 0.04, 16, 2.1, C.ember);
                }
              } else if (e.ally === 'zhang') {
                this.slashes.push({ x: e.x, y: e.y, ang: e.ang ?? 0, len: 16, col: C.paper, until: now + 90 });
              } else if (e.ally === 'zhao') {
                this.slashes.push({ x: e.x, y: e.y, ang: e.ang ?? 0, len: 14, col: C.electric, until: now + 90 });
              }
            }
          } else if (e.from === 'turret') {
            for (let i = 0; i < this.turretSprites.length; i++) {
              const sp = this.turretSprites[i];
              const ox = turretWorldPos(i).x;
              if (sp && (this.turretTypes[i] === 'mg' || this.turretTypes[i] === 'tesla' || this.turretTypes[i] === 'cannon') && Math.abs(ox - (e.x - 10)) < 2) {
                if (!this.tweens.isTweening(sp)) {
                  this.tweens.add({ targets: sp, x: ox - 2, duration: 45, yoyo: true, onComplete: () => sp.setX(ox) });
                }
              }
            }
          }
        }
        break;
      case 'jump':
        this.heroSquash = 0.16;
        for (let i = 0; i < 4; i++) {
          this.spawnSpark(game.run.player.x + (i - 1.5) * 4, GROUND_Y + game.run.player.y - 1, Phaser.Math.FloatBetween(-0.9, 0.9), Phaser.Math.FloatBetween(-1.4, -0.4), 0.06, 16, 2.4, C.haze);
        }
        break;
      case 'swap':
        this.gunPop = 1.48;
        break;
      case 'railbeam':
        if (game.run.inside) return;
        this.bolts.push({ pts: [{ x: e.x1, y: e.y1 }, { x: e.x2, y: e.y2 }], until: now + (e.crit ? 260 : 210), color: C.red, straight: true, crit: e.crit });
        this.waves.push({ x: e.x1, y: e.y1, r: 4, maxR: e.crit ? 20 : 14, col: C.red, life: 10, max: 10, width: 2.4 });
        break;
      case 'hit': {
        if (game.run.inside) return;
        const dir = e.dir ?? 1;
        this.flashUntil.set(e.id, now + (e.crit || e.overload ? 88 : 68));
        this.squashUntil.set(e.id, now + (e.crit || e.heavy || e.overload ? 98 : 70));
        this.hitJitterUntil.set(e.id, now + (e.crit || e.overload ? 90 : 55));
        if (e.crit || e.heavy || e.overload) this.hitStopUntil.set(e.id, now + 45);
        this.hitTilt.set(e.id, dir * (e.crit || e.overload ? 0.16 : e.heavy ? 0.12 : 0.07));
        this.burst('shot_hit', e.x + Phaser.Math.Between(-4, 4), e.y + Phaser.Math.Between(-6, 6), e.crit || e.overload ? 1.32 : 0.95);

        const col = e.overload ? C.electric : e.freeze ? C.frost : e.crit ? C.gold : e.burn ? C.ember : e.slow ? C.frost : C.paper;
        const count = e.crit || e.overload ? 7 : e.heavy ? 5 : 3;
        for (let i = 0; i < count; i++) {
          this.spawnSpark(
            e.x, e.y + Phaser.Math.Between(-6, 4),
            dir * Phaser.Math.FloatBetween(1.4, 3.6),
            Phaser.Math.FloatBetween(-2.6, 0.6),
            0.13, 18, e.crit || e.overload ? 2.6 : 1.9, i % 3 === 0 ? C.infected : col,
          );
        }
        if (e.overload) {
          this.waves.push({ x: e.x, y: e.y, r: 6, maxR: 28, col: C.electric, life: 13, max: 13, width: 2.6 });
          this.slashes.push({ x: e.x, y: e.y - 2, ang: 0.65, len: 15, col: C.electric, until: now + 100 });
          this.slashes.push({ x: e.x, y: e.y - 2, ang: -0.65, len: 15, col: C.ember, until: now + 100 });
        } else if (e.freeze) {
          this.waves.push({ x: e.x, y: e.y, r: 4, maxR: 22, col: C.frost, life: 12, max: 12, width: 2.2 });
        } else if (e.crit) {
          this.slashes.push({ x: e.x, y: e.y - 2, ang: dir * -0.55, len: 16, col: C.gold, until: now + 95 });
          this.waves.push({ x: e.x, y: e.y, r: 4, maxR: 20, col: C.gold, life: 11, max: 11, width: 2.2 });
          this.camZoom = Math.max(this.camZoom, 1.015);
        }
        const label = e.overload ? `超载 ${e.dmg}!` : e.crit ? `${e.dmg}!` : String(e.dmg);
        floaters.add(e.x, e.y - 24, label, e.overload || e.crit ? 'crit' : e.burn ? 'burn' : 'dmg');
        break;
      }
      case 'lightning':
        this.bolts.push({ pts: e.pts, until: now + 170, color: e.color === 'shock' ? C.gold : C.electric });
        break;
      case 'frost': {
        this.waves.push({ x: e.x, y: e.y, r: 6, maxR: e.r, col: C.frost, life: 15, max: 15, width: 2.5 });
        break;
      }
      case 'kill': {
        if (game.run.inside) return;
        const dir = e.dir ?? 1;
        const ky = e.y ?? BODY_Y;
        const flying = ky < BODY_Y - 20;
        this.burst('z_death', e.x, ky - 4, e.boss ? 1.55 : 1.08);
        this.waves.push({ x: e.x, y: ky, r: 5, maxR: e.boss ? 42 : 24, col: e.crit ? C.gold : C.paper, life: 13, max: 13, width: e.boss ? 3.5 : 2 });
        for (let i = 0; i < (e.boss ? 16 : 9); i++) {
          this.spawnSpark(
            e.x, ky + Phaser.Math.Between(-8, 6),
            dir * Phaser.Math.FloatBetween(0.6, 3.2) + Phaser.Math.FloatBetween(-1.2, 1.2),
            Phaser.Math.FloatBetween(-3.8, -0.5),
            0.13, 24, 2.6, i % 2 ? C.infected : C.rose, !flying,
          );
        }
        this.camZoom = Math.max(this.camZoom, e.boss ? 1.04 : 1.014);
        if (e.boss) this.cameras.main.shake(190, 0.0065);
        else if (e.crit) this.cameras.main.shake(45, 0.002);
        const mTxt = e.meat > 0 ? ` +${e.meat}${e.meatKind ? MEATS[e.meatKind].short : '肉'}` : '';
        floaters.add(e.x, ky - 34, `+${e.coins}${mTxt}`, 'coin');
        if (e.preserved && e.meat > 0) {
          floaters.add(e.x, ky - 48, '保鲜 ×2!', 'crit');
        }
        break;
      }
      case 'kitchenDone': {
        if (game.run.inside) {
          this.burst('fx_boom', IN_STATIONS.pass, GROUND_Y - 36, 0.48);
          for (let i = 0; i < 6; i++) {
            this.spawnSpark(IN_STATIONS.pass, GROUND_Y - 38, Phaser.Math.FloatBetween(-1.2, 1.2), Phaser.Math.FloatBetween(-2.2, -0.5), 0.08, 22, 2.2, e.isRye ? C.copper : C.gold);
          }
          const txt = e.extraPlate ? `余锅+1盘 ${e.dishName}` : `${e.dishName} 出锅!`;
          floaters.add(IN_STATIONS.pass, GROUND_Y - (e.extraPlate ? 72 : 58), txt, e.isRye ? 'hurt' : 'coin');
        }
        break;
      }
      case 'grindSauce': {
        if (game.run.inside) {
          for (let i = 0; i < 6; i++) {
            this.spawnSpark(IN_STATIONS.mortar, GROUND_Y - 34, Phaser.Math.FloatBetween(-1.0, 1.0), Phaser.Math.FloatBetween(-1.9, -0.5), 0.08, 20, 2.1, C.ember);
          }
          floaters.add(IN_STATIONS.mortar, GROUND_Y - 56, e.byStaff ? `${e.byStaff}磨酱 ${e.sauce}%` : `辣酱 ${e.sauce}%`, 'coin');
        }
        break;
      }
      case 'sauceEmpty': {
        if (game.run.inside) {
          floaters.add(IN_STATIONS.mortar, GROUND_Y - 62, '辣酱耗尽！去磨酱', 'hurt');
        }
        break;
      }
      case 'pourDone': {
        if (game.run.inside) {
          for (let i = 0; i < 6; i++) {
            this.spawnSpark(IN_STATIONS.drink, GROUND_Y - 38, Phaser.Math.FloatBetween(-1.1, 1.1), Phaser.Math.FloatBetween(-2.0, -0.5), 0.07, 20, 2.1, e.quality === 'legendary' ? C.gold : C.lamp);
          }
          floaters.add(IN_STATIONS.drink, GROUND_Y - 60, `${QUALITY_META[e.quality].label}·${DRINKS[e.drink].name}`, e.quality === 'legendary' || e.quality === 'perfect' ? 'crit' : 'coin');
        }
        break;
      }
      case 'tableClean': {
        if (game.run.inside) {
          for (let i = 0; i < 5; i++) {
            this.spawnSpark(e.x, GROUND_Y - 34, Phaser.Math.FloatBetween(-1.0, 1.0), Phaser.Math.FloatBetween(-1.8, -0.4), 0.07, 18, 2.0, C.green);
          }
          floaters.add(e.x, GROUND_Y - 54, `${e.byStaff ?? ''}收碗+${e.coins}金`, 'coin');
        }
        break;
      }
      case 'dispatchReturn': {
        if (game.run.inside) {
          floaters.add(IN_STATIONS.door - 40, GROUND_Y - 68, `派遣归来 +${e.spice}香料`, 'crit');
        }
        break;
      }
      case 'rackHarvest': {
        if (game.run.inside) {
          floaters.add(IN_STATIONS.kitchen, GROUND_Y - 72, `贮肉架 +${e.tender}嫩/+${e.thick}厚`, 'coin');
        }
        break;
      }
      case 'partyStart': {
        if (game.run.inside) {
          for (const lx of [280, 390]) {
            for (let i = 0; i < 6; i++) {
              this.spawnSpark(lx, GROUND_Y - 74, Phaser.Math.FloatBetween(-1.5, 1.5), Phaser.Math.FloatBetween(-2.0, 0.2), 0.03, 28, 2.4, C.gold);
            }
          }
          floaters.add(340, GROUND_Y - 82, `${e.name} 今夜开宴!`, 'crit');
        }
        break;
      }
      case 'guestAngry': {
        if (game.run.inside) {
          floaters.add(IN_STATIONS.door - 48, GROUND_Y - 56, `${e.name} 离席`, 'hurt');
        }
        break;
      }
      case 'shiftOpen': {
        if (game.run.inside) {
          for (const lx of [302, 420]) {
            for (let i = 0; i < 5; i++) {
              this.spawnSpark(lx, GROUND_Y - 68, Phaser.Math.FloatBetween(-1.3, 1.3), Phaser.Math.FloatBetween(-1.5, 0.5), 0.03, 24, 2.2, C.gold);
            }
          }
        }
        break;
      }
      case 'shiftEnd': {
        if (game.run.inside) {
          for (let i = 0; i < 10; i++) {
            this.spawnSpark(350, GROUND_Y - 52, Phaser.Math.FloatBetween(-2.0, 2.0), Phaser.Math.FloatBetween(-2.4, -0.4), 0.06, 26, 2.4, C.gold);
          }
        }
        break;
      }
      case 'serve': {
        const guest = game.run.guests.find((o) => o.id === e.guestId);
        const gx = guest ? guest.x : 340;
        this.burst('fx_boom', gx, GROUND_Y - 36, 0.55);
        const burstN = e.hotCrit || e.warReward ? 10 : e.quality === 'legendary' ? 10 : e.quality === 'perfect' ? 6 : 4;
        for (let i = 0; i < burstN; i++) {
          this.spawnSpark(gx, GROUND_Y - 40, Phaser.Math.FloatBetween(-1.4, 1.4), Phaser.Math.FloatBetween(-2.2, -0.6), 0.08, 26, 2.2, e.hotCrit || e.quality === 'legendary' ? C.gold : C.ember);
        }
        floaters.add(gx, GROUND_Y - 58, '+' + e.coins + '金', 'coin');
        if (e.hotCrit) {
          floaters.add(gx, GROUND_Y - 76, '趁热暴击 +30%!', 'crit');
        } else if (e.warReward) {
          floaters.add(gx, GROUND_Y - 76, e.warReward === 'barrel' ? '暗号:明晚火油桶!' : '暗号:满额弹药箱!', 'crit');
        } else if (e.supportTag) {
          floaters.add(gx, GROUND_Y - 76, e.supportTag, 'crit');
        } else if (e.dishBuffTag) {
          floaters.add(gx, GROUND_Y - 76, `明日 ${e.dishBuffTag}`, 'crit');
        }
        break;
      }
      case 'dishLevelUp': {
        const fxX = game.run.inside ? game.run.player.x : IN_STATIONS.kitchen;
        for (let i = 0; i < 12; i++) {
          this.spawnSpark(fxX, GROUND_Y - 46, Phaser.Math.FloatBetween(-2.2, 2.2), Phaser.Math.FloatBetween(-2.8, -0.6), 0.06, 28, 2.6, C.gold);
        }
        this.waves.push({ x: fxX, y: GROUND_Y - 36, r: 8, maxR: 38, col: C.gold, life: 15, max: 15, width: 2.8 });
        floaters.add(fxX, GROUND_Y - 82, `${MEALS[e.id].name} Lv.${e.level}招牌!`, 'crit');
        break;
      }
      case 'fortify': {
        const fy = GROUND_Y + e.y;
        this.waves.push({ x: e.x, y: fy, r: 6, maxR: 34, col: C.gold, life: 14, max: 14, width: 2.6 });
        for (let i = 0; i < 10; i++) {
          this.spawnSpark(e.x, fy, Phaser.Math.FloatBetween(-1.9, 1.9), Phaser.Math.FloatBetween(-2.6, -0.4), 0.1, 24, 2.4, i % 2 ? C.gold : C.ember, true);
        }
        floaters.add(e.x, fy - 24, e.label, 'crit');
        break;
      }
      case 'contractDone': {
        const cx = game.run.player.x, cy = GROUND_Y + game.run.player.y - 30;
        this.waves.push({ x: cx, y: cy, r: 10, maxR: 48, col: C.gold, life: 18, max: 18, width: 3.2 });
        for (let i = 0; i < 14; i++) {
          this.spawnSpark(cx, cy, Phaser.Math.FloatBetween(-2.4, 2.4), Phaser.Math.FloatBetween(-3.0, -0.6), 0.07, 28, 2.6, C.gold);
        }
        floaters.add(cx, cy - 32, `猎令达成! +${e.coins}金`, 'crit');
        break;
      }
      case 'allyJoin':
        for (let i = 0; i < 10; i++) {
          this.spawnSpark(game.run.player.x, GROUND_Y + game.run.player.y - 24, Phaser.Math.FloatBetween(-2, 2), Phaser.Math.FloatBetween(-2.8, -0.8), 0.09, 28, 2.6, C.gold);
        }
        break;
      case 'cook':
        if (game.run.inside) {
          this.burst('fx_boom', IN_STATIONS.kitchen, GROUND_Y - 36, 0.6);
          floaters.add(IN_STATIONS.kitchen, GROUND_Y - 60, '+' + e.coins + ' 金币', 'coin');
        }
        break;
      case 'boom': {
        this.burst('fx_boom', e.x, e.y, Math.max(0.95, e.r / 25));
        this.waves.push({ x: e.x, y: e.y, r: 8, maxR: e.r, col: C.gold, life: 15, max: 15, width: 3.4 });
        this.waves.push({ x: e.x, y: e.y, r: 4, maxR: e.r * 0.72, col: C.ember, life: 11, max: 11, width: 2.2 });
        for (let i = 0; i < 14; i++) {
          const ang = (i / 14) * Math.PI * 2;
          const sp = Phaser.Math.FloatBetween(1.6, 4.0);
          this.spawnSpark(e.x, e.y, Math.cos(ang) * sp, Math.sin(ang) * sp - 1.4, 0.14, 26, 2.9, i % 2 ? C.gold : C.ember, true);
        }
        this.camZoom = Math.max(this.camZoom, 1.032);
        this.cameras.main.shake(155, 0.0058);
        break;
      }
      case 'barrelBoom': {
        this.waves.push({ x: e.x, y: e.y, r: 10, maxR: 86, col: C.ember, life: 18, max: 18, width: 3.6 });
        floaters.add(e.x, e.y - 36, '火油桶引爆!', 'burn');
        break;
      }
      case 'airdropDrop': {
        for (let i = 0; i < 6; i++) {
          this.spawnSpark(e.x, GROUND_Y - 80, Phaser.Math.FloatBetween(-1.6, 1.6), Phaser.Math.FloatBetween(-1.2, 0.8), 0.06, 18, 2.2, C.paper);
        }
        floaters.add(e.x, GROUND_Y - 96, '伞绳已断!', 'crit');
        break;
      }
      case 'airdropSlam': {
        this.waves.push({ x: e.x, y: GROUND_Y - 8, r: 8, maxR: 82, col: C.gold, life: 16, max: 16, width: 3.2 });
        this.cameras.main.shake(130, 0.005);
        floaters.add(e.x, GROUND_Y - 40, e.stunned > 0 ? `空投砸晕 ×${e.stunned}!` : '空投砸落!', 'crit');
        break;
      }
      case 'lanternBreak': {
        this.waves.push({ x: e.x, y: e.y, r: 6, maxR: 54, col: C.infected, life: 16, max: 16, width: 3.2 });
        this.waves.push({ x: e.x, y: e.y, r: 4, maxR: 34, col: C.gold, life: 12, max: 12, width: 2.2 });
        for (let i = 0; i < 12; i++) {
          this.spawnSpark(e.x, e.y, Phaser.Math.FloatBetween(-2.6, 2.6), Phaser.Math.FloatBetween(-2.8, 0.8), 0.1, 24, 2.5, i % 2 ? C.infected : C.gold);
        }
        this.camZoom = Math.max(this.camZoom, 1.03);
        floaters.add(e.x, e.y - 38, '打灯破招! +1魔髓', 'crit');
        break;
      }
      case 'guardBreak': {
        this.waves.push({ x: e.x, y: e.y, r: 6, maxR: 46, col: C.gold, life: 15, max: 15, width: 3.2 });
        this.slashes.push({ x: e.x, y: e.y, ang: -0.7, len: 22, col: C.gold, until: now + 130 });
        this.slashes.push({ x: e.x, y: e.y, ang: 0.7, len: 22, col: C.red, until: now + 130 });
        this.cameras.main.shake(110, 0.0042);
        floaters.add(e.x, e.y - 42, '重击破防!', 'crit');
        break;
      }
      case 'perfectDodge': {
        this.slowMoUntil = now + 180;
        this.heroFlashUntil = now + 200;
        this.waves.push({ x: e.x, y: e.y, r: 6, maxR: 48, col: C.paper, life: 16, max: 16, width: 3.2 });
        this.waves.push({ x: e.x, y: e.y, r: 4, maxR: 30, col: C.gold, life: 12, max: 12, width: 2.4 });
        for (let i = 0; i < 10; i++) {
          this.spawnSpark(e.x, e.y, Phaser.Math.FloatBetween(-2.4, 2.4), Phaser.Math.FloatBetween(-2.6, 0.6), 0.06, 22, 2.4, i % 2 ? C.paper : C.gold);
        }
        this.camZoom = Math.max(this.camZoom, 1.032);
        floaters.add(e.x, e.y - 34, '绝境反骨! 暴击×3', 'crit');
        break;
      }
      case 'hurt':
        this.cameras.main.shake(e.cover ? 105 : 150, e.cover ? 0.004 : 0.006);
        if (e.cover && e.cover > 0) {
          this.waves.push({ x: game.run.player.x, y: GROUND_Y + game.run.player.y - 24, r: 6, maxR: 22, col: C.gold, life: 10, max: 10, width: 2 });
          floaters.add(game.run.player.x, GROUND_Y + game.run.player.y - 54, `掩体-${e.cover}`, 'coin');
        }
        floaters.add(game.run.player.x, GROUND_Y + game.run.player.y - 40, '-' + e.dmg, 'hurt');
        break;
      case 'wallHit':
        for (const w of this.wallTierObjs) this.tweens.add({ targets: w.obj, x: '+=2', duration: 35, yoyo: true });
        break;
      case 'dayStart':
      case 'inside':
        this.camX = this.targetCamX();
        this.camKickX = 0;
        this.camZoom = 1;
        this.slowMoUntil = 0;
        this.heroFlashUntil = 0;
        this.sparks = [];
        this.waves = [];
        this.slashes = [];
        break;
      case 'bossAppear':
        this.cameras.main.shake(260, 0.008);
        break;
      case 'endlessEnter':
        this.camX = this.targetCamX();
        if (game.run.inside) {
          for (let i = 0; i < 12; i++) {
            this.spawnSpark(380, GROUND_Y - 62, Phaser.Math.FloatBetween(-2.2, 2.2), Phaser.Math.FloatBetween(-2.4, -0.3), 0.04, 28, 2.6, C.gold);
          }
          floaters.add(380, GROUND_Y - 76, '破晓无尽酒馆 开业!', 'crit');
        }
        break;
      case 'skill':
        this.cameras.main.flash(180, (C.lamp >> 16) & 255, (C.lamp >> 8) & 255, C.lamp & 255);
        break;
    }
  }

  /** 世界坐标 -> 屏幕上的 CSS 像素，给界面层的飘字定位用 */
  worldToScreen(x: number, y: number) {
    const r = this.game.canvas.getBoundingClientRect(), k = r.height / VIEW_H;
    return { x: r.left + (x - this.cameras.main.scrollX) * k, y: r.top + y * k };
  }
}

let scene: GameScene | null = null;
export const getScene = () => scene;

/** 逻辑高度固定 310，宽度跟着屏幕比例在 480～680 之间变，铺满屏幕不留黑边 */
const viewWidth = () => Math.round(Phaser.Math.Clamp((VIEW_H * window.innerWidth) / Math.max(1, window.innerHeight), 480, 680));

export function startView(parent: HTMLElement) {
  scene = new GameScene();
  const phaser = new Phaser.Game({
    type: Phaser.AUTO, parent, pixelArt: true, backgroundColor: '#' + C.night.toString(16), banner: false,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: viewWidth(), height: VIEW_H },
    scene,
  });
  window.addEventListener('resize', () => phaser.scale.setGameSize(viewWidth(), VIEW_H));
  return phaser;
}
