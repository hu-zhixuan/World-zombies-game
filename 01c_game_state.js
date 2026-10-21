// ═══════════════════════════════════════════

//  GAME STATE
// ═══════════════════════════════════════════
let score=0,best=0,health=100,maxHp=100,coins=100;
let moraleBuff=0;  // 士气加成：餐厅经营越好，下一波战斗伤害/移速越高（0=无加成）
// ── 经营→战斗联动：菜品增益队列（餐厅上菜品质good+时按菜谱buffId入队，下一波生效）──
let queuedBattleBuffs=[];  // [{id:'dmg_small'|'hp_regen'|'armor'|'dmg_med'|'berserk'|'all_buff', stacks:1-2}]
let activeBattleBuffs=[];   // 本波生效中的增益 [{id,stacks,timeLeft}]
// 增益定义表（HUD显示+效果说明）
const BATTLE_BUFF_DEFS={
  dmg_small:{icon:'🍖',name:'增益小餐',desc:'伤害+10%'},
  hp_regen:{icon:'🍲',name:'浓汤回春',desc:'每2秒回1血'},
  armor:{icon:'🥩',name:'厚肉护体',desc:'受伤-20%'},
  dmg_med:{icon:'🍢',name:'拼盘助力',desc:'伤害+20%'},
  berserk:{icon:'🍲',name:'火锅狂热',desc:'伤害+30% 移速+10%'},
  all_buff:{icon:'👑',name:'盛宴全开',desc:'伤害+20% 减伤20% 回血'},
};
let zombies=[],bullets=[],bossProjList=[],gameRunning=false,gamePaused=false;
let spawnTimer,waveTimer,reloadTimer;
let wave=1,killCount=0,isReloading=false,animFrame;
// ── 射击/换弹动画状态 ──
let muzzleFlashT=0;      // 枪口火光持续帧数（>0 时显示）
let reloadAnimT=0;       // 换弹动画进度（0=完成，>0=进行中，用于枪身下倾）
let shootRecoil=0;       // 后坐力（枪身回缩量，每帧衰减）
// ── 增强换弹动画状态（阶段A2+）──
let reloadWpnId='pistol';   // 正在换弹的武器 id（用于差异化动画/音效）
let reloadPhase=0;          // 换弹阶段 0=无,1=卸弹匣,2=持弹匣,3=装弹匣,4=上膛
let reloadMagDrop=null;     // {x,y,vx,vy,angle,spin,life} 掉落弹匣物理体
let muzzleLightFlash=0;     // 枪口火光屏幕照明（短暂泛光）
let critFlash=0;            // 暴击金色屏幕闪光
let smokeAccum=0;           // 连续射击烟雾累积（衰减后生成烟雾粒子）
// ── 闪避翻滚状态（任务3）──
let dodgeT=0;            // 翻滚进行中帧数（>0=翻滚中，有无敌帧）
let dodgeCd=0;           // 翻滚冷却
// ── 等级系统（任务7）──
let playerLevel=1;       // 玩家等级
let playerXp=0;          // 当前经验
let playerXpNeed=35;     // 升级所需经验（随等级增长，放慢升级节奏）
let levelUpFlash=0;      // 升级闪光强度
let curWpnIdx=0,wAmmo=WEAPONS.map(w=>w.maxAmmo);
// ── 武器库存系统：ownedWeapons = 已拥有的武器索引数组（按拾取顺序）──
// ownedWeaponsSet 用于 O(1) 判断是否已拥有
let ownedWeapons=[0];  // 开局拥有手枪(0)，弱化开局对比锚点，前两波走位拉扯
let ownedWeaponsSet=new Set([0]);
const MAX_OWNED_WEAPONS=2;  // 用户明确要求：最多只能带俩把武器（主武器[1] + 副武器[2]）
function isWeaponOwned(idx){return ownedWeaponsSet.has(idx);}
// 初始化 ownedWeaponsSet（WEAPONS 在上方已定义）
(function initOwnedSet(){
  ownedWeapons=WEAPONS.map((w,i)=>w.startOwned?i:-1).filter(i=>i>=0);
  ownedWeaponsSet=new Set(ownedWeapons);
})();
function refreshOwnedSet(){ownedWeaponsSet=new Set(ownedWeapons);}
let autoInterval=null,mouseHeld=false,lastMX=400+cameraX,lastMY=300,frameT=0;

const upgrades={damage:0,speed:0,armor:0,maxHp:0,ammo:0, clinicArmor:0, armoryCooling:0, armoryAmmo:0, armoryDamageBoost:0};

// Dungeon Interior Exploration States
let gameState = 'world'; // 'world' 战斗 | 'building' 建筑内 | 'hub' 避难所据点
let hubInteractCooldown = 0; // 据点进入防误触冷却（毫秒时间戳）
let activeBuilding = null;
let buildingInteriorCleared = { clinic: false, tavern: false, armory: false, safehouse: false, cabin: true };
let buildingInteriorLooted = { clinic: false, armory: false, safehouse: false };
let buildingInteriorZombies = [];
let buildingOldWorldX = 100;

let hiredCompanions=[];
let safehouseRestUsed=false;
let safehouseCraftUsed=false;
let safehouseRestBoost=false;  // 安全屋休息期延长（每波一次）
let damageBuffActive=false;

let woodPlanks = 0;
let scrapMetal = 0;
const cabinUpgrades = { turret: 0, barricade: 0, supplier: 0, fortify: 0, farm: 0, watchtower: 0 };
const cabinCrates = { ammoSpawned: false, medkitSpawned: false };
let lootDrops = [];
let turretCooldown = 0;
let lastBarricadeWarning = 0;

