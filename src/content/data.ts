// 内容表。名字和说明文字取自旧版（src/content/legacy/），数值按新目标重定。
import legacyPerks from './legacy/perks.json';
import legacyWeapons from './legacy/weapons.json';
import legacyZombies from './legacy/zombies.json';

const perkText = (id: string) => legacyPerks.PERKS.find((p) => p.id === id)!;
const weaponText = (id: string) => legacyWeapons.WEAPONS.find((w) => w.id === id)!;
const zombieText = (key: string) => legacyZombies.ZOMBIE_DEX.find((z) => z.key === key)!;

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export const RARITY_NAME: Record<Rarity, string> = { common: '普通', rare: '稀有', epic: '史诗', legendary: '传说' };

// ── 武器 ──
export type WeaponId = 'pistol' | 'smg' | 'shotgun' | 'rifle';
export interface WeaponDef {
  id: WeaponId; name: string; rarity: Rarity; icon: string;
  damage: number; interval: number; mag: number; reload: number; speed: number; range: number; spread: number;
  pellets?: number; pierce?: boolean;
}
// interval / reload 的单位是「步」（1 秒 = 60 步）
export const WEAPONS: Record<WeaponId, WeaponDef> = {
  pistol: { id: 'pistol', name: weaponText('pistol').name, rarity: 'common', icon: 'wp_pistol', damage: 30, interval: 15, mag: 12, reload: 54, speed: 9, range: 240, spread: 0 },
  smg: { id: 'smg', name: weaponText('smg').name, rarity: 'rare', icon: 'wp_smg', damage: 14, interval: 3, mag: 36, reload: 60, speed: 10, range: 215, spread: 0.035 },
  shotgun: { id: 'shotgun', name: weaponText('shotgun').name, rarity: 'rare', icon: 'wp_shotgun', damage: 22, interval: 40, mag: 6, reload: 70, speed: 9, range: 150, spread: 0.16, pellets: 7 },
  rifle: { id: 'rifle', name: weaponText('sniper').name, rarity: 'rare', icon: 'wp_rifle', damage: 150, interval: 45, mag: 5, reload: 75, speed: 14, range: 380, spread: 0, pierce: true },
};
export const MAX_STAR = 5;
/** 星级是变强的主线：每星伤害 +35%，★3 弹匣 +50%，★5 每次多打出子弹 */
export const starMul = (star: number) => 1 + 0.35 * (star - 1);
export const magSize = (id: WeaponId, star: number) => Math.round(WEAPONS[id].mag * (star >= 3 ? 1.5 : 1));
export const extraBullets = (id: WeaponId, star: number) => (star >= 5 ? Math.max(1, Math.floor((WEAPONS[id].pellets ?? 1) / 2)) : 0);
export const STAR_PERKS: Record<number, string> = { 3: '弹匣 +50%', 5: '每次多打出子弹' };
export const STAR_COST = [0, 80, 160, 260, 380]; // 升到 ★2..★5 的金币
/** 按住开火、算上换弹的持续火力（每秒），打单个目标 */
export function sustainedDps(w: WeaponDef, star = 1): number {
  const mag = magSize(w.id, star), shots = (w.pellets ?? 1) + extraBullets(w.id, star);
  return (w.damage * starMul(star) * shots * mag) / ((mag * w.interval + w.reload) / 60);
}

// ── 僵尸 ──
export type ZombieKind = 'roamer' | 'sprinter' | 'bruiser';
export interface ZombieDef {
  kind: ZombieKind; name: string; sprites: string[]; baseHp: number; speed: number; damage: number; attackEvery: number;
  coins: number; firstDay: number; fps: number; weight: number; scale: number;
}
export const ZOMBIES: Record<ZombieKind, ZombieDef> = {
  roamer: { kind: 'roamer', name: zombieText('roamer').name, sprites: ['z_roamer', 'z_oldman', 'z_woman'], baseHp: 80, speed: 0.84, damage: 8, attackEvery: 50, coins: 2, firstDay: 1, fps: 7, weight: 6, scale: 1 },
  sprinter: { kind: 'sprinter', name: zombieText('sprinter').name, sprites: ['z_hat'], baseHp: 55, speed: 1.75, damage: 6, attackEvery: 36, coins: 3, firstDay: 2, fps: 14, weight: 3, scale: 1 },
  bruiser: { kind: 'bruiser', name: zombieText('bruiser').name, sprites: ['z_bearded'], baseHp: 300, speed: 0.6, damage: 16, attackEvery: 60, coins: 6, firstDay: 3, fps: 6, weight: 2, scale: 1.3 },
};
/** 血量曲线：全程让「跟得上进度」的武器 0.6～1.2 秒打死一只普通僵尸 */
export const zombieHp = (kind: ZombieKind, day: number) => Math.floor((ZOMBIES[kind].baseHp + day * 6) * (1 + 0.22 * day));
export const dayZombieCount = (day: number) => 12 + day * 11;
export const newZombieOn = (day: number) => Object.values(ZOMBIES).find((z) => z.firstDay === day && day > 1);

export const TURRET = {
  name: '机枪塔', range: 230,
  levels: [{ damage: 10, cooldown: 18 }, { damage: 19, cooldown: 12 }, { damage: 36, cooldown: 7 }],
  upgradeScrap: [0, 5, 10],
};

// ── 天赋：只收「改变打法」的，不收单纯加数值的 ──
export type PerkId = 'pierce' | 'ricochet' | 'overkill' | 'lifesteal' | 'incendiary' | 'overclock'
  | 'frostbite' | 'chainkill' | 'vanguard' | 'bloodfrenzy' | 'glasscannon' | 'secondwind';
export interface PerkDef { id: PerkId; name: string; desc: string; icon: string; rarity: Rarity }
const perk = (id: PerkId): PerkDef => ({ id, name: perkText(id).name, desc: perkText(id).desc, icon: 'ic_' + id, rarity: perkText(id).rarity as Rarity });
export const PERKS: PerkDef[] = ([
  'lifesteal', 'incendiary', 'frostbite', 'ricochet', 'overkill', 'overclock', 'vanguard', 'secondwind',
  'pierce', 'chainkill', 'bloodfrenzy', 'glasscannon',
] as PerkId[]).map(perk);
export const perkDef = (id: PerkId) => PERKS.find((p) => p.id === id)!;
/** 三选一时的出现权重：越稀有越少见 */
export const RARITY_WEIGHT: Record<Rarity, number> = { common: 10, rare: 6, epic: 3, legendary: 1 };

// ── 职业：一个被动 + 一个主动技能，决定这一局怎么打 ──
export type ClassId = 'gunner' | 'engineer' | 'chef';
export interface ClassDef {
  id: ClassId; name: string; role: string; icon: string; passive: string; skill: string; skillDesc: string;
  /** 主动技能的持续时间和冷却（步） */
  dur: number; cd: number;
  /** 还没做完的职业先摆出来，但不能选 */
  comingSoon?: string;
}
export const CLASSES: Record<ClassId, ClassDef> = {
  gunner: { id: 'gunner', name: '枪手', role: '主角输出', icon: 'wp_rifle', passive: '暴击率 +15%', skill: '鹰眼', skillDesc: '5 秒全穿透 + 必暴', dur: 300, cd: 1200 },
  engineer: { id: 'engineer', name: '工程师', role: '塔防', icon: 'ic_turret', passive: '塔造价 -25%，塔伤害 +20%', skill: '过载', skillDesc: '所有塔 6 秒攻速 ×2', dur: 360, cd: 1200 },
  chef: { id: 'chef', name: '主厨', role: '经营', icon: 'ic_chef', passive: '每只僵尸多掉 1 块肉，菜的 buff +50%', skill: '战地大餐', skillDesc: '回 40% 血 + 8 秒攻速', dur: 480, cd: 1200, comingSoon: '食堂开张后开放' },
};
export const CRIT_CHANCE = 0.15;
export const CRIT_MUL = 2;

// ── 一局的长度 ──
export const LAST_DAY = 5; // 试玩版先做前 5 天
export const WALL_REPAIR_COST = 10;
export const DAY_HEAL = 0.3; // 每天出发前回 30% 血：受的伤会带到明天

// ── 局外成长：每撑过一天得一颗星，星星永久保留，用来解锁新武器进掉落池 ──
export type Unlock = { stars: number; kind: 'weapon'; id: WeaponId } | { stars: number; kind: 'class'; id: ClassId };
export const UNLOCKS: Unlock[] = [
  { stars: 0, kind: 'weapon', id: 'smg' }, { stars: 0, kind: 'class', id: 'gunner' },
  { stars: 2, kind: 'class', id: 'engineer' }, { stars: 3, kind: 'weapon', id: 'shotgun' }, { stars: 8, kind: 'weapon', id: 'rifle' },
];
export const unlockedWeapons = (stars: number) => UNLOCKS.flatMap((u) => (u.kind === 'weapon' && stars >= u.stars ? [u.id] : []));
export const unlockedClasses = (stars: number) => UNLOCKS.flatMap((u) => (u.kind === 'class' && stars >= u.stars ? [u.id] : []));
export const classUnlockStars = (id: ClassId) => UNLOCKS.find((u) => u.kind === 'class' && u.id === id)?.stars;
export const nextUnlock = (stars: number) => UNLOCKS.find((u) => stars < u.stars);
export const unlockName = (u: Unlock) => (u.kind === 'weapon' ? WEAPONS[u.id].name : `职业「${CLASSES[u.id].name}」`);
