// 内容表。名字和文案尽量承接旧版（src/content/legacy/），数值按 15 天完整流程与防线养成校调。
import legacyPerks from './legacy/perks.json';
import legacyWeapons from './legacy/weapons.json';
import legacyZombies from './legacy/zombies.json';

const perkText = (id: string) => legacyPerks.PERKS.find((p) => p.id === id);
const weaponText = (id: string) => legacyWeapons.WEAPONS.find((w) => w.id === id);
const zombieText = (key: string) => legacyZombies.ZOMBIE_DEX.find((z) => z.key === key);

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export const RARITY_NAME: Record<Rarity, string> = { common: '普通', rare: '稀有', epic: '史诗', legendary: '传说' };

// ── 武器（8 把武器，含近中远与元素爆发）──
export type WeaponId = 'pistol' | 'revolver' | 'smg' | 'shotgun' | 'assault' | 'rifle' | 'tesla' | 'rocket';
export interface WeaponDef {
  id: WeaponId; name: string; rarity: Rarity; icon: string; price: number;
  damage: number; interval: number; mag: number; reload: number; speed: number; range: number; spread: number;
  pellets?: number; pierce?: boolean; chain?: number; aoe?: number; slow?: number;
}
// interval / reload 单位：步（1 秒 = 60 步）
export const WEAPONS: Record<WeaponId, WeaponDef> = {
  pistol: {
    id: 'pistol', name: weaponText('pistol')?.name ?? '战术自卫手枪', rarity: 'common', icon: 'wp_pistol', price: 0,
    damage: 32, interval: 15, mag: 12, reload: 48, speed: 10, range: 260, spread: 0,
  },
  revolver: {
    id: 'revolver', name: '左轮重炮手枪', rarity: 'common', icon: 'wp_revolver', price: 65,
    damage: 64, interval: 22, mag: 6, reload: 56, speed: 12.5, range: 285, spread: 0,
  },
  smg: {
    id: 'smg', name: weaponText('smg')?.name ?? '战术冲锋枪', rarity: 'rare', icon: 'wp_smg', price: 95,
    damage: 14, interval: 3, mag: 36, reload: 54, speed: 10.5, range: 240, spread: 0.035,
  },
  shotgun: {
    id: 'shotgun', name: weaponText('shotgun')?.name ?? '防暴重型霰弹', rarity: 'rare', icon: 'wp_shotgun', price: 110,
    damage: 22, interval: 38, mag: 6, reload: 64, speed: 9.5, range: 185, spread: 0.16, pellets: 7,
  },
  assault: {
    id: 'assault', name: weaponText('smg_heavy')?.name ?? '重装突击步枪', rarity: 'rare', icon: 'wp_assault', price: 145,
    damage: 25, interval: 5, mag: 32, reload: 58, speed: 12, range: 315, spread: 0.02, slow: 45,
  },
  rifle: {
    id: 'rifle', name: weaponText('sniper')?.name ?? '精锐反器材狙', rarity: 'epic', icon: 'wp_rifle', price: 180,
    damage: 175, interval: 40, mag: 6, reload: 68, speed: 15, range: 440, spread: 0, pierce: true,
  },
  tesla: {
    id: 'tesla', name: '特斯拉电弧枪', rarity: 'epic', icon: 'wp_tesla', price: 210,
    damage: 56, interval: 18, mag: 16, reload: 60, speed: 14, range: 300, spread: 0, chain: 3,
  },
  rocket: {
    id: 'rocket', name: weaponText('rocket')?.name ?? '战术重装火箭筒', rarity: 'legendary', icon: 'wp_rocket', price: 260,
    damage: 195, interval: 46, mag: 4, reload: 74, speed: 9.5, range: 390, spread: 0, aoe: 68,
  },
};
export const WEAPON_ORDER: WeaponId[] = ['pistol', 'revolver', 'smg', 'shotgun', 'assault', 'rifle', 'tesla', 'rocket'];
export const MAX_STAR = 5;
export const starMul = (star: number) => 1 + 0.35 * (star - 1);
export const magSize = (id: WeaponId, star: number) => Math.round(WEAPONS[id].mag * (star >= 3 ? 1.5 : 1));
export const extraBullets = (id: WeaponId, star: number) => (star >= 5 ? Math.max(1, Math.floor((WEAPONS[id].pellets ?? 1) / 2)) : 0);
export const STAR_PERKS: Record<number, string> = { 3: '弹匣 +50%', 5: '每次多打出子弹' };
export const STAR_COST = [0, 75, 145, 235, 340]; // ★2..★5 费用
export function sustainedDps(w: WeaponDef, star = 1): number {
  const mag = magSize(w.id, star), shots = (w.pellets ?? 1) + extraBullets(w.id, star);
  return (w.damage * starMul(star) * shots * mag) / ((mag * w.interval + w.reload) / 60);
}

// ── 僵尸与 Boss（方案二 哥特暗黑像素风）──
export type ZombieKind = 'roamer' | 'crawler' | 'sprinter' | 'bruiser' | 'ghoul' | 'boss_beast' | 'boss_demon';
export interface ZombieDef {
  kind: ZombieKind; name: string; sprites: string[]; baseHp: number; speed: number; damage: number; attackEvery: number;
  coins: number; meat: number; firstDay: number; fps: number; weight: number; scale: number;
  boss?: boolean; ranged?: boolean;
}
export const ZOMBIES: Record<ZombieKind, ZombieDef> = {
  roamer: {
    kind: 'roamer', name: zombieText('roamer')?.name ?? '游荡感染者', sprites: ['z_roamer_a', 'z_roamer_b', 'z_roamer_c'],
    baseHp: 80, speed: 0.84, damage: 8, attackEvery: 50, coins: 4, meat: 1, firstDay: 1, fps: 10, weight: 8, scale: 0.95,
  },
  crawler: {
    kind: 'crawler', name: '爬行潜伏者', sprites: ['z_crawler'],
    baseHp: 62, speed: 1.24, damage: 7, attackEvery: 42, coins: 5, meat: 1, firstDay: 2, fps: 11, weight: 4, scale: 0.95,
  },
  sprinter: {
    kind: 'sprinter', name: '地狱猎犬', sprites: ['z_hound'],
    baseHp: 58, speed: 1.72, damage: 8, attackEvery: 34, coins: 6, meat: 1, firstDay: 3, fps: 14, weight: 4, scale: 1.05,
  },
  bruiser: {
    kind: 'bruiser', name: zombieText('bruiser')?.name ?? '壮汉感染者', sprites: ['z_bruiser'],
    baseHp: 280, speed: 0.58, damage: 16, attackEvery: 60, coins: 10, meat: 2, firstDay: 4, fps: 8, weight: 3, scale: 1.22,
  },
  ghoul: {
    kind: 'ghoul', name: '燃烧食尸鬼', sprites: ['z_ghoul'],
    baseHp: 145, speed: 0.86, damage: 12, attackEvery: 78, coins: 13, meat: 2, firstDay: 6, fps: 11, weight: 3, scale: 1.02, ranged: true,
  },
  boss_beast: {
    kind: 'boss_beast', name: '地狱巨兽·暴君', sprites: ['boss_beast'],
    baseHp: 1150, speed: 0.44, damage: 24, attackEvery: 64, coins: 80, meat: 6, firstDay: 5, fps: 9, weight: 0, scale: 1.55, boss: true, ranged: true,
  },
  boss_demon: {
    kind: 'boss_demon', name: '深渊魔王·尸皇', sprites: ['boss_demon'],
    baseHp: 2150, speed: 0.38, damage: 32, attackEvery: 58, coins: 180, meat: 10, firstDay: 15, fps: 8, weight: 0, scale: 0.96, boss: true, ranged: true,
  },
};

export const zombieHp = (kind: ZombieKind, day: number) => Math.floor((ZOMBIES[kind].baseHp + day * 6) * (1 + 0.22 * day));
export const dayZombieCount = (day: number) => 12 + day * 10;
export const bossForDay = (day: number): ZombieKind | null => (day === 15 ? 'boss_demon' : day === 5 || day === 10 ? 'boss_beast' : null);
export const newZombieOn = (day: number) => {
  const b = bossForDay(day);
  if (b) return ZOMBIES[b];
  return Object.values(ZOMBIES).find((z) => !z.boss && z.firstDay === day && day > 1);
};

// ── 炮塔体系（4 种塔：机枪 / 电弧 / 冰霜 / 重炮）──
export type TurretType = 'mg' | 'tesla' | 'frost' | 'cannon';
export interface TurretLevel { damage: number; cooldown: number; aoe?: number; chain?: number }
export interface TurretDef {
  type: TurretType; name: string; desc: string; icon: string; sprite: string;
  range: number; buildScrap: number; upgradeScrap: [number, number, number];
  levels: [TurretLevel, TurretLevel, TurretLevel];
}
export const TURRETS: Record<TurretType, TurretDef> = {
  mg: {
    type: 'mg', name: '机枪塔', desc: '速射单体，造价便宜压制力强', icon: 'ic_turret', sprite: 'turret',
    range: 340, buildScrap: 6, upgradeScrap: [0, 7, 13],
    levels: [{ damage: 11, cooldown: 18 }, { damage: 21, cooldown: 12 }, { damage: 38, cooldown: 8 }],
  },
  frost: {
    type: 'frost', name: '冰霜塔', desc: '冰弹范围减速 45%，掩护输出', icon: 'ic_turret_frost', sprite: 'turret_frost',
    range: 330, buildScrap: 8, upgradeScrap: [0, 8, 15],
    levels: [{ damage: 12, cooldown: 34, aoe: 52 }, { damage: 22, cooldown: 25, aoe: 64 }, { damage: 36, cooldown: 17, aoe: 78 }],
  },
  tesla: {
    type: 'tesla', name: '电弧塔', desc: '高压电弧连续跳跃 3~5 名敌人', icon: 'ic_turret_tesla', sprite: 'turret_tesla',
    range: 320, buildScrap: 10, upgradeScrap: [0, 10, 18],
    levels: [{ damage: 24, cooldown: 40, chain: 3 }, { damage: 42, cooldown: 28, chain: 4 }, { damage: 72, cooldown: 19, chain: 5 }],
  },
  cannon: {
    type: 'cannon', name: '重炮塔', desc: '榴弹爆炸轰击大群僵尸并击退', icon: 'ic_turret_cannon', sprite: 'turret_cannon',
    range: 390, buildScrap: 12, upgradeScrap: [0, 12, 20],
    levels: [{ damage: 48, cooldown: 62, aoe: 68 }, { damage: 88, cooldown: 45, aoe: 86 }, { damage: 150, cooldown: 32, aoe: 108 }],
  },
};
// 保留 TURRET 别名以便兼容基础属性访问
export const TURRET = TURRETS.mg;

// ── 路障与堡垒房子升级（Lv1..3）──
export const MAX_WALL_LEVEL = 3;
export const WALL_LEVELS = [
  { level: 1, name: '铁丝木障', maxHp: 240, coins: 0, scrap: 0, reflect: 0 },
  { level: 2, name: '石砌壁垒', maxHp: 440, coins: 40, scrap: 4, reflect: 3 },
  { level: 3, name: '高压电网墙', maxHp: 720, coins: 85, scrap: 8, reflect: 8 },
];

export const MAX_FORT_LEVEL = 3;
export const FORT_LEVELS = [
  { level: 1, name: '木石酒馆', maxHp: 120, coins: 0, scrap: 0, desc: '屋顶2个塔位，庇护所门廊' },
  { level: 2, name: '石堡要塞', maxHp: 240, coins: 60, scrap: 6, desc: '屋顶守卫轻炮自动开火 · 大屋耐久翻倍' },
  { level: 3, name: '哥特铁堡', maxHp: 420, coins: 120, scrap: 12, desc: '屋顶双联火炮 · 屋顶射程+15% · 每夜自动修墙' },
];

// ── 消耗品 & 商店售价 ──
export const WALL_REPAIR_COST = 12;
export const FORT_REPAIR_COST = 18;
export const SHOP_GRENADE_COST = 35;
export const SHOP_ARMOR_COST = 40;
export const SHOP_MEDKIT_COST = 30;
export const SHOP_REROLL_COST = 15;
export const MAX_GRENADES = 5;

// ── 深夜小厨房：鲜肉翻炒 & 战前特餐 ──
export type MealId = 'spicy_skewer' | 'hearty_stew' | 'iron_steak';
export interface MealDef { id: MealId; name: string; desc: string; meatCost: number; dmgMul: number; armor: number; haste: number }
export const MEALS: Record<MealId, MealDef> = {
  spicy_skewer: { id: 'spicy_skewer', name: '香辣僵尸肉串', desc: '明天所有武器伤害 +22%', meatCost: 2, dmgMul: 0.22, armor: 0, haste: 0 },
  hearty_stew:  { id: 'hearty_stew',  name: '浓汤热炖',     desc: '立即回复 40 血 + 明天开局 +35 护甲', meatCost: 2, dmgMul: 0, armor: 35, haste: 0 },
  iron_steak:   { id: 'iron_steak',   name: '秘制铁板厚肉', desc: '明天角色与炮塔攻速 +20%', meatCost: 3, dmgMul: 0.1, armor: 15, haste: 0.2 },
};
export const MEAT_SELL_PRICE = 12; // 每块肉清炒出摊售卖可得 12 金币（主厨翻倍倾向）

// ── 天赋 ──
export type PerkId =
  | 'pierce' | 'ricochet' | 'overkill' | 'lifesteal' | 'incendiary' | 'overclock'
  | 'frostbite' | 'chainkill' | 'vanguard' | 'bloodfrenzy' | 'glasscannon' | 'secondwind'
  | 'rooftop' | 'shrapnel' | 'fortify' | 'shock';

export interface PerkDef { id: PerkId; name: string; desc: string; icon: string; rarity: Rarity }
const extraPerks: Record<string, { name: string; desc: string; rarity: Rarity }> = {
  rooftop:  { name: '居高临下', desc: '站在房顶时伤害 +30%，射程 +20%', rarity: 'rare' },
  shrapnel: { name: '高爆破片', desc: '手雷与爆炸伤害 +45%，爆炸半径放大', rarity: 'rare' },
  fortify:  { name: '铜墙铁壁', desc: '路障与房子最大耐久 +40%，开战获得 25 护甲', rarity: 'common' },
  shock:    { name: '链式雷涌', desc: '命中 25% 触发连锁电弧跳击身边目标', rarity: 'epic' },
};
const perk = (id: PerkId): PerkDef => {
  const lp = perkText(id);
  const ep = extraPerks[id];
  return { id, name: lp?.name ?? ep.name, desc: lp?.desc ?? ep.desc, icon: 'ic_' + id, rarity: (lp?.rarity ?? ep.rarity) as Rarity };
};
export const PERKS: PerkDef[] = ([
  'lifesteal', 'incendiary', 'frostbite', 'ricochet', 'overkill', 'overclock', 'vanguard', 'secondwind',
  'pierce', 'chainkill', 'bloodfrenzy', 'glasscannon', 'rooftop', 'shrapnel', 'fortify', 'shock',
] as PerkId[]).map(perk);
export const perkDef = (id: PerkId) => PERKS.find((p) => p.id === id)!;
export const RARITY_WEIGHT: Record<Rarity, number> = { common: 10, rare: 6, epic: 3, legendary: 1 };

// ── 职业（3 大职业全部可用！主厨随小厨房一起开放）──
export type ClassId = 'gunner' | 'engineer' | 'chef';
export interface ClassDef {
  id: ClassId; name: string; role: string; icon: string; passive: string; skill: string; skillDesc: string;
  dur: number; cd: number; comingSoon?: string;
}
export const CLASSES: Record<ClassId, ClassDef> = {
  gunner:   { id: 'gunner', name: '枪手', role: '主角输出', icon: 'wp_rifle', passive: '暴击率 +15%', skill: '鹰眼', skillDesc: '5 秒全穿透 + 必暴', dur: 300, cd: 1080 },
  engineer: { id: 'engineer', name: '工程师', role: '塔防建设', icon: 'ic_turret', passive: '建塔/升塔 -25% 废铁，塔伤害 +20%', skill: '过载', skillDesc: '所有炮塔 6 秒攻速 ×2', dur: 360, cd: 1080 },
  chef:     { id: 'chef', name: '主厨', role: '厨房经营', icon: 'ic_chef', passive: '僵尸多掉 1 块肉，卖肉 +35% 金币，菜品效果 +50%', skill: '战地大餐', skillDesc: '回 40% 血 + 8 秒攻速 ×1.4', dur: 480, cd: 1080 },
};
export const CRIT_CHANCE = 0.15;
export const CRIT_MUL = 2;

export const LAST_DAY = 15;
export const DAY_HEAL = 0.3;

// ── 局外成长 ──
export type Unlock = { stars: number; kind: 'weapon'; id: WeaponId } | { stars: number; kind: 'class'; id: ClassId };
export const UNLOCKS: Unlock[] = [
  { stars: 0, kind: 'weapon', id: 'revolver' },
  { stars: 0, kind: 'weapon', id: 'smg' },
  { stars: 0, kind: 'class', id: 'gunner' },
  { stars: 2, kind: 'class', id: 'engineer' },
  { stars: 3, kind: 'weapon', id: 'shotgun' },
  { stars: 4, kind: 'class', id: 'chef' },
  { stars: 6, kind: 'weapon', id: 'assault' },
  { stars: 8, kind: 'weapon', id: 'rifle' },
  { stars: 10, kind: 'weapon', id: 'tesla' },
  { stars: 14, kind: 'weapon', id: 'rocket' },
];
export const unlockedWeapons = (stars: number) => UNLOCKS.flatMap((u) => (u.kind === 'weapon' && stars >= u.stars ? [u.id] : []));
export const unlockedClasses = (stars: number) => UNLOCKS.flatMap((u) => (u.kind === 'class' && stars >= u.stars ? [u.id] : []));
export const classUnlockStars = (id: ClassId) => UNLOCKS.find((u) => u.kind === 'class' && u.id === id)?.stars;
export const nextUnlock = (stars: number) => UNLOCKS.find((u) => stars < u.stars);
export const unlockName = (u: Unlock) => (u.kind === 'weapon' ? WEAPONS[u.id].name : `职业「${CLASSES[u.id].name}」`);
