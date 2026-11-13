// 100% 离线 Web Audio 音效与多通道背景音乐引擎（不依赖外部 URL，安卓单文件 APK 离线可用）。
import type { GameEvent } from '../sim/types';

export type BgmMood = 'none' | 'tavern' | 'battle' | 'boss';

const MUTE_KEY = 'wz57.mute';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  muted = false;
  private mood: BgmMood = 'none';
  private stepIdx = 0;
  private timer: number | null = null;
  private lastShot = 0;
  private lastHit = 0;
  private lastKill = 0;

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
      comp.threshold.value = -14; comp.ratio.value = 6;
      const master = ctx.createGain();
      master.gain.value = 0.52;
      const sfx = ctx.createGain();
      sfx.gain.value = 0.72;
      const bgm = ctx.createGain();
      bgm.gain.value = 0.34;
      sfx.connect(master); bgm.connect(master); master.connect(comp); comp.connect(ctx.destination);

      // 预生成一段 1 秒白噪供枪械、爆炸与打击乐复用
      const len = ctx.sampleRate;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

      this.ctx = ctx; this.master = master; this.sfxGain = sfx; this.bgmGain = bgm; this.noiseBuf = buf;
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
      if (ctx && this.master) this.master.gain.setTargetAtTime(0.52, ctx.currentTime, 0.04);
      if (this.mood !== 'none') this.startBgmLoop();
      this.uiClick();
    }
    return this.muted;
  }

  syncMood(mood: BgmMood) {
    if (this.mood === mood) return;
    this.mood = mood;
    this.stepIdx = 0;
    if (mood === 'none' || this.muted) this.stopBgm();
    else this.startBgmLoop();
  }

  private stopBgm() {
    if (this.timer !== null) { clearInterval(this.timer); this.timer = null; }
  }

  private startBgmLoop() {
    if (this.muted || this.timer !== null || typeof window === 'undefined') return;
    this.timer = window.setInterval(() => this.tickBgm(), 160);
  }

  private tone(
    freq: number, dur: number, type: OscillatorType, vol: number,
    opts?: { slide?: number; delay?: number; cutoff?: number; bus?: 'sfx' | 'bgm' },
  ) {
    const ctx = this.ensure();
    if (!ctx || !this.sfxGain || !this.bgmGain) return;
    const t = ctx.currentTime + (opts?.delay ?? 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (opts?.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(24, opts.slide), t + dur);

    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    const target = opts?.bus === 'bgm' ? this.bgmGain : this.sfxGain;
    if (opts?.cutoff) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.setValueAtTime(opts.cutoff, t);
      osc.connect(f); f.connect(g);
    } else {
      osc.connect(g);
    }
    g.connect(target);
    osc.start(t); osc.stop(t + dur + 0.03);
  }

  private noise(dur: number, vol: number, cutoff: number, opts?: { highpass?: boolean; delay?: number; bus?: 'sfx' | 'bgm' }) {
    const ctx = this.ensure();
    if (!ctx || !this.noiseBuf || !this.sfxGain || !this.bgmGain) return;
    const t = ctx.currentTime + (opts?.delay ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = opts?.highpass ? 'highpass' : 'lowpass';
    f.frequency.setValueAtTime(cutoff, t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g);
    g.connect(opts?.bus === 'bgm' ? this.bgmGain : this.sfxGain);
    src.start(t); src.stop(t + dur + 0.02);
  }

  private tickBgm() {
    if (this.muted || this.mood === 'none') return;
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;

    const i = this.stepIdx++;
    if (this.mood === 'tavern') {
      // 温暖酒馆爵士民谣琶音（D Dorian / F Major）
      const chords = [
        [146.83, 220.0, 261.63, 329.63], // Dm7
        [174.61, 220.0, 261.63, 349.23], // Fmaj7
        [196.0,  246.94, 293.66, 392.0], // G
        [130.81, 196.0, 246.94, 329.63], // Cmaj7
      ];
      const bar = Math.floor(i / 8) % chords.length;
      const chord = chords[bar];
      if (i % 8 === 0) this.tone(chord[0] * 0.5, 0.9, 'triangle', 0.14, { cutoff: 420, bus: 'bgm' });
      const arp = chord[i % 4];
      if (i % 2 === 0 || i % 8 === 5) {
        this.tone(arp, 0.36, 'sine', 0.09, { bus: 'bgm' });
        this.tone(arp * 2, 0.18, 'triangle', 0.03, { cutoff: 1400, bus: 'bgm' });
      }
      return;
    }

    const boss = this.mood === 'boss';
    // 哥特要塞战斗律动（E 小调合成脉冲）
    const bassSeq = boss
      ? [82.41, 82.41, 98.0, 82.41, 110.0, 82.41, 123.47, 110.0]
      : [82.41, 82.41, 98.0, 82.41, 73.42, 73.42, 92.5,  82.41];
    const leadSeq = boss
      ? [329.63, 392.0, 440.0, 493.88, 392.0, 440.0, 523.25, 493.88]
      : [329.63, 0,     392.0, 329.63, 440.0, 0,     392.0, 293.66];
    const bass = bassSeq[i % bassSeq.length];
    const lead = leadSeq[(Math.floor(i / 2) + (i % 2)) % leadSeq.length];

    this.tone(bass, 0.14, 'sawtooth', boss ? 0.15 : 0.11, { cutoff: boss ? 560 : 420, bus: 'bgm' });
    if (i % 4 === 0) this.tone(96, 0.11, 'sine', 0.2, { slide: 36, bus: 'bgm' }); // Kick
    if (i % 4 === 2) this.noise(0.06, 0.08, 2200, { highpass: true, bus: 'bgm' }); // Snare tick
    else this.noise(0.025, 0.03, 5500, { highpass: true, bus: 'bgm' }); // Hi-hat
    if (lead > 0 && (boss || i % 2 === 0)) {
      this.tone(lead, 0.13, 'triangle', boss ? 0.09 : 0.065, { bus: 'bgm' });
    }
  }

  uiClick() {
    this.tone(580, 0.045, 'triangle', 0.12, { slide: 760 });
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
        if (w === 'tesla') this.tone(920, 0.1, 'sawtooth', 0.16, { slide: 280 });
        else if (w === 'rocket') { this.tone(210, 0.18, 'sawtooth', 0.22, { slide: 85, cutoff: 900 }); this.noise(0.14, 0.2, 1100); }
        else if (w === 'shotgun') { this.tone(160, 0.11, 'square', 0.2, { slide: 55, cutoff: 850 }); this.noise(0.11, 0.26, 1300); }
        else if (w === 'rifle') { this.tone(420, 0.1, 'sawtooth', 0.22, { slide: 95 }); this.noise(0.09, 0.22, 2400); }
        else if (w === 'smg' || w === 'assault') { this.tone(330, 0.045, 'square', 0.11, { slide: 120, cutoff: 1400 }); this.noise(0.035, 0.1, 1800); }
        else if (w === 'revolver') { this.tone(220, 0.09, 'square', 0.19, { slide: 75, cutoff: 1200 }); this.noise(0.07, 0.18, 1600); }
        else { this.tone(290, 0.06, 'square', 0.14, { slide: 95, cutoff: 1400 }); this.noise(0.05, 0.12, 1700); }
        break;
      }
      case 'hit':
        if (now - this.lastHit < 45) return;
        this.lastHit = now;
        if (e.crit) this.tone(980, 0.07, 'triangle', 0.14, { slide: 1260 });
        else this.tone(140, 0.04, 'triangle', 0.08, { slide: 70 });
        break;
      case 'boom':
        this.tone(130, 0.3, 'sine', 0.34, { slide: 28 });
        this.noise(0.32, 0.34, 700);
        break;
      case 'lightning':
        this.noise(0.07, 0.12, 4200, { highpass: true });
        this.tone(1240, 0.06, 'sawtooth', 0.09, { slide: 420 });
        break;
      case 'frost':
        this.tone(1050, 0.1, 'sine', 0.12, { slide: 620 });
        this.tone(1480, 0.09, 'sine', 0.08, { delay: 0.03, slide: 880 });
        break;
      case 'kill':
        if (now - this.lastKill < 50) return;
        this.lastKill = now;
        this.tone(740, 0.06, 'sine', 0.09, { delay: 0.02 });
        this.tone(1040, 0.08, 'sine', 0.08, { delay: 0.05 });
        break;
      case 'hurt':
        this.tone(145, 0.18, 'sawtooth', 0.24, { slide: 62, cutoff: 650 });
        break;
      case 'dodge':
      case 'grenadeThrow':
        this.noise(0.09, 0.14, 1800, { highpass: true });
        this.tone(240, 0.08, 'sine', 0.1, { slide: 460 });
        break;
      case 'reload':
        this.tone(420, 0.04, 'triangle', 0.11);
        this.tone(640, 0.05, 'triangle', 0.12, { delay: 0.09 });
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
