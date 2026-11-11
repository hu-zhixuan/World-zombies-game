import type { PerkId, WeaponId, ZombieKind } from '../content/data';

/** 世界尺寸（逻辑像素）。画面高 270，脚下的地面线在 184，下面留给地面和手指按键。 */
export const GROUND_Y = 184;
export const WORLD_W = 900;
export const HOME_X = 96; // 小屋门口
export const WALL_X = 330; // 路障
export const TURRET_X = 292;
export const SPAWN_X = WORLD_W + 30;
export const PLAYER_MIN_X = 40;
export const PLAYER_MAX_X = WORLD_W - 30;

export type Phase = 'fight' | 'clear' | 'perk' | 'camp' | 'dead' | 'won';

export interface OwnedWeapon { id: WeaponId; star: number; ammo: number }
export interface Player {
  x: number; y: number; vx: number; vy: number; facing: 1 | -1;
  hp: number; maxHp: number; hurtT: number; healCarry: number;
  dodgeT: number; dodgeCd: number; dodgeDir: 1 | -1;
  fireCd: number; reloadT: number; shootT: number;
  weapons: OwnedWeapon[]; cur: number;
}
export interface Zombie {
  id: number; kind: ZombieKind; x: number; hp: number; maxHp: number;
  atkCd: number; kb: number; burnT: number; carriesCrate: boolean;
}
export interface Bullet {
  x: number; y: number; vx: number; vy: number; dmg: number; life: number;
  from: 'player' | 'turret'; pierce: boolean; bounces: number; hit: number[];
}
export interface Crate { id: number; x: number; weapon: WeaponId }
export interface Turret { x: number; level: number; cd: number; aim: number }

/** 一局的全部状态。能直接 JSON 序列化：存档就是存它。 */
export interface RunState {
  seed: number; rng: number; tick: number; nextId: number;
  day: number; phase: Phase; phaseT: number;
  player: Player; zombies: Zombie[]; bullets: Bullet[]; crates: Crate[]; turret: Turret;
  wall: { hp: number; maxHp: number }; home: { hp: number; maxHp: number };
  spawn: { left: number; timer: number; total: number; killed: number; crateAt: number };
  coins: number; scrap: number; kills: number;
  perks: PerkId[]; perkChoices: PerkId[];
  targetId: number | null;
}

/** 这一步玩家按了什么。jump/dodge/reload/swap 是「这一步刚按下」。 */
export interface Input { move: number; fire: boolean; jump: boolean; dodge: boolean; reload: boolean; swap: boolean }
export const NO_INPUT: Input = { move: 0, fire: false, jump: false, dodge: false, reload: false, swap: false };

/** 面板和按钮发给规则层的指令。 */
export type Command =
  | { t: 'pickPerk'; id: PerkId }
  | { t: 'buyStar'; weapon: WeaponId }
  | { t: 'upgradeTurret' }
  | { t: 'repairWall' }
  | { t: 'nextDay' };

/** 这一步发生了什么，给画面层播特效和音效用。 */
export type GameEvent =
  | { t: 'shot'; x: number; y: number; from: 'player' | 'turret' }
  | { t: 'hit'; id: number; x: number; y: number; dmg: number; burn?: boolean }
  | { t: 'kill'; id: number; x: number; kind: ZombieKind; coins: number }
  | { t: 'boom'; x: number; y: number; r: number }
  | { t: 'hurt'; dmg: number }
  | { t: 'wallHit' } | { t: 'homeHit' } | { t: 'dodge' } | { t: 'reload' } | { t: 'empty' }
  | { t: 'pickup'; weapon: WeaponId; star: number; isNew: boolean }
  | { t: 'star'; weapon: WeaponId; star: number }
  | { t: 'dayStart'; day: number } | { t: 'dayClear'; day: number } | { t: 'dead' } | { t: 'won' };
