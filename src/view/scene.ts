// 画面层：照着规则层的状态把画面画出来，听事件播特效。这里不改任何游戏状态。
import Phaser from 'phaser';
import { game } from '../app/game';
import { ASSETS } from '../assets';
import { ZOMBIES } from '../content/data';
import { MUZZLE_Y, TURRET_Y } from '../sim/sim';
import { GROUND_Y, TURRET_X, WALL_X, WORLD_W, type GameEvent } from '../sim/types';
import { floaters } from '../ui/floaters';
import { PALETTE as C } from '../ui/palette';

export const VIEW_H = 270;
const D = { sky: 0, town: 1, back: 2, ground: 3, prop: 4, actor: 5, fx: 6, mark: 7 };

export class GameScene extends Phaser.Scene {
  private sky!: Phaser.GameObjects.TileSprite;
  private town!: Phaser.GameObjects.TileSprite;
  private hero!: Phaser.GameObjects.Sprite;
  private turret!: Phaser.GameObjects.Sprite;
  private wallParts: Phaser.GameObjects.Image[] = [];
  private zombies = new Map<number, Phaser.GameObjects.Sprite>();
  private crates = new Map<number, Phaser.GameObjects.Image>();
  private bullets: Phaser.GameObjects.Sprite[] = [];
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
    for (const z of Object.values(ZOMBIES)) anim(z.sprite, z.fps);
    anim('z_death', 14, 0); anim('shot', 18); anim('shot_hit', 22, 0); anim('turret', 16, 0);

    // 远景：天空和远处的城镇跟着镜头慢慢动，做出纵深
    this.sky = this.add.tileSprite(0, 0, 640, 288, 'bg_sky').setOrigin(0).setScrollFactor(0).setDepth(D.sky);
    this.town = this.add.tileSprite(0, -44, 640, 288, 'bg_town').setOrigin(0).setScrollFactor(0).setDepth(D.town);
    // 街景：左边是据点（小屋），右边是僵尸来的方向
    const prop = (key: string, x: number, depth = D.back, tint?: number) => {
      const im = this.add.image(x, GROUND_Y, key).setOrigin(0.5, 1).setDepth(depth);
      if (tint !== undefined) im.setTint(tint);
      return im;
    };
    prop('house_c', 112);
    prop('house_a', 760, D.back, C.haze);
    prop('sign', 232); prop('lamp', 262); prop('lamp', 560); prop('lamp', 850);
    prop('well', 640, D.back, C.haze); prop('barrel', 30, D.prop); prop('barrel', 470, D.back);
    // 地面：石板路面，下面是石墙，一直铺到屏幕底（手指按键压在这一段上，不挡战场）
    this.add.tileSprite(0, GROUND_Y - 13, WORLD_W, 48, 'ground').setOrigin(0).setDepth(D.ground);
    this.add.tileSprite(0, GROUND_Y + 35, WORLD_W, VIEW_H - GROUND_Y - 35, 'ground_wall').setOrigin(0).setDepth(D.ground);
    // 路障和塔
    this.wallParts = [prop('wagon', WALL_X + 18, D.prop), prop('barrel', WALL_X - 22, D.prop), prop('crate', WALL_X + 62, D.prop)];
    prop('crate_stack', TURRET_X, D.prop);
    this.turret = this.add.sprite(TURRET_X, TURRET_Y + 11, 'turret', 0).setOrigin(0.5, 1).setDepth(D.prop).setFlipX(true);

    this.hero = this.add.sprite(0, GROUND_Y, 'hero_idle').setOrigin(0.5, 1).setDepth(D.actor);
    this.hero.play('hero_idle');
    this.overlay = this.add.graphics().setDepth(D.mark);
    this.cameras.main.setBounds(0, 0, WORLD_W, VIEW_H).setRoundPixels(true);
    game.onEvent((e) => this.onEvent(e));
    this.scale.on('resize', () => this.layout());
    this.layout();
    this.camX = this.targetCamX();
  }

  private layout() {
    const w = this.scale.gameSize.width;
    this.sky.setSize(w, 288); this.town.setSize(w, 288);
  }

  private targetCamX() {
    const w = this.scale.gameSize.width, p = game.run.player;
    // 主角站在画面左侧三分之一处，把右边（僵尸来的方向）留出来
    return Phaser.Math.Clamp(p.x - w * 0.34, 0, WORLD_W - w);
  }

  update(_t: number, dt: number) {
    game.advance(dt);
    const run = game.run, p = run.player, now = this.time.now;

    this.camX += (this.targetCamX() - this.camX) * 0.12;
    const cam = this.cameras.main; cam.scrollX = Math.round(this.camX);
    this.sky.tilePositionX = cam.scrollX * 0.08; this.town.tilePositionX = cam.scrollX * 0.25;

    // 主角
    const want = p.dodgeT > 0 ? 'hero_crouch' : p.hurtT > 22 ? 'hero_hurt' : p.y < 0 ? (p.vy < 0 ? 'hero_jump' : 'hero_fall')
      : p.shootT > 0 && Math.abs(p.vx) < 0.1 ? 'hero_shoot' : Math.abs(p.vx) > 0.1 ? 'hero_run' : 'hero_idle';
    if (this.hero.anims.currentAnim?.key !== want) this.hero.play(want);
    this.hero.setPosition(p.x, GROUND_Y + p.y).setFlipX(p.facing < 0);
    this.hero.setAlpha(p.dodgeT > 0 ? 0.6 : p.hurtT > 0 && Math.floor(now / 60) % 2 ? 0.5 : 1);

    // 僵尸：按编号对应到精灵，新来的建，没了的删
    const seen = new Set<number>();
    for (const z of run.zombies) {
      seen.add(z.id);
      let s = this.zombies.get(z.id);
      if (!s) {
        s = this.add.sprite(z.x, GROUND_Y, ZOMBIES[z.kind].sprite).setOrigin(0.5, 1).setDepth(D.actor);
        s.play({ key: ZOMBIES[z.kind].sprite, startFrame: z.id % 4 });
        this.zombies.set(z.id, s);
      }
      s.setPosition(z.x, GROUND_Y);
      if ((this.flashUntil.get(z.id) ?? 0) > now) s.setTintFill(C.paper);
      else if (z.burnT > 0) s.setTint(C.ember); else s.clearTint();
    }
    for (const [id, s] of this.zombies) if (!seen.has(id)) { s.destroy(); this.zombies.delete(id); this.flashUntil.delete(id); }

    // 武器箱
    const seenCrates = new Set<number>();
    for (const c of run.crates) {
      seenCrates.add(c.id);
      let im = this.crates.get(c.id);
      if (!im) { im = this.add.image(c.x, GROUND_Y, 'ic_crate').setOrigin(0.5, 1).setDepth(D.actor); this.crates.set(c.id, im); }
      im.y = GROUND_Y - 2 - Math.abs(Math.sin(now / 260)) * 5;
    }
    for (const [id, im] of this.crates) if (!seenCrates.has(id)) { im.destroy(); this.crates.delete(id); }

    // 子弹：用一个池子，够用就复用
    while (this.bullets.length < run.bullets.length) this.bullets.push(this.add.sprite(0, 0, 'shot').setDepth(D.fx).play('shot'));
    this.bullets.forEach((s, i) => {
      const b = run.bullets[i];
      s.setVisible(!!b);
      if (b) s.setPosition(b.x, b.y).setRotation(Math.atan2(b.vy, b.vx)).setScale(b.from === 'turret' ? 0.7 : 1);
    });

    // 路障坏了就只剩一点残骸
    const wallAlive = run.wall.hp > 0;
    this.wallParts.forEach((w, i) => w.setVisible(wallAlive || i === 2).setAlpha(wallAlive ? 1 : 0.6));

    // 锁定标记和血条
    const g = this.overlay; g.clear();
    const target = run.zombies.find((z) => z.id === run.targetId);
    if (target) {
      const pulse = 1 + Math.sin(now / 120) * 0.08;
      g.lineStyle(2, C.red, 0.95).strokeEllipse(target.x, GROUND_Y - 1, 30 * pulse, 9 * pulse);
      g.fillStyle(C.red, 0.95).fillTriangle(target.x - 4, GROUND_Y - 54, target.x + 4, GROUND_Y - 54, target.x, GROUND_Y - 48);
    }
    for (const z of run.zombies) {
      if (z.hp >= z.maxHp) continue;
      g.fillStyle(C.ink, 0.85).fillRect(z.x - 11, GROUND_Y - 50, 22, 4);
      g.fillStyle(C.red, 1).fillRect(z.x - 10, GROUND_Y - 49, 20 * Math.max(0, z.hp / z.maxHp), 2);
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
        this.burst('shot_hit', e.x + (e.from === 'player' ? game.run.player.facing * 6 : 6), e.y, e.from === 'player' ? 1.1 : 0.7);
        if (e.from === 'turret') this.turret.play('turret');
        break;
      case 'hit':
        this.flashUntil.set(e.id, now + 70);
        this.burst('shot_hit', e.x + Phaser.Math.Between(-4, 4), e.y + Phaser.Math.Between(-6, 6));
        floaters.add(e.x, e.y - 22, String(e.dmg), e.burn ? 'burn' : 'dmg');
        break;
      case 'kill':
        this.burst('z_death', e.x, GROUND_Y - 26);
        floaters.add(e.x, GROUND_Y - 58, '+' + e.coins, 'coin');
        break;
      case 'boom': {
        const c = this.add.circle(e.x, e.y, 6, C.gold, 0.8).setDepth(D.fx);
        this.tweens.add({ targets: c, radius: e.r, alpha: 0, duration: 220, onComplete: () => c.destroy() });
        this.cameras.main.shake(120, 0.004);
        break;
      }
      case 'hurt': this.cameras.main.shake(140, 0.006); floaters.add(game.run.player.x, MUZZLE_Y - 34, '-' + e.dmg, 'hurt'); break;
      case 'wallHit': this.tweens.add({ targets: this.wallParts, x: '+=2', duration: 40, yoyo: true }); break;
      case 'dayStart': this.camX = this.targetCamX(); break;
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

/** 逻辑高度固定 270，宽度跟着屏幕比例在 480～640 之间变，铺满屏幕不留黑边 */
const viewWidth = () => Math.round(Phaser.Math.Clamp((VIEW_H * window.innerWidth) / Math.max(1, window.innerHeight), 480, 640));

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
