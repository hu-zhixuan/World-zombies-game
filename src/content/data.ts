// 内容表。6 把机制与品质分明的暮夜神兵（致敬《元气骑士》白→绿→蓝→紫→橙→红分级）、15 天敌群曲线与纯金币防线养成。
import legacyPerks from './legacy/perks.json';

const perkText = (id: string) => legacyPerks.PERKS.find((p) => p.id === id);

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
export const RARITY_NAME: Record<Rarity, string> = {
  common: '普通',
  uncommon: '精良',
  rare: '稀有',
  epic: '史诗',
  legendary: '传说',
  mythic: '神兵',
};
export const RARITY_TIER_COLOR: Record<Rarity, string> = {
  common: '白',
  uncommon: '绿',
  rare: '蓝',
  epic: '紫',
  legendary: '橙',
  mythic: '红',
};
export const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

// ── 武器（6 把品质色与定位完全分化的暮夜神兵：白/二连回膛 · 绿/蓄热连珠 · 蓝/龙息轰退 · 紫/麻痹雷链 · 橙/瞬发全穿 · 红/追踪火海）──
export type WeaponId = 'pistol' | 'smg' | 'shotgun' | 'tesla' | 'rifle' | 'rocket';
export interface WeaponDef {
  id: WeaponId; name: string; rarity: Rarity; icon: string; price: number;
  trait: string; desc: string;
  damage: number; interval: number; mag: number; reload: number; speed: number; range: number; spread: number;
  burst?: number; pellets?: number; pierce?: boolean; pierceCount?: number; ricochet?: number;
  chain?: number; aoe?: number; slow?: number; hitscan?: boolean; homing?: boolean;
}
// interval / reload 单位：步（1 秒 = 60 步）
export const WEAPONS: Record<WeaponId, WeaponDef> = {
  pistol: {
    id: 'pistol', name: '猎手双铳', rarity: 'common', icon: 'wp_pistol', price: 0,
    trait: '灵动二连', desc: '一扣扳机连发两颗银弹，+20% 暴击且每次击杀立即回膛 2 发弹药',
    damage: 19, burst: 2, interval: 30, mag: 10, reload: 50, speed: 13, range: 280, spread: 0,
  },
  smg: {
    id: 'smg', name: '连珠火铳', rarity: 'uncommon', icon: 'wp_smg', price: 95,
    trait: '蓄热狂飙', desc: '按住不放铳管升温，射速飙升，高热下每 3 发化作灼烧穿甲火弹',
    damage: 14, interval: 9, mag: 40, reload: 48, speed: 13.5, range: 300, spread: 0.04,
  },
  shotgun: {
    id: 'shotgun', name: '双管龙息铳', rarity: 'rare', icon: 'wp_shotgun', price: 150,
    trait: '轰退爆燃', desc: '6 发扇形龙息重弹贯穿 2 名敌军，中近距 1.5 倍轰击击退并点燃尸群',
    damage: 17, interval: 33, mag: 6, reload: 50, speed: 11.5, range: 285, spread: 0.135, pellets: 6, pierceCount: 2,
  },
  tesla: {
    id: 'tesla', name: '秘蓝法杖', rarity: 'epic', icon: 'wp_tesla', price: 215,
    trait: '麻痹超载', desc: '秘法雷链跳跃 4～6 名敌军并短暂麻痹，命中燃烧或冰冻目标触发元素超载 +35%',
    damage: 62, interval: 18, mag: 16, reload: 48, speed: 14, range: 350, spread: 0, chain: 4,
  },
  rifle: {
    id: 'rifle', name: '猩红圣铳', rarity: 'legendary', icon: 'wp_rifle', price: 285,
    trait: '瞬发全穿', desc: '扣扳机瞬发穿透整列敌军的圣光符文弹，对重甲与首领额外 +35% 破甲伤',
    damage: 160, interval: 35, mag: 6, reload: 52, speed: 99, range: 520, spread: 0, pierce: true, hitscan: true,
  },
  rocket: {
    id: 'rocket', name: '焦土爆炎炮', rarity: 'mythic', icon: 'wp_rocket', price: 360,
    trait: '追踪火海', desc: '发射轻度自导爆炎重弹，大范围轰炸并留下持续 3.5 秒的灼烧火海',
    damage: 225, interval: 41, mag: 4, reload: 54, speed: 9.4, range: 440, spread: 0, aoe: 96, homing: true,
  },
};
export const WEAPON_ORDER: WeaponId[] = ['pistol', 'smg', 'shotgun', 'tesla', 'rifle', 'rocket'];
export const MAX_STAR = 5;
export const starMul = (star: number) => 1 + 0.22 * (star - 1);
export const magSize = (id: WeaponId, star: number) => Math.round(WEAPONS[id].mag * (star >= 3 ? 1.4 : 1));
export const extraBullets = (id: WeaponId, star: number) => {
  if (star < 5) return 0;
  const w = WEAPONS[id];
  if (w.pellets) return 1;
  if (w.aoe) return 1;
  return 0;
};
export const STAR_PERKS: Record<number, string> = { 3: '弹匣 +40%', 5: '绝技觉醒升级' };
export const STAR_COST = [0, 85, 165, 270, 390]; // ★2..★5 费用
export function sustainedDps(w: WeaponDef, star = 1): number {
  const mag = magSize(w.id, star);
  const perPull = (w.pellets ?? w.burst ?? 1) + extraBullets(w.id, star);
  const aoeScale = w.aoe && star >= 5 ? 0.56 : 1;
  const effInterval = w.id === 'smg' ? 4.8 : w.interval;
  return (w.damage * starMul(star) * perPull * aoeScale * mag) / ((mag * effInterval + w.reload) / 60);
}

// ── 亡灵魔物与首领（100% 统一哥特暗黑像素风，15 天压迫递进曲线 + 空中翼魔威胁）──
export type MeatKind = 'tender' | 'thick' | 'essence';
export type ZombieKind = 'roamer' | 'crawler' | 'sprinter' | 'bat' | 'bruiser' | 'ghoul' | 'boss_beast' | 'boss_demon';
export interface ZombieDef {
  kind: ZombieKind; name: string; sprites: string[]; baseHp: number; speed: number; damage: number; attackEvery: number;
  coins: number; meat: number; meatKind: MeatKind; firstDay: number; fps: number; weight: number; scale: number;
  boss?: boolean; ranged?: boolean; flying?: boolean;
}
export const ZOMBIES: Record<ZombieKind, ZombieDef> = {
  roamer: {
    kind: 'roamer', name: '游荡腐尸', sprites: ['z_swamp', 'z_clothed', 'z_skeleton'],
    baseHp: 52, speed: 0.96, damage: 10, attackEvery: 46, coins: 2, meat: 1, meatKind: 'tender', firstDay: 1, fps: 9, weight: 8, scale: 1.0,
  },
  crawler: {
    kind: 'crawler', name: '噬魂黑猫', sprites: ['z_gato'],
    baseHp: 52, speed: 1.56, damage: 9, attackEvery: 36, coins: 2, meat: 1, meatKind: 'tender', firstDay: 2, fps: 11, weight: 4, scale: 1.0,
  },
  sprinter: {
    kind: 'sprinter', name: '地狱猎犬', sprites: ['z_hound'],
    baseHp: 62, speed: 1.92, damage: 11, attackEvery: 30, coins: 2, meat: 1, meatKind: 'tender', firstDay: 3, fps: 13, weight: 4, scale: 1.05,
  },
  bat: {
    kind: 'bat', name: '夜翼魔蝠', sprites: ['z_bat'],
    baseHp: 46, speed: 1.54, damage: 8, attackEvery: 48, coins: 3, meat: 1, meatKind: 'tender', firstDay: 3, fps: 10, weight: 3.2, scale: 1.05, flying: true,
  },
  bruiser: {
    kind: 'bruiser', name: '焦骨巨尸', sprites: ['z_ghoul'],
    baseHp: 245, speed: 0.72, damage: 20, attackEvery: 52, coins: 4, meat: 2, meatKind: 'thick', firstDay: 4, fps: 9, weight: 3, scale: 1.15,
  },
  ghoul: {
    kind: 'ghoul', name: '提灯怨灵', sprites: ['z_ghost'],
    baseHp: 130, speed: 0.94, damage: 15, attackEvery: 68, coins: 4, meat: 1, meatKind: 'essence', firstDay: 6, fps: 8, weight: 3, scale: 1.02, ranged: true, flying: true,
  },
  boss_beast: {
    kind: 'boss_beast', name: '地狱巨兽·暴君', sprites: ['boss_beast'],
    baseHp: 1250, speed: 0.50, damage: 28, attackEvery: 54, coins: 45, meat: 4, meatKind: 'essence', firstDay: 5, fps: 9, weight: 0, scale: 1.5, boss: true, ranged: true,
  },
  boss_demon: {
    kind: 'boss_demon', name: '深渊魔王·尸皇', sprites: ['boss_demon'],
    baseHp: 2700, speed: 0.45, damage: 36, attackEvery: 48, coins: 100, meat: 6, meatKind: 'essence', firstDay: 15, fps: 8, weight: 0, scale: 0.96, boss: true, ranged: true,
  },
};

export type DifficultyId = 'normal' | 'hard' | 'nightmare';
export interface DifficultyDef {
  id: DifficultyId;
  name: string;
  tag: string;
  desc: string;
  hpMul: number;
  dmgMul: number;
  spawnMul: number;
  nightHeal: number;
  starMul: number;
}
export const DIFFICULTIES: Record<DifficultyId, DifficultyDef> = {
  normal:    { id: 'normal',    name: '普通', tag: '暮夜守望', desc: '硬核基准 · 谨慎布防',   hpMul: 1.24, dmgMul: 1.18, spawnMul: 1.16, nightHeal: 0.16, starMul: 1 },
  hard:      { id: 'hard',      name: '困难', tag: '血月围城', desc: '敌群厚甲 · 减半夜愈',   hpMul: 1.56, dmgMul: 1.38, spawnMul: 1.30, nightHeal: 0.08, starMul: 1.5 },
  nightmare: { id: 'nightmare', name: '噩梦', tag: '深渊炼狱', desc: '绝境高压 · 零夜回血',   hpMul: 1.95, dmgMul: 1.62, spawnMul: 1.44, nightHeal: 0,    starMul: 2 },
};
export const DIFFICULTY_ORDER: DifficultyId[] = ['normal', 'hard', 'nightmare'];

export const zombieHp = (kind: ZombieKind, day: number, diff: DifficultyId = 'normal') => {
  const base = (ZOMBIES[kind].baseHp + day * 10) * (1 + 0.21 * day + 0.017 * day * day);
  const diffMul = diff === 'normal' && day <= 1 ? 1 : DIFFICULTIES[diff].hpMul;
  return Math.floor(base * diffMul);
};
export const dayZombieCount = (day: number, diff: DifficultyId = 'normal') =>
  Math.round((10 + day * 4.8 + (day >= 6 ? (day - 5) * 2.2 : 0)) * DIFFICULTIES[diff].spawnMul);
export const bossForDay = (day: number): ZombieKind | null => (day === 15 ? 'boss_demon' : day === 5 || day === 10 ? 'boss_beast' : null);
export const newZombieOn = (day: number) => {
  const b = bossForDay(day);
  if (b) return ZOMBIES[b];
  return Object.values(ZOMBIES).find((z) => !z.boss && z.firstDay === day && day > 1);
};

// ── 守卫炮塔体系（4 种哥特防线器械：火铳塔 / 寒霜水晶塔 / 雷鸣臼炮 / 黑铁重炮，全工坊建设统一只消耗金币）──
export type TurretType = 'mg' | 'tesla' | 'frost' | 'cannon';
export interface TurretLevel { damage: number; cooldown: number; aoe?: number; chain?: number }
export interface TurretDef {
  type: TurretType; name: string; desc: string; icon: string; sprite: string;
  range: number; buildCoins: number; upgradeCoins: [number, number, number];
  levels: [TurretLevel, TurretLevel, TurretLevel];
}
export const TURRETS: Record<TurretType, TurretDef> = {
  mg: {
    type: 'mg', name: '火铳塔', desc: '速射单体，辅助压制前线', icon: 'ic_turret', sprite: 'turret',
    range: 295, buildCoins: 85, upgradeCoins: [0, 110, 200],
    levels: [{ damage: 8, cooldown: 24 }, { damage: 13, cooldown: 18 }, { damage: 20, cooldown: 14 }],
  },
  frost: {
    type: 'frost', name: '寒霜水晶塔', desc: '寒晶范围减速 48%，克制快跑怪', icon: 'ic_turret_frost', sprite: 'turret_frost',
    range: 290, buildCoins: 110, upgradeCoins: [0, 130, 220],
    levels: [{ damage: 8, cooldown: 38, aoe: 62 }, { damage: 15, cooldown: 29, aoe: 74 }, { damage: 25, cooldown: 22, aoe: 88 }],
  },
  tesla: {
    type: 'tesla', name: '雷鸣臼炮', desc: '雷纹连弧跳跃 3～5 名敌人', icon: 'ic_turret_tesla', sprite: 'turret_tesla',
    range: 285, buildCoins: 145, upgradeCoins: [0, 165, 275],
    levels: [{ damage: 18, cooldown: 44, chain: 3 }, { damage: 29, cooldown: 34, chain: 4 }, { damage: 44, cooldown: 26, chain: 5 }],
  },
  cannon: {
    type: 'cannon', name: '黑铁重炮', desc: '重磅黑火药炮弹轰击尸群并击退', icon: 'ic_turret_cannon', sprite: 'turret_cannon',
    range: 335, buildCoins: 180, upgradeCoins: [0, 195, 315],
    levels: [{ damage: 46, cooldown: 62, aoe: 76 }, { damage: 82, cooldown: 46, aoe: 94 }, { damage: 132, cooldown: 34, aoe: 116 }],
  },
};
export const TURRET = TURRETS.mg;

// ── 路障与堡垒房子升级（Lv1..3：站在屋子/屋顶直接大幅增强火力与掩体减伤）──
export const MAX_WALL_LEVEL = 3;
export const WALL_LEVELS = [
  { level: 1, name: '拒马木障', maxHp: 300, coins: 0, reflect: 0 },
  { level: 2, name: '石砌壁垒', maxHp: 460, coins: 135, reflect: 4 },
  { level: 3, name: '雷纹铁壁', maxHp: 740, coins: 270, reflect: 10 },
];

export const MAX_FORT_LEVEL = 3;
export const FORT_LEVELS = [
  { level: 1, name: '木石酒馆', maxHp: 160, coins: 0, desc: '屋顶+20%伤·+20%程·换弹+25%·掩体-25%火球伤' },
  { level: 2, name: '石堡要塞', maxHp: 280, coins: 175, desc: '屋顶+28%伤·掩体-35% · 守卫火炮自动开火 · 大屋280血' },
  { level: 3, name: '哥特铁堡', maxHp: 440, coins: 340, desc: '屋顶+36%伤·掩体-45% · 双联火炮 · 屋顶慢回血+夜修墙' },
];

// ── 消耗品 & 商店售价 ──
export const WALL_REPAIR_COST = 16;
export const FORT_REPAIR_COST = 22;
export const SHOP_GRENADE_COST = 35;
export const SHOP_ARMOR_COST = 40;
export const SHOP_MEDKIT_COST = 30;
export const SHOP_REROLL_COST = 15;
export const MAX_GRENADES = 5;

// ── 魔物食材（主战场杀敌分级掉落，高地/暴击/控制击杀触发鲜切保鲜×2）──
export type IngredientId = MeatKind | 'spice';
export type MeatInventory = Record<MeatKind, number>;
export interface MeatDef {
  id: MeatKind;
  name: string;
  short: string;
  icon: string;
  sellPrice: number;
  hint: string;
}
export const MEATS: Record<MeatKind, MeatDef> = {
  tender:  { id: 'tender',  name: '嫩肉', short: '嫩', icon: 'ic_meat',         sellPrice: 6,  hint: '游荡腐尸 / 黑猫 / 猎犬 / 魔蝠' },
  thick:   { id: 'thick',   name: '厚肉', short: '厚', icon: 'ic_meat_thick',   sellPrice: 11, hint: '焦骨巨尸 / 悬赏补给' },
  essence: { id: 'essence', name: '魔髓', short: '髓', icon: 'ic_meat_essence', sellPrice: 20, hint: '首领巨兽 / 提灯怨灵 / 净空悬赏' },
};
export const MEAT_ORDER: MeatKind[] = ['tender', 'thick', 'essence'];
export const SPICE_BUY_COST = 12;
export const SPICE_SELL_PRICE = 4;
export const SPICE_META = { id: 'spice' as const, name: '秘酿香料', short: '香', icon: 'ic_spice', buyCost: SPICE_BUY_COST, sellPrice: SPICE_SELL_PRICE };

// ── 暮夜战备酒馆：6 道核心魔物战备料理（上菜即享：赚取军费 + 叠加明日主战场全队战备增益）──
export type MealId =
  | 'spicy_skewer' | 'hearty_stew' | 'garlic_cold_cut' | 'amber_egg_hash'
  | 'smoked_bone_broth' | 'iron_steak' | 'honey_glazed_ribs' | 'melted_cheese_roast'
  | 'crimson_carrot_braise' | 'berry_meat_tart' | 'abyss_marrow_pot' | 'apocalypse_feast';

export interface MealDef {
  id: MealId;
  name: string;
  icon: string;
  desc: string;
  battleTag: string;
  cost: Partial<Record<IngredientId, number>>;
  servings: number;
  basePay: number;
  baseTaste: number;
  cookTicks: number;
  sauceCost: number;
  researchCost: number;
  defaultUnlocked?: boolean;
  tags: string[];
  dmgMul: number;
  armor: number;
  haste: number;
  heal: number;
  turretMul?: number;
  critBonus?: number;
  frostRounds?: boolean;
  bonusGrenades?: number;
}

export const MEALS: Record<MealId, MealDef> = {
  spicy_skewer: {
    id: 'spicy_skewer', name: '炭烤香辣肉串', icon: 'ic_dish_skewer',
    desc: '明火快烤嫩肉 · 明日主战场主角与战友火器伤害 +22%',
    battleTag: '枪伤+22%',
    cost: { tender: 1 }, servings: 1, basePay: 28, baseTaste: 100, cookTicks: 65, sauceCost: 0, researchCost: 0, defaultUnlocked: true,
    tags: ['辣', '家常'], dmgMul: 0.22, armor: 0, haste: 0, heal: 0,
  },
  hearty_stew: {
    id: 'hearty_stew', name: '守夜暖胃肉汤', icon: 'ic_dish_stew',
    desc: '浓汤热补 · 立即回 35 血，明日主战场开战 +40 铁甲',
    battleTag: '回35血+40甲',
    cost: { tender: 2 }, servings: 1, basePay: 38, baseTaste: 120, cookTicks: 75, sauceCost: 0, researchCost: 0, defaultUnlocked: true,
    tags: ['鲜嫩', '饱腹'], dmgMul: 0, armor: 40, haste: 0, heal: 35,
  },
  garlic_cold_cut: {
    id: 'garlic_cold_cut', name: '蒜香疾风熏肉', icon: 'ic_dish_coldcut',
    desc: '双肉冷切拼盘 · 明日主战场射击攻速与换弹 +24%、枪伤 +12%',
    battleTag: '攻速+24%',
    cost: { tender: 1, thick: 1 }, servings: 1, basePay: 54, baseTaste: 165, cookTicks: 80, sauceCost: 0, researchCost: 0, defaultUnlocked: true,
    tags: ['烟熏', '家常'], dmgMul: 0.12, armor: 15, haste: 0.24, heal: 15,
  },
  iron_steak: {
    id: 'iron_steak', name: '铁板重甲厚排', icon: 'ic_dish_steak',
    desc: '炙烤巨兽厚排 · 明日主战场所有炮塔与堡垒火炮伤害/射速 +30%',
    battleTag: '炮塔+30%',
    cost: { thick: 2 }, servings: 1, basePay: 72, baseTaste: 215, cookTicks: 90, sauceCost: 0, researchCost: 0, defaultUnlocked: true,
    tags: ['厚肉', '烟熏'], dmgMul: 0.15, armor: 25, haste: 0.15, heal: 0, turretMul: 0.30,
  },
  abyss_marrow_pot: {
    id: 'abyss_marrow_pot', name: '深渊魔髓秘锅', icon: 'ic_dish_hotpot',
    desc: '魔髓沸煮奇锅 · 明日主战场暴击率 +18% 且子弹附带寒霜减速',
    battleTag: '暴+18%寒霜',
    cost: { thick: 1, essence: 1 }, servings: 1, basePay: 98, baseTaste: 290, cookTicks: 95, sauceCost: 0, researchCost: 0, defaultUnlocked: true,
    tags: ['辣', '奇味'], dmgMul: 0.24, armor: 30, haste: 0.16, heal: 25, critBonus: 0.18, frostRounds: true,
  },
  apocalypse_feast: {
    id: 'apocalypse_feast', name: '长夜堡垒全宴', icon: 'ic_dish_feast',
    desc: '三材镇店大席 · 明日全伤 +35% · 攻速 +24% · +50甲 · +2爆炎弹',
    battleTag: '伤+35%+2雷',
    cost: { tender: 2, thick: 1, essence: 1 }, servings: 1, basePay: 138, baseTaste: 380, cookTicks: 105, sauceCost: 0, researchCost: 0, defaultUnlocked: true,
    tags: ['鲜嫩', '烟熏', '饱腹', '奇味', '厚肉'], dmgMul: 0.35, armor: 50, haste: 0.24, heal: 45, turretMul: 0.22, critBonus: 0.12, bonusGrenades: 2,
  },
  // 兼容旧存档引用的 6 道副菜映射
  amber_egg_hash: {
    id: 'amber_egg_hash', name: '炉火金蛋煎肉', icon: 'ic_dish_egg',
    desc: '铁锅煎香盖饭 · 明日武器伤害 +18%', battleTag: '枪伤+18%',
    cost: { tender: 2 }, servings: 1, basePay: 40, baseTaste: 145, cookTicks: 80, sauceCost: 0, researchCost: 0, defaultUnlocked: true,
    tags: ['鲜嫩', '辣'], dmgMul: 0.18, armor: 15, haste: 0.14, heal: 15,
  },
  smoked_bone_broth: {
    id: 'smoked_bone_broth', name: '白萝卜清炖骨汤', icon: 'ic_dish_turnip',
    desc: '慢火热汤 · 回 45 血且 +40 护甲', battleTag: '回45血/+40甲',
    cost: { tender: 3 }, servings: 1, basePay: 44, baseTaste: 170, cookTicks: 85, sauceCost: 0, researchCost: 0, defaultUnlocked: true,
    tags: ['鲜嫩', '饱腹'], dmgMul: 0.10, armor: 40, haste: 0, heal: 45,
  },
  honey_glazed_ribs: {
    id: 'honey_glazed_ribs', name: '蜜汁甜玉米肋排', icon: 'ic_dish_corn',
    desc: '炭炉肋排 · 伤害 +26%', battleTag: '枪伤+26%',
    cost: { tender: 1, thick: 1 }, servings: 1, basePay: 60, baseTaste: 230, cookTicks: 85, sauceCost: 0, researchCost: 0, defaultUnlocked: true,
    tags: ['厚肉', '家常'], dmgMul: 0.26, armor: 18, haste: 0.16, heal: 15,
  },
  melted_cheese_roast: {
    id: 'melted_cheese_roast', name: '熔岩奶酪焗厚肉', icon: 'ic_dish_cheese',
    desc: '浓香拉丝厚肉 · +35 护甲', battleTag: '护甲+35/伤+24%',
    cost: { thick: 2 }, servings: 1, basePay: 72, baseTaste: 265, cookTicks: 90, sauceCost: 0, researchCost: 0, defaultUnlocked: true,
    tags: ['厚肉', '饱腹'], dmgMul: 0.24, armor: 35, haste: 0.15, heal: 25,
  },
  crimson_carrot_braise: {
    id: 'crimson_carrot_braise', name: '琥珀蜜汁炖肉腩', icon: 'ic_dish_carrot',
    desc: '琥珀慢炖肉腩 · 全攻防提升', battleTag: '枪伤+30%/+28甲',
    cost: { tender: 2, thick: 2 }, servings: 1, basePay: 78, baseTaste: 300, cookTicks: 95, sauceCost: 0, researchCost: 0, defaultUnlocked: true,
    tags: ['鲜嫩', '烟熏', '厚肉'], dmgMul: 0.30, armor: 28, haste: 0.18, heal: 30,
  },
  berry_meat_tart: {
    id: 'berry_meat_tart', name: '暮夜野莓烘肉派', icon: 'ic_dish_tart',
    desc: '魔髓调馅肉派 · 伤害 +34%', battleTag: '枪伤+34%',
    cost: { thick: 1, essence: 1 }, servings: 1, basePay: 96, baseTaste: 345, cookTicks: 95, sauceCost: 0, researchCost: 0, defaultUnlocked: true,
    tags: ['奇味', '鲜嫩'], dmgMul: 0.34, armor: 25, haste: 0.20, heal: 30,
  },
};

/** 精选 6 道战备主菜（一屏展示、定位清晰、直连主战场） */
export const MEAL_ORDER: MealId[] = [
  'spicy_skewer', 'hearty_stew', 'garlic_cold_cut',
  'iron_steak', 'abyss_marrow_pot', 'apocalypse_feast',
];

export const defaultResearchedMeals = (): MealId[] => [...MEAL_ORDER];
export const unlockedMeals = (_day?: number): MealDef[] => MEAL_ORDER.map((id) => MEALS[id]);
export const MEAT_SELL_PRICE = MEATS.tender.sellPrice;

export const RYE_FALLBACK = {
  name: '干硬黑麦饼',
  icon: 'ic_rye',
  pay: 1,
  rep: -1,
  fans: 0,
  cookTicks: 60,
} as const;

export type DrinkId = 'beer' | 'tea';
export interface DrinkDef {
  id: DrinkId;
  name: string;
  icon: string;
  pay: number;
  rep: number;
  fans: number;
  orderQuote: string;
}
export const DRINKS: Record<DrinkId, DrinkDef> = {
  beer: {
    id: 'beer', name: '麦芽黑啤', icon: 'ic_beer', pay: 18, rep: 2, fans: 10,
    orderQuote: '先打一大杯冰镇麦芽黑啤解乏，泡沫留足两指厚！',
  },
  tea: {
    id: 'tea', name: '守夜热茶', icon: 'ic_tea', pay: 16, rep: 2, fans: 9,
    orderQuote: '夜风凉透骨头，快沏一盏滚烫暖胃的守夜热茶！',
  },
};

export const MAX_DISH_LV = 3;
export const dishUpgradeCost = (id: MealId, lv: number) => Math.round((MEALS[id].basePay * 0.65 + 16) * lv);
export const dishEnhanceMeatCost = (id: MealId, lv: number): MeatInventory => {
  const m = MEALS[id].cost;
  const mul = Math.max(1, lv);
  return {
    tender: (m.tender ?? 0) * mul,
    thick: (m.thick ?? 0) * mul,
    essence: (m.essence ?? 0) * mul,
  };
};
export const dishLevelPayMul = (lv: number) => 1 + 0.25 * Math.max(0, lv - 1);
export const dishLevelBuffMul = (lv: number) => 1 + 0.22 * Math.max(0, lv - 1);
export const dishLevelTaste = (id: MealId, lv: number) =>
  MEALS[id].baseTaste + Math.max(0, lv - 1) * Math.round(MEALS[id].baseTaste * 0.2 + 15);
export const dishLevelServings = (id: MealId, lv: number) =>
  MEALS[id].servings + (lv >= 2 ? 1 : 0) + (lv >= 3 ? 1 : 0);

// ── 酒馆硬件装潢升级（室内可见家具 + 主战场永久战力双联动）──
export type TavernUpgradeId = 'tables_6' | 'tables_8' | 'fast_tap' | 'wide_pass' | 'warm_lantern';
export interface TavernUpgradeDef {
  id: TavernUpgradeId;
  name: string;
  desc: string;
  battleTag: string;
  cost: number;
  icon: string;
}
export const TAVERN_UPGRADES: Record<TavernUpgradeId, TavernUpgradeDef> = {
  tables_6:     { id: 'tables_6',     name: '6座',     battleTag: '城墙+120',   desc: '大堂增设第3桌(6座) · 主战场防线与大屋耐久上限永久 +120', cost: 90,  icon: 'ic_chef' },
  tables_8:     { id: 'tables_8',     name: '8座',     battleTag: '城墙+240',   desc: '大堂增设第4桌(8座) · 主战场防线与大屋耐久上限再 +120', cost: 145, icon: 'ic_chef' },
  wide_pass:    { id: 'wide_pass',    name: '传菜架',   battleTag: '全伤+15%',   desc: '后厨出锅速度翻倍 · 主战场主角与战友火器伤害永久 +15%', cost: 95,  icon: 'ic_clean_plate' },
  fast_tap:     { id: 'fast_tap',     name: '铜酒栓',   battleTag: '开战甲+雷',  desc: '食客配酒赏金 +25% · 每晚开战自动获 +35铁甲 与 +1爆炎弹', cost: 80,  icon: 'ic_beer' },
  warm_lantern: { id: 'warm_lantern', name: '琥珀灯',   battleTag: '高地暴+12%', desc: '吸引高赏金豪客 · 屋顶与门廊高地暴击率永久 +12%、射程 +10%', cost: 110, icon: 'ic_ledger' },
};
export const TAVERN_UPGRADE_ORDER: TavernUpgradeId[] = ['wide_pass', 'fast_tap', 'warm_lantern'];
export const SEAT_UPGRADE_ORDER: TavernUpgradeId[] = ['tables_6', 'tables_8'];

// ── 食客主战场支援身份（每位食客吃饱后立刻反哺主战场！）──
export type GuestSupportKind = 'smith' | 'arms' | 'medic' | 'vanguard';
export interface GuestSupportDef {
  id: GuestSupportKind;
  roleName: string;
  shortTag: string;
  desc: string;
  icon: string;
}
export const GUEST_SUPPORTS: Record<GuestSupportKind, GuestSupportDef> = {
  smith:    { id: 'smith',    roleName: '筑城匠师', shortTag: '修墙+90·造塔85折', desc: '饱餐后立即修复防线与大屋 90 耐久，且工坊造塔/升塔立减 15% 金币', icon: 'ic_anvil' },
  arms:     { id: 'arms',     roleName: '军火游商', shortTag: '赠爆炎弹·战场空投', desc: '饱餐后立即赠送 1 枚爆炎弹，且明日主战场额外空投 1 个武器升星箱', icon: 'ic_grenade' },
  medic:    { id: 'medic',    roleName: '战地药师', shortTag: '回血+35·铁甲+35',   desc: '饱餐后立即为主角恢复 35 生命并镀上 +35 镶铁护甲', icon: 'ic_armor' },
  vanguard: { id: 'vanguard', roleName: '猎魔同袍', shortTag: '明日战友伤害+35%', desc: '饱餐后激发明日【战友狂飙】：全体战友伤害 +35%、攻速 +25%', icon: 'ic_rooftop' },
};
export const GUEST_SUPPORT_ORDER: GuestSupportKind[] = ['smith', 'arms', 'medic', 'vanguard'];

// ── 主战场狩猎悬赏（酒馆委托 -> 战场明确目标 -> 达成即奖重金与高阶肉材）──
export type BattleContractId = 'rooftop_hunt' | 'crit_blast' | 'elite_purge' | 'iron_wall';
export interface BattleContractDef {
  id: BattleContractId;
  title: string;
  desc: (target: number) => string;
  baseTarget: number;
  perDayTarget: number;
  baseCoins: number;
  meatReward: MeatInventory;
  bonusGrenade?: number;
}
export const BATTLE_CONTRACTS: Record<BattleContractId, BattleContractDef> = {
  rooftop_hunt: {
    id: 'rooftop_hunt', title: '高地狙猎令',
    desc: (t) => `站在屋顶或门廊高地击杀 ${t} 只魔物`,
    baseTarget: 4, perDayTarget: 1, baseCoins: 45,
    meatReward: { tender: 2, thick: 1, essence: 0 },
  },
  crit_blast: {
    id: 'crit_blast', title: '破甲重火令',
    desc: (t) => `利用暴击或爆炎火器击杀 ${t} 只魔物`,
    baseTarget: 3, perDayTarget: 1, baseCoins: 55,
    meatReward: { tender: 1, thick: 2, essence: 0 }, bonusGrenade: 1,
  },
  elite_purge: {
    id: 'elite_purge', title: '猎魔净空令',
    desc: (t) => `击杀 ${t} 只飞怪或精锐魔物（黑猫/猎犬/巨尸/魔蝠/怨灵/首领）`,
    baseTarget: 2, perDayTarget: 1, baseCoins: 68,
    meatReward: { tender: 0, thick: 1, essence: 1 },
  },
  iron_wall: {
    id: 'iron_wall', title: '铁壁守夜令',
    desc: () => '本夜清场时前院防线耐久保持在 50% 以上',
    baseTarget: 1, perDayTarget: 0, baseCoins: 62,
    meatReward: { tender: 1, thick: 1, essence: 1 },
  },
};
export const BATTLE_CONTRACT_ORDER: BattleContractId[] = ['rooftop_hunt', 'crit_blast', 'elite_purge', 'iron_wall'];

export interface DinerGuestDef {
  id: string; name: string; role: string; sprite: string; fps: number;
  supportKind: GuestSupportKind;
  dish: MealId; dishName: string; basePay: number;
  orderQuote: string; thanksQuote: string;
}
export const DINER_GUESTS: DinerGuestDef[] = [
  {
    id: 'agou', name: '阿狗', role: '猎魔游侠', sprite: 'npc_hat', fps: 6, supportKind: 'vanguard',
    dish: 'spicy_skewer', dishName: '炭烤香辣肉串', basePay: 28,
    orderQuote: '小胡！黑雾立宵禁不许人出门，老子偏刚摸黑踩完点回来——烤串暴辣的，呛醒这鬼夜！',
    thanksQuote: '嘶哈——够烈够野！你一个大学生都敢跟死城掀桌，明晚我带头冲上去撕开缺口！',
  },
  {
    id: 'qijie', name: '七姐', role: '战地药师', sprite: 'npc_woman', fps: 7, supportKind: 'medic',
    dish: 'hearty_stew', dishName: '守夜暖胃肉汤', basePay: 38,
    orderQuote: '小胡同学，给姐盛碗滚烫肉汤！手腕震肿了还死不低头，这副铁甲和秘药你必须披上！',
    thanksQuote: '好一口烈汤！黑雾越要咱们闭嘴等死，姐越要保你活蹦乱跳杀穿东门！',
  },
  {
    id: 'laobao', name: '老包', role: '筑城匠师', sprite: 'npc_bearded', fps: 6, supportKind: 'smith',
    dish: 'iron_steak', dishName: '铁板重甲厚排', basePay: 72,
    orderQuote: '小胡，切块最厚的铁板肉排！怪物想推平老街立规矩，老子偏把铁壁砸成它的断头台！',
    thanksQuote: '痛快！满口滚油肉汁，前院木垒我刚替你铆成铁板，今晚造塔加固全算八五折！',
  },
  {
    id: 'niqiu', name: '泥鳅', role: '军火游商', sprite: 'npc_oldman', fps: 7, supportKind: 'arms',
    dish: 'garlic_cold_cut', dishName: '蒜香疾风熏肉', basePay: 54,
    orderQuote: '小胡，上盘招牌蒜香熏肉！满城都押暮色镇必亡，老夫偏反着盘口全押你这身反骨！',
    thanksQuote: '绝活！这枚爆炎弹揣稳了，明晚战场上老夫冒死给你抛口神兵箱，一起掀翻黑雾！',
  },
];

// ── 酒馆人手排班：6 位特色伙计（Lv.1~5）+ 3 档招工广告 + 后院贮肉架 + 周期主题派对 ──
export type StaffRole = 'kitchen' | 'floor' | 'dispatch' | 'rest';
export type StaffSkillId = 'auto_clean' | 'auto_drink' | 'auto_mortar' | 'extra_plate' | 'fast_cook' | 'spice_haul';
export type AdTierId = 'flyer' | 'board' | 'guild';

export interface StaffDef {
  id: string;
  name: string;
  title: string;
  sprite: 'npc_woman' | 'npc_bearded' | 'npc_oldman' | 'npc_hat';
  hireCost: number;
  dailyWage: number;
  specialty: StaffRole;
  unlockGrade: 'E' | 'D' | 'C' | 'B';
  lv3Skill: StaffSkillId;
  lv5Skill: StaffSkillId;
  lv3Label: string;
  lv5Label: string;
  flavor: string;
}

export const STAFF_SKILL_META: Record<StaffSkillId, { label: string; desc: string }> = {
  auto_clean:  { label: '手脚麻利', desc: '营业时自动收拾餐桌脏碗盘' },
  auto_drink:  { label: '酒水熟手', desc: '营业时自动为坐席客人斟茶倒酒' },
  auto_mortar: { label: '辛辣磨手', desc: '辣酱低于 45% 时自动石臼补磨' },
  extra_plate: { label: '余锅加菜', desc: '出菜 28% 几率赠出额外 1 盘免材热菜' },
  fast_cook:   { label: '旺火快炒', desc: '后厨灶台出菜速度再 +22%' },
  spice_haul:  { label: '寻香老道', desc: '夜里派遣多带回双份秘酿香料与厚肉' },
};

export const MAX_STAFF_LV = 5;
export const STAFF_TRAIN_COST = [0, 28, 46, 72, 105]; // Lv.1->2 .. Lv.4->5

export const STAFF_POOL: StaffDef[] = [
  {
    id: 'staff_meimei', name: '梅姐', title: '利落跑堂', sprite: 'npc_woman',
    hireCost: 48, dailyWage: 12, specialty: 'floor', unlockGrade: 'E',
    lv3Skill: 'auto_clean', lv5Skill: 'auto_drink',
    lv3Label: '自动收碗', lv5Label: '自动打酒',
    flavor: '手脚干脆，一人顶半个前厅。',
  },
  {
    id: 'staff_dazhu', name: '大壮', title: '黑铁帮厨', sprite: 'npc_bearded',
    hireCost: 58, dailyWage: 15, specialty: 'kitchen', unlockGrade: 'E',
    lv3Skill: 'fast_cook', lv5Skill: 'auto_mortar',
    lv3Label: '旺火加快', lv5Label: '自动磨酱',
    flavor: '拎得动铸铁炒锅，磨辣酱也是一把好手。',
  },
  {
    id: 'staff_xiaobai', name: '阿茗', title: '茶吧小侍', sprite: 'npc_hat',
    hireCost: 68, dailyWage: 16, specialty: 'floor', unlockGrade: 'D',
    lv3Skill: 'auto_drink', lv5Skill: 'auto_clean',
    lv3Label: '自动打酒', lv5Label: '兼手收碗',
    flavor: '泡热茶和控黑啤泡沫稳如尺量。',
  },
  {
    id: 'staff_laotou', name: '陈伯', title: '驿道寻香客', sprite: 'npc_oldman',
    hireCost: 64, dailyWage: 14, specialty: 'dispatch', unlockGrade: 'D',
    lv3Skill: 'spice_haul', lv5Skill: 'auto_mortar',
    lv3Label: '满载寻香', lv5Label: '磨酱能手',
    flavor: '熟门熟路专找镇外秘酿香料与兽肉。',
  },
  {
    id: 'staff_tiechui', name: '铁锅梁', title: '老练掌勺', sprite: 'npc_bearded',
    hireCost: 92, dailyWage: 22, specialty: 'kitchen', unlockGrade: 'C',
    lv3Skill: 'fast_cook', lv5Skill: 'extra_plate',
    lv3Label: '旺火快炒', lv5Label: '余锅加菜',
    flavor: '铁铲一抖能顺势抢出第二盘热菜。',
  },
  {
    id: 'staff_suyu', name: '苏玉', title: '夜巡领班', sprite: 'npc_woman',
    hireCost: 115, dailyWage: 26, specialty: 'floor', unlockGrade: 'B',
    lv3Skill: 'auto_mortar', lv5Skill: 'auto_drink',
    lv3Label: '自动磨酱', lv5Label: '全能端饮',
    flavor: '既顾得住石臼辣酱，又能帮喝客斟满黑啤。',
  },
];

export interface AdTierDef { id: AdTierId; name: string; cost: number; desc: string; count: number; minLv: number; maxGradeIdx: number }
export const AD_TIERS: Record<AdTierId, AdTierDef> = {
  flyer: { id: 'flyer', name: '街角传单', cost: 22,  desc: '刷新 2 名基础帮手立等应聘', count: 2, minLv: 1, maxGradeIdx: 1 },
  board: { id: 'board', name: '酒馆告示', cost: 55,  desc: '刷新 3 名好手应聘，涵括进阶专精', count: 3, minLv: 1, maxGradeIdx: 2 },
  guild: { id: 'guild', name: '商会悬赏', cost: 110, desc: '刷新 3 名强将应聘且老练领班几率提升', count: 3, minLv: 2, maxGradeIdx: 3 },
};
export const AD_TIER_ORDER: AdTierId[] = ['flyer', 'board', 'guild'];

export interface RackLevelDef {
  level: number;
  name: string;
  cost: number;
  tender: number;
  thick: number;
  essence: number;
  desc: string;
}
export const MAX_RACK_LEVEL = 3;
export const RACK_LEVELS: RackLevelDef[] = [
  { level: 1, name: '风干挂肉架', cost: 85,  tender: 2, thick: 1, essence: 0, desc: '第 4 日起每战归来自动产 +2嫩肉 +1厚肉' },
  { level: 2, name: '双层盐腌架', cost: 135, tender: 3, thick: 2, essence: 0, desc: '每战归来自动产 +3嫩肉 +2厚肉' },
  { level: 3, name: '寒髓秘窖架', cost: 195, tender: 4, thick: 2, essence: 1, desc: '每战归来自动产 +4嫩肉 +2厚肉 +1魔髓' },
];

export interface PartyDef {
  id: string;
  name: string;
  tags: string[];
  meatHint: MeatKind;
  payMul: number;
  fansMul: number;
  desc: string;
}
export const PARTIES: PartyDef[] = [
  { id: 'stew_fest',  name: '暖锅炖肉祭', tags: ['鲜嫩', '饱腹', '家常'], meatHint: 'tender',  payMul: 1.50, fansMul: 1.60, desc: '鲜嫩/饱腹/家常菜售价 +50% · 涨粉 +60%' },
  { id: 'steak_fest', name: '铁板炙烤祭', tags: ['厚肉', '烟熏'],        meatHint: 'thick',   payMul: 1.55, fansMul: 1.70, desc: '厚肉/烟熏大肉售价 +55% · 涨粉 +70%' },
  { id: 'abyss_fest', name: '深渊奇味祭', tags: ['奇味', '辣'],          meatHint: 'essence', payMul: 1.65, fansMul: 1.80, desc: '魔髓/辛辣奇菜售价 +65% · 涨粉 +80%' },
];

export function partyForDay(day: number): { active: PartyDef | null; upcoming: PartyDef | null; daysAway: number; partyDay: number } {
  if (day <= 0) return { active: null, upcoming: null, daysAway: 0, partyDay: 0 };
  if (day % 4 === 0) {
    const idx = (Math.floor(day / 4) - 1) % PARTIES.length;
    return { active: PARTIES[idx], upcoming: null, daysAway: 0, partyDay: day };
  }
  const nextPartyDay = Math.ceil(day / 4) * 4;
  const daysAway = nextPartyDay - day;
  if (daysAway <= 2) {
    const idx = (Math.floor(nextPartyDay / 4) - 1) % PARTIES.length;
    return { active: null, upcoming: PARTIES[idx], daysAway, partyDay: nextPartyDay };
  }
  return { active: null, upcoming: null, daysAway, partyDay: nextPartyDay };
}


// ── 天赋 ──
export type PerkId =
  | 'pierce' | 'ricochet' | 'overkill' | 'lifesteal' | 'incendiary' | 'overclock'
  | 'frostbite' | 'chainkill' | 'vanguard' | 'bloodfrenzy' | 'glasscannon' | 'secondwind'
  | 'rooftop' | 'shrapnel' | 'fortify' | 'shock';

export interface PerkDef { id: PerkId; name: string; desc: string; icon: string; rarity: Rarity }
const extraPerks: Record<string, { name: string; desc: string; rarity: Rarity }> = {
  pierce:   { name: '贯穿', desc: '所有弹丸穿透不消失，射速仅微降 8%', rarity: 'epic' },
  rooftop:  { name: '居高临下', desc: '站在房顶时伤害再 +20%，射程 +15%', rarity: 'rare' },
  shrapnel: { name: '高爆破片', desc: '爆炎弹与爆炸伤害 +32%，爆炸半径放大', rarity: 'rare' },
  fortify:  { name: '铜墙铁壁', desc: '路障与房子最大耐久 +40%，开战获得 25 护甲', rarity: 'common' },
  shock:    { name: '链式雷涌', desc: '命中 20% 触发连锁电弧跳击身边目标', rarity: 'epic' },
};
const perk = (id: PerkId): PerkDef => {
  const lp = perkText(id);
  const ep = extraPerks[id];
  return { id, name: ep?.name ?? lp?.name ?? id, desc: ep?.desc ?? lp?.desc ?? '', icon: 'ic_' + id, rarity: (lp?.rarity ?? ep.rarity) as Rarity };
};
export const PERKS: PerkDef[] = ([
  'lifesteal', 'incendiary', 'frostbite', 'ricochet', 'overkill', 'overclock', 'vanguard', 'secondwind',
  'pierce', 'chainkill', 'bloodfrenzy', 'glasscannon', 'rooftop', 'shrapnel', 'fortify', 'shock',
] as PerkId[]).map(perk);
export const perkDef = (id: PerkId) => PERKS.find((p) => p.id === id)!;
export const RARITY_WEIGHT: Record<Rarity, number> = { common: 10, uncommon: 8, rare: 6, epic: 3, legendary: 1.5, mythic: 0.7 };

// ── 职业（3 大职业全部可用！厨师随深夜食堂一起开放）──
export type ClassId = 'gunner' | 'engineer' | 'chef';
export interface ClassDef {
  id: ClassId; name: string; role: string; icon: string; passive: string; skill: string; skillDesc: string;
  dur: number; cd: number; comingSoon?: string;
}
export const CLASSES: Record<ClassId, ClassDef> = {
  gunner:   { id: 'gunner', name: '猎手', role: '屋顶神射', icon: 'wp_rifle', passive: '暴击率 +15%', skill: '鹰眼', skillDesc: '5 秒全穿透必暴', dur: 300, cd: 1080 },
  engineer: { id: 'engineer', name: '铸匠', role: '工坊铸造', icon: 'ic_turret', passive: '造塔 -25%金 · 塔伤 +20%', skill: '过载', skillDesc: '炮塔 6 秒攻速 ×2', dur: 360, cd: 1080 },
  chef:     { id: 'chef', name: '厨师', role: '食堂掌勺', icon: 'ic_chef', passive: '掉肉/卖菜 +35% · 特餐 +50%', skill: '守夜大餐', skillDesc: '回 40% 血 + 攻速 ×1.4', dur: 480, cd: 1080 },
};
export const CRIT_CHANCE = 0.15;
export const CRIT_MUL = 2;

export const LAST_DAY = 15;
export const DAY_HEAL = 0.16;

// ── 局外成长（更快解锁各把特色神兵：0★起手体验白/绿/蓝，2/4/6★逐级解锁紫/橙/红神兵）──
export type Unlock = { stars: number; kind: 'weapon'; id: WeaponId } | { stars: number; kind: 'class'; id: ClassId };
export const UNLOCKS: Unlock[] = [
  { stars: 0, kind: 'weapon', id: 'smg' },
  { stars: 0, kind: 'weapon', id: 'shotgun' },
  { stars: 0, kind: 'class', id: 'gunner' },
  { stars: 2, kind: 'class', id: 'engineer' },
  { stars: 2, kind: 'weapon', id: 'tesla' },
  { stars: 4, kind: 'class', id: 'chef' },
  { stars: 4, kind: 'weapon', id: 'rifle' },
  { stars: 6, kind: 'weapon', id: 'rocket' },
];
export const unlockedWeapons = (stars: number) => UNLOCKS.flatMap((u) => (u.kind === 'weapon' && stars >= u.stars ? [u.id] : []));
export const unlockedClasses = (stars: number) => UNLOCKS.flatMap((u) => (u.kind === 'class' && stars >= u.stars ? [u.id] : []));
export const classUnlockStars = (id: ClassId) => UNLOCKS.find((u) => u.kind === 'class' && u.id === id)?.stars;
export const nextUnlock = (stars: number) => UNLOCKS.find((u) => stars < u.stars);
export const unlockName = (u: Unlock) => (u.kind === 'weapon' ? WEAPONS[u.id].name : `职业「${CLASSES[u.id].name}」`);

// ── 动态黑夜天象（纯画面氛围 + 玩法变奏，顶栏仅 2 字标识）──
export type WeatherDef = { id: 'clear' | 'fog' | 'bloodrain' | 'gale'; short: string; name: string; desc: string };
export const WEATHERS: Record<'clear' | 'fog' | 'bloodrain' | 'gale', WeatherDef> = {
  clear:     { id: 'clear',     short: '',     name: '寒星夜', desc: '夜空澄澈，战局无额外天象变奏' },
  fog:       { id: 'fog',       short: '浓雾', name: '浓雾夜', desc: '地面视野微收，高地煤油灯光圈内暴击率大幅提升' },
  bloodrain: { id: 'bloodrain', short: '血雨', name: '血雨夜', desc: '爆炎火海范围收敛，雷鸣连弧与寒霜冻结连锁翻倍' },
  gale:      { id: 'gale',      short: '狂风', name: '狂风夜', desc: '顺风爆炎弹飞得更远，空中飞魔俯冲更加迅急' },
};
export function weatherForDay(day: number): 'clear' | 'fog' | 'bloodrain' | 'gale' {
  if (day < 3) return 'clear';
  const m = day % 4;
  if (m === 3) return 'fog';
  if (m === 0) return 'bloodrain';
  if (m === 2 && day >= 6) return 'gale';
  return 'clear';
}

