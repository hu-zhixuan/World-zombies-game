// 画面层：照着规则层的状态把画面画出来（室外黄昏堡垒防线 & 室内酒馆营地），听事件播特效。这里不改任何游戏状态。
import Phaser from 'phaser';
import { game } from '../app/game';
import { ASSETS } from '../assets';
import { ZOMBIES } from '../content/data';
import { FORT_GUN_X, nearbyExterior, nearbyStation, turretWorldPos } from '../sim/sim';
import { GROUND_Y, IN_STATIONS, LADDER_X, DOOR_X, ROOF_MAX_X, ROOF_MIN_X, ROOF_Y, TURRET_SLOTS, VIEW_H, WALL_X, WORLD_W, type GameEvent } from '../sim/types';
import { floaters } from '../ui/floaters';
import { PALETTE as C } from '../ui/palette';

export { VIEW_H };

const D = { sky: 0, town: 1, back: 2, ground: 3, prop: 4, actor: 5, fx: 6, mark: 7 };

interface BoltFx { pts: { x: number; y: number }[]; until: number; color: number }

export class GameScene extends Phaser.Scene {
  private sky!: Phaser.GameObjects.TileSprite;
  private town!: Phaser.GameObjects.TileSprite;
  private hero!: Phaser.GameObjects.Sprite;

  // 室外与室内两组静态舞台物件（随 run.inside 快速切换可见性）
  private extObjs: { setVisible(v: boolean): void }[] = [];
  private intObjs: { setVisible(v: boolean): void }[] = [];
  private fortKeepObjs: Phaser.GameObjects.GameObject[] = [];
  private fortCannon!: Phaser.GameObjects.Image;
  private turretSprites: (Phaser.GameObjects.Sprite | Phaser.GameObjects.Image | null)[] = [null, null, null, null];
  private turretTypes: (string | null)[] = [null, null, null, null];
  private wallTierObjs: { minLv: number; obj: Phaser.GameObjects.Image }[] = [];

  private zombies = new Map<number, Phaser.GameObjects.Sprite>();
  private crates = new Map<number, Phaser.GameObjects.Image>();
  private bullets: Phaser.GameObjects.Sprite[] = [];
  private grenadeSprites: Phaser.GameObjects.Image[] = [];
  private enemyProjSprites: Phaser.GameObjects.Sprite[] = [];
  private bolts: BoltFx[] = [];

  private overlay!: Phaser.GameObjects.Graphics;
  private flashUntil = new Map<number, number>();
  private camX = 0;

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
    anim('z_death', 14, 0); anim('z_collapse', 12, 0);
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

    // ── 室外：黄昏堡垒酒馆 + 房顶阵地 + 梯子 + 3 级路障 + 街道背景 ──
    ext(this.add.tileSprite(0, GROUND_Y - 13, WORLD_W, 48, 'ground').setOrigin(0).setDepth(D.ground));
    ext(this.add.tileSprite(0, GROUND_Y + 35, WORLD_W, VIEW_H - GROUND_Y - 35, 'ground_wall').setOrigin(0).setDepth(D.ground));

    // 石堡翼楼与旗帜（堡垒 Lv.2+ 显示，让堡垒真正拔地而起）
    const keepTower = ext(this.add.image(44, GROUND_Y + 2, 'fort_keep').setOrigin(0.5, 1).setDepth(D.back).setScale(1.06));
    const keepBanner = ext(this.add.image(66, GROUND_Y - 118, 'castle_banner').setOrigin(0.5, 1).setDepth(D.prop));
    const fortPlinth = ext(this.add.image(FORT_GUN_X, GROUND_Y + ROOF_Y + 2, 'crate').setOrigin(0.5, 1).setDepth(D.ground + 0.5).setScale(0.62));
    this.fortKeepObjs = [keepTower, keepBanner, fortPlinth];

    // 核心据点大屋（放大并贴合屋顶防御平台）
    prop('fort_house', 152, GROUND_Y + 4, D.back, undefined, 1.08);
    // 房顶走道栏杆与木梯
    ext(this.add.image((ROOF_MIN_X + ROOF_MAX_X) / 2, GROUND_Y + ROOF_Y + 22, 'roof_deck').setOrigin(0.5, 1).setDepth(D.prop));
    prop('prop_ladder', LADDER_X, GROUND_Y, D.prop);
    prop('prop_ladder', LADDER_X, GROUND_Y - 56, D.prop);
    // 堡垒 Lv.2+ 自带屋顶守卫火炮（稳稳架在房顶木栈平台底座上）
    this.fortCannon = ext(this.add.image(FORT_GUN_X, GROUND_Y + ROOF_Y - 4, 'turret_cannon').setOrigin(0.5, 1).setDepth(D.prop + 0.2).setFlipX(true));

    // 大屋门廊灯、拱窗暖光、街头路灯
    for (const [lx, ly, r, it] of [
      [106, GROUND_Y - 40, 48, 0.28], [178, GROUND_Y - 40, 48, 0.28],
      [176, GROUND_Y - 88, 50, 0.24], [130, GROUND_Y - 148, 40, 0.2],
      [294, GROUND_Y - 96, 52, 0.3], [540, GROUND_Y - 96, 52, 0.3], [830, GROUND_Y - 96, 52, 0.3],
    ] as [number, number, number, number][]) {
      ext(this.add.pointlight(lx, ly, C.lamp, r, it, 0.06).setDepth(D.fx));
    }
    prop('sign', 298, GROUND_Y, D.back);
    for (const lx of [294, 540, 830]) prop('lamp', lx, GROUND_Y, D.back);
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

    // ── 室内：温馨酒馆营地（左侧小厨房 / 中间商店吧台 / 右侧工坊铁砧 / 最右木门） ──
    const intAdd = <T extends { setVisible(v: boolean): void }>(o: T) => { this.intObjs.push(o); return o; };
    intAdd(this.add.image(20, GROUND_Y + 53, 'tavern_interior').setOrigin(0, 1).setScale(1.2).setDepth(D.ground));
    for (const [lx, ly, r, col] of [
      [88, GROUND_Y - 22, 48, C.ember],   // 灶台暖光（柔和不刺眼）
      [210, GROUND_Y - 62, 46, C.lamp],   // 餐桌窗光
      [310, GROUND_Y - 56, 52, C.lamp],   // 商店酒架灯
      [483, GROUND_Y - 24, 44, C.ember],  // 铁砧炭火
    ] as [number, number, number, number][]) {
      intAdd(this.add.pointlight(lx, ly, col, r, 0.16, 0.08).setDepth(D.fx));
    }

    // ── 角色、武器箱、特效与矢量层 ──
    this.hero = this.add.sprite(0, GROUND_Y, 'hero_idle').setOrigin(0.5, 1).setDepth(D.actor);
    this.hero.play('hero_idle');
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
      // 室内宽 674：宽屏直接居中，窄屏平稳跟随主角
      const roomSpan = 674;
      if (w >= roomSpan) return (roomSpan - w) / 2;
      return Phaser.Math.Clamp(p.x - w * 0.5, 0, roomSpan - w);
    }
    return Phaser.Math.Clamp(p.x - w * 0.3, 0, WORLD_W - w);
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

    // 摄像机跟随（室内切出/入时快速贴近）
    const targetX = this.targetCamX();
    if (Math.abs(targetX - this.camX) > 220) this.camX = targetX;
    else this.camX += (targetX - this.camX) * 0.14;
    const cam = this.cameras.main;
    if (inside && this.scale.gameSize.width >= 674) cam.setBounds(-120, 0, WORLD_W + 240, VIEW_H);
    else cam.setBounds(0, 0, WORLD_W, VIEW_H);
    cam.scrollX = Math.round(this.camX);
    this.sky.tilePositionX = cam.scrollX * 0.08;
    this.town.tilePositionX = cam.scrollX * 0.25;

    // ── 主角 ──
    const want = p.dodgeT > 0 ? 'hero_crouch' : p.hurtT > 22 ? 'hero_hurt' : p.vy < -0.2 ? 'hero_jump' : p.vy > 0.4 ? 'hero_fall'
      : p.shootT > 0 && Math.abs(p.vx) < 0.1 ? 'hero_shoot' : Math.abs(p.vx) > 0.1 ? 'hero_run' : 'hero_idle';
    if (this.hero.anims.currentAnim?.key !== want) this.hero.play(want);
    this.hero.setPosition(p.x, GROUND_Y + p.y).setFlipX(p.facing < 0);
    this.hero.setAlpha(p.dodgeT > 0 ? 0.6 : p.hurtT > 0 && Math.floor(now / 60) % 2 ? 0.5 : 1);

    // ── 僵尸 ──
    const seen = new Set<number>();
    if (!inside) {
      for (const z of run.zombies) {
        seen.add(z.id);
        let s = this.zombies.get(z.id);
        if (!s) {
          const def = ZOMBIES[z.kind], key = def.sprites[z.id % def.sprites.length];
          s = this.add.sprite(z.x, GROUND_Y, key).setOrigin(0.5, 1).setDepth(D.actor).setScale(def.scale);
          s.play({ key, startFrame: z.id % 4 });
          this.zombies.set(z.id, s);
        }
        s.setVisible(true).setPosition(z.x, GROUND_Y);
        if ((this.flashUntil.get(z.id) ?? 0) > now) s.setTintFill(C.paper);
        else if (z.burnT > 0) s.setTint(C.ember);
        else if (z.slowT > 0) s.setTint(C.frost);
        else s.clearTint();
      }
    }
    for (const [id, s] of this.zombies) if (!seen.has(id)) { s.destroy(); this.zombies.delete(id); this.flashUntil.delete(id); }

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
        if (b.kind === 'frost') s.setScale(1.15).setTint(C.frost);
        else if (b.kind === 'rocket' || b.kind === 'cannon') s.setScale(1.45).setTint(C.ember);
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

    // ── 叠加高亮层（目标准星、血条、电网火花、电弧、室内外交互提示点） ──
    const g = this.overlay; g.clear();

    if (inside) {
      const near = nearbyStation(run);
      const bob = Math.sin(now / 180) * 3;
      const drawStationMark = (st: keyof typeof IN_STATIONS, yOff: number) => {
        const sx = IN_STATIONS[st], active = near === st;
        const col = active ? C.gold : C.lamp;
        g.fillStyle(col, active ? 0.98 : 0.68).fillTriangle(sx - 5, yOff - 8 + bob, sx + 5, yOff - 8 + bob, sx, yOff + bob);
        if (active) g.lineStyle(1.5, C.gold, 0.9).strokeCircle(sx, yOff - 5 + bob, 9);
      };
      drawStationMark('kitchen', GROUND_Y - 78);
      drawStationMark('shop', GROUND_Y - 96);
      drawStationMark('workshop', GROUND_Y - 68);
      drawStationMark('door', GROUND_Y - 66);
      return;
    }

    // 室外电弧与 Lv.3 电网壁垒火花
    this.bolts = this.bolts.filter((bf) => bf.until > now);
    for (const bf of this.bolts) {
      const alpha = Math.min(1, (bf.until - now) / 140);
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

    // 营地夜晚室外标识（房门进屋、木梯、4 处炮塔等级点）
    for (let i = 0; i < run.turrets.length; i++) {
      const sl = run.turrets[i], pos = turretWorldPos(i);
      if (sl.type) {
        for (let lv = 0; lv < sl.level; lv++) g.fillStyle(C.gold, 0.95).fillCircle(pos.x - 4 + lv * 4, pos.baseY + 4, 1.5);
      } else if (run.phase === 'camp') {
        g.lineStyle(1, C.copper, 0.55).strokeRect(pos.x - 10, pos.baseY - 12, 20, 12);
      }
    }
    if (run.phase === 'camp') {
      const extNear = nearbyExterior(run);
      const bob = Math.sin(now / 180) * 3;
      g.fillStyle(extNear === 'door' ? C.gold : C.lamp, 0.9).fillTriangle(DOOR_X - 5, GROUND_Y - 58 + bob, DOOR_X + 5, GROUND_Y - 58 + bob, DOOR_X, GROUND_Y - 50 + bob);
      g.fillStyle(extNear === 'ladder' ? C.gold : C.lamp, 0.9).fillTriangle(LADDER_X - 5, GROUND_Y - 134 + bob, LADDER_X + 5, GROUND_Y - 134 + bob, LADDER_X, GROUND_Y - 126 + bob);
    }

    // 锁定目标标记与僵尸血条
    const target = run.zombies.find((z) => z.id === run.targetId);
    if (target) {
      const pulse = 1 + Math.sin(now / 120) * 0.08;
      g.lineStyle(2, C.red, 0.95).strokeEllipse(target.x, GROUND_Y - 1, 30 * pulse, 9 * pulse);
      const top = GROUND_Y - (this.zombies.get(target.id)?.displayHeight ?? 46) - 6;
      g.fillStyle(C.red, 0.95).fillTriangle(target.x - 4, top - 6, target.x + 4, top - 6, target.x, top);
    }
    for (const z of run.zombies) {
      const isBoss = ZOMBIES[z.kind].boss;
      if (!isBoss && z.hp >= z.maxHp) continue;
      const w = isBoss ? 44 : 22;
      const y = GROUND_Y - (this.zombies.get(z.id)?.displayHeight ?? 46) - 6;
      g.fillStyle(C.ink, 0.88).fillRect(z.x - w / 2, y, w, isBoss ? 5 : 4);
      g.fillStyle(isBoss ? C.gold : C.red, 1).fillRect(z.x - w / 2 + 1, y + 1, (w - 2) * Math.max(0, z.hp / z.maxHp), isBoss ? 3 : 2);
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
        this.burst('shot_hit', e.x + (e.from === 'player' ? game.run.player.facing * 6 : 6), e.y, e.from === 'player' ? 1.1 : 0.75);
        if (e.from === 'turret') {
          for (let i = 0; i < this.turretSprites.length; i++) {
            const sp = this.turretSprites[i];
            if (sp && sp instanceof Phaser.GameObjects.Sprite && (this.turretTypes[i] === 'mg' || this.turretTypes[i] === 'frost') && Math.abs(sp.x - (e.x - 10)) < 4) {
              sp.play(this.turretTypes[i]!);
            }
          }
        }
        break;
      case 'hit':
        if (game.run.inside) return;
        this.flashUntil.set(e.id, now + 70);
        this.burst('shot_hit', e.x + Phaser.Math.Between(-4, 4), e.y + Phaser.Math.Between(-6, 6));
        floaters.add(e.x, e.y - 22, String(e.dmg), e.burn ? 'burn' : e.crit ? 'crit' : 'dmg');
        break;
      case 'lightning':
        this.bolts.push({ pts: e.pts, until: now + 170, color: e.color === 'shock' ? C.gold : C.electric });
        break;
      case 'frost': {
        const c = this.add.circle(e.x, e.y, 6, C.frost, 0.55).setDepth(D.fx);
        this.tweens.add({ targets: c, radius: e.r, alpha: 0, duration: 240, onComplete: () => c.destroy() });
        break;
      }
      case 'kill':
        if (game.run.inside) return;
        this.burst(e.kind === 'roamer' || e.kind === 'crawler' || e.kind === 'bruiser' ? 'z_collapse' : 'z_death', e.x, GROUND_Y - 26);
        floaters.add(e.x, GROUND_Y - 58, '+' + e.coins + (e.meat > 0 ? ' +肉' : ''), 'coin');
        break;
      case 'boom': {
        this.burst('fx_boom', e.x, e.y, Math.max(0.9, e.r / 26));
        const c = this.add.circle(e.x, e.y, 6, C.ember, 0.65).setDepth(D.fx);
        this.tweens.add({ targets: c, radius: e.r, alpha: 0, duration: 240, onComplete: () => c.destroy() });
        this.cameras.main.shake(140, 0.005);
        break;
      }
      case 'hurt':
        this.cameras.main.shake(150, 0.006);
        floaters.add(game.run.player.x, GROUND_Y + game.run.player.y - 42, '-' + e.dmg, 'hurt');
        break;
      case 'wallHit':
        for (const w of this.wallTierObjs) this.tweens.add({ targets: w.obj, x: '+=2', duration: 35, yoyo: true });
        break;
      case 'dayStart':
      case 'inside':
        this.camX = this.targetCamX();
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
