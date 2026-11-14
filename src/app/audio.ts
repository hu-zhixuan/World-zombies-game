// 100% 离线 Web Audio 音效与多音轨前瞻合成背景音乐引擎（元气骑士风战斗曲 + 温暖酒馆爵士，不依赖外部音频）。
import type { GameEvent } from '../sim/types';

export type BgmMood = 'none' | 'tavern' | 'battle' | 'boss';

const MUTE_KEY = 'wz57.mute';

// MIDI 音符转频率，方便谱写完整的 64 步 A/B 乐句
const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

// ── 1. 深夜酒馆小调（Dm9 -> G13 -> Cmaj9 -> A7sus4，温暖木吉他分解 + 电钢主旋律，64 步 = 4 小节） ──
const TAVERN_BASS = [
  50, 0, 0, 50, 57, 0, 50, 0,   43, 0, 0, 43, 50, 0, 43, 0,
  48, 0, 0, 48, 55, 0, 48, 0,   45, 0, 0, 45, 52, 0, 45, 0,
  50, 0, 0, 50, 57, 0, 50, 0,   43, 0, 0, 43, 50, 0, 43, 0,
  48, 0, 0, 48, 55, 0, 47, 0,   45, 0, 52, 0, 55, 0, 52, 0,
];
const TAVERN_ARP = [
  62, 65, 69, 72, 69, 65, 62, 69,  59, 62, 67, 71, 67, 62, 59, 67,
  60, 64, 67, 71, 67, 64, 60, 67,  57, 62, 64, 67, 64, 62, 57, 64,
  62, 65, 69, 72, 74, 72, 69, 65,  59, 62, 67, 71, 74, 71, 67, 62,
  60, 64, 67, 71, 74, 71, 67, 64,  57, 61, 64, 67, 69, 67, 64, 61,
];
const TAVERN_MEL = [
  74, 0, 72, 0, 69, 0, 0, 72,   71, 0, 67, 0, 62, 0, 0, 0,
  64, 0, 67, 0, 71, 0, 69, 0,   64, 0, 0, 0, 0, 0, 69, 0,
  74, 0, 76, 0, 77, 0, 74, 0,   71, 0, 74, 0, 67, 0, 0, 0,
  72, 0, 71, 0, 67, 0, 64, 0,   69, 0, 0, 0, 0, 0, 0, 0,
];

// ── 2. 元气像素守城战歌（Em -> C -> D -> Bm/B7，双段燃系 A/B 副歌，143 BPM 十六分律动） ──
const BATTLE_BASS = [
  40, 0, 40, 52, 40, 0, 52, 40,  40, 0, 40, 52, 40, 52, 43, 47,
  36, 0, 36, 48, 36, 0, 48, 36,  38, 0, 38, 50, 38, 50, 45, 50,
  40, 0, 40, 52, 40, 0, 52, 40,  40, 0, 40, 52, 40, 52, 47, 52,
  36, 0, 48, 36, 38, 0, 50, 38,  47, 0, 47, 59, 47, 54, 51, 47,
];
const BATTLE_LEAD = [
  // A 段：爽脆顿音主Hook
  64, 0, 67, 0, 71, 0, 74, 0,   71, 0, 67, 64, 67, 0, 64, 0,
  60, 0, 64, 0, 67, 0, 72, 0,   74, 0, 72, 69, 66, 0, 62, 0,
  // B 段：高八度冲锋副歌
  76, 0, 74, 0, 71, 0, 74, 76,  79, 0, 76, 74, 71, 0, 67, 0,
  72, 0, 71, 69, 74, 0, 71, 69,  71, 0, 66, 0, 63, 0, 66, 0,
];
const BATTLE_ARP = [
  52, 55, 59, 55, 52, 55, 59, 55,  52, 55, 59, 55, 52, 59, 55, 52,
  48, 52, 55, 52, 50, 54, 57, 54,  50, 54, 57, 54, 50, 57, 54, 50,
  52, 55, 59, 64, 59, 55, 52, 59,  52, 55, 59, 64, 59, 55, 52, 59,
  48, 52, 55, 52, 50, 54, 57, 54,  47, 51, 54, 59, 54, 51, 47, 54,
];

// ── 3. Boss 死斗狂飙曲（弗里吉亚急拍，163 BPM） ──
const BOSS_BASS = [
  40, 40, 52, 40, 40, 40, 52, 40,  41, 41, 53, 41, 43, 43, 55, 43,
  40, 40, 52, 40, 40, 40, 52, 40,  47, 47, 59, 47, 46, 46, 45, 43,
  40, 40, 52, 40, 41, 41, 53, 41,  43, 43, 55, 43, 44, 44, 56, 44,
  48, 48, 60, 48, 47, 47, 59, 47,  46, 45, 43, 41, 40, 43, 46, 47,
];
const BOSS_LEAD = [
  64, 0, 65, 64, 67, 0, 64, 0,   65, 0, 69, 65, 71, 0, 67, 0,
  76, 0, 77, 76, 79, 0, 76, 0,   74, 71, 69, 67, 65, 64, 63, 64,
  64, 67, 71, 76, 77, 76, 72, 69,  71, 74, 79, 76, 74, 71, 67, 64,
  72, 0, 76, 0, 74, 0, 71, 0,    76, 0, 75, 0, 74, 0, 71, 0,
];

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private echoSend: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  muted = false;
  private mood: BgmMood = 'none';
  private stepIdx = 0;
  private nextStepAt = 0;
  private timer: number | null = null;
  private lastShot = 0;
  private lastHit = 0;
  private lastKill = 0;
  private killStreak = 0;
  private lastAimTick = 0;
  private lastEmpty = 0;

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
      comp.threshold.value = -13; comp.ratio.value = 5.5;
      const master = ctx.createGain();
      master.gain.value = 0.56;
      const sfx = ctx.createGain();
      sfx.gain.value = 0.78;
      const bgm = ctx.createGain();
      bgm.gain.value = 0.36;

      // 立体声暖回声总线：只加给 BGM 旋律，不糊打击乐与枪声
      const delay = ctx.createDelay(0.5);
      delay.delayTime.value = 0.21;
      const echoLp = ctx.createBiquadFilter();
      echoLp.type = 'lowpass'; echoLp.frequency.value = 1850;
      const echoFb = ctx.createGain();
      echoFb.gain.value = 0.25;
      const echoSend = ctx.createGain();
      echoSend.gain.value = 0.34;
      echoSend.connect(delay); delay.connect(echoLp); echoLp.connect(echoFb); echoFb.connect(delay); echoLp.connect(bgm);

      sfx.connect(master); bgm.connect(master); master.connect(comp); comp.connect(ctx.destination);

      const len = ctx.sampleRate;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

      this.ctx = ctx; this.master = master; this.sfxGain = sfx; this.bgmGain = bgm; this.echoSend = echoSend; this.noiseBuf = buf;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => { /* wait for gesture */ });
    return this.ctx;
  }

  unlock() { this.ensure(); }

  toggleMute(): boolean {
    this.muted = !this.muted;
    try { localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0'); } catch { /* ignore */ }
    if (this.muted) {
      this.stopBgm();
      if (this.master && this.ctx) this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.03);
    } else {
      const ctx = this.ensure();
      if (ctx && this.master) this.master.gain.setTargetAtTime(0.56, ctx.currentTime, 0.04);
      if (this.mood !== 'none') this.startBgmLoop();
      this.uiClick();
    }
    return this.muted;
  }

  syncMood(mood: BgmMood) {
    if (this.mood === mood) return;
    this.mood = mood;
    this.stepIdx = 0;
    this.nextStepAt = 0;
    if (mood === 'none' || this.muted) this.stopBgm();
    else this.startBgmLoop();
  }

  private stopBgm() {
    if (this.timer !== null) { clearInterval(this.timer); this.timer = null; }
  }

  private startBgmLoop() {
    if (this.muted || this.timer !== null || typeof window === 'undefined') return;
    this.nextStepAt = 0;
    // 前瞻调度器：每 35ms 预排接下来 90ms 的精确 WebAudio 音符，绝不卡拍
    this.timer = window.setInterval(() => this.pumpBgm(), 35);
  }

  private toneAt(
    at: number, freq: number, dur: number, type: OscillatorType, vol: number,
    opts?: { slide?: number; cutoff?: number; bus?: 'sfx' | 'bgm'; echo?: boolean; attack?: number },
  ) {
    const ctx = this.ensure();
    if (!ctx || !this.sfxGain || !this.bgmGain) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    if (opts?.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(24, opts.slide), at + dur);

    const atk = opts?.attack ?? 0.008;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(vol, at + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);

    const bus = opts?.bus === 'bgm' ? this.bgmGain : this.sfxGain;
    if (opts?.cutoff) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.setValueAtTime(opts.cutoff, at);
      osc.connect(f); f.connect(g);
    } else {
      osc.connect(g);
    }
    g.connect(bus);
    if (opts?.echo && this.echoSend) g.connect(this.echoSend);
    osc.start(at); osc.stop(at + dur + 0.03);
  }

  private tone(
    freq: number, dur: number, type: OscillatorType, vol: number,
    opts?: { slide?: number; delay?: number; cutoff?: number; bus?: 'sfx' | 'bgm'; echo?: boolean },
  ) {
    const ctx = this.ensure();
    if (!ctx) return;
    this.toneAt(ctx.currentTime + (opts?.delay ?? 0), freq, dur, type, vol, opts);
  }

  private noiseAt(at: number, dur: number, vol: number, cutoff: number, opts?: { highpass?: boolean; bus?: 'sfx' | 'bgm' }) {
    const ctx = this.ensure();
    if (!ctx || !this.noiseBuf || !this.sfxGain || !this.bgmGain) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = opts?.highpass ? 'highpass' : 'lowpass';
    f.frequency.setValueAtTime(cutoff, at);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(f); f.connect(g);
    g.connect(opts?.bus === 'bgm' ? this.bgmGain : this.sfxGain);
    src.start(at); src.stop(at + dur + 0.02);
  }

  private noise(dur: number, vol: number, cutoff: number, opts?: { highpass?: boolean; delay?: number; bus?: 'sfx' | 'bgm' }) {
    const ctx = this.ensure();
    if (!ctx) return;
    this.noiseAt(ctx.currentTime + (opts?.delay ?? 0), dur, vol, cutoff, opts);
  }

  private pumpBgm() {
    if (this.muted || this.mood === 'none') return;
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const stepLen = this.mood === 'tavern' ? 0.135 : this.mood === 'boss' ? 0.092 : 0.105;
    if (this.nextStepAt < ctx.currentTime) this.nextStepAt = ctx.currentTime + 0.02;
    while (this.nextStepAt < ctx.currentTime + 0.09) {
      this.scheduleBgmStep(this.stepIdx++, this.nextStepAt, stepLen);
      this.nextStepAt += stepLen;
    }
  }

  private scheduleBgmStep(rawStep: number, at: number, stepLen: number) {
    const i = rawStep % 64;

    if (this.mood === 'tavern') {
      const bass = TAVERN_BASS[i], arp = TAVERN_ARP[i], mel = TAVERN_MEL[i];
      if (bass > 0) this.toneAt(at, hz(bass), stepLen * 2.8, 'triangle', 0.17, { cutoff: 420, bus: 'bgm' });
      // 木吉他分解和弦（偶拍拨弦 + 回声暖润质感）
      if (i % 2 === 0 && arp > 0) {
        this.toneAt(at, hz(arp), stepLen * 1.9, 'triangle', 0.065, { cutoff: 1400, bus: 'bgm', echo: true });
      }
      // 温暖酒馆电钢/钟琴主旋律
      if (mel > 0) {
        this.toneAt(at, hz(mel), stepLen * 2.6, 'sine', 0.11, { bus: 'bgm', echo: true });
        this.toneAt(at, hz(mel + 12), stepLen * 1.2, 'triangle', 0.028, { cutoff: 2100, bus: 'bgm' });
      }
      // 轻柔爵士沙锤刷音
      if (i % 4 === 2) this.noiseAt(at, 0.045, 0.03, 5200, { highpass: true, bus: 'bgm' });
      return;
    }

    const isBoss = this.mood === 'boss';
    const bassM = (isBoss ? BOSS_BASS : BATTLE_BASS)[i];
    const leadM = (isBoss ? BOSS_LEAD : BATTLE_LEAD)[i];

    // 1. 强律动八度合成贝斯
    if (bassM > 0) {
      this.toneAt(at, hz(bassM), stepLen * 1.35, 'sawtooth', isBoss ? 0.16 : 0.13, { cutoff: isBoss ? 680 : 520, bus: 'bgm' });
    }
    // 2. 元气像素和弦分解伴奏
    if (!isBoss && i % 2 === 0) {
      this.toneAt(at, hz(BATTLE_ARP[i]), stepLen * 1.1, 'triangle', 0.048, { cutoff: 1500, bus: 'bgm' });
    }
    // 3. 元气风高辨识度主旋律（Square 脉冲主音 + 五度/三度弱衬 + 回声）
    if (leadM > 0) {
      this.toneAt(at, hz(leadM), stepLen * (isBoss ? 1.5 : 1.7), 'square', isBoss ? 0.085 : 0.072, {
        cutoff: isBoss ? 2400 : 1950, bus: 'bgm', echo: true,
      });
      if (isBoss) {
        this.toneAt(at, hz(leadM + 7), stepLen * 1.2, 'sawtooth', 0.04, { cutoff: 1800, bus: 'bgm' });
      }
    }
    // 4. 鼓组（Kick / Snare / 16th Hat / 4 小节结尾加花 Tom Roll）
    const inBar = i % 16;
    if (i >= 60) {
      // 小节末通鼓加花冲刺
      this.toneAt(at, 190 - (i - 60) * 28, 0.09, 'triangle', 0.22, { slide: 68, bus: 'bgm' });
      this.noiseAt(at, 0.06, 0.11, 2400, { highpass: true, bus: 'bgm' });
    } else {
      if (inBar === 0 || inBar === 8 || (isBoss && (inBar === 6 || inBar === 14)) || (!isBoss && inBar === 10)) {
        this.toneAt(at, 112, 0.11, 'sine', isBoss ? 0.25 : 0.21, { slide: 36, bus: 'bgm' });
      }
      if (inBar === 4 || inBar === 12) {
        this.noiseAt(at, 0.075, 0.12, 1850, { highpass: true, bus: 'bgm' });
        this.toneAt(at, 210, 0.06, 'triangle', 0.09, { slide: 95, bus: 'bgm' });
      } else if (i % 2 === 1) {
        this.noiseAt(at, 0.022, 0.032, 6200, { highpass: true, bus: 'bgm' });
      }
    }
  }

  uiClick() {
    this.tone(620, 0.045, 'triangle', 0.13, { slide: 840 });
  }

  cookSizzle() {
    if (this.muted) return;
    this.noise(0.18, 0.09, 3600, { highpass: true });
    this.noise(0.16, 0.06, 2600, { highpass: true, delay: 0.1 });
    this.tone(320, 0.06, 'triangle', 0.08, { slide: 460 });
  }

  cookResult(q: 'poor' | 'good' | 'perfect' | 'legendary') {
    if (this.muted) return;
    if (q === 'legendary') {
      [587.33, 739.99, 880, 1174.66, 1318.51].forEach((f, i) => this.tone(f, 0.16, 'sine', 0.14, { delay: i * 0.055 }));
    } else if (q === 'perfect') {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, 0.14, 'triangle', 0.14, { delay: i * 0.055 }));
    } else if (q === 'good') {
      this.tone(523.25, 0.09, 'triangle', 0.14);
      this.tone(659.25, 0.12, 'triangle', 0.14, { delay: 0.06 });
    } else {
      this.tone(240, 0.11, 'triangle', 0.12, { slide: 185 });
    }
  }

  storyBlip(npc: string) {
    if (this.muted) return;
    if (npc === 'radio' || npc === 'heli') {
      this.tone(1180, 0.035, 'square', 0.06, { cutoff: 2000 });
      this.noise(0.03, 0.04, 2800, { highpass: true });
      return;
    }
    const pitch = npc.startsWith('boss') ? 160 : npc === 'zhang' ? 280 : npc === 'lin' ? 560 : npc === 'qiang' ? 320 : npc === 'zhao' ? 480 : 420;
    this.tone(pitch, 0.045, 'triangle', 0.09, { slide: pitch * 1.12 });
  }

  aimTick() {
    if (this.muted) return;
    const now = performance.now();
    if (now - this.lastAimTick < 55) return;
    this.lastAimTick = now;
    this.tone(920, 0.025, 'triangle', 0.06, { slide: 1120 });
  }

  onEvent(e: GameEvent) {
    if (this.muted) return;
    const now = performance.now();
    switch (e.t) {
      case 'shot': {
        if (now - this.lastShot < 36) return;
        this.lastShot = now;
        if (e.from === 'fort') {
          this.tone(175, 0.12, 'sawtooth', 0.18, { slide: 70, cutoff: 800 });
          this.noise(0.09, 0.18, 900);
          return;
        }
        if (e.from === 'turret') {
          if (e.turret === 'tesla') this.tone(860, 0.09, 'sawtooth', 0.11, { slide: 320 });
          else if (e.turret === 'frost') this.tone(680, 0.09, 'sine', 0.12, { slide: 420 });
          else if (e.turret === 'cannon') { this.tone(145, 0.15, 'triangle', 0.22, { slide: 46 }); this.noise(0.11, 0.2, 650); }
          else { this.tone(280, 0.045, 'square', 0.09, { slide: 110, cutoff: 1100 }); this.noise(0.03, 0.07, 1500); }
          return;
        }
        const w = e.weapon ?? 'pistol';
        if (w === 'tesla') {
          this.tone(980, 0.11, 'sawtooth', 0.18, { slide: 260 });
          this.noise(0.055, 0.13, 3600, { highpass: true });
        } else if (w === 'rocket') {
          this.tone(150, 0.16, 'sine', 0.24, { slide: 42 });
          this.tone(240, 0.2, 'sawtooth', 0.22, { slide: 78, cutoff: 950 });
          this.noise(0.16, 0.24, 1150);
        } else if (w === 'shotgun') {
          this.tone(135, 0.13, 'sine', 0.28, { slide: 36 });
          this.tone(185, 0.12, 'square', 0.22, { slide: 54, cutoff: 920 });
          this.noise(0.14, 0.3, 1600);
          this.noise(0.04, 0.12, 3200, { highpass: true, delay: 0.08 });
        } else if (w === 'rifle') {
          this.tone(1360, 0.12, 'sawtooth', 0.2, { slide: 150 });
          this.tone(175, 0.15, 'sine', 0.27, { slide: 42 });
          this.noise(0.1, 0.26, 2600);
        } else if (w === 'smg' || w === 'assault') {
          this.tone(145, 0.04, 'sine', 0.14, { slide: 48 });
          this.tone(390, 0.048, 'square', 0.12, { slide: 135, cutoff: 1650 });
          this.noise(0.036, 0.11, 2200);
        } else if (w === 'revolver') {
          this.tone(140, 0.1, 'sine', 0.25, { slide: 42 });
          this.tone(265, 0.1, 'square', 0.22, { slide: 72, cutoff: 1350 });
          this.noise(0.09, 0.23, 1950);
        } else {
          this.tone(135, 0.06, 'sine', 0.18, { slide: 46 });
          this.tone(340, 0.06, 'square', 0.15, { slide: 98, cutoff: 1600 });
          this.noise(0.052, 0.15, 2000);
        }
        break;
      }
      case 'hit':
        if (now - this.lastHit < 40) return;
        this.lastHit = now;
        this.tone(e.heavy || e.crit ? 148 : 172, 0.052, 'sine', e.crit ? 0.22 : 0.14, { slide: 44 });
        this.noise(0.036, e.crit ? 0.14 : 0.085, e.crit ? 2200 : 1250);
        if (e.crit) {
          this.tone(1180, 0.085, 'triangle', 0.16, { slide: 1640 });
          this.tone(680, 0.06, 'square', 0.075, { slide: 920, cutoff: 2000 });
        }
        break;
      case 'boom':
        this.tone(162, 0.38, 'sine', 0.38, { slide: 24 });
        this.tone(110, 0.24, 'triangle', 0.24, { slide: 34 });
        this.noise(0.38, 0.38, 860);
        break;
      case 'lightning':
        this.noise(0.07, 0.13, 4200, { highpass: true });
        this.tone(1280, 0.07, 'sawtooth', 0.1, { slide: 420 });
        break;
      case 'frost':
        this.tone(1080, 0.1, 'sine', 0.13, { slide: 640 });
        this.tone(1520, 0.09, 'sine', 0.09, { delay: 0.03, slide: 880 });
        break;
      case 'kill': {
        if (now - this.lastKill < 42) return;
        this.killStreak = now - this.lastKill < 950 ? Math.min(5, this.killStreak + 1) : 0;
        this.lastKill = now;
        this.tone(e.boss ? 120 : 190, e.boss ? 0.22 : 0.075, 'sine', e.boss ? 0.32 : 0.2, { slide: 42 });
        this.noise(e.boss ? 0.2 : 0.06, e.boss ? 0.24 : 0.13, 1800);
        const f = 760 * Math.pow(1.09, this.killStreak);
        this.tone(f, 0.065, 'sine', 0.105, { delay: 0.015 });
        this.tone(f * 1.45, 0.09, 'sine', 0.095, { delay: 0.045 });
        break;
      }
      case 'hurt':
        this.tone(145, 0.18, 'sawtooth', 0.25, { slide: 58, cutoff: 650 });
        break;
      case 'jump':
        this.tone(240, 0.085, 'triangle', 0.13, { slide: 540 });
        break;
      case 'swap':
        this.tone(480, 0.045, 'triangle', 0.12, { slide: 780 });
        this.noise(0.035, 0.09, 2800, { highpass: true });
        break;
      case 'empty':
        if (now - this.lastEmpty < 180) return;
        this.lastEmpty = now;
        this.tone(210, 0.03, 'square', 0.08, { slide: 150 });
        break;
      case 'dodge':
      case 'grenadeThrow':
        this.noise(0.09, 0.14, 1900, { highpass: true });
        this.tone(260, 0.09, 'sine', 0.11, { slide: 520 });
        break;
      case 'reload':
        this.tone(440, 0.04, 'triangle', 0.12);
        this.tone(680, 0.05, 'triangle', 0.13, { delay: 0.09 });
        break;
      case 'serve':
        this.cookResult(e.quality);
        break;
      case 'allyJoin':
        [440, 554.37, 659.25, 880].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.14, { delay: i * 0.065 }));
        break;
      case 'pickup':
      case 'star':
      case 'shop':
        this.tone(523.25, 0.08, 'triangle', 0.15);
        this.tone(659.25, 0.08, 'triangle', 0.15, { delay: 0.06 });
        this.tone(783.99, 0.14, 'triangle', 0.16, { delay: 0.12 });
        break;
      case 'build':
        this.tone(220, 0.09, 'square', 0.18, { slide: 110, cutoff: 950 });
        this.tone(587.33, 0.12, 'triangle', 0.14, { delay: 0.07 });
        break;
      case 'cook':
      case 'meal':
        this.noise(0.18, 0.11, 3200, { highpass: true });
        this.tone(659.25, 0.09, 'sine', 0.14, { delay: 0.06 });
        this.tone(987.77, 0.16, 'sine', 0.15, { delay: 0.13 });
        break;
      case 'skill':
        this.tone(330, 0.1, 'triangle', 0.18);
        this.tone(493.88, 0.12, 'triangle', 0.18, { delay: 0.05 });
        this.tone(659.25, 0.2, 'triangle', 0.2, { delay: 0.1 });
        break;
      case 'bossAppear':
        this.tone(110, 0.55, 'sawtooth', 0.28, { slide: 68, cutoff: 520 });
        this.tone(164.81, 0.45, 'sawtooth', 0.2, { delay: 0.12, slide: 92, cutoff: 620 });
        break;
      case 'dayStart':
        this.tone(293.66, 0.14, 'triangle', 0.16);
        this.tone(440, 0.24, 'triangle', 0.18, { delay: 0.08 });
        break;
      case 'dayClear':
      case 'won':
        [523.25, 659.25, 783.99, 1046.5].forEach((f, idx) => this.tone(f, 0.16, 'triangle', 0.16, { delay: idx * 0.08 }));
        break;
      case 'dead':
        [329.63, 293.66, 246.94, 196.0].forEach((f, idx) => this.tone(f, 0.2, 'sawtooth', 0.16, { delay: idx * 0.11, cutoff: 700 }));
        break;
    }
  }
}

export const audio = new SoundEngine();
