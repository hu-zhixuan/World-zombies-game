// 把规则层、画面层、音效与界面层接起来的地方。全游戏只有这一份状态。
import { ZOMBIES, unlockedWeapons, type ClassId, type DifficultyId } from '../content/data';
import {
  ALLIES, BOSS_VICTORY, CINEMATIC_INTRO, COMPANION_JOIN_STORIES,
  REST_STORY, SPEAKERS, type AllyId, type StoryLine,
} from '../content/story';
import { MAX_CARRY, command, houseBuff, nearbyCampTarget, nearbyExterior, nearbyStation, nearbyWeaponCrate, newRun, step } from '../sim/sim';
import { NO_INPUT, type Command, type GameEvent, type Input, type RunState } from '../sim/types';
import { audio } from './audio';
import { loadMeta, recordRunToMeta, saveMeta, starsEarned, type MetaState } from './meta';

/** 玩家主动打开的弹窗。三选一与结算直接由 run.phase 驱动；营地夜晚可直接在屋里烤肉并直跳商店与升级。 */
export type UserPanel = 'shop' | 'build' | 'pause' | 'lore' | 'weaponSwap';
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
  pendingSwapCrateId: number | null = null;
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
  /** 营地点地自动寻路目标（手动摇杆随时接管） */
  walkTarget: { x: number; autoInteract: boolean } | null = null;
  private grenadeAimPayload: { dx: number; dy: number } | null = null;
  private acc = 0;

  constructor() {
    this.onEvent((e) => audio.onEvent(e));
  }

  walkTo(x: number, autoInteract = true) {
    if (this.panel() !== null || this.run.phase !== 'camp') return;
    audio.unlock();
    this.walkTarget = { x, autoInteract };
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
    if (p === 'shop' || p === 'build') {
      this.stack = this.stack.filter((x) => x !== 'shop' && x !== 'build');
    }
    if (!this.stack.includes(p)) {
      this.stack.push(p);
      this.releaseAll();
      this.syncBgm();
      this.notify();
    }
  }

  openWeaponSwap(crateId: number) {
    const c = this.run.crates.find((o) => o.id === crateId && o.kind !== 'supply' && (o.y ?? 0) >= -8);
    if (!c) return false;
    const p = this.run.player;
    const owned = p.weapons.some((w) => w.id === c.weapon);
    if (owned || p.weapons.length < MAX_CARRY) {
      return this.send({ t: 'pickupCrate', crateId: c.id });
    }
    this.pendingSwapCrateId = c.id;
    this.open('weaponSwap');
    return true;
  }

  close() {
    audio.uiClick();
    const popped = this.stack.pop();
    if (popped === 'weaponSwap') this.pendingSwapCrateId = null;
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
    this.pendingSwapCrateId = null;
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
    this.pendingSwapCrateId = null;
    this.run = newRun(Date.now() % 100000, unlockedWeapons(this.meta.stars), cls, difficulty, {
      metVips: this.meta.metVips, mastery: this.meta.recipeMastery, decor: this.meta.unlockedDecor,
    });
    this.stack = [];
    this.storyQueue = [];
    this.immediateStory = false;
    this.started = true;
    this.releaseAll();
    this.enqueueStory('序幕 · 逆夜突围', CINEMATIC_INTRO);
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

  /** 根据主角当前位置自动执行或打开附近交互（炉灶烤肉/停火出锅/端肉上桌/NPC搭话/商店/工坊/进出木门）。 */
  handleInteract(): boolean {
    const r = this.run;
    const ct = nearbyCampTarget(r);
    if (ct) {
      switch (ct.kind) {
        case 'grillFinish':
          return this.send({ t: 'stopGrill' });
        case 'grillStart':
          audio.uiClick();
          return this.send({ t: 'startGrill', guestId: ct.guest?.id ?? null });
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
          const quote = g.served
            ? (g.reactionQuote ?? g.thanksQuote)
            : g.orderQuote;
          const reply = g.served
            ? '慢用！趁热吃饱了，明晚一起把东门掀了！'
            : '马上来！红砖炉灶正旺，这就给你烤一份滚烫鲜肉端上桌！';
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
            zhang: r.inside
              ? '镇长早叫我这伤腿老兵缩地窖等死，去他的规矩！小胡，你一个大学生都敢掀桌，屋顶高台归我架银枪！'
              : '谁给黑雾定的死局？老子偏不认！敢露头的腐尸，先吃我屋顶一记银枪贯穿！',
            lin: r.inside
              ? '公会那帮老古董锁门装死，我偏陪你把这口红砖烤炉烧旺！打起来阎王也别想从我手里抢人！'
              : '别怕受伤，小胡！绯火药囊全备齐了——前排归我轰穿，你只管放肆开火，你的命我替你从死神手里硬抢回来！',
            qiang: r.inside
              ? '铺子塌了算个屁？造塔加固随时来找我，谁也别想给咱们画死线！'
              : '暴君踩碎我炉子想叫我下跪？做梦！前院由我重铠劈开，敢撞门的烂骨头全当我的磨刀石！',
            zhao: r.inside
              ? '清规戒律叫我闭门敲钟等超度，我把木鱼砸了过来陪你闹翻西街！杀穿重围咱们奉陪到底！'
              : '天上装神弄鬼的魔蝠与怨灵归我苍蓝气劲挨个打落！小胡，只管放手掀翻这鬼夜，头顶有我小赵罩着！',
          };
          const lines: StoryLine[] = [
            { npc: ct.ally, name: a.name, initial: a.initial, role: `${a.role} · ${a.buffDesc}`, avatar: a.sprite, text: campBanter[ct.ally] },
            ...(join ? join.lines.slice(-1) : []),
          ];
          this.enqueueStory(`${a.name} · ${a.role}`, lines, true);
          return true;
        }
        case 'drink':
        case 'pass':
        case 'kitchen':
          audio.uiClick();
          return this.send({ t: 'startGrill' });
        case 'shop': this.open('shop'); return true;
        case 'workshop': this.open('build'); return true;
        case 'turretSlot': {
          const sl = r.turrets[ct.slot];
          if (sl?.type) {
            if (this.send({ t: 'upgradeTurret', slot: ct.slot })) return true;
            return this.send({ t: 'cycleTurretMode', slot: ct.slot });
          }
          if (this.send({ t: 'buildTurret', slot: ct.slot, kind: 'mg' })) return true;
          this.open('build'); return true;
        }
        case 'wallSpot': {
          if (r.wall.hp < r.wall.maxHp && this.send({ t: 'repairWall' })) return true;
          if (this.send({ t: 'upgradeWall' })) return true;
          this.open('build'); return true;
        }
        case 'fortSpot': {
          if (r.home.hp < r.home.maxHp && this.send({ t: 'repairFort' })) return true;
          if (this.send({ t: 'upgradeFort' })) return true;
          this.open('build'); return true;
        }
        case 'doorOut': return this.send({ t: 'exitHouse' });
        case 'doorIn': return this.send({ t: 'enterHouse' });
      }
    }
    if (r.inside) {
      const st = nearbyStation(r);
      if (st === 'kitchen') { audio.uiClick(); return this.send({ t: 'startGrill' }); }
      if (st === 'shop') { this.open('shop'); return true; }
      if (st === 'workshop') { this.open('build'); return true; }
      if (st === 'door') { return this.send({ t: 'exitHouse' }); }
      return false;
    }
    const ext = nearbyExterior(r);
    if (ext === 'door' && r.phase === 'camp') return this.send({ t: 'enterHouse' });
    const nearWc = nearbyWeaponCrate(r);
    if (nearWc) return this.openWeaponSwap(nearWc.id);
    return false;
  }

  releaseAll() { this.held.move = 0; this.held.down = false; this.held.fire = false; this.grenadeAim = null; this.grenadeAimPayload = null; this.walkTarget = null; }

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
    if (this.panel() !== null) { this.acc = 0; this.walkTarget = null; return; }

    this.acc = Math.min(this.acc + dtMs, 100);
    const beforePhase = this.run.phase, beforeInside = this.run.inside, beforeZone = houseBuff(this.run).zone;
    let urgent = false;
    while (this.acc >= 1000 / 60) {
      this.acc -= 1000 / 60;
      let autoMove = 0;
      if (this.held.move !== 0 || this.run.phase !== 'camp' || this.run.pourMinigame || this.run.grillMinigame) {
        this.walkTarget = null;
      } else if (this.walkTarget) {
        const dx = this.walkTarget.x - this.run.player.x;
        if (Math.abs(dx) <= 14) {
          const doAct = this.walkTarget.autoInteract;
          this.walkTarget = null;
          if (doAct) {
            this.handleInteract();
            urgent = true;
          }
        } else {
          autoMove = Math.sign(dx);
        }
      }
      const input: Input = {
        ...NO_INPUT,
        ...this.held,
        move: this.held.move !== 0 ? this.held.move : autoMove,
        ...this.pressed,
        fire: this.held.fire || this.pressed.fire,
        grenadeAim: this.grenadeAimPayload,
      };
      this.pressed = { fire: false, jump: false, dodge: false, reload: false, swap: false, skill: false, grenade: false, interact: false };
      this.grenadeAimPayload = null;
      for (const e of step(this.run, input)) {
        if (
          e.t === 'bossAppear' || e.t === 'pickup' || e.t === 'supplyPickup' || e.t === 'star' || e.t === 'kill' || e.t === 'hurt' || e.t === 'swap'
          || e.t === 'grillDone' || e.t === 'pourDone' || e.t === 'tableClean' || e.t === 'guestAngry' || e.t === 'shiftEnd' || e.t === 'shiftOpen' || e.t === 'serve'
          || e.t === 'grindSauce' || e.t === 'sauceEmpty' || e.t === 'kitchenDone' || e.t === 'research' || e.t === 'prepDish'
          || e.t === 'dispatchReturn' || e.t === 'rackHarvest' || e.t === 'partyStart' || e.t === 'endlessEnter'
          || e.t === 'contractDone' || e.t === 'dishLevelUp' || e.t === 'fortify'
          || e.t === 'barrelBoom' || e.t === 'airdropDrop' || e.t === 'airdropSlam' || e.t === 'lanternBreak' || e.t === 'guardBreak' || e.t === 'perfectDodge'
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
