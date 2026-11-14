// 画面层：照着规则层的状态把画面画出来（室外黄昏堡垒防线 & 室内酒馆营地），听事件播特效。这里不改任何游戏状态。
import Phaser from 'phaser';
import { game } from '../app/game';
import { ASSETS } from '../assets';
import { MEALS, WEAPONS, ZOMBIES } from '../content/data';
import { ALLIES } from '../content/story';
import { BODY_Y, FORT_GUN_X, computeGrenadeThrow, curWeapon, houseBuff, nearbyStation, turretWorldPos } from '../sim/sim';
import {
  DOOR_X, GROUND_Y, IN_STATIONS, LADDER_X, PORCH_MAX_X, PORCH_MIN_X, PORCH_Y,
  ROOF_MAX_X, ROOF_MIN_X, ROOF_Y, TURRET_SLOTS, VIEW_H, WALL_X, WORLD_W, type GameEvent,
} from '../sim/types';
import { floaters } from '../ui/floaters';
import { PALETTE as C } from '../ui/palette';

export { VIEW_H };

const D = { sky: 0, town: 1, back: 2, ground: 3, prop: 4, actor: 5, fx: 6, mark: 7 };

/** 每把枪精确的握把锚点、前臂伸展距离与枪口前伸量（对齐 15x8 hero_arm 拳头中心） */
const WEAPON_GRIP: Record<string, { ox: number; oy: number; reach: number; gyOff: number; muzzle: number; scale: number; kick: number; recoil: number; shake: number }> = {
  pistol:   { ox: 0.26, oy: 0.56, reach: 10.5, gyOff: 1.0, muzzle: 10, scale: 1.04, kick: 0.2,  recoil: 4.5, shake: 0 },
  revolver: { ox: 0.22, oy: 0.55, reach: 10.5, gyOff: 1.0, muzzle: 11, scale: 1.05, kick: 0.34, recoil: 6.2, shake: 0.0022 },
  smg:      { ox: 0.32, oy: 0.50, reach: 10.0, gyOff: 1.0, muzzle: 11, scale: 1.06, kick: 0.14, recoil: 3.4, shake: 0 },
  shotgun:  { ox: 0.26, oy: 0.50, reach: 10.0, gyOff: 1.0, muzzle: 13, scale: 1.12, kick: 0.42, recoil: 7.4, shake: 0.0038 },
  assault:  { ox: 0.30, oy: 0.52, reach: 10.0, gyOff: 1.0, muzzle: 11, scale: 1.08, kick: 0.18, recoil: 4.2, shake: 0.0012 },
  rifle:    { ox: 0.22, oy: 0.52, reach: 10.0, gyOff: 1.0, muzzle: 15, scale: 1.16, kick: 0.46, recoil: 8.0, shake: 0.0044 },
  tesla:    { ox: 0.28, oy: 0.52, reach: 10.0, gyOff: 1.0, muzzle: 12, scale: 1.08, kick: 0.2,  recoil: 4.4, shake: 0.0016 },
  rocket:   { ox: 0.32, oy: 0.56, reach: 9.5,  gyOff: 0.5, muzzle: 13, scale: 1.15, kick: 0.5,  recoil: 8.4, shake: 0.0052 },
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

  // 室外与室内两组静态舞台物件（随 run.inside 快速切换可见性）
  private extObjs: { setVisible(v: boolean): void }[] = [];
  private intObjs: { setVisible(v: boolean): void }[] = [];
  private fortKeepObjs: Phaser.GameObjects.GameObject[] = [];
  private fortCannon!: Phaser.GameObjects.Image;
  private turretSprites: (Phaser.GameObjects.Sprite | Phaser.GameObjects.Image | null)[] = [null, null, null, null];
  private turretTypes: (string | null)[] = [null, null, null, null];
  private wallTierObjs: { minLv: number; obj: Phaser.GameObjects.Image }[] = [];

  private zombies = new Map<number, Phaser.GameObjects.Sprite>();
  private allySprites = new Map<string, Phaser.GameObjects.Sprite>();
  private guestSprites = new Map<string, Phaser.GameObjects.Sprite>();
  private guestDishSprites = new Map<string, Phaser.GameObjects.Image>();
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
    for (const [key, fps] of [['npc_hat', 6], ['npc_bearded', 6], ['npc_woman', 7], ['npc_oldman', 7]] as const) anim(key, fps);
    anim('z_death', 14, 0);
    anim('fx_fireball', 14); anim('fx_boom', 20, 0);
    anim('shot', 18); anim('shot_hit', 22, 0);
    anim('turret', 18, 0); anim('turret_frost', 14, 0); anim('turret_tesla', 10);

    // ── 远景背景（室外与室内共用夜色天空基底） ──
    this.sky = this.add.tileSprite(0, 0, 768, 288, 'bg_sky').setOrigin(0).setScrollFactor(0).setDepth(D.sky);
    this.town = this.add.tileSprite(0, -18, 768, 288, 'bg_town').setOrigin(0).setScrollFactor(0).setDepth(D.town).setAlpha(0.56);

    const ext = <T extends { setVisible(v: boolean): void }>(o: T) => { this.extObjs.push(o); return o; };
    const prop = (key: string, x: number, y = GROUND_Y, depth = D.back, tint?: number, scale = 1) => {
      const im = ext(this.add.image(x, y, key).setOrigin(0.5, 1).setDepth(depth).setScale(scale));
      if (tint !== undefined) im.setTint(tint);
      return im;
    };

    // ── 室外：黄昏堡垒酒馆 + 阶梯木跳台 + 二层房顶阵地 + 3 级路障 + 街道背景 ──
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
    // 堡垒 Lv.2+ 自带屋顶守卫火炮（稳稳架在房顶木栈平台底座上）
    this.fortCannon = ext(this.add.image(FORT_GUN_X, GROUND_Y + ROOF_Y - 4, 'turret_cannon').setOrigin(0.5, 1).setDepth(D.prop + 0.2).setFlipX(true));

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

    // 3 级路障壁垒（Lv1 铁丝木障 → Lv2 武装战车木箱壁垒 → Lv3 双层重装电网壁垒）
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

    // ── 室内：哥特木石酒馆温馨剖面（左砖窑烤炉料理区 / 中明窗双木桌堂食区 / 右铁砧整备与出击木门） ──
    const intAdd = <T extends { setVisible(v: boolean): void }>(o: T) => { this.intObjs.push(o); return o; };
    intAdd(this.add.image(40, GROUND_Y + 26, 'tavern_interior').setOrigin(0, 1).setScale(1.12).setDepth(D.ground));
    for (const [lx, ly, r, col] of [
      [118, GROUND_Y - 14, 58, C.ember],   // 砖窑炉口炉火暖光
      [302, GROUND_Y - 68, 72, C.lamp],    // 左拱窗与餐桌暖光
      [420, GROUND_Y - 68, 72, C.lamp],    // 右拱窗与餐桌暖光
      [520, GROUND_Y - 46, 54, C.lamp],    // 铁砧工作台暖光
    ] as [number, number, number, number][]) {
      intAdd(this.add.pointlight(lx, ly, col, r, 0.22, 0.07).setDepth(D.fx));
    }

    // ── 角色、独立瞄准手臂/闲置手臂、手持武器、特效与矢量层 ──
    this.hero = this.add.sprite(0, GROUND_Y, 'hero_idle').setOrigin(0.5, 1).setDepth(D.actor);
    this.hero.play('hero_idle');
    this.heroGun = this.add.image(0, GROUND_Y - 22, 'wp_pistol').setOrigin(0.26, 0.56).setDepth(D.actor + 0.08).setScale(1.04);
    this.heroArm = this.add.image(0, GROUND_Y - 32, 'hero_arm').setOrigin(0.27, 0.44).setDepth(D.actor + 0.1);
    this.overlay = this.add.graphics().setDepth(D.mark);
    this.cameras.main.setBounds(0, 0, WORLD_W, VIEW_H).setRoundPixels(true);

    const grade = this.cameras.main.postFX?.addColorMatrix();
    if (grade) grade.brightness(1.1).saturate(0.14, true);

    // 点击战斗画面可手动切换优先集火目标
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      const r = game.run;
      if (game.panel() === null && !r.inside && r.phase === 'fight') {
        game.send({ t: 'focusTarget', x: ptr.worldX });
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
      // 室内宽 700：宽屏直接居中，窄屏平稳跟随主角
      const roomSpan = 700;
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
        if (slot.type === 'mg') sp = this.add.sprite(pos.x, pos.baseY - 4, 'turret', 0).setFlipX(true);
        else if (slot.type === 'frost') sp = this.add.sprite(pos.x, pos.baseY - 4, 'turret_frost', 0).setFlipX(true).setScale(0.65);
        else if (slot.type === 'tesla') sp = this.add.sprite(pos.x, pos.baseY - 4, 'turret_tesla', 0).play('turret_tesla').setScale(0.88);
        else sp = this.add.image(pos.x, pos.baseY - 4, 'turret_cannon').setFlipX(true);
        sp.setOrigin(0.5, 1).setDepth(D.prop + 0.2);
        this.turretSprites[i] = sp;
        this.turretTypes[i] = slot.type;
      }
      this.turretSprites[i]?.setVisible(true);
    }
  }

  private syncAllies() {
    const run = game.run, inside = run.inside;
    const seen = new Set<string>();
    const extPos: Record<string, [number, number, boolean]> = {
      zhang: [132, GROUND_Y + ROOF_Y, false],
      lin: [266, GROUND_Y + PORCH_Y, false],
      qiang: [342, GROUND_Y, false],
      zhao: [58, GROUND_Y + ROOF_Y, false],
    };
    const intPos: Record<string, [number, number, boolean]> = {
      lin: [150, GROUND_Y, false],
      zhang: [230, GROUND_Y, false],
      qiang: [548, GROUND_Y, true],
      zhao: [576, GROUND_Y, true],
    };
    for (const allyId of run.story.allies) {
      seen.add(allyId);
      const meta = ALLIES[allyId];
      let sp = this.allySprites.get(allyId);
      if (!sp) {
        sp = this.add.sprite(0, GROUND_Y, meta.sprite).setOrigin(0.5, 1).setDepth(D.actor - 0.1).setScale(0.92);
        sp.play(meta.sprite);
        this.allySprites.set(allyId, sp);
      }
      const [x, y, flip] = (inside ? intPos : extPos)[allyId] ?? [200, GROUND_Y, false];
      sp.setVisible(true).setPosition(x, y).setFlipX(flip);
    }
    for (const [id, sp] of this.allySprites) {
      if (!seen.has(id)) {
        sp.destroy();
        this.allySprites.delete(id);
      }
    }
  }

  private syncDinerGuests() {
    const run = game.run, inside = run.inside;
    const seen = new Set<string>();
    // 坐席 0/1 坐在 1 号桌左右两侧，坐席 2 坐在 2 号桌右侧；菜品稳稳摆在桌面正上方
    const dishSpots: [number, number][] = [[298, GROUND_Y - 36], [342, GROUND_Y - 36], [444, GROUND_Y - 36]];
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
        sp.setVisible(true).setPosition(g.x, GROUND_Y).setFlipX(i >= 1);

        let dishIm = this.guestDishSprites.get(g.id);
        const dishIcon = MEALS[g.dish].icon;
        const [dx, dy] = dishSpots[i] ?? [g.x + 16, GROUND_Y - 36];
        if (!dishIm) {
          dishIm = this.add.image(dx, dy, dishIcon).setOrigin(0.5, 1).setDepth(D.prop + 0.4).setScale(0.88);
          this.guestDishSprites.set(g.id, dishIm);
        }
        dishIm.setTexture(dishIcon).setVisible(g.served).setPosition(dx, dy);
      }
    }
    for (const [id, sp] of this.guestSprites) {
      if (!seen.has(id)) {
        sp.destroy();
        this.guestSprites.delete(id);
        this.guestDishSprites.get(id)?.destroy();
        this.guestDishSprites.delete(id);
      }
    }
  }

  update(_t: number, dt: number) {
    game.advance(dt);
    const run = game.run, p = run.player, now = this.time.now, inside = run.inside;

    // 快速切换室内 / 室外图层
    for (const o of this.extObjs) o.setVisible(!inside);
    for (const o of this.intObjs) o.setVisible(inside);
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

    // ── 主角 + 分层独立手臂 + 手持枪械贴图 + 闪避残影 ──
    const want = p.dodgeT > 0 ? 'hero_crouch' : p.hurtT > 22 ? 'hero_hurt' : p.vy < -0.2 ? 'hero_jump' : p.vy > 0.4 ? 'hero_fall'
      : p.shootT > 0 && Math.abs(p.vx) < 0.1 ? 'hero_shoot' : Math.abs(p.vx) > 0.1 ? 'hero_run' : 'hero_idle';
    if (this.hero.anims.currentAnim?.key !== want) this.hero.play(want);
    this.heroSquash *= 0.8;
    const hsy = 1 + this.heroSquash;
    const hsx = 1 - this.heroSquash * 0.55;
    this.hero.setPosition(p.x, GROUND_Y + p.y).setFlipX(p.facing < 0).setScale(hsx, hsy);
    this.hero.setAlpha(p.dodgeT > 0 ? 0.65 : p.hurtT > 0 && Math.floor(now / 60) % 2 ? 0.5 : 1);

    if (p.dodgeT > 0 && run.tick !== this.afterimageTick && run.tick % 2 === 0) {
      this.afterimageTick = run.tick;
      const ghost = this.add.sprite(p.x, GROUND_Y + p.y, want).setOrigin(0.5, 1).setFlipX(p.facing < 0).setDepth(D.actor - 0.1).setTint(C.frost).setAlpha(0.52);
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

    if (aliveVis) {
      const { shX, shY } = this.heroJoints(now);
      if (inside) {
        // 室内脱枪，垂手轻松漫步
        if (this.heroArm.texture.key !== 'hero_arm_rest') this.heroArm.setTexture('hero_arm_rest');
        const walkSwing = Math.abs(p.vx) > 0.1 ? Math.sin(now / 85) * 0.28 : Math.sin(now / 420) * 0.03;
        this.heroArm
          .setOrigin(0.5, 0.16)
          .setPosition(shX, shY - 1)
          .setRotation(walkSwing * p.facing)
          .setFlipX(p.facing < 0)
          .setFlipY(false)
          .setScale(1);
      } else {
        // 室外持枪：独立袖管拳头连接肩膀与枪身，瞄准角度同步翻转与后坐力退移
        if (this.heroArm.texture.key !== 'hero_arm') this.heroArm.setTexture('hero_arm');
        const rawAng = activeTarget ? Math.atan2(BODY_Y - shY, activeTarget.x - shX) : (p.facing > 0 ? 0 : Math.PI);
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
    }

    // ── 僵尸（含微卡肉顿帧、震颤抖动、方向性受击后仰角与水平压缩挤压） ──
    const seen = new Set<number>();
    if (!inside) {
      for (const z of run.zombies) {
        seen.add(z.id);
        const def = ZOMBIES[z.kind];
        let s = this.zombies.get(z.id);
        if (!s) {
          const key = def.sprites[z.id % def.sprites.length];
          s = this.add.sprite(z.x, GROUND_Y, key).setOrigin(0.5, 1).setDepth(D.actor).setScale(def.scale);
          s.play({ key, startFrame: z.id % 4 });
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
          .setPosition(z.x + jit, GROUND_Y)
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

    // ── 武器箱 ──
    const seenCrates = new Set<number>();
    if (!inside) {
      for (const c of run.crates) {
        seenCrates.add(c.id);
        let im = this.crates.get(c.id);
        if (!im) { im = this.add.image(c.x, GROUND_Y, 'ic_crate').setOrigin(0.5, 1).setDepth(D.actor); this.crates.set(c.id, im); }
        im.setVisible(true).y = GROUND_Y - 2 - Math.abs(Math.sin(now / 260)) * 5;
      }
    }
    for (const [id, im] of this.crates) if (!seenCrates.has(id)) { im.destroy(); this.crates.delete(id); }

    // ── 子弹、手雷与敌方火球 ──
    while (this.bullets.length < run.bullets.length) this.bullets.push(this.add.sprite(0, 0, 'shot').setDepth(D.fx).play('shot'));
    this.bullets.forEach((s, i) => {
      const b = run.bullets[i];
      const vis = !inside && !!b;
      s.setVisible(vis);
      if (vis && b) {
        s.setPosition(b.x, b.y).setRotation(Math.atan2(b.vy, b.vx));
        if (b.kind === 'firebolt') s.setScale(1.36).setTint(C.ember);
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

    // 室内炉口温柔火星与餐桌微热气
    if (inside && now > this.hearthTick + 170) {
      this.hearthTick = now;
      this.spawnSpark(118 + Phaser.Math.Between(-10, 10), GROUND_Y - 14, Phaser.Math.FloatBetween(-0.18, 0.18), Phaser.Math.FloatBetween(-0.85, -0.4), -0.008, 32, 2, C.ember);
      for (const guest of run.guests) {
        if (guest.served && Math.random() < 0.4) {
          this.spawnSpark(guest.x + Phaser.Math.Between(-8, 8), GROUND_Y - 36, 0, -0.4, -0.004, 24, 1.6, C.paper);
        }
      }
    }
    this.stepAndDrawSparks(g);
    this.stepAndDrawImpacts(g, now);

    if (inside) {
      // 清爽酒馆内部：只保留脚底淡淡的当前站位光晕与餐桌待客极简金点（去掉遮挡窗户的暗盒与跳动大三角）
      const near = nearbyStation(run);
      if (near && near !== 'shop') {
        const sx = IN_STATIONS[near];
        const barW = near === 'kitchen' ? 76 : near === 'workshop' ? 58 : 38;
        g.fillStyle(C.gold, 0.34).fillRoundedRect(sx - barW / 2, GROUND_Y - 4, barW, 5, 2);
        g.lineStyle(1.4, C.lamp, 0.85).strokeRoundedRect(sx - barW / 2, GROUND_Y - 4, barW, 5, 2);
      }
      const bob = Math.sin(now / 210) * 1.6;
      for (const guest of run.guests) {
        if (guest.served) continue;
        const gy = GROUND_Y - 52 + bob;
        const dotCol = guest.trendMatch ? C.gold : C.lamp;
        g.fillStyle(C.ink, 0.85).fillCircle(guest.x, gy, 3.6);
        g.fillStyle(dotCol, 0.96).fillCircle(guest.x, gy, 2.3);
      }
      return;
    }

    // 拖拽手榴弹时绘制真实物理解算出的抛物线曲线与落地爆区预警圈
    if (game.grenadeAim && run.phase === 'fight' && p.grenades > 0) {
      const traj = computeGrenadeThrow(run, game.grenadeAim);
      let px = traj.sx, py = traj.sy, vx = traj.vx, vy = traj.vy;
      let landX = px, landY = GROUND_Y - 4;
      for (let f = 0; f < 84; f++) {
        px += vx; py += vy; vy += traj.g;
        landX = px;
        const hitZ = run.zombies.some((z) => z.hp > 0 && Math.abs(px - z.x) <= 18 && py >= GROUND_Y - 46);
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
        if (Math.abs(z.x - landX) <= 66) g.lineStyle(1.6, C.gold, 0.95).strokeEllipse(z.x, GROUND_Y - 1, 28, 9);
      }
    }

    // 焦土火箭残余火海地面特效
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

    // 屋顶 / 门廊高地防守增益光环与矮墙护线
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

    // 特色子弹拖尾（左轮金痕 / 加特林过热火弹 / 急冻冰晶痕）
    for (const b of run.bullets) {
      if (b.kind === 'firebolt') {
        g.lineStyle(2.4, C.ember, 0.82).lineBetween(b.x - b.vx * 1.3, b.y - b.vy * 1.3, b.x, b.y);
      } else if (b.weaponId === 'revolver') {
        g.lineStyle(2.0, C.gold, 0.75).lineBetween(b.x - b.vx * 1.4, b.y - b.vy * 1.4, b.x, b.y);
      } else if (b.weaponId === 'assault') {
        g.lineStyle(1.6, C.frost, 0.65).lineBetween(b.x - b.vx * 1.1, b.y - b.vy * 1.1, b.x, b.y);
      }
    }

    // 僵尸深冻冰壳 & 麻痹电弧
    for (const z of run.zombies) {
      if (z.freezeT > 0) {
        g.fillStyle(C.frost, 0.22).fillRoundedRect(z.x - 13, GROUND_Y - 40, 26, 38, 4);
        g.lineStyle(1.5, C.paper, 0.75).strokeRoundedRect(z.x - 13, GROUND_Y - 40, 26, 38, 4);
      }
      if (z.stunT > 0 && Math.floor(now / 70 + z.id) % 2 === 0) {
        g.lineStyle(1.4, C.electric, 0.9)
          .lineBetween(z.x - 10, GROUND_Y - 34, z.x + 2, GROUND_Y - 22)
          .lineBetween(z.x + 2, GROUND_Y - 22, z.x - 6, GROUND_Y - 10);
      }
    }

    // 室外电弧、狙击磁轨光束与 Lv.3 电网壁垒火花
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

    // 营地夜晚室外标识（房门进屋、4 处炮塔等级点）
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
    }

    // 元气骑士式锁定准星（四角收缩锁敌框 + 脚底脉动光圈，优先集火目标镶金色外环）
    const target = run.zombies.find((z) => z.id === run.targetId);
    if (target) {
      const sp = this.zombies.get(target.id);
      const h = sp?.displayHeight ?? 46;
      const w = ZOMBIES[target.kind].boss ? 22 : 13;
      const isPri = target.id === run.priorityId;
      const col = isPri ? C.gold : C.red;
      const pulse = Math.sin(now / 110) * 2;
      const rx = w + pulse, top = GROUND_Y - h - pulse, bot = GROUND_Y - 2 + pulse * 0.5, arm = 5;
      g.lineStyle(1.8, col, 0.92).strokeEllipse(target.x, GROUND_Y - 1, (w * 2 + 4) + pulse * 2, 9);
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
      const y = GROUND_Y - (this.zombies.get(z.id)?.displayHeight ?? 46) - 8;
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
          if (e.from === 'turret') {
            for (let i = 0; i < this.turretSprites.length; i++) {
              const sp = this.turretSprites[i];
              if (sp && sp instanceof Phaser.GameObjects.Sprite && (this.turretTypes[i] === 'mg' || this.turretTypes[i] === 'frost') && Math.abs(sp.x - (e.x - 10)) < 4) {
                sp.play(this.turretTypes[i]!);
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
        this.burst('z_death', e.x, GROUND_Y - 26, e.boss ? 1.55 : 1.08);
        this.waves.push({ x: e.x, y: BODY_Y, r: 5, maxR: e.boss ? 42 : 24, col: e.crit ? C.gold : C.paper, life: 13, max: 13, width: e.boss ? 3.5 : 2 });
        for (let i = 0; i < (e.boss ? 16 : 9); i++) {
          this.spawnSpark(
            e.x, BODY_Y + Phaser.Math.Between(-8, 6),
            dir * Phaser.Math.FloatBetween(0.6, 3.2) + Phaser.Math.FloatBetween(-1.2, 1.2),
            Phaser.Math.FloatBetween(-3.8, -0.5),
            0.13, 24, 2.6, i % 2 ? C.infected : C.rose, true,
          );
        }
        this.camZoom = Math.max(this.camZoom, e.boss ? 1.04 : 1.014);
        if (e.boss) this.cameras.main.shake(190, 0.0065);
        else if (e.crit) this.cameras.main.shake(45, 0.002);
        floaters.add(e.x, GROUND_Y - 58, '+' + e.coins + (e.meat > 0 ? ' +肉' : ''), 'coin');
        break;
      }
      case 'serve': {
        this.burst('fx_boom', 118, GROUND_Y - 36, 0.65);
        const guest = game.run.guests.find((o) => o.id === e.guestId);
        const gx = guest ? guest.x : 340;
        const burstN = e.quality === 'legendary' ? 10 : e.quality === 'perfect' ? 6 : 3;
        for (let i = 0; i < burstN; i++) {
          this.spawnSpark(gx, GROUND_Y - 40, Phaser.Math.FloatBetween(-1.4, 1.4), Phaser.Math.FloatBetween(-2.2, -0.6), 0.08, 26, 2.2, e.quality === 'legendary' ? C.gold : C.ember);
        }
        floaters.add(gx, GROUND_Y - 62, '+' + e.coins + '金', 'coin');
        break;
      }
      case 'allyJoin':
        for (let i = 0; i < 10; i++) {
          this.spawnSpark(game.run.player.x, GROUND_Y + game.run.player.y - 24, Phaser.Math.FloatBetween(-2, 2), Phaser.Math.FloatBetween(-2.8, -0.8), 0.09, 28, 2.6, C.gold);
        }
        break;
      case 'cook':
        if (game.run.inside) {
          this.burst('fx_boom', 118, GROUND_Y - 36, 0.6);
          floaters.add(118, GROUND_Y - 60, '+' + e.coins + ' 金币', 'coin');
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
        this.sparks = [];
        this.waves = [];
        this.slashes = [];
        break;
      case 'bossAppear':
        this.cameras.main.shake(260, 0.008);
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
