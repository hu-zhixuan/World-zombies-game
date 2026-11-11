// 把规则层、画面层、界面层接起来的地方。全游戏只有这一份状态。
import { unlockedWeapons, type ClassId } from '../content/data';
import { command, newRun, step } from '../sim/sim';
import { loadMeta, saveMeta, starsEarned, type MetaState } from './meta';
import { NO_INPUT, type Command, type GameEvent, type Input, type RunState } from '../sim/types';

/** 玩家主动打开的面板。由流程决定的面板（三选一、营地、结算）不进栈，直接看 run.phase。 */
export type UserPanel = 'workshop' | 'pause';
export type Panel = UserPanel | 'title' | 'class' | 'perk' | 'camp' | 'dead' | 'won' | null;

type Listener = () => void;
type EventListener = (ev: GameEvent) => void;

class Game {
  meta: MetaState = loadMeta();
  /** 上一局结束时得了几颗星（结算面板显示用） */
  lastGain = 0;
  run: RunState = newRun(Date.now() % 100000, unlockedWeapons(this.meta.stars));
  started = false;
  /** 正在选职业（标题页点了开始，或者结算后再来一局） */
  choosing = false;
  /** 面板栈：谁在最上面只有一个答案，游戏是否暂停也只看这里 */
  private stack: UserPanel[] = [];
  private listeners = new Set<Listener>();
  private eventListeners = new Set<EventListener>();
  /** 持续按住的输入（摇杆、开火键） */
  held = { move: 0, fire: false };
  /** 这一步刚按下的输入，被规则层读走一次就清掉 */
  private pressed = { jump: false, dodge: false, reload: false, swap: false, skill: false };
  private acc = 0;

  panel(): Panel {
    if (this.choosing) return 'class';
    if (!this.started) return 'title';
    if (this.stack.length) return this.stack[this.stack.length - 1];
    const ph = this.run.phase;
    return ph === 'perk' || ph === 'camp' || ph === 'dead' || ph === 'won' ? ph : null;
  }
  open(p: UserPanel) { if (!this.stack.includes(p)) { this.stack.push(p); this.releaseAll(); this.notify(); } }
  close() { this.stack.pop(); this.notify(); }
  chooseClass() { this.choosing = true; this.stack = []; this.releaseAll(); this.notify(); }
  restart(cls: ClassId = this.run.cls) { this.choosing = false; this.run = newRun(Date.now() % 100000, unlockedWeapons(this.meta.stars), cls); this.stack = []; this.started = true; this.releaseAll(); this.emit({ t: 'dayStart', day: 1 }); this.notify(); }

  press(k: keyof Game['pressed']) { this.pressed[k] = true; }
  releaseAll() { this.held.move = 0; this.held.fire = false; }

  send(cmd: Command): boolean {
    const ev = command(this.run, cmd);
    if (!ev) return false;
    ev.forEach((e) => this.emit(e));
    this.notify();
    return true;
  }

  /** 画面层每帧调用：按固定步长推进规则层 */
  advance(dtMs: number) {
    if (this.panel() !== null) { this.acc = 0; return; }
    this.acc = Math.min(this.acc + dtMs, 100);
    const before = this.run.phase;
    while (this.acc >= 1000 / 60) {
      this.acc -= 1000 / 60;
      const input: Input = { ...NO_INPUT, ...this.held, ...this.pressed };
      this.pressed = { jump: false, dodge: false, reload: false, swap: false, skill: false };
      for (const e of step(this.run, input)) this.emit(e);
    }
    if (this.run.phase !== before) this.releaseAll();
    if (this.run.tick % 6 === 0 || this.run.phase !== before) this.notify();
  }

  subscribe(fn: Listener) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  onEvent(fn: EventListener) { this.eventListeners.add(fn); return () => { this.eventListeners.delete(fn); }; }
  notify() { this.listeners.forEach((fn) => fn()); }
  private emit(e: GameEvent) {
    if (e.t === 'dead' || e.t === 'won') {
      // 一局结束：结算星星，永久保存
      this.lastGain = starsEarned(this.run);
      this.meta = { stars: this.meta.stars + this.lastGain, bestDay: Math.max(this.meta.bestDay, this.run.phase === 'won' ? this.run.day : this.run.day - 1), runs: this.meta.runs + 1 };
      saveMeta(this.meta);
    }
    this.eventListeners.forEach((fn) => fn(e));
  }
}

export const game = new Game();
