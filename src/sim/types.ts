import type { ClassId, MealId, PerkId, TurretType, WeaponId, ZombieKind } from '../content/data';
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

/** 酒馆室内动线（对应 560x220 哥特木石酒馆剖面图 * 1.12 缩放后的世界坐标，地面均在 GROUND_Y） */
export const IN_MIN_X = 76;
export const IN_MAX_X = 626;
export const IN_STATIONS = {
  kitchen: 148,
  shop: 354,
  workshop: 520,
  door: 598,
} as const;
export type StationId = keyof typeof IN_STATIONS;

/** 酒馆餐桌食客座位世界 X 坐标（对齐两张原木餐桌两侧座椅，三人完全错开） */
export const DINER_SEAT_X = [272, 358, 468] as const;

export type Phase = 'fight' | 'clear' | 'perk' | 'camp' | 'dead' | 'won';

export interface OwnedWeapon { id: WeaponId; star: number; ammo: number }
export interface Player {
  x: number; y: number; vx: number; vy: number; facing: 1 | -1;
  hp: number; maxHp: number; armor: number; maxArmor: number; hurtT: number; healCarry: number;
  dodgeT: number; dodgeCd: number; dodgeDir: 1 | -1;
  fireCd: number; reloadT: number; shootT: number;
  burstLeft: number; burstCd: number; smgHeat: number; smgShots: number;
  grenades: number;
  weapons: OwnedWeapon[]; cur: number;
}
export interface Zombie {
  id: number; kind: ZombieKind; x: number; hp: number; maxHp: number;
  atkCd: number; kb: number; burnT: number; slowT: number; stunT: number; freezeT: number; carriesCrate: boolean;
}
export interface Bullet {
  x: number; y: number; vx: number; vy: number; dmg: number; life: number;
  from: 'player' | 'turret' | 'fort'; pierce: boolean; crit: boolean; bounces: number; hit: number[];
  aoe?: number; slow?: number; kind?: 'normal' | 'rocket' | 'frost' | 'cannon' | 'firebolt';
  weaponId?: WeaponId; startX?: number; pierceLeft?: number; ricochetLeft?: number;
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
export interface TurretSlotState { type: TurretType | null; level: number; cd: number; aim: number }

export interface DinerGuest {
  id: string;
  vipId: string;
  tier: VipTierId;
  name: string;
  role: string;
  sprite: string;
  x: number;
  dish: MealId;
  dishName: string;
  meatCost: number;
  pay: number;
  trendMatch: boolean;
  orderQuote: string;
  thanksQuote: string;
  served: boolean;
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

export interface DinerState {
  rep: number;
  fans: number;
  trendId: string;
  trendTag: string;
  trendTitle: string;
  servedTotal: number;
  metVips: string[];
  reviews: DinerReview[];
}

export interface StoryProgress {
  allies: AllyId[];
  seenEvents: string[];
}

/** 一局的全部状态。能直接 JSON 序列化：存档就是存它。 */
export interface RunState {
  seed: number; rng: number; tick: number; nextId: number;
  day: number; phase: Phase; phaseT: number;
  inside: boolean;
  autoFire: boolean;
  player: Player; zombies: Zombie[]; bullets: Bullet[]; fires: GroundFire[]; grenades: GrenadeProj[]; enemyProjs: EnemyProj[]; crates: Crate[];
  turrets: TurretSlotState[];
  wall: { level: number; hp: number; maxHp: number };
  home: { hp: number; maxHp: number };
  fort: { level: number; cd: number; aim: number };
  spawn: { left: number; timer: number; total: number; killed: number; crateAt: number; bossKind: ZombieKind | null; bossSpawned: boolean };
  coins: number; meat: number; kills: number;
  meal: MealId | null;
  mealQuality: DishQuality;
  guests: DinerGuest[];
  diner: DinerState;
  story: StoryProgress;
  buff: { dmgMul: number; haste: number };
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
}

/** 这一步玩家按了什么。jump/dodge/reload/swap/skill/grenade/interact 是「这一步刚按下」。 */
export interface Input {
  move: number; fire: boolean; jump: boolean; dodge: boolean; reload: boolean; swap: boolean; skill: boolean; grenade: boolean; interact: boolean;
  grenadeAim?: { dx: number; dy: number } | null;
}
export const NO_INPUT: Input = {
  move: 0, fire: false, jump: false, dodge: false, reload: false, swap: false, skill: false, grenade: false, interact: false, grenadeAim: null,
};

/** 面板和按钮发给规则层的指令。 */
export type Command =
  | { t: 'pickPerk'; id: PerkId }
  | { t: 'buyStar'; weapon: WeaponId }
  | { t: 'buildTurret'; slot: number; kind: TurretType }
  | { t: 'upgradeTurret'; slot: number }
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
  | { t: 'cookSell'; count: number }
  | { t: 'pickMeal'; id: MealId; quality?: DishQuality }
  | { t: 'focusTarget'; x: number }
  | { t: 'enterHouse' }
  | { t: 'exitHouse' }
  | { t: 'nextDay' };

/** 这一步发生了什么，给画面层播特效和音效用。 */
export type GameEvent =
  | { t: 'shot'; x: number; y: number; from: 'player' | 'turret' | 'fort'; weapon?: WeaponId; turret?: TurretType; ang?: number; hot?: boolean }
  | { t: 'railbeam'; x1: number; y1: number; x2: number; y2: number; crit?: boolean }
  | { t: 'hit'; id: number; x: number; y: number; dmg: number; burn?: boolean; crit?: boolean; slow?: boolean; freeze?: boolean; stun?: boolean; overload?: boolean; dir?: 1 | -1; weapon?: WeaponId; heavy?: boolean }
  | { t: 'lightning'; pts: { x: number; y: number }[]; color?: 'tesla' | 'shock' }
  | { t: 'frost'; x: number; y: number; r: number }
  | { t: 'grenadeThrow' }
  | { t: 'skill'; cls: ClassId }
  | { t: 'kill'; id: number; x: number; kind: ZombieKind; coins: number; meat: number; dir?: 1 | -1; crit?: boolean; boss?: boolean }
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
  | { t: 'serve'; guestId: string; vipId: string; name: string; dishName: string; quality: DishQuality; coins: number; fans: number; rep: number; quote: string; allServed?: boolean; firstMeet?: boolean; trendMatch?: boolean; rankUp?: string }
  | { t: 'cook'; meat: number; coins: number }
  | { t: 'meal'; id: MealId; quality: DishQuality }
  | { t: 'dinerStory'; eventKey: 'firstOpen' | 'rep10' | 'rep25' | 'rep40' }
  | { t: 'allyJoin'; ally: AllyId; day: number }
  | { t: 'inside'; inside: boolean }
  | { t: 'roof'; onRoof: boolean }
  | { t: 'bossAppear'; kind: ZombieKind }
  | { t: 'bossDead'; kind: ZombieKind; bossIdx: 0 | 1 | 2 }
  | { t: 'dayStart'; day: number } | { t: 'dayClear'; day: number } | { t: 'dead' } | { t: 'won' };
