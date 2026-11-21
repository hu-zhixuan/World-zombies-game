// 把规则层、画面层、音效与界面层接起来的地方。全游戏只有这一份状态。
import { MEALS, ZOMBIES, unlockedWeapons, type ClassId, type DifficultyId } from '../content/data';
import {
  ALLIES, BOSS_VICTORY, CINEMATIC_INTRO, COMPANION_JOIN_STORIES,
  REST_STORY, SPEAKERS, type AllyId, type StoryLine,
} from '../content/story';
import { command, formatRecipeCost, hasIngredients, houseBuff, nearbyCampTarget, nearbyExterior, nearbyStation, newRun, step } from '../sim/sim';
import { NO_INPUT, type Command, type GameEvent, type Input, type RunState } from '../sim/types';
import { audio } from './audio';
import { loadMeta, recordRunToMeta, saveMeta, starsEarned, type MetaState } from './meta';

/** 玩家主动打开的弹窗。三选一与结算直接由 run.phase 驱动；营地夜晚可自由走动并按需开店/下厨/修防线。 */
export type UserPanel = 'shop' | 'build' | 'kitchen' | 'pause' | 'lore';
export type Panel = UserPanel | 'title' | 'class' | 'perk' | 'dead' | 'won' | 'story' | null;

export interface QueuedStory { title: string; line: StoryLine }

type Listener = () => void;
type EventListener = (ev: GameEvent) => void;

class Game {
  meta: MetaState = loadMeta();
  /** 上一局结束时得了几颗星（结算面板显示用） */
  lastGain = 0;
  selectedDifficulty: DifficultyId = 'normal';
  run: RunState = newRun(Date.now() % 100000, unlockedWeapons(this.meta.stars), 'gunner', 'normal', {
    metVips: this.meta.metVips, mastery: this.meta.recipeMastery, decor: this.meta.unlockedDecor,
  });
  started = false;
  choosing = false;
  private stack: UserPanel[] = [];
  storyQueue: QueuedStory[] = [];
  private immediateStory = false;
  private listeners = new Set<Listener>();
  private eventListeners = new Set<EventListener>();
  /** 持续按住的输入（左摇杆 / 下穿跳台 / 攻击键） */
  held = { move: 0, down: false, fire: false };
  /** 实时拖拽爆炎弹瞄准向量（画面层据此画抛物线预览） */
  grenadeAim: { dx: number; dy: number } | null = null;
  /** 这一步刚按下的输入，被规则层读走一次就清掉 */
  private pressed = { fire: false, jump: false, dodge: false, reload: false, swap: false, skill: false, grenade: false, interact: false };
  private grenadeAimPayload: { dx: number; dy: number } | null = null;
  private acc = 0;

  constructor() {
    this.onEvent((e) => audio.onEvent(e));
  }

  panel(): Panel {
    if (this.choosing) return 'class';
    if (!this.started) {
      if (this.stack.length && this.stack[this.stack.length - 1] === 'lore') return 'lore';
      return 'title';
    }
    if (this.immediateStory && this.storyQueue.length > 0) return 'story';
    if (this.stack.length) return this.stack[this.stack.length - 1];
    if (this.storyQueue.length > 0) return 'story';
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

  enqueueStory(title: string, lines: readonly StoryLine[], immediate = false) {
    if (!lines.length) return;
    if (immediate) this.immediateStory = true;
    for (const line of lines) this.storyQueue.push({ title, line });
    this.releaseAll();
    if (!immediate || !this.stack.length) audio.storyBlip(this.storyQueue[0].line.npc);
    this.syncBgm();
    this.notify();
  }

  nextStory() {
    audio.unlock();
    if (!this.storyQueue.length) return;
    this.storyQueue.shift();
    if (this.storyQueue.length > 0) {
      audio.storyBlip(this.storyQueue[0].line.npc);
    } else {
      this.immediateStory = false;
      audio.uiClick();
    }
    this.syncBgm();
    this.notify();
  }

  skipStory() {
    audio.unlock();
    audio.uiClick();
    this.storyQueue = [];
    this.immediateStory = false;
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

  setDifficulty(d: DifficultyId) {
    audio.unlock();
    audio.uiClick();
    this.selectedDifficulty = d;
    this.notify();
  }

  restart(cls: ClassId = this.run.cls, difficulty: DifficultyId = this.selectedDifficulty) {
    audio.unlock();
    audio.uiClick();
    this.choosing = false;
    this.run = newRun(Date.now() % 100000, unlockedWeapons(this.meta.stars), cls, difficulty, {
      metVips: this.meta.metVips, mastery: this.meta.recipeMastery, decor: this.meta.unlockedDecor,
    });
    this.stack = [];
    this.storyQueue = [];
    this.immediateStory = false;
    this.started = true;
    this.releaseAll();
    this.enqueueStory('序幕 · 暮夜酒馆', CINEMATIC_INTRO);
    this.emit({ t: 'dayStart', day: 1 });
    this.syncBgm();
    this.notify();
  }

  toggleMute() {
    audio.toggleMute();
    if (!audio.muted) this.syncBgm();
    this.notify();
  }

  press(k: keyof Game['pressed'], aim?: { dx: number; dy: number } | null) {
    audio.unlock();
    if (k === 'interact') {
      if (this.handleInteract()) return;
    }
    if (k === 'grenade') this.grenadeAimPayload = aim ?? null;
    this.pressed[k] = true;
  }

  /** 根据主角当前位置自动执行或打开附近交互（灶台铁板出锅/酒桶斟酒/传菜台/收碗/端盘上菜/NPC搭话/商店/工坊/进出木门）。 */
  handleInteract(): boolean {
    const r = this.run;
    const ct = nearbyCampTarget(r);
    if (ct) {
      switch (ct.kind) {
        case 'pourFinish':
          return this.send({ t: 'stopPour' });
        case 'pourStart':
          audio.uiClick();
          return this.send({ t: 'startPour', drink: ct.drink, guestId: ct.guest?.id ?? null });
        case 'grindMortar':
          return this.send({ t: 'grindMortar' });
        case 'serveDrink':
          return this.send({ t: 'serveDrink', guestId: ct.guest.id });
        case 'serveCarried':
          return this.send({ t: 'serveCarried' });
        case 'cleanTable':
          return this.send({ t: 'cleanTable', plateId: ct.plateId });
        case 'pickCounter':
          return this.send({ t: 'pickCounterDish', id: ct.counterDish.id });
        case 'guestTalk': {
          const g = ct.guest;
          const sp = SPEAKERS.ming;
          const isDrink = g.orderKind === 'drink';
          const costStr = g.isRye ? '断货救急' : formatRecipeCost(MEALS[g.dish].cost);
          const quote = g.served
            ? (g.reactionQuote ?? g.thanksQuote)
            : isDrink
              ? `「${g.orderQuote}」——点单：${g.dishName}（饮品→${g.pay}金）`
              : `「${g.orderQuote}」——点单：${g.dishName}（${costStr}→${g.pay}金${g.trendMatch ? ' · 今夜热门' : ''}）`;
          const hasStockOrIng = (r.diner.menuStock[g.dish] ?? 0) > 0 || hasIngredients(r, MEALS[g.dish].cost);
          const reply = g.served
            ? '慢用！屋里炉火常亮，明晚还来喝口热汤。'
            : isDrink
              ? '好嘞，马上到旁边的原木酒桶替您现打一扎！'
              : hasStockOrIng
                ? '好嘞，后厨砖灶已记下这一单，出锅就从传菜台替您端来！'
                : '记下了！今夜备菜稍紧，先替您现烤干硬黑麦饼垫垫腹。';
          this.enqueueStory(`${g.name} · ${g.role}`, [
            { npc: g.vipId, name: g.name, initial: g.name[0] ?? '客', role: g.role, avatar: g.sprite, text: quote },
            { npc: 'ming', name: sp.name, initial: sp.initial, role: sp.desc, avatar: sp.avatar, text: reply },
          ], true);
          return true;
        }
        case 'allyTalk': {
          const a = ALLIES[ct.ally];
          const join = COMPANION_JOIN_STORIES[a.joinDay];
          const campBanter: Record<AllyId, string> = {
            zhang: r.inside ? '屋外寒雾越压越低，迎战时我就守在屋顶替你挺紧银枪！传菜台快堆满时我来搭手端！' : '屋顶高台视野通透，只要魔物敢露头，我这杆银枪当场贯穿！',
            lin:   r.inside ? '灶火旁温着绯火药罐，开张后我看紧左灶加快出菜，迎战再替你调息轰散前排！' : '门廊药囊都在手里，待我用绯火轰散前排，顺带替你慢慢续伤！',
            qiang: r.inside ? '右侧铁砧刚淬过火，久未收拾的脏碗盘我也会顺手擦净，造塔加固一律九折！' : '壁垒前由我顶着！靠过来的腐尸先吃一记重铠斩击，空隙我也会顺手修墙。',
            zhao:  r.inside ? '驿道上的商旅都在传咱们暮夜酒馆的名头，今夜堂食涨粉快三成，我来照应中间茶座！' : '半空扑来的夜翼魔蝠与提灯怨灵由我苍蓝气劲盯死，胡掌柜只管放手杀敌！',
          };
          const lines: StoryLine[] = [
            { npc: ct.ally, name: a.name, initial: a.initial, role: `${a.role} · ${a.buffDesc}`, avatar: a.sprite, text: campBanter[ct.ally] },
            ...(join ? join.lines.slice(-1) : []),
          ];
          this.enqueueStory(`${a.name} · ${a.role}`, lines, true);
          return true;
        }
        case 'drink':
          if (!r.carryingDish && !r.carryingDrink && !r.pourMinigame) {
            audio.uiClick();
            return this.send({ t: 'startPour', drink: 'beer', guestId: null });
          }
          this.open('kitchen'); return true;
        case 'pass':
        case 'kitchen': this.open('kitchen'); return true;
        case 'shop': this.open('shop'); return true;
        case 'workshop': this.open('build'); return true;
        case 'doorOut': return this.send({ t: 'exitHouse' });
        case 'doorIn': return this.send({ t: 'enterHouse' });
      }
    }
    if (r.inside) {
      const st = nearbyStation(r);
      if (st === 'mortar') return this.send({ t: 'grindMortar' });
      if (st === 'kitchen' || st === 'pass') { this.open('kitchen'); return true; }
      if (st === 'drink') {
        if (!r.carryingDish && !r.carryingDrink && !r.pourMinigame) {
          audio.uiClick();
          return this.send({ t: 'startPour', drink: 'beer', guestId: null });
        }
        return false;
      }
      if (st === 'shop') { this.open('shop'); return true; }
      if (st === 'workshop') { this.open('build'); return true; }
      if (st === 'door') { return this.send({ t: 'exitHouse' }); }
      return false;
    }
    const ext = nearbyExterior(r);
    if (ext === 'door' && r.phase === 'camp') return this.send({ t: 'enterHouse' });
    return false;
  }

  releaseAll() { this.held.move = 0; this.held.down = false; this.held.fire = false; this.grenadeAim = null; this.grenadeAimPayload = null; }

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
    const beforePhase = this.run.phase, beforeInside = this.run.inside, beforeZone = houseBuff(this.run).zone;
    let urgent = false;
    while (this.acc >= 1000 / 60) {
      this.acc -= 1000 / 60;
      const input: Input = {
        ...NO_INPUT,
        ...this.held,
        ...this.pressed,
        fire: this.held.fire || this.pressed.fire,
        grenadeAim: this.grenadeAimPayload,
      };
      this.pressed = { fire: false, jump: false, dodge: false, reload: false, swap: false, skill: false, grenade: false, interact: false };
      this.grenadeAimPayload = null;
      for (const e of step(this.run, input)) {
        if (
          e.t === 'bossAppear' || e.t === 'pickup' || e.t === 'star' || e.t === 'kill' || e.t === 'hurt' || e.t === 'swap'
          || e.t === 'pourDone' || e.t === 'tableClean' || e.t === 'guestAngry' || e.t === 'shiftEnd' || e.t === 'shiftOpen' || e.t === 'serve'
          || e.t === 'grindSauce' || e.t === 'sauceEmpty' || e.t === 'kitchenDone' || e.t === 'research' || e.t === 'prepDish'
          || e.t === 'dispatchReturn' || e.t === 'rackHarvest' || e.t === 'partyStart' || e.t === 'endlessEnter'
        ) {
          urgent = true;
        }
        this.emit(e);
      }
    }
    if (this.run.phase !== beforePhase || this.run.inside !== beforeInside) {
      if (this.run.phase !== beforePhase) this.releaseAll();
      this.syncBgm();
    }
    const liveTavern = this.run.phase === 'camp' && this.run.inside && this.run.dinerShift.mode === 'open' && this.run.tick % 4 === 0;
    if (urgent || liveTavern || this.run.tick % 6 === 0 || this.run.phase !== beforePhase || this.run.inside !== beforeInside || houseBuff(this.run).zone !== beforeZone) {
      this.syncBgm();
      this.notify();
    }
  }

  private syncBgm() {
    if (!this.started) { audio.syncMood('none'); return; }
    const p = this.panel();
    const ph = this.run.phase;
    if (ph === 'dead') { audio.syncMood('none'); return; }
    if (ph === 'won' && p !== 'story') { audio.syncMood('none'); return; }
    if (this.choosing || ph === 'perk' || ph === 'camp' || this.run.inside || (p === 'story' && this.run.tick === 0)) {
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
    if (e.t === 'bossDead' && e.bossIdx === 2) {
      this.enqueueStory('终章 · 破晓归途', BOSS_VICTORY[2] ?? []);
    } else if (e.t === 'allyJoin') {
      const join = COMPANION_JOIN_STORIES[e.day];
      if (join) this.enqueueStory(`${ALLIES[e.ally].name} 加入据点`, join.lines);
    } else if (e.t === 'dinerStory') {
      const ev = REST_STORY[e.eventKey];
      if (ev) this.enqueueStory(ev.title, ev.lines);
    } else if (e.t === 'dead' || e.t === 'won') {
      const firstFinish = !(e.t === 'dead' && this.run.endless);
      this.lastGain = firstFinish ? starsEarned(this.run) : 0;
      this.meta = recordRunToMeta(this.meta, this.run, firstFinish);
      saveMeta(this.meta);
    } else if (e.t === 'shiftEnd' || e.t === 'endlessEnter' || e.t === 'research') {
      this.meta = recordRunToMeta(this.meta, this.run, false);
      saveMeta(this.meta);
    }
    this.eventListeners.forEach((fn) => fn(e));
  }
}

export const game = new Game();
