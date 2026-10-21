const GAME_VERSION = 'v55';
// ═══════════════════════════════════════════════════════════════════════════════
//  十五波围城：最后据点 v55 — 代码总目录 (ARCHITECTURE INDEX)
// ═══════════════════════════════════════════════════════════════════════════════
//  /* ══ 01. CONFIG & REGISTRIES ══ */  全局常量、武器注册表、塔防配置、僵尸图鉴、菜品配方、装扮流派
//  /* ══ 02. CORE ENGINE & INPUT ══ */   游戏主循环、视口缩放、复调音效引擎、键鼠触屏输入与快捷监听
//  /* ══ 03. COMBAT & DEFENSE ══ */      小胡角色绘制、枪械射击弹道、高地哨塔、僵尸AI与受击死亡结算
//  /* ══ 04. SHELTER & EXPEDITION ══ */  安全屋交互、3秒大门闭锁、小胡战术工坊、背包系统与旧城远征
//  /* ══ 05. RESTAURANT SYSTEM ══ */     深夜食堂状态机、后厨烹饪QTE、顾客耐心排队、经营收益与评价
//  /* ══ 06. UI & PERSISTENCE ══ */      战场HUD绘制、战术胶囊弹窗、设置/暂停、图鉴/教程、本地存档读档
// ═══════════════════════════════════════════════════════════════════════════════



/* ═══════════════════════════════════════════════════════════════════════════════
   ══ 01. CONFIG & REGISTRIES ══
   全局常量 / 武器注册表 WEAPONS / 塔防配置 TOWER_TYPES / 僵尸图鉴 ZOMBIE_DEX / 菜品原料配方 / 装扮流派
═══════════════════════════════════════════════════════════════════════════════ */


//  CANVAS & CONSTANTS
// ═══════════════════════════════════════════
const canvas = document.getElementById('gc');
const ctx=canvas.getContext('2d');
// ── 美术重构：高DPR高清渲染 ──
// 原画布 1100×500 拉伸到容器宽度 + image-rendering:pixelated → 1080p+屏幕上发虚颗粒感。
// 方案：物理分辨率按 devicePixelRatio 放大（上限2防低端机内存爆），CSS 尺寸不变，
// ctx.scale 归一坐标系 → 所有绘制代码（世界坐标 GW/GH=1100/500）零改动即获锐利渲染。
const _DPR = Math.min(2, window.devicePixelRatio || 1);
canvas.width = 1100 * _DPR;
canvas.height = 500 * _DPR;
canvas.style.width = '100%';
canvas.style.height = 'auto';
canvas.style.aspectRatio = '1100 / 500';
ctx.scale(_DPR, _DPR);
// 游戏内所有截图/坐标换算依赖 CSS 宽高比；getBoundingClientRect 仍返回 CSS 尺寸，逻辑不变。
const GW=1100,GH=500,GROUND_H=80,GROUND_Y=GH-GROUND_H; // GROUND_Y=420
const CHAR_W=36,CHAR_H=64,CHAR_GY=GROUND_Y-CHAR_H;    // CHAR_GY=286
const Z_TOP=GROUND_Y-58;                                // 292 zombie feet level
const GRAVITY=0.52,JUMP_V=-13,BASE_SPEED=3.8;
const WORLD_W=2520;  // 3屏宽：左屏=家园城堡，中屏=战场，右屏=旧小镇（探索区）
let cameraX=0;        // 相机水平偏移（世界坐标）
let scoutView=false;  // 侦察视角：按住 Q 时相机自动平移到战场

// ── 运行时战斗上下文与生命周期管理 (隐患3修复) ──
const RuntimeBattleContext = {
  reset() {
    window._groundFires = [];
    window._berserkActive = false;
    window._berserkTimer = 0;
    window._berserkUsed = false;
    window._vanguardBuffT = 0;
    window._vanguardWarned = false;
    window._dualwieldT = 0;
    window._critFlowT = 0;
    window._chainkillBuff = 0;
    window._chainkillTimer = 0;
    window._globalDmgNumCd = 0;
    window._bufferWaveScheduled = false;
    window._waveClearing = false;
    window._waveDlgActive = false;
    window._ionizationTrails = [];
    window._plasmaVortices = [];
    window._sonicWaves = [];
    window._fireballs = [];
    window._freeTowerPending = false;
    window._lowHpWarned = false;
    window._lastShockT = 0;
    window._cozyShield = 0;
    window._catchBuffT = 0;
    window._crateDroppedThisWave = false;
    window._smgSprintT = 0;
    window._classSkillT = 0;
    window._classSkillCd = 0;
    window._flameRampT = 0;
    window._flameRampStacks = 0;
    window._xbowLastFire = 0;
    window._chargeFullPing = false;
    window._annGranted = false;
    window._towerWrecks = [];
    window._railCharge = 0;
    window._lastAttacker = null;
    window._restParticles = [];
    window._restNightEnding = false;
    if(window._npcTalkTimer){ clearTimeout(window._npcTalkTimer); window._npcTalkTimer = null; }
    if(typeof clearFloatTexts === 'function') clearFloatTexts();
  }
};
RuntimeBattleContext.reset();

// ── 离线预渲染画布缓存 (隐患4修复: 消除全屏径向渐变实时数学计算) ──
let _pvigCanvas = null;
function getPvigCanvas(){
  if(!_pvigCanvas && typeof document !== 'undefined'){
    _pvigCanvas = document.createElement('canvas');
    _pvigCanvas.width = GW;
    _pvigCanvas.height = GH;
    const c = _pvigCanvas.getContext('2d');
    const g = c.createRadialGradient(GW/2, GH/2, GH*.3, GW/2, GH/2, GH*.9);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,.25)');
    c.fillStyle = g;
    c.fillRect(0, 0, GW, GH);
  }
  return _pvigCanvas;
}

let _hvigCanvas = null;
function getHvigCanvas(){
  if(!_hvigCanvas && typeof document !== 'undefined'){
    _hvigCanvas = document.createElement('canvas');
    _hvigCanvas.width = GW;
    _hvigCanvas.height = GH;
    const c = _hvigCanvas.getContext('2d');
    const g = c.createRadialGradient(GW/2, GH/2, GH*.3, GW/2, GH/2, GH*.9);
    g.addColorStop(0, 'rgba(255,180,80,0)');
    g.addColorStop(1, 'rgba(40,20,0,.35)');
    c.fillStyle = g;
    c.fillRect(0, 0, GW, GH);
  }
  return _hvigCanvas;
}

let _muzzleLightCanvas = null;
function getMuzzleLightCanvas(){
  if(!_muzzleLightCanvas && typeof document !== 'undefined'){
    _muzzleLightCanvas = document.createElement('canvas');
    _muzzleLightCanvas.width = GW;
    _muzzleLightCanvas.height = GH;
    const c = _muzzleLightCanvas.getContext('2d');
    const g = c.createRadialGradient(GW/2, GH*.55, GH*.1, GW/2, GH*.55, GH*.85);
    g.addColorStop(0, 'rgba(255,220,140,1)');
    g.addColorStop(1, 'rgba(255,220,140,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, GW, GH);
  }
  return _muzzleLightCanvas;
}

// ═══════════════════════════════════════════

//  WEAPONS —— 武器注册表（掉落系统从其中抽取）
// rarity: common(普通) / rare(稀有) / epic(史诗) / legendary(传说)
// dropWeight: 掉落权重（越高越常掉，越稀有越低）
// ═══════════════════════════════════════════
const WEAPONS = [
  // ── ⚪ 白色（制式自卫 / Common: #d0d7de）── 质朴扎实，开局自卫
  {id:'pistol',   name:'战术自卫手枪', icon:'🔫', tag:'点射', tagClass:'tag-norm', rarity:'common', dropWeight:30, maxAmmo:10, damage:14, speed:32, reloadMs:1100, spread:false, pellets:0, spreadDeg:0, piercing:false, burn:false, explosive:false, grav:false, autofire:false, startOwned:true, traitCritBonus:0, traitCritMul:2.0, trait:'清脆利落：爆头精准击杀普通感染者并立即回膛1发，前期自卫点射。走位爆头极强打击感'},
  {id:'shovel',   name:'战术工兵短铲', icon:'⛏️', tag:'近战', tagClass:'tag-norm', rarity:'common', dropWeight:15, maxAmmo:99, damage:36, speed:0,  reloadMs:500,  spread:false, pellets:0, spreadDeg:0, piercing:false, burn:false, explosive:false, grav:false, autofire:true, fireInterval:280, meleeWeapon:true, trait:'工兵挥击：近战劈砍击退感染者，应急防身扎实自卫。'},

  // ── 🔵 蓝色（战术军规 / Tactical: #388bfd）── 手感精良，射速/击退/精准
  {id:'smg',      name:'战术冲锋枪',   icon:'🔫', tag:'速射', tagClass:'tag-mini', rarity:'rare',   dropWeight:22, maxAmmo:36, damage:10, speed:26, reloadMs:850,  spread:false, pellets:0, spreadDeg:0, piercing:false, burn:false, explosive:false, grav:false, autofire:true, fireInterval:50, noMovePenalty:true, trait:'疾风扫射：超高射速爽快泼水，中近距离压制极度解压，奔跑射击绝对精准。'},
  {id:'shotgun',  name:'防暴重型霰弹', icon:'💥', tag:'散射', tagClass:'tag-norm', rarity:'rare',   dropWeight:22, maxAmmo:8,  damage:13, speed:18, reloadMs:1200, spread:true,  pellets:8, spreadDeg:20, piercing:false, burn:false, explosive:false, grav:false, autofire:false, traitKnockback:4.8, rangeFalloff:true, trait:'近身重轰：近距离贴脸(<180px)轰飞敌人(强力击退)，远距离弹片自然散开衰减，近身保命神器。'},
  {id:'smg_heavy',name:'重装突击步枪', icon:'🔫', tag:'稳健', tagClass:'tag-mini', rarity:'rare',   dropWeight:16, maxAmmo:30, damage:20, speed:28, reloadMs:1050, spread:false, pellets:0, spreadDeg:0, piercing:false, burn:false, explosive:false, grav:false, autofire:true, fireInterval:65, traitSlow:0.45, trait:'稳健军规：大口径穿甲点射，中远距离稳定火力压制，强效减速扑面敌人。'},
  {id:'sniper',   name:'精锐反器材狙', icon:'🎯', tag:'穿透', tagClass:'tag-elec', rarity:'rare',   dropWeight:12, maxAmmo:5,  damage:180,speed:62, reloadMs:1500, spread:false, pellets:0, spreadDeg:0, piercing:true,  burn:false, explosive:false, grav:false, autofire:false, maxRange:1500, noMoveFire:true, movePenalty:true, traitCritMul:3.5, traitCritBonus:0.25, trait:'站桩穿透：红外精准架枪直线全屏贯穿，单发重创高危精英。'},

  // ── 🟣 紫色（特种重火 / Special Ops: #a371f7）── 重装火力与元素机制
  {id:'minigun',  name:'终结者加特林', icon:'⚙️', tag:'转管', tagClass:'tag-mini', rarity:'epic',   dropWeight:8,  maxAmmo:9999,damage:14, speed:22, reloadMs:1,    spread:false, pellets:0, spreadDeg:0, piercing:false, burn:false, explosive:false, grav:false, autofire:true, fireInterval:42, heat:0, maxHeat:100, overheated:false, trait:'毁灭风暴：无限转管火力风暴，热量累积狂暴融甲破防，战场绝对绞肉机。'},
  {id:'grenade',  name:'高爆破片榴弹', icon:'💣', tag:'破片', tagClass:'tag-expl', rarity:'epic',   dropWeight:8,  maxAmmo:6,  damage:120,speed:14, reloadMs:1350, spread:false, pellets:0, spreadDeg:0, piercing:false, burn:false, explosive:true,  grav:true,  autofire:false, aoe:150, fuseDelay:400, trait:'破片高爆：越墙物理反弹延迟起爆，AOE150扩散破片风暴重创掩体后尸潮。'},
  {id:'ice',      name:'极地急冻枪',   icon:'❄️', tag:'急冻', tagClass:'tag-elec', rarity:'epic',   dropWeight:8,  maxAmmo:22, damage:36, speed:26, reloadMs:1100, spread:false, pellets:0, spreadDeg:0, piercing:false, burn:false, explosive:false, grav:false, autofire:false, frost:true, frostShatter:true, frostMul:0.4, trait:'极寒碎冰：极地冰爆减速60%，命中冻结目标触发碎冰爆发(+120%伤害)并范围冰爆。'},
  {id:'rocket',   name:'战术重装火箭筒',icon:'🚀', tag:'重炮', tagClass:'tag-expl', rarity:'epic',   dropWeight:8,  maxAmmo:4,  damage:210,speed:19, reloadMs:1800, spread:false, pellets:0, spreadDeg:0, piercing:false, burn:false, explosive:true,  grav:false, autofire:false, aoe:180, trait:'重装重炮：火箭推进推进轰然剧震全场(210重伤)，群怪与装甲终结者。'},

  // ── 🔴 红色（神兵专属 / Signature & Mythic: #f85149）── 各流派专属神兵
  {id:'railcharger',name:'磁轨充能狙击',icon:'🔮', tag:'神兵', tagClass:'tag-elec', rarity:'legendary', dropWeight:0, maxAmmo:10, damage:95, speed:55, reloadMs:1400, spread:false, pellets:0, spreadDeg:0, piercing:true, burn:false, explosive:false, grav:false, autofire:false, maxRange:1600, classWeapon:'marksman', noShop:true, trait:'磁轨极光：直线全屏贯穿，3格暴击充能激活终极光矛(260点穿刺)，爆头必暴击！神射手小胡专属神兵'},
  {id:'bloodblades',name:'嗜血狂暴双刃',icon:'🗡️', tag:'神兵', tagClass:'tag-norm', rarity:'legendary', dropWeight:0, maxAmmo:99, damage:52, speed:0,  reloadMs:600,  spread:false, pellets:0, spreadDeg:0, piercing:false, burn:false, explosive:false, grav:false, autofire:true, fireInterval:170, meleeWeapon:true, lifestealBlade:0.06, classWeapon:'berserker', noShop:true, noRefill:true, trait:'嗜血连环：极速双刃每刀吸血6%，5连斩触发风暴直接处决35%血以下敌人！狂战士小胡专属神兵'},
  {id:'stickybomb', name:'集束黏弹发射器',icon:'🕸️', tag:'神兵', tagClass:'tag-expl', rarity:'legendary', dropWeight:0, maxAmmo:6,  damage:125,speed:15, reloadMs:1350, spread:false, pellets:0, spreadDeg:0, piercing:false, burn:false, explosive:true,  grav:true,  autofire:false, aoe:140, fuseDelay:650, classWeapon:'demolition', noShop:true, trait:'集束黏附：黏弹附着减速35%倒数爆破，多发同挂引发倍率叠加殉爆！爆破小胡专属神兵'},
  {id:'warhorn',    name:'战地冲锋哨笛',icon:'📯', tag:'神兵', tagClass:'tag-mini', rarity:'legendary', dropWeight:0, maxAmmo:99, damage:0,  speed:0,  reloadMs:2000, spread:false, pellets:0, spreadDeg:0, piercing:false, burn:false, explosive:false, grav:false, autofire:false, classWeapon:'beastmaster', noShop:true, noRefill:true, trait:'狼群战号：吹响狂暴全体伙伴6秒(射速×2.2伤+80%移速+30%)并疗愈唤醒倒地伙伴！驭兽师小胡专属神兵'},
  {id:'quakehammer',name:'撼地神盾援护锤',icon:'🔨', tag:'神兵', tagClass:'tag-expl', rarity:'legendary', dropWeight:0, maxAmmo:99, damage:105,speed:0,  reloadMs:1800, spread:false, pellets:0, spreadDeg:0, piercing:false, burn:false, explosive:false, grav:false, autofire:false, meleeWeapon:true, classWeapon:'warden', noShop:true, noRefill:true, trait:'裂地金钟：140°重锤破敌眩晕2.5秒，自身展开5秒减伤75%御敌金钟神盾！铁壁小胡专属神兵'},
  {id:'chiliflamer',name:'魔鬼辣椒喷焰枪',icon:'🌶️', tag:'神兵', tagClass:'tag-fire', rarity:'legendary', dropWeight:0, maxAmmo:80, damage:8.2, speed:8.0, reloadMs:900,  spread:false, pellets:0, spreadDeg:0, piercing:false, burn:true,  explosive:false, grav:false, autofire:true, fireInterval:30, maxRange:350, rampUp:true, alwaysBurn:true, meatLuck:1.8, classWeapon:'chef', noShop:true, trait:'特辣燃焰：持续喷射融解一切护甲，击杀肉块掉率+80%！暗黑厨神小胡专属神兵'}
];

// 武器稀有度统一 4 种鲜明品质（⚪ 制式自卫 / 🔵 战术军规 / 🟣 特种重火 / 🔴 神兵专属）
const WEAPON_RARITY = {
  common:    { color:'#d0d7de', glow:'rgba(208,215,222,.4)', name:'制式自卫', cn:'制式自卫', badge:'⚪制式自卫' },
  rare:      { color:'#388bfd', glow:'rgba(56,139,253,.45)',  name:'战术军规', cn:'战术军规', badge:'🔵战术军规' },
  epic:      { color:'#a371f7', glow:'rgba(163,113,247,.45)', name:'特种重火', cn:'特种重火', badge:'🟣特种重火' },
  legendary: { color:'#f85149', glow:'rgba(248,81,73,.5)',   name:'神兵专属', cn:'神兵专属', badge:'🔴神兵专属' },
};

// ── 武器定义原始镜像与生命周期复位 ──
const INITIAL_WEAPONS_SNAPSHOT = JSON.stringify(WEAPONS);

function resetWeaponDefs(){
  try{
    const cleanList = JSON.parse(INITIAL_WEAPONS_SNAPSHOT);
    for(let i = 0; i < WEAPONS.length; i++){
      if(cleanList[i]){
        delete WEAPONS[i].isSuperEvolved;
        delete WEAPONS[i].evoType;
        delete WEAPONS[i].burnAlways;
        delete WEAPONS[i].evoChainExplode;
        delete WEAPONS[i].evoChainZap;
        delete WEAPONS[i]._evoCritBonus;
        delete WEAPONS[i]._burstN;
        Object.assign(WEAPONS[i], cleanList[i]);
      }
    }
  }catch(e){
    console.error('resetWeaponDefs error:', e);
  }
}

