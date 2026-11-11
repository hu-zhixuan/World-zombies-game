// 竖切片用到的内容表。名字和说明文字取自旧版（src/content/legacy/），数值按新目标重定。
import legacyPerks from './legacy/perks.json';
import legacyWeapons from './legacy/weapons.json';
import legacyZombies from './legacy/zombies.json';

const perkText = (id: string) => legacyPerks.PERKS.find((p) => p.id === id)!;
const weaponText = (id: string) => legacyWeapons.WEAPONS.find((w) => w.id === id)!;
const zombieText = (key: string) => legacyZombies.ZOMBIE_DEX.find((z) => z.key === key)!;

export type WeaponId = 'pistol' | 'smg';
export interface WeaponDef {
  id: WeaponId; name: string; rarity: 'common' | 'rare'; icon: string;
  damage: number; interval: number; mag: number; reload: number; speed: number; range: number; spread: number;
}
// interval / reload 的单位是「步」（1 秒 = 60 步）
export const WEAPONS: Record<WeaponId, WeaponDef> = {
  pistol: { id: 'pistol', name: weaponText('pistol').name, rarity: 'common', icon: 'wp_pistol', damage: 30, interval: 15, mag: 12, reload: 54, speed: 9, range: 240, spread: 0 },
  smg: { id: 'smg', name: weaponText('smg').name, rarity: 'rare', icon: 'wp_smg', damage: 14, interval: 3, mag: 36, reload: 60, speed: 10, range: 215, spread: 0.035 },
};
export const MAX_STAR = 5;
export const starMul = (star: number) => 1 + 0.35 * (star - 1);
export const STAR_COST = [0, 40, 80, 140, 220]; // 升到 ★2..★5 的金币
/** 按住开火、算上换弹的持续火力（每秒） */
export function sustainedDps(w: WeaponDef, star = 1): number {
  return (w.damage * starMul(star) * w.mag) / ((w.mag * w.interval + w.reload) / 60);
}

export type ZombieKind = 'roamer' | 'sprinter';
export interface ZombieDef {
  kind: ZombieKind; name: string; sprite: string; baseHp: number; speed: number; damage: number; attackEvery: number;
  coins: number; firstDay: number; fps: number;
}
export const ZOMBIES: Record<ZombieKind, ZombieDef> = {
  roamer: { kind: 'roamer', name: zombieText('roamer').name, sprite: 'z_roamer', baseHp: 80, speed: 0.72, damage: 8, attackEvery: 50, coins: 3, firstDay: 1, fps: 6 },
  sprinter: { kind: 'sprinter', name: zombieText('sprinter').name, sprite: 'z_sprinter', baseHp: 55, speed: 1.5, damage: 6, attackEvery: 36, coins: 4, firstDay: 2, fps: 14 },
};
/** 血量曲线：全程让「跟得上进度」的武器 0.6～1.2 秒打死一只普通僵尸 */
export const zombieHp = (kind: ZombieKind, day: number) => Math.floor((ZOMBIES[kind].baseHp + day * 6) * (1 + 0.22 * day));
export const dayZombieCount = (day: number) => 10 + day * 6;

export const TURRET = {
  name: '机枪塔', range: 230,
  levels: [{ damage: 10, cooldown: 18 }, { damage: 19, cooldown: 12 }, { damage: 36, cooldown: 7 }],
  upgradeScrap: [0, 5, 10],
};

export type PerkId = 'pierce' | 'ricochet' | 'overkill' | 'lifesteal' | 'incendiary' | 'overclock';
export interface PerkDef { id: PerkId; name: string; desc: string; icon: string }
const perk = (id: PerkId): PerkDef => ({ id, name: perkText(id).name, desc: perkText(id).desc, icon: 'ic_' + id });
export const PERKS: PerkDef[] = (['pierce', 'ricochet', 'overkill', 'lifesteal', 'incendiary', 'overclock'] as PerkId[]).map(perk);

export const LAST_DAY = 3; // 竖切片只做前 3 天
export const WALL_REPAIR_COST = 10;
