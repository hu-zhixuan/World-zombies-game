// ═══════════════════════════════════════════════════════════════════
//  01.1 核心实体状态与输入总线 (提前初始化彻底消除 TDZ 隐患)
// ═══════════════════════════════════════════════════════════════════
const player = { x: 100, y: CHAR_GY, vx: 0, vy: 0, onGround: true, facingRight: true, iframes: 0, walkT: 0 };
const keys = { l: false, r: false, j: false, holdInteract: false };
let cabinHoldTimer = 0;       // 长按累计帧数（60帧=1秒，目标80帧=1.3秒）
let cabinHoldActive = false;  // 是否正在长按E
const CABIN_HOLD_MAX = 80;    // 1.3秒（60fps，紧凑灵敏，响应迅速）
let cabinUIOpen = false;      // 避难小屋管理界面开关状态
let wavePhase = 'spawning';   // 'spawning' | 'waiting' | 'shop' | 'boss' | 'cleared' | 'rest' | 'hub' | 'restaurant'
let bufferWaveThreat = 0;     // 缓冲期僵尸威胁波次
let timeOfDay = 'day';        // 全局昼夜状态
let boss = null;
let bossActive = false;
let bossCount = 0;
let endingTriggered = false;
const CAMPAIGN_WAVES = 15;
let restTimerVal = 0;
const REST_DURATION = 35;
let waveSpawnQueue = 0;
let waveSpawnTimer = 0;
let waveTotalThisWave = 0;
let waveKilledThisWave = 0;
let shopOpen = false;
let shopTimerVal = 0;
let shopTimerId = null;
let combo = 0, comboTimer = 0, comboFlash = 0, lastComboMilestone = 0, lastMilestone = 0;
const COMBO_TIMEOUT = 180;
let hitstop = 0;
const CRIT_CHANCE = 0.18;
let mingToughness = 0;
let progressMilestone = 0;
let frenzyT = 0;
let bId = 1;

