import type { ClassId, MealId, PerkId, TurretType, WeaponId, ZombieKind } from '../content/data';

/** 世界尺寸（逻辑像素）。画面高 310，室外地面线在 222，下面留给石墙地基与手指按键。 */
export const VIEW_H = 310;
export const GROUND_Y = 222;
export const WORLD_W = 960;

export const DOOR_X = 148;       // 堡垒酒馆大门
export const ROOF_Y = -116;      // 房顶平台相对地面的高度（worldY = GROUND_Y + ROOF_Y = 106）
export const ROOF_MIN_X = 36;
export const ROOF_MAX_X = 276;
export const LADDER_X = 280;     // 上下房顶的木梯位置
export const HOME_X = 264;       // 僵尸攻破路障后砸房屋东墙的位置
export const WALL_X = 392;       // 防御壁垒（路障）
export const SPAWN_X = WORLD_W + 30;
export const PLAYER_MIN_X = 38;
export const PLAYER_MAX_X = WORLD_W - 28;

/** 4 个炮塔安装槽位：前 2 个在房顶，后 2 个在庭院与前线 */
export const TURRET_SLOTS = [
  { id: 0, x: 96,  y: ROOF_Y, roof: true,  name: '屋顶后哨' },
  { id: 1, x: 242, y: ROOF_Y, roof: true,  name: '屋顶前哨' },
  { id: 2, x: 320, y: 0,      roof: false, name: '庭院防线' },
  { id: 3, x: 364, y: 0,      roof: false, name: '前线堡垒' },
] as const;

/** 酒馆室内动线（对应 528x240 原图 * 1.2 缩放后的世界坐标，地面均在 GROUND_Y） */
export const IN_MIN_X = 56;
export const IN_MAX_X = 616;
export const IN_STATIONS = {
  kitchen: 121,
  shop: 308,
  workshop: 483,
  door: 606,
} as const;
export type StationId = keyof typeof IN_STATIONS;

export type Phase = 'fight' | 'clear' | 'perk' | 'camp' | 'dead' | 'won';

export interface OwnedWeapon { id: WeaponId; star: number; ammo: number }
export interface Player {
  x: number; y: number; vx: number; vy: number; facing: 1 | -1;
  hp: number; maxHp: number; armor: number; maxArmor: number; hurtT: number; healCarry: number;
  dodgeT: number; dodgeCd: number; dodgeDir: 1 | -1;
  fireCd: number; reloadT: number; shootT: number;
  grenades: number;
  weapons: OwnedWeapon[]; cur: number;
}
export interface Zombie {
  id: number; kind: ZombieKind; x: number; hp: number; maxHp: number;
  atkCd: number; kb: number; burnT: number; slowT: number; carriesCrate: boolean;
}
export interface Bullet {
  x: number; y: number; vx: number; vy: number; dmg: number; life: number;
  from: 'player' | 'turret' | 'fort'; pierce: boolean; crit: boolean; bounces: number; hit: number[];
  aoe?: number; slow?: number; kind?: 'normal' | 'rocket' | 'frost' | 'cannon';
}
export interface GrenadeProj {
  x: number; y: number; vx: number; vy: number; dmg: number; r: number;
}
export interface EnemyProj {
  x: number; y: number; vx: number; vy: number; dmg: number; life: number;
}
export interface Crate { id: number; x: number; weapon: WeaponId }
export interface TurretSlotState { type: TurretType | null; level: number; cd: number; aim: number }

/** 一局的全部状态。能直接 JSON 序列化：存档就是存它。 */
export interface RunState {
  seed: number; rng: number; tick: number; nextId: number;
  day: number; phase: Phase; phaseT: number;
  inside: boolean;
  autoFire: boolean;
  player: Player; zombies: Zombie[]; bullets: Bullet[]; grenades: GrenadeProj[]; enemyProjs: EnemyProj[]; crates: Crate[];
  turrets: TurretSlotState[];
  wall: { level: number; hp: number; maxHp: number };
  home: { hp: number; maxHp: number };
  fort: { level: number; cd: number; aim: number };
  spawn: { left: number; timer: number; total: number; killed: number; crateAt: number; bossKind: ZombieKind | null; bossSpawned: boolean };
  coins: number; scrap: number; meat: number; kills: number;
  meal: MealId | null;
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
}
export const NO_INPUT: Input = {
  move: 0, fire: false, jump: false, dodge: false, reload: false, swap: false, skill: false, grenade: false, interact: false,
};

/** 面板和按钮发给规则层的指令。 */
export type Command =
  | { t: 'pickPerk'; id: PerkId }
  | { t: 'buyStar'; weapon: WeaponId }
  | { t: 'buildTurret'; slot: number; kind: TurretType }
  | { t: 'upgradeTurret'; slot: number }
  | { t: 'scrapTurret'; slot: number }
  | { t: 'upgradeWall' }
  | { t: 'repairWall' }
  | { t: 'upgradeFort' }
  | { t: 'repairFort' }
  | { t: 'buyWeapon'; weapon: WeaponId }
  | { t: 'buySupply'; item: 'grenade' | 'armor' | 'medkit' }
  | { t: 'rerollShop' }
  | { t: 'salvageWeapon'; index: number }
  | { t: 'cookSell'; count: number }
  | { t: 'pickMeal'; id: MealId }
  | { t: 'focusTarget'; x: number }
  | { t: 'enterHouse' }
  | { t: 'exitHouse' }
  | { t: 'toggleRoof' }
  | { t: 'nextDay' };

/** 这一步发生了什么，给画面层播特效和音效用。 */
export type GameEvent =
  | { t: 'shot'; x: number; y: number; from: 'player' | 'turret' | 'fort'; weapon?: WeaponId; turret?: TurretType }
  | { t: 'hit'; id: number; x: number; y: number; dmg: number; burn?: boolean; crit?: boolean; slow?: boolean }
  | { t: 'lightning'; pts: { x: number; y: number }[]; color?: 'tesla' | 'shock' }
  | { t: 'frost'; x: number; y: number; r: number }
  | { t: 'grenadeThrow' }
  | { t: 'skill'; cls: ClassId }
  | { t: 'kill'; id: number; x: number; kind: ZombieKind; coins: number; meat: number }
  | { t: 'boom'; x: number; y: number; r: number }
  | { t: 'hurt'; dmg: number; blocked?: number }
  | { t: 'wallHit'; reflect?: boolean }
  | { t: 'homeHit' }
  | { t: 'dodge' } | { t: 'reload' } | { t: 'empty' }
  | { t: 'pickup'; weapon: WeaponId; star: number; isNew: boolean }
  | { t: 'star'; weapon: WeaponId; star: number }
  | { t: 'build'; kind: 'turret' | 'wall' | 'fort' }
  | { t: 'shop'; item: string }
  | { t: 'cook'; meat: number; coins: number }
  | { t: 'meal'; id: MealId }
  | { t: 'inside'; inside: boolean }
  | { t: 'roof'; onRoof: boolean }
  | { t: 'bossAppear'; kind: ZombieKind }
  | { t: 'dayStart'; day: number } | { t: 'dayClear'; day: number } | { t: 'dead' } | { t: 'won' };
