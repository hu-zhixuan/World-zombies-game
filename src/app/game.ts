// 把规则层、画面层、音效与界面层接起来的地方。全游戏只有这一份状态。
import { ZOMBIES, unlockedWeapons, type ClassId } from '../content/data';
import { command, nearbyExterior, nearbyStation, newRun, step } from '../sim/sim';
import { NO_INPUT, type Command, type GameEvent, type Input, type RunState } from '../sim/types';
import { audio } from './audio';
import { loadMeta, saveMeta, starsEarned, type MetaState } from './meta';

/** 玩家主动打开的弹窗。三选一与结算直接由 run.phase 驱动；营地夜晚可自由走动并按需开店/下厨/修防线。 */
export type UserPanel = 'shop' | 'build' | 'kitchen' | 'pause';
export type Panel = UserPanel | 'title' | 'class' | 'perk' | 'dead' | 'won' | null;

type Listener = () => void;
type EventListener = (ev: GameEvent) => void;

class Game {
  meta: MetaState = loadMeta();
  /** 上一局结束时得了几颗星（结算面板显示用） */
  lastGain = 0;
  run: RunState = newRun(Date.now() % 100000, unlockedWeapons(this.meta.stars));
  started = false;
  choosing = false;
  private stack: UserPanel[] = [];
  private listeners = new Set<Listener>();
  private eventListeners = new Set<EventListener>();
  /** 持续按住的输入（左摇杆） */
  held = { move: 0, fire: false };
  /** 这一步刚按下的输入，被规则层读走一次就清掉 */
  private pressed = { jump: false, dodge: false, reload: false, swap: false, skill: false, grenade: false, interact: false };
  private acc = 0;

  constructor() {
    this.onEvent((e) => audio.onEvent(e));
  }

  panel(): Panel {
    if (this.choosing) return 'class';
    if (!this.started) return 'title';
    if (this.stack.length) return this.stack[this.stack.length - 1];
    const ph = this.run.phase;
    return ph === 'perk' || ph === 'dead' || ph === 'won' ? ph : null;
  }

  open(p: UserPanel) {
    audio.unlock();
    audio.uiClick();
    if (!this.stack.includes(p)) {
      this.stack.push(p);
      this.releaseAll();
      this.syncBgm();
      this.notify();
    }
  }

  close() {
    audio.uiClick();
    this.stack.pop();
    this.syncBgm();
    this.notify();
  }

  chooseClass() {
    audio.unlock();
    audio.uiClick();
    this.choosing = true;
    this.stack = [];
    this.releaseAll();
    this.syncBgm();
    this.notify();
  }

  restart(cls: ClassId = this.run.cls) {
    audio.unlock();
    audio.uiClick();
    this.choosing = false;
    this.run = newRun(Date.now() % 100000, unlockedWeapons(this.meta.stars), cls);
    this.stack = [];
    this.started = true;
    this.releaseAll();
    this.syncBgm();
    this.emit({ t: 'dayStart', day: 1 });
    this.notify();
  }

  toggleMute() {
    audio.toggleMute();
    if (!audio.muted) this.syncBgm();
    this.notify();
  }

  press(k: keyof Game['pressed']) {
    audio.unlock();
    if (k === 'interact') {
      if (this.handleInteract()) return;
    }
    this.pressed[k] = true;
  }

  /** 根据主角当前位置自动打开附近交互（室内进厨房/商店/工坊/出门，室外进门/爬梯）。 */
  handleInteract(): boolean {
    const r = this.run;
    if (r.inside) {
      const st = nearbyStation(r);
      if (st === 'kitchen') { this.open('kitchen'); return true; }
      if (st === 'shop') { this.open('shop'); return true; }
      if (st === 'workshop') { this.open('build'); return true; }
      if (st === 'door') { return this.send({ t: 'exitHouse' }); }
      return false;
    }
    const ext = nearbyExterior(r);
    if (ext === 'door' && r.phase === 'camp') return this.send({ t: 'enterHouse' });
    if (ext === 'ladder') return this.send({ t: 'toggleRoof' });
    return false;
  }

  releaseAll() { this.held.move = 0; this.held.fire = false; }

  send(cmd: Command): boolean {
    audio.unlock();
    const ev = command(this.run, cmd);
    if (!ev) return false;
    ev.forEach((e) => this.emit(e));
    this.syncBgm();
    this.notify();
    return true;
  }

  /** 画面层每帧调用：按固定步长推进规则层 */
  advance(dtMs: number) {
    if (this.panel() !== null) { this.acc = 0; return; }
    this.acc = Math.min(this.acc + dtMs, 100);
    const beforePhase = this.run.phase, beforeInside = this.run.inside;
    let urgent = false;
    while (this.acc >= 1000 / 60) {
      this.acc -= 1000 / 60;
      const input: Input = { ...NO_INPUT, ...this.held, ...this.pressed };
      this.pressed = { jump: false, dodge: false, reload: false, swap: false, skill: false, grenade: false, interact: false };
      for (const e of step(this.run, input)) {
        if (e.t === 'bossAppear' || e.t === 'pickup' || e.t === 'star' || e.t === 'kill' || e.t === 'hurt') urgent = true;
        this.emit(e);
      }
    }
    if (this.run.phase !== beforePhase || this.run.inside !== beforeInside) {
      if (this.run.phase !== beforePhase) this.releaseAll();
      this.syncBgm();
    }
    if (urgent || this.run.tick % 6 === 0 || this.run.phase !== beforePhase || this.run.inside !== beforeInside) {
      this.syncBgm();
      this.notify();
    }
  }

  private syncBgm() {
    if (!this.started) { audio.syncMood('none'); return; }
    const ph = this.run.phase;
    if (ph === 'dead' || ph === 'won') { audio.syncMood('none'); return; }
    if (this.choosing || ph === 'perk' || ph === 'camp' || this.run.inside) {
      audio.syncMood('tavern');
      return;
    }
    const bossAlive = this.run.zombies.some((z) => ZOMBIES[z.kind].boss);
    audio.syncMood(bossAlive ? 'boss' : 'battle');
  }

  subscribe(fn: Listener) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  onEvent(fn: EventListener) { this.eventListeners.add(fn); return () => { this.eventListeners.delete(fn); }; }
  notify() { this.listeners.forEach((fn) => fn()); }

  private emit(e: GameEvent) {
    if (e.t === 'dead' || e.t === 'won') {
      this.lastGain = starsEarned(this.run);
      this.meta = {
        stars: this.meta.stars + this.lastGain,
        bestDay: Math.max(this.meta.bestDay, this.run.phase === 'won' ? this.run.day : this.run.day - 1),
        runs: this.meta.runs + 1,
      };
      saveMeta(this.meta);
    }
    this.eventListeners.forEach((fn) => fn(e));
  }
}

export const game = new Game();
