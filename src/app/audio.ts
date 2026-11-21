// 离线真实开源音效与无缝循环背景音乐引擎（全部音源来自 GitHub 开源仓库真人类作品并附 CC0 / CC-BY 署名，零自主合成波形）。
import type { GameEvent } from '../sim/types';

export type BgmMood = 'none' | 'tavern' | 'battle' | 'boss';

const MUTE_KEY = 'wz57.mute';

const AUDIO_URLS = import.meta.glob('../assets/audio/*.ogg', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const urlFor = (id: string): string | undefined => AUDIO_URLS[`../assets/audio/${id}.ogg`];

type PlayOpts = { gain?: number; rate?: number; jitter?: number; delay?: number };

const BGM_TRACK: Record<Exclude<BgmMood, 'none'>, { id: string; gain: number }> = {
  tavern: { id: 'bgm_tavern', gain: 0.92 },
  battle: { id: 'bgm_battle', gain: 0.88 },
  boss: { id: 'bgm_boss', gain: 0.94 },
};

const ALL_SFX_IDS = [
  'sfx_ui_click', 'sfx_aim_tick', 'sfx_story_blip',
  'sfx_wp_pistol', 'sfx_wp_revolver', 'sfx_wp_smg', 'sfx_wp_shotgun',
  'sfx_wp_assault', 'sfx_wp_rifle', 'sfx_wp_tesla', 'sfx_wp_rocket',
  'sfx_wp_cannon', 'sfx_wp_turret',
  'sfx_hit', 'sfx_crit', 'sfx_boom', 'sfx_lightning', 'sfx_frost',
  'sfx_hurt', 'sfx_wall_hit', 'sfx_kill',
  'sfx_jump', 'sfx_dodge', 'sfx_reload', 'sfx_swap', 'sfx_empty',
  'sfx_coin', 'sfx_build', 'sfx_cook_sizzle', 'sfx_serve', 'sfx_good',
  'sfx_fanfare', 'sfx_fail', 'sfx_skill', 'sfx_boss_appear',
  'sfx_day_start', 'sfx_door',
] as const;

function decodeDataUri(url: string): ArrayBuffer {
  const idx = url.indexOf(',');
  const bin = atob(idx >= 0 ? url.slice(idx + 1) : url);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private loading = new Map<string, Promise<AudioBuffer | null>>();
  private preloaded = false;

  private activeBgm: { mood: BgmMood; src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private bgmSeq = 0;
  private mood: BgmMood = 'none';
  muted = false;

  private lastShot = 0;
  private lastHit = 0;
  private lastKill = 0;
  private lastWallHit = 0;
  private lastAimTick = 0;
  private lastEmpty = 0;
  private killStreak = 0;

  constructor() {
    try { this.muted = localStorage.getItem(MUTE_KEY) === '1'; } catch { /* ignore */ }
  }

  private ensure(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      const ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -5;
      comp.knee.value = 6;
      comp.ratio.value = 4;
      comp.attack.value = 0.002;
      comp.release.value = 0.12;

      const master = ctx.createGain();
      master.gain.value = 0.94;
      const sfx = ctx.createGain();
      sfx.gain.value = 1.0;
      const bgm = ctx.createGain();
      bgm.gain.value = 0.62;

      sfx.connect(master);
      bgm.connect(master);
      master.connect(comp);
      comp.connect(ctx.destination);

      this.ctx = ctx;
      this.master = master;
      this.sfxGain = sfx;
      this.bgmGain = bgm;
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().then(() => {
        if (!this.muted && this.mood !== 'none') this.ensureBgm();
      }).catch(() => { /* wait for user gesture */ });
    }
    if (!this.preloaded) {
      this.preloaded = true;
      for (const m of ['tavern', 'battle', 'boss'] as const) void this.load(BGM_TRACK[m].id);
      for (const id of ALL_SFX_IDS) void this.load(id);
    }
    return this.ctx;
  }

  private load(id: string): Promise<AudioBuffer | null> {
    const cached = this.buffers.get(id);
    if (cached) return Promise.resolve(cached);
    const pending = this.loading.get(id);
    if (pending) return pending;

    const ctx = this.ctx;
    const url = urlFor(id);
    if (!ctx || !url) return Promise.resolve(null);

    const task = (async (): Promise<AudioBuffer | null> => {
      try {
        const raw = url.startsWith('data:')
          ? decodeDataUri(url)
          : await (await fetch(url)).arrayBuffer();
        const buf = await ctx.decodeAudioData(raw);
        this.buffers.set(id, buf);
        return buf;
      } catch {
        return null;
      } finally {
        this.loading.delete(id);
      }
    })();
    this.loading.set(id, task);
    return task;
  }

  private play(id: string, opts?: PlayOpts) {
    const ctx = this.ensure();
    if (!ctx || !this.sfxGain || ctx.state !== 'running') return;
    const buf = this.buffers.get(id);
    if (!buf) {
      void this.load(id);
      return;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const jitter = opts?.jitter ? (Math.random() * 2 - 1) * opts.jitter : 0;
    const rate = Math.max(0.55, Math.min(1.85, (opts?.rate ?? 1) + jitter));
    src.playbackRate.value = rate;

    const g = ctx.createGain();
    g.gain.value = opts?.gain ?? 0.9;
    src.connect(g);
    g.connect(this.sfxGain);

    const at = ctx.currentTime + (opts?.delay ?? 0);
    try { src.start(at); } catch { /* ignore invalid state */ }
  }

  private fadeOutBgm(fadeSec = 0.28) {
    const prev = this.activeBgm;
    this.activeBgm = null;
    if (!prev || !this.ctx) return;
    const now = this.ctx.currentTime;
    try {
      prev.gain.gain.cancelScheduledValues(now);
      prev.gain.gain.setValueAtTime(prev.gain.gain.value, now);
      prev.gain.gain.linearRampToValueAtTime(0.0001, now + fadeSec);
      prev.src.stop(now + fadeSec + 0.03);
    } catch { /* ignore */ }
  }

  private async ensureBgm() {
    if (this.muted || this.mood === 'none') {
      this.fadeOutBgm(0.2);
      return;
    }
    if (this.activeBgm && this.activeBgm.mood === this.mood) return;

    const targetMood = this.mood;
    const seq = ++this.bgmSeq;
    const spec = BGM_TRACK[targetMood];
    const ctx = this.ensure();
    if (!ctx) return;

    const buf = this.buffers.get(spec.id) ?? await this.load(spec.id);
    if (!buf || this.muted || this.mood !== targetMood || this.bgmSeq !== seq) return;
    if (!this.ctx || !this.bgmGain || this.ctx.state !== 'running') return;
    if (this.activeBgm && this.activeBgm.mood === targetMood) return;

    this.fadeOutBgm(0.28);
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(spec.gain, now + 0.24);
    src.connect(g);
    g.connect(this.bgmGain);
    src.start(now);

    this.activeBgm = { mood: targetMood, src, gain: g };
  }

  unlock() {
    const ctx = this.ensure();
    if (ctx && !this.muted && this.mood !== 'none') void this.ensureBgm();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    try { localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0'); } catch { /* ignore */ }
    if (this.muted) {
      this.bgmSeq++;
      this.fadeOutBgm(0.12);
      if (this.master && this.ctx) this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.03);
    } else {
      const ctx = this.ensure();
      if (ctx && this.master) this.master.gain.setTargetAtTime(0.94, ctx.currentTime, 0.04);
      if (this.mood !== 'none') void this.ensureBgm();
      this.uiClick();
    }
    return this.muted;
  }

  syncMood(mood: BgmMood) {
    if (this.mood === mood) {
      if (!this.muted && mood !== 'none' && !this.activeBgm && this.ctx?.state === 'running') {
        void this.ensureBgm();
      }
      return;
    }
    this.mood = mood;
    if (mood === 'none' || this.muted) {
      this.bgmSeq++;
      this.fadeOutBgm(0.22);
    } else {
      void this.ensureBgm();
    }
  }

  uiClick() {
    this.play('sfx_ui_click', { gain: 0.72, jitter: 0.03 });
  }

  cookSizzle() {
    if (this.muted) return;
    this.play('sfx_cook_sizzle', { gain: 0.96, jitter: 0.04 });
  }

  cookResult(q: 'poor' | 'good' | 'perfect' | 'legendary') {
    if (this.muted) return;
    if (q === 'legendary') {
      this.play('sfx_serve', { gain: 0.92, rate: 1.08 });
      this.play('sfx_fanfare', { gain: 0.95, rate: 1.05, delay: 0.14 });
    } else if (q === 'perfect') {
      this.play('sfx_serve', { gain: 0.88, rate: 1.02 });
      this.play('sfx_fanfare', { gain: 0.85, rate: 1.0, delay: 0.12 });
    } else if (q === 'good') {
      this.play('sfx_serve', { gain: 0.88 });
      this.play('sfx_good', { gain: 0.68, delay: 0.1 });
    } else {
      this.play('sfx_fail', { gain: 0.82 });
    }
  }

  storyBlip(npc: string) {
    if (this.muted) return;
    if (npc === 'watch' || npc === 'dawn' || npc === 'radio' || npc === 'heli') {
      this.play('sfx_aim_tick', { gain: 0.58, rate: 1.35, jitter: 0.04 });
      return;
    }
    const rate = npc.startsWith('boss') ? 0.68
      : npc === 'qiang' ? 0.82
      : npc === 'zhang' ? 0.9
      : npc === 'lin' ? 1.24
      : npc === 'zhao' ? 1.12
      : 1.02;
    this.play('sfx_story_blip', { gain: 0.68, rate, jitter: 0.04 });
  }

  aimTick() {
    if (this.muted) return;
    const now = performance.now();
    if (now - this.lastAimTick < 55) return;
    this.lastAimTick = now;
    this.play('sfx_aim_tick', { gain: 0.56, rate: 1.05, jitter: 0.04 });
  }

  onEvent(e: GameEvent) {
    if (this.muted) return;
    const now = performance.now();
    switch (e.t) {
      case 'shot': {
        if (now - this.lastShot < 38) return;
        this.lastShot = now;
        if (e.from === 'ally') {
          if (e.ally === 'qiang') this.play('sfx_wp_cannon', { gain: 0.72, rate: 1.15, jitter: 0.05 });
          else if (e.ally === 'lin') this.play('sfx_wp_assault', { gain: 0.54, rate: 1.22, jitter: 0.05 });
          else this.play('sfx_wp_turret', { gain: 0.62, rate: e.ally === 'zhao' ? 1.16 : 0.98, jitter: 0.05 });
          return;
        }
        if (e.from === 'fort') {
          this.play('sfx_wp_cannon', { gain: 0.86, rate: 0.95, jitter: 0.04 });
          return;
        }
        if (e.from === 'turret') {
          if (e.turret === 'tesla') this.play('sfx_wp_tesla', { gain: 0.56, rate: 1.15, jitter: 0.05 });
          else if (e.turret === 'frost') this.play('sfx_wp_assault', { gain: 0.52, rate: 1.28, jitter: 0.05 });
          else if (e.turret === 'cannon') this.play('sfx_wp_cannon', { gain: 0.85, rate: 0.94, jitter: 0.04 });
          else this.play('sfx_wp_turret', { gain: 0.52, rate: 1.06, jitter: 0.06 });
          return;
        }
        const w = e.weapon ?? 'pistol';
        if (w === 'tesla') this.play('sfx_wp_tesla', { gain: 0.88, jitter: 0.05 });
        else if (w === 'rocket') this.play('sfx_wp_rocket', { gain: 1.02, rate: 0.97, jitter: 0.04 });
        else if (w === 'shotgun') this.play('sfx_wp_shotgun', { gain: 1.08, rate: 0.98, jitter: 0.04 });
        else if (w === 'rifle') this.play('sfx_wp_rifle', { gain: 1.04, jitter: 0.03 });
        else if (w === 'smg') this.play('sfx_wp_smg', { gain: e.hot ? 0.86 : 0.76, rate: e.hot ? 1.12 : 1.0, jitter: 0.06 });
        else if (w === 'assault') this.play('sfx_wp_assault', { gain: 0.82, rate: 1.08, jitter: 0.05 });
        else if (w === 'revolver') this.play('sfx_wp_revolver', { gain: 0.98, rate: 0.96, jitter: 0.04 });
        else this.play('sfx_wp_pistol', { gain: 0.9, jitter: 0.05 });
        break;
      }
      case 'hit':
        if (now - this.lastHit < 42) return;
        this.lastHit = now;
        this.play('sfx_hit', { gain: e.crit || e.heavy ? 0.78 : 0.55, jitter: 0.08 });
        if (e.overload) {
          this.play('sfx_lightning', { gain: 0.86, rate: 1.18, jitter: 0.06 });
        } else if (e.freeze) {
          this.play('sfx_frost', { gain: 0.78, rate: 1.08, jitter: 0.06 });
        } else if (e.crit) {
          this.play('sfx_crit', { gain: 0.82, jitter: 0.06 });
        }
        break;
      case 'boom':
        this.play('sfx_boom', { gain: 0.98, jitter: 0.05 });
        break;
      case 'lightning':
        this.play('sfx_lightning', { gain: 0.8, jitter: 0.08 });
        break;
      case 'frost':
        this.play('sfx_frost', { gain: 0.84, jitter: 0.06 });
        break;
      case 'kill': {
        if (now - this.lastKill < 45) return;
        this.killStreak = now - this.lastKill < 950 ? Math.min(5, this.killStreak + 1) : 0;
        this.lastKill = now;
        const rate = 0.98 + this.killStreak * 0.04;
        this.play('sfx_kill', { gain: e.boss ? 1.0 : 0.76, rate, jitter: 0.04 });
        break;
      }
      case 'hurt':
        this.play('sfx_hurt', { gain: e.cover ? 0.74 : 0.94, rate: e.cover ? 1.1 : 1.0, jitter: 0.05 });
        break;
      case 'wallHit':
      case 'homeHit':
        if (now - this.lastWallHit < 110) return;
        this.lastWallHit = now;
        this.play('sfx_wall_hit', { gain: e.t === 'homeHit' ? 0.9 : 0.72, rate: e.t === 'homeHit' ? 0.86 : 1.0, jitter: 0.06 });
        break;
      case 'jump':
        this.play('sfx_jump', { gain: 0.54, rate: e.onRoof ? 1.08 : 1.0, jitter: 0.04 });
        break;
      case 'swap':
        this.play('sfx_swap', { gain: 0.84, jitter: 0.04 });
        break;
      case 'empty':
        if (now - this.lastEmpty < 180) return;
        this.lastEmpty = now;
        this.play('sfx_empty', { gain: 0.72 });
        break;
      case 'dodge':
      case 'grenadeThrow':
        this.play('sfx_dodge', { gain: 0.88, rate: e.t === 'grenadeThrow' ? 1.14 : 1.0, jitter: 0.05 });
        break;
      case 'reload':
        this.play('sfx_reload', { gain: 0.95, jitter: 0.03 });
        break;
      case 'kitchenDone':
        this.play('sfx_serve', { gain: 0.72, rate: e.isRye ? 0.86 : 1.08 });
        break;
      case 'grindSauce':
        this.play('sfx_cook_sizzle', { gain: 0.72, rate: 1.24 });
        break;
      case 'sauceEmpty':
        this.play('sfx_empty', { gain: 0.88, rate: 0.9 });
        break;
      case 'research':
        this.play('sfx_good', { gain: 0.9, rate: 1.08 });
        break;
      case 'prepDish':
        this.play('sfx_cook_sizzle', { gain: 0.76, rate: 1.0 });
        break;
      case 'pourDone':
      case 'serve':
        this.cookResult(e.quality);
        break;
      case 'tableClean':
        this.play('sfx_coin', { gain: 0.72, rate: 1.16 });
        break;
      case 'guestAngry':
        this.play('sfx_fail', { gain: 0.78, rate: 0.92 });
        break;
      case 'shiftOpen':
        this.play('sfx_door', { gain: 0.85 });
        this.play('sfx_day_start', { gain: 0.85, rate: 1.12, delay: 0.08 });
        break;
      case 'shiftEnd':
        this.play('sfx_fanfare', { gain: 0.92 });
        break;
      case 'allyJoin':
      case 'partyStart':
      case 'endlessEnter':
        this.play('sfx_fanfare', { gain: 0.96, rate: 1.06 });
        break;
      case 'dispatchReturn':
      case 'rackHarvest':
        this.play('sfx_good', { gain: 0.85, rate: 1.06 });
        break;
      case 'pickup':
      case 'star':
      case 'shop':
        this.play('sfx_coin', { gain: 0.92, rate: e.t === 'star' ? 1.1 : 1.0 });
        if (e.t === 'star' || (e.t === 'pickup' && e.isNew)) this.play('sfx_good', { gain: 0.65, delay: 0.08 });
        break;
      case 'build':
        this.play('sfx_build', { gain: 0.92, jitter: 0.05 });
        break;
      case 'cook':
      case 'meal':
        this.play('sfx_cook_sizzle', { gain: 0.88 });
        this.play('sfx_serve', { gain: 0.84, delay: 0.14 });
        break;
      case 'skill':
        this.play('sfx_skill', { gain: 0.94 });
        break;
      case 'bossAppear':
        this.play('sfx_day_start', { gain: 0.88, rate: 0.84 });
        this.play('sfx_boss_appear', { gain: 0.96, delay: 0.12 });
        break;
      case 'bossDead':
        this.play('sfx_fanfare', { gain: 1.0, rate: 1.05 });
        break;
      case 'dayStart':
        this.play('sfx_day_start', { gain: 0.92 });
        break;
      case 'dayClear':
      case 'won':
        this.play('sfx_fanfare', { gain: 0.96 });
        break;
      case 'dead':
        this.play('sfx_fail', { gain: 0.95 });
        break;
      case 'inside':
        this.play('sfx_door', { gain: 0.78, rate: e.inside ? 1.0 : 1.08 });
        break;
    }
  }
}

export const audio = new SoundEngine();
