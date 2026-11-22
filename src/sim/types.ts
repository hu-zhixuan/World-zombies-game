import type { AdTierId, BattleContractId, ClassId, DifficultyId, DrinkId, GuestSupportKind, MealId, MeatInventory, MeatKind, PerkId, StaffRole, TavernUpgradeId, TurretType, WeaponId, ZombieKind } from '../content/data';
import type { AllyId, DishQuality, VipTierId } from '../content/story';

/** 世界尺寸（逻辑像素）。画面高 310，室外地面线在 222，下面留给石墙地基与手指按键。 */
export const VIEW_H = 310;
export const GROUND_Y = 222;
export const WORLD_W = 960;

/**
 * 室外酒馆堡垒 2D 实体碰撞与阶梯跳台：
 * - 地面一楼砖墙右边界在 HOUSE_WALL_X (246)，在地面走过去会被实体墙挡住，不会穿模进屋体
 * - 中层木制门廊跳台 PORCH (x: 232..300, y: -48)，从地面起跳即可跃上
 * - 二楼屋顶防守平台 ROOF (x: 38..252, y: -92)，从中层门廊再跳一下即可登上房顶
 */
export const HOUSE_WALL_X = 246; // 一楼房屋右侧实体砖墙碰撞线
export const DOOR_X = 258;       // 堡垒门廊入口位置（地面靠近砖墙处）
export const PORCH_Y = -48;      // 中层木制挑台高度（worldY = GROUND_Y - 48 = 174）
export const PORCH_MIN_X = 232;
export const PORCH_MAX_X = 300;
export const ROOF_Y = -92;       // 二层房顶防守平台高度（worldY = GROUND_Y - 92 = 130）
export const ROOF_MIN_X = 38;
export const ROOF_MAX_X = 252;
export const LADDER_X = 264;     // 门廊阶梯中心位
export const HOME_X = 256;       // 僵尸攻破路障后砸房屋东墙的位置
export const WALL_X = 392;       // 防御壁垒（路障）
export const SPAWN_X = WORLD_W + 30;
export const PLAYER_MIN_X = 38;
export const PLAYER_MAX_X = WORLD_W - 28;

/** 4 个炮塔安装槽位：前 2 个在房顶，后 2 个在庭院与前线 */
export const TURRET_SLOTS = [
  { id: 0, x: 88,  y: ROOF_Y, roof: true,  name: '屋顶后哨' },
  { id: 1, x: 224, y: ROOF_Y, roof: true,  name: '屋顶前哨' },
  { id: 2, x: 320, y: 0,      roof: false, name: '庭院防线' },
  { id: 3, x: 364, y: 0,      roof: false, name: '前线堡垒' },
] as const;

/** 酒馆室内动线（对应 720x220 哥特木石酒馆剖面图 * 1.12 ≈ 806px 缩放后的世界坐标，支持 4 桌 8 座扩建） */
export const IN_MIN_X = 76;
export const IN_MAX_X = 804;
export const IN_STATIONS = {
  kitchen: 112,
  mortar: 152,
  pass: 192,
  drink: 236,
  shop: 700,
  workshop: 736,
  door: 782,
} as const;
export type StationId = keyof typeof IN_STATIONS;

/** 酒馆餐桌最多 8 个食客座位（4桌：基础4座 + 扩建6/8座）与对应桌面摆盘/收碗世界 X 坐标 */
export const DINER_SEAT_X = [258, 342, 368, 452, 477, 559, 587, 669] as const;
export const DINER_PLATE_X = [282, 316, 390, 424, 498, 536, 608, 646] as const;

/** 四位战友室外守城位置与室内营地站位（随扩建大堂拉大站位间距） */
export const ALLY_POS: Record<AllyId, { extX: number; extY: number; intX: number; intFlip: boolean }> = {
  zhang: { extX: 132, extY: ROOF_Y,  intX: 355, intFlip: false },
  lin:   { extX: 266, extY: PORCH_Y, intX: 130, intFlip: false },
  qiang: { extX: 342, extY: 0,       intX: 760, intFlip: true },
  zhao:  { extX: 58,  extY: ROOF_Y,  intX: 545, intFlip: true },
};

export type Phase = 'fight' | 'clear' | 'perk' | 'camp' | 'dead' | 'won';
export type TurretTargetMode = 'near' | 'boss' | 'air';

export interface OwnedWeapon { id: WeaponId; star: number; ammo: number }
export interface Player {
  x: number; y: number; vx: number; vy: number; facing: 1 | -1;
  dropIgnoreT: number;
  hp: number; maxHp: number; armor: number; maxArmor: number; hurtT: number; healCarry: number;
  dodgeT: number; dodgeCd: number; dodgeDir: 1 | -1;
  fireCd: number; reloadT: number; shootT: number;
  burstLeft: number; burstCd: number; smgHeat: number; smgShots: number;
  grenades: number;
  weapons: OwnedWeapon[]; cur: number;
}
export interface Zombie {
  id: number; kind: ZombieKind; x: number; y: number; hp: number; maxHp: number;
  atkCd: number; kb: number; burnT: number; slowT: number; stunT: number; freezeT: number; carriesCrate: boolean;
}
export interface Bullet {
  x: number; y: number; vx: number; vy: number; dmg: number; life: number;
  from: 'player' | 'turret' | 'fort' | 'ally'; allyId?: AllyId; pierce: boolean; crit: boolean; bounces: number; hit: number[];
  aoe?: number; slow?: number; kind?: 'normal' | 'rocket' | 'frost' | 'cannon' | 'firebolt' | 'spear' | 'qi';
  weaponId?: WeaponId; startX?: number; startY?: number; pierceLeft?: number; ricochetLeft?: number;
  closeBoost?: boolean; shatter?: boolean; homing?: boolean; stun?: number; burn?: number;
}
export interface GroundFire { x: number; r: number; t: number; maxT: number; dmg: number }
export interface GrenadeProj {
  x: number; y: number; vx: number; vy: number; dmg: number; r: number;
}
export interface EnemyProj {
  x: number; y: number; vx: number; vy: number; dmg: number; life: number;
}
export interface Crate { id: number; x: number; weapon: WeaponId }
export interface TurretSlotState { type: TurretType | null; level: number; cd: number; aim: number; mode: TurretTargetMode }
export interface AllyRuntime {
  cd: number;
  atkT: number;
  facing: 1 | -1;
  x: number;
  y: number;
  vx: number;
  state: 'idle' | 'move' | 'atk';
  dir: 1 | -1;
  pauseT: number;
  atkSeq: number;
  fireDone: boolean;
  atkTargetId?: number | null;
  staffTask?: 'idle' | 'clean' | 'serve' | 'cook' | 'host';
  staffT?: number;
  staffGuestId?: string;
}

export type GuestPersonality = 'regular' | 'hurried' | 'gourmet' | 'drinker';

export interface DinerGuest {
  id: string;
  vipId: string;
  tier: VipTierId;
  personality: GuestPersonality;
  supportKind?: GuestSupportKind;
  name: string;
  role: string;
  sprite: string;
  x: number;
  seatIdx: number;
  targetX: number;
  walkState: 'entering' | 'seated' | 'leaving';
  facing: 1 | -1;
  orderKind: 'dish' | 'drink';
  dish: MealId;
  drink?: DrinkId;
  dishName: string;
  pay: number;
  trendMatch: boolean;
  isRye?: boolean;
  isVipRequest?: boolean;
  requestBonusCoins?: number;
  orderQuote: string;
  thanksQuote: string;
  served: boolean;
  patience: number;
  maxPatience: number;
  eatT: number;
  angry?: boolean;
  qualityServed?: DishQuality;
  reactionQuote?: string;
}

export interface DinerReview {
  id: number;
  author: string;
  tierName: string;
  dishName: string;
  quality: DishQuality;
  text: string;
  fansDelta: number;
}

export interface CounterDish {
  id: number;
  guestId: string;
  dish: MealId | 'rye';
  dishName: string;
  quality: DishQuality;
  isRye?: boolean;
}

export interface KitchenOrder {
  id: number;
  guestId: string;
  dish: MealId | 'rye';
  dishName: string;
  ticksLeft: number;
  totalTicks: number;
  sauceCost: number;
  isRye?: boolean;
}

export interface DirtyPlate {
  id: number;
  seatIdx: number;
  x: number;
  createdTick: number;
}

export interface PourMinigameState {
  drink: DrinkId;
  guestId: string | null;
  fill: number;
  speed: number;
  startedTick: number;
}

export interface CarriedDrinkState {
  drink: DrinkId;
  guestId: string | null;
  quality: DishQuality;
}

export interface ShiftReport {
  dishCoins: number;
  drinkCoins: number;
  tipsCoins: number;
  partyBonusCoins: number;
  spiceExpense: number;
  staffWages: number;
  upkeepCost: number;
  ryePenaltyCount: number;
  angryCount: number;
  dirtyLeftCount: number;
  rating: number;
  flameEarned: number;
  netProfit: number;
}

export interface DinerShiftState {
  mode: 'prep' | 'open' | 'summary';
  timer: number;
  duration: number;
  spawnCd: number;
  servedCount: number;
  drinkCount: number;
  cleanedCount: number;
  lostCount: number;
  ryeCount: number;
  coinsEarned: number;
  tipsEarned: number;
  partyBonusCoins?: number;
  fansEarned: number;
  spiceSpentCoins: number;
  combo: number;
  bestCombo: number;
  sauce: number;
  maxSauce: number;
  sauceStalled: boolean;
  kitchenOrders: KitchenOrder[];
  dirtyTables: DirtyPlate[];
  counterDishes: CounterDish[];
  report: ShiftReport | null;
}

export interface StaffCarriedDish {
  guestId: string;
  dish: MealId | 'rye';
  dishName: string;
  quality: DishQuality;
  isRye?: boolean;
}

export interface HiredStaffState {
  id: string;
  level: number;
  role: StaffRole;
  x: number;
  vx: number;
  facing: 1 | -1;
  task: 'idle' | 'clean' | 'serve' | 'drink' | 'mortar' | 'cook';
  taskT: number;
  targetId?: number | string | null;
  carrying?: StaffCarriedDish | null;
}

export interface BattleContractState {
  id: BattleContractId;
  title: string;
  desc: string;
  progress: number;
  target: number;
  coins: number;
  meatReward: MeatInventory;
  bonusGrenade?: number;
  done: boolean;
}

export interface DinerState {
  rep: number;
  fans: number;
  flame: number;
  bestTaste: number;
  trendId: string;
  trendTag: string;
  trendTitle: string;
  servedTotal: number;
  metVips: string[];
  reviews: DinerReview[];
  researched: MealId[];
  dishLevels: Partial<Record<MealId, number>>;
  /** 菜品实战火候熟练度（每做出/端出 1 盘 +1，达 2 盘自动升 Lv.2 熟手招牌，达 5 盘自动升 Lv.3 镇店绝活） */
  dishXp?: Partial<Record<MealId, number>>;
  menu: MealId[];
  menuStock: Partial<Record<MealId, number>>;
  autoSupply: Partial<Record<MealId, boolean>>;
  upgrades: TavernUpgradeId[];
  hiredStaff: HiredStaffState[];
  applicants: { id: string; startLevel: number }[];
  adTier: AdTierId | null;
  rackLevel: number;
  lastDispatchLog: string;
  allyRoles: Partial<Record<AllyId, StaffRole>>;
  /** 今夜已犒赏激活的明日主战场料理队列（最多3道叠加） */
  feastDishes?: MealId[];
  /** 今夜已触发的食客战场支援身份 */
  supportsTriggered?: GuestSupportKind[];
  /** 筑城匠师支援：工坊造塔/升塔享 85 折 */
  smithDiscount?: boolean;
  /** 军火游商支援：明日主战场额外空投武器升星箱数 */
  extraCrates?: number;
  /** 猎魔同袍支援：明日主战场全体战友伤害+35%、攻速+25% */
  allyFuryNext?: boolean;
  /** 当前主战场狩猎悬赏 */
  contract?: BattleContractState;
}

export interface StoryProgress {
  allies: AllyId[];
  seenEvents: string[];
}

export interface CarriedDishState {
  guestId: string;
  dish: MealId | 'rye';
  dishName: string;
  quality: DishQuality;
  isRye?: boolean;
}

/** 一局的全部状态。能直接 JSON 序列化：存档就是存它。 */
export interface RunState {
  seed: number; rng: number; tick: number; nextId: number;
  day: number; phase: Phase; phaseT: number;
  inside: boolean;
  autoFire: boolean;
  difficulty: DifficultyId;
  player: Player; zombies: Zombie[]; bullets: Bullet[]; fires: GroundFire[]; grenades: GrenadeProj[]; enemyProjs: EnemyProj[]; crates: Crate[];
  turrets: TurretSlotState[];
  allies: Record<AllyId, AllyRuntime>;
  wall: { level: number; hp: number; maxHp: number };
  home: { hp: number; maxHp: number };
  fort: { level: number; cd: number; aim: number };
  spawn: { left: number; timer: number; total: number; killed: number; crateAt: number; bossKind: ZombieKind | null; bossSpawned: boolean };
  coins: number;
  meats: MeatInventory;
  spice: number;
  kills: number;
  meal: MealId | null;
  mealQuality: DishQuality;
  guests: DinerGuest[];
  carryingDish: CarriedDishState | null;
  pourMinigame: PourMinigameState | null;
  carryingDrink: CarriedDrinkState | null;
  dinerShift: DinerShiftState;
  diner: DinerState;
  story: StoryProgress;
  buff: { dmgMul: number; haste: number; turretMul?: number; critBonus?: number; frostRounds?: boolean; allyFury?: boolean };
  shop: WeaponId[];
  perks: PerkId[]; perkChoices: PerkId[];
  /** 这一局能掉落/进货的武器（由局外解锁决定） */
  pool: WeaponId[];
  /** 连锁处决的连杀计数、先锋的增伤倒计时 */
  chain: { n: number; t: number }; vanguardT: number;
  targetId: number | null;
  priorityId: number | null;
  /** 职业，和主动技能的剩余时间 / 冷却 */
  cls: ClassId; skill: { t: number; cd: number };
  /** 破晓无尽酒馆模式与跨局轻度传承 */
  endless?: boolean;
  heirloom?: { metVips: string[]; mastery: Partial<Record<MealId, number>>; decor: TavernUpgradeId[] };
}

/** 这一步玩家按了什么。jump/dodge/reload/swap/skill/grenade/interact 是「这一步刚按下」。 */
export interface Input {
  move: number; down: boolean; fire: boolean; jump: boolean; dodge: boolean; reload: boolean; swap: boolean; skill: boolean; grenade: boolean; interact: boolean;
  grenadeAim?: { dx: number; dy: number } | null;
}
export const NO_INPUT: Input = {
  move: 0, down: false, fire: false, jump: false, dodge: false, reload: false, swap: false, skill: false, grenade: false, interact: false, grenadeAim: null,
};

/** 面板和按钮发给规则层的指令。 */
export type Command =
  | { t: 'pickPerk'; id: PerkId }
  | { t: 'buyStar'; weapon: WeaponId }
  | { t: 'buildTurret'; slot: number; kind: TurretType }
  | { t: 'upgradeTurret'; slot: number }
  | { t: 'cycleTurretMode'; slot: number }
  | { t: 'sellTurret'; slot: number }
  | { t: 'upgradeWall' }
  | { t: 'repairWall' }
  | { t: 'upgradeFort' }
  | { t: 'repairFort' }
  | { t: 'buyWeapon'; weapon: WeaponId }
  | { t: 'buySupply'; item: 'grenade' | 'armor' | 'medkit' }
  | { t: 'rerollShop' }
  | { t: 'salvageWeapon'; index: number }
  | { t: 'serveGuest'; guestId: string; quality?: DishQuality }
  | { t: 'feastAll' }
  | { t: 'serveCarried' }
  | { t: 'grindMortar' }
  | { t: 'startShift' }
  | { t: 'closeShift' }
  | { t: 'finishSummary' }
  | { t: 'researchDish'; id: MealId }
  | { t: 'toggleMenuDish'; id: MealId }
  | { t: 'toggleAutoSupply'; id: MealId }
  | { t: 'prepDish'; id: MealId; batches?: number }
  | { t: 'upgradeDish'; id: MealId }
  | { t: 'buyTavernUpgrade'; id: TavernUpgradeId }
  | { t: 'postRecruitment'; tier: AdTierId }
  | { t: 'hireStaff'; id: string }
  | { t: 'setStaffRole'; id: string; role: StaffRole }
  | { t: 'trainStaff'; id: string }
  | { t: 'setAllyRole'; ally: AllyId; role: StaffRole }
  | { t: 'upgradeRack' }
  | { t: 'buySpice'; count?: number }
  | { t: 'sellMeatKind'; kind: MeatKind; count: number }
  | { t: 'startPour'; drink: DrinkId; guestId?: string | null }
  | { t: 'stopPour' }
  | { t: 'cancelPour' }
  | { t: 'serveDrink'; guestId?: string }
  | { t: 'cleanTable'; plateId: number }
  | { t: 'pickCounterDish'; id?: number }
  | { t: 'cookSell'; count: number }
  | { t: 'pickMeal'; id: MealId; quality?: DishQuality }
  | { t: 'focusTarget'; x: number }
  | { t: 'enterHouse' }
  | { t: 'exitHouse' }
  | { t: 'nextDay' }
  | { t: 'enterEndless' }
  | { t: 'nextEndlessNight' };

/** 这一步发生了什么，给画面层播特效和音效用。 */
export type GameEvent =
  | { t: 'shot'; x: number; y: number; from: 'player' | 'turret' | 'fort' | 'ally'; weapon?: WeaponId; turret?: TurretType; ally?: AllyId; ang?: number; hot?: boolean }
  | { t: 'railbeam'; x1: number; y1: number; x2: number; y2: number; crit?: boolean }
  | { t: 'hit'; id: number; x: number; y: number; dmg: number; burn?: boolean; crit?: boolean; slow?: boolean; freeze?: boolean; stun?: boolean; overload?: boolean; dir?: 1 | -1; weapon?: WeaponId; heavy?: boolean }
  | { t: 'lightning'; pts: { x: number; y: number }[]; color?: 'tesla' | 'shock' }
  | { t: 'frost'; x: number; y: number; r: number }
  | { t: 'grenadeThrow' }
  | { t: 'skill'; cls: ClassId }
  | { t: 'kill'; id: number; x: number; y?: number; kind: ZombieKind; coins: number; meat: number; meatKind?: MeatKind; preserved?: boolean; dir?: 1 | -1; crit?: boolean; boss?: boolean }
  | { t: 'boom'; x: number; y: number; r: number }
  | { t: 'hurt'; dmg: number; blocked?: number; cover?: number }
  | { t: 'wallHit'; reflect?: boolean }
  | { t: 'homeHit' }
  | { t: 'jump'; onRoof: boolean } | { t: 'swap'; weapon: WeaponId }
  | { t: 'dodge' } | { t: 'reload' } | { t: 'empty' }
  | { t: 'pickup'; weapon: WeaponId; star: number; isNew: boolean }
  | { t: 'star'; weapon: WeaponId; star: number }
  | { t: 'build'; kind: 'turret' | 'wall' | 'fort' }
  | { t: 'shop'; item: string }
  | { t: 'kitchenDone'; dish: MealId | 'rye'; dishName: string; isRye?: boolean; extraPlate?: boolean }
  | { t: 'grindSauce'; sauce: number; byStaff?: string }
  | { t: 'sauceEmpty' }
  | { t: 'research'; id: MealId; flameLeft: number }
  | { t: 'prepDish'; id: MealId; servingsAdded: number }
  | { t: 'pourDone'; drink: DrinkId; quality: DishQuality }
  | { t: 'tableClean'; x: number; coins: number; byAlly?: AllyId; byStaff?: string }
  | { t: 'dispatchReturn'; log: string; spice: number; meats: MeatInventory }
  | { t: 'rackHarvest'; tender: number; thick: number; essence: number }
  | { t: 'partyStart'; partyId: string; name: string }
  | { t: 'guestAngry'; guestId: string; name: string }
  | { t: 'shiftOpen'; duration: number }
  | { t: 'shiftEnd'; served: number; coins: number; tips: number; fans: number; bestCombo: number; rating: number; flameEarned: number }
  | { t: 'serve'; guestId: string; vipId: string; name: string; dishName: string; quality: DishQuality; coins: number; fans: number; rep: number; quote: string; allServed?: boolean; firstMeet?: boolean; trendMatch?: boolean; partyMatch?: boolean; vipRequestClear?: boolean; rankUp?: string; isRye?: boolean; supportKind?: GuestSupportKind; supportTag?: string; dishBuffTag?: string }
  | { t: 'contractDone'; id: BattleContractId; title: string; coins: number; rewardText: string }
  | { t: 'dishLevelUp'; id: MealId; level: number }
  | { t: 'fortify'; x: number; y: number; label: string }
  | { t: 'cook'; meat: number; coins: number }
  | { t: 'meal'; id: MealId; quality: DishQuality }
  | { t: 'dinerStory'; eventKey: 'firstOpen' | 'rep10' | 'rep25' | 'rep40' }
  | { t: 'allyJoin'; ally: AllyId; day: number }
  | { t: 'inside'; inside: boolean }
  | { t: 'roof'; onRoof: boolean }
  | { t: 'bossAppear'; kind: ZombieKind }
  | { t: 'bossDead'; kind: ZombieKind; bossIdx: 0 | 1 | 2 }
  | { t: 'endlessEnter' }
  | { t: 'dayStart'; day: number } | { t: 'dayClear'; day: number } | { t: 'dead' } | { t: 'won' };

