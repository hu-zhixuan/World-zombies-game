// 内容表。8 把机制迥异的武器（致敬《元气骑士》×《沼泽激战》）、15 天敌群曲线与纯金币防线养成。
import legacyPerks from './legacy/perks.json';
import legacyWeapons from './legacy/weapons.json';
import legacyZombies from './legacy/zombies.json';

const perkText = (id: string) => legacyPerks.PERKS.find((p) => p.id === id);
const weaponText = (id: string) => legacyWeapons.WEAPONS.find((w) => w.id === id);
const zombieText = (key: string) => legacyZombies.ZOMBIE_DEX.find((z) => z.key === key);

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export const RARITY_NAME: Record<Rarity, string> = { common: '普通', rare: '稀有', epic: '史诗', legendary: '传说' };

// ── 武器（8 把机制完全分化的武器：二连回膛 / 穿甲跳弹 / 蓄热机炮 / 龙息霰弹 / 深冻碎冰 / 瞬发磁轨 / 超载电弧 / 追踪火海）──
export type WeaponId = 'pistol' | 'revolver' | 'smg' | 'shotgun' | 'assault' | 'rifle' | 'tesla' | 'rocket';
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
    id: 'pistol', name: weaponText('pistol')?.name ?? '猎手双发手枪', rarity: 'common', icon: 'wp_pistol', price: 0,
    trait: '灵动二连', desc: '一发扳机连打两颗银弹，+20% 暴击且每次击杀立即回膛 2 发子弹',
    damage: 22, burst: 2, interval: 22, mag: 10, reload: 42, speed: 13, range: 270, spread: 0,
  },
  revolver: {
    id: 'revolver', name: '重锤左轮炮', rarity: 'common', icon: 'wp_revolver', price: 90,
    trait: '穿甲跳弹', desc: '大口径马格南重弹击飞击退 2 人，命中后自动弹射追击近邻僵尸',
    damage: 64, interval: 26, mag: 6, reload: 50, speed: 15, range: 315, spread: 0, pierceCount: 2, ricochet: 1,
  },
  smg: {
    id: 'smg', name: '暴风加特林', rarity: 'rare', icon: 'wp_smg', price: 135,
    trait: '蓄热狂飙', desc: '按住不放管口升温，射速飙升至 2.5 倍，高热下每 3 发化作灼烧穿甲弹',
    damage: 13, interval: 8, mag: 44, reload: 56, speed: 13, range: 275, spread: 0.045,
  },
  shotgun: {
    id: 'shotgun', name: '双管龙息霰弹', rarity: 'rare', icon: 'wp_shotgun', price: 155,
    trait: '轰退爆燃', desc: '7 发扇形龙息重弹，中近距 1.5 倍轰击巨幅击退并点燃整排尸群',
    damage: 17, interval: 38, mag: 6, reload: 60, speed: 11, range: 235, spread: 0.16, pellets: 7,
  },
  assault: {
    id: 'assault', name: '极地冰暴步枪', rarity: 'rare', icon: 'wp_assault', price: 195,
    trait: '深冻碎冰', desc: '极寒弹令敌军几近定身，命中已减速目标当场引爆碎冰飞溅',
    damage: 21, interval: 7, mag: 32, reload: 52, speed: 13.5, range: 345, spread: 0.015, slow: 115,
  },
  rifle: {
    id: 'rifle', name: '猩红磁轨激光', rarity: 'epic', icon: 'wp_rifle', price: 250,
    trait: '瞬发全穿', desc: '扣扳机瞬发全屏电磁激光，一穿到底且对重甲/首领额外 +35% 破甲伤',
    damage: 165, interval: 42, mag: 6, reload: 64, speed: 99, range: 520, spread: 0, pierce: true, hitscan: true,
  },
  tesla: {
    id: 'tesla', name: '特斯拉雷暴线圈', rarity: 'epic', icon: 'wp_tesla', price: 295,
    trait: '麻痹超载', desc: '跳跃 4~6 名敌军并短暂麻痹定身，命中燃烧或冰冻目标触发元素超载 +35%',
    damage: 56, interval: 21, mag: 16, reload: 56, speed: 14, range: 335, spread: 0, chain: 4,
  },
  rocket: {
    id: 'rocket', name: '焦土蜂巢火箭', rarity: 'legendary', icon: 'wp_rocket', price: 355,
    trait: '追踪火海', desc: '发射轻度自导高爆火箭，大范围轰炸并留下持续 3.5 秒的灼烧火海',
    damage: 185, interval: 48, mag: 4, reload: 68, speed: 8.8, range: 430, spread: 0, aoe: 86, homing: true,
  },
};
export const WEAPON_ORDER: WeaponId[] = ['pistol', 'revolver', 'smg', 'shotgun', 'assault', 'rifle', 'tesla', 'rocket'];
export const MAX_STAR = 5;
export const starMul = (star: number) => 1 + 0.22 * (star - 1);
export const magSize = (id: WeaponId, star: number) => Math.round(WEAPONS[id].mag * (star >= 3 ? 1.4 : 1));
export const extraBullets = (id: WeaponId, star: number) => {
  if (star < 5) return 0;
  const w = WEAPONS[id];
  if (w.pellets) return 2;
  if (w.burst) return 1;
  if (w.aoe) return 1;
  return 0;
};
export const STAR_PERKS: Record<number, string> = { 3: '弹匣 +40%', 5: '绝技觉醒升级' };
export const STAR_COST = [0, 75, 145, 235, 345]; // ★2..★5 费用
export function sustainedDps(w: WeaponDef, star = 1): number {
  const mag = magSize(w.id, star);
  const perPull = (w.pellets ?? w.burst ?? 1) + extraBullets(w.id, star);
  const aoeScale = w.aoe && star >= 5 ? 0.68 : 1;
  const effInterval = w.id === 'smg' ? 4.4 : w.interval;
  return (w.damage * starMul(star) * perPull * aoeScale * mag) / ((mag * effInterval + w.reload) / 60);
}

// ── 僵尸与 Boss（100% 统一哥特暗黑像素风，15 天压迫递进曲线）──
export type ZombieKind = 'roamer' | 'crawler' | 'sprinter' | 'bruiser' | 'ghoul' | 'boss_beast' | 'boss_demon';
export interface ZombieDef {
  kind: ZombieKind; name: string; sprites: string[]; baseHp: number; speed: number; damage: number; attackEvery: number;
  coins: number; meat: number; firstDay: number; fps: number; weight: number; scale: number;
  boss?: boolean; ranged?: boolean;
}
export const ZOMBIES: Record<ZombieKind, ZombieDef> = {
  roamer: {
    kind: 'roamer', name: zombieText('roamer')?.name ?? '游荡腐尸', sprites: ['z_swamp', 'z_clothed', 'z_skeleton'],
    baseHp: 62, speed: 0.96, damage: 10, attackEvery: 46, coins: 2, meat: 1, firstDay: 1, fps: 9, weight: 8, scale: 1.0,
  },
  crawler: {
    kind: 'crawler', name: '噬魂黑猫', sprites: ['z_gato'],
    baseHp: 52, speed: 1.56, damage: 9, attackEvery: 36, coins: 2, meat: 1, firstDay: 2, fps: 11, weight: 4, scale: 1.0,
  },
  sprinter: {
    kind: 'sprinter', name: '地狱猎犬', sprites: ['z_hound'],
    baseHp: 62, speed: 1.92, damage: 11, attackEvery: 30, coins: 3, meat: 1, firstDay: 3, fps: 13, weight: 4, scale: 1.05,
  },
  bruiser: {
    kind: 'bruiser', name: '焦骨巨尸', sprites: ['z_ghoul'],
    baseHp: 245, speed: 0.72, damage: 20, attackEvery: 52, coins: 5, meat: 1, firstDay: 4, fps: 9, weight: 3, scale: 1.15,
  },
  ghoul: {
    kind: 'ghoul', name: '提灯怨灵', sprites: ['z_wraith'],
    baseHp: 135, speed: 0.94, damage: 16, attackEvery: 68, coins: 5, meat: 1, firstDay: 6, fps: 9, weight: 3, scale: 1.05, ranged: true,
  },
  boss_beast: {
    kind: 'boss_beast', name: '地狱巨兽·暴君', sprites: ['boss_beast'],
    baseHp: 1200, speed: 0.50, damage: 28, attackEvery: 54, coins: 55, meat: 5, firstDay: 5, fps: 9, weight: 0, scale: 1.5, boss: true, ranged: true,
  },
  boss_demon: {
    kind: 'boss_demon', name: '深渊魔王·尸皇', sprites: ['boss_demon'],
    baseHp: 2500, speed: 0.45, damage: 36, attackEvery: 48, coins: 120, meat: 8, firstDay: 15, fps: 8, weight: 0, scale: 0.96, boss: true, ranged: true,
  },
};

export const zombieHp = (kind: ZombieKind, day: number) =>
  Math.floor((ZOMBIES[kind].baseHp + day * 10) * (1 + 0.19 * day + 0.014 * day * day));
export const dayZombieCount = (day: number) => Math.round(9 + day * 4.5 + (day >= 8 ? (day - 7) * 2 : 0));
export const bossForDay = (day: number): ZombieKind | null => (day === 15 ? 'boss_demon' : day === 5 || day === 10 ? 'boss_beast' : null);
export const newZombieOn = (day: number) => {
  const b = bossForDay(day);
  if (b) return ZOMBIES[b];
  return Object.values(ZOMBIES).find((z) => !z.boss && z.firstDay === day && day > 1);
};

// ── 炮塔体系（4 种塔：机枪 / 冰霜 / 电弧 / 重炮，全军工建设统一只消耗金币）──
export type TurretType = 'mg' | 'tesla' | 'frost' | 'cannon';
export interface TurretLevel { damage: number; cooldown: number; aoe?: number; chain?: number }
export interface TurretDef {
  type: TurretType; name: string; desc: string; icon: string; sprite: string;
  range: number; buildCoins: number; upgradeCoins: [number, number, number];
  levels: [TurretLevel, TurretLevel, TurretLevel];
}
export const TURRETS: Record<TurretType, TurretDef> = {
  mg: {
    type: 'mg', name: '机枪塔', desc: '速射单体，辅助压制前线', icon: 'ic_turret', sprite: 'turret',
    range: 295, buildCoins: 85, upgradeCoins: [0, 110, 200],
    levels: [{ damage: 8, cooldown: 24 }, { damage: 15, cooldown: 16 }, { damage: 26, cooldown: 10 }],
  },
  frost: {
    type: 'frost', name: '冰霜塔', desc: '冰弹范围减速 45%，克制快跑怪', icon: 'ic_turret_frost', sprite: 'turret_frost',
    range: 290, buildCoins: 110, upgradeCoins: [0, 130, 220],
    levels: [{ damage: 10, cooldown: 36, aoe: 56 }, { damage: 18, cooldown: 27, aoe: 68 }, { damage: 30, cooldown: 20, aoe: 82 }],
  },
  tesla: {
    type: 'tesla', name: '电弧塔', desc: '高压电弧连续跳跃 3~5 名敌人', icon: 'ic_turret_tesla', sprite: 'turret_tesla',
    range: 285, buildCoins: 150, upgradeCoins: [0, 165, 270],
    levels: [{ damage: 20, cooldown: 42, chain: 3 }, { damage: 34, cooldown: 30, chain: 4 }, { damage: 56, cooldown: 22, chain: 5 }],
  },
  cannon: {
    type: 'cannon', name: '重炮塔', desc: '榴弹爆炸轰击大群僵尸并击退', icon: 'ic_turret_cannon', sprite: 'turret_cannon',
    range: 335, buildCoins: 185, upgradeCoins: [0, 195, 310],
    levels: [{ damage: 42, cooldown: 64, aoe: 72 }, { damage: 76, cooldown: 48, aoe: 90 }, { damage: 128, cooldown: 34, aoe: 112 }],
  },
};
export const TURRET = TURRETS.mg;

// ── 路障与堡垒房子升级（Lv1..3：站在屋子/屋顶直接大幅增强火力与掩体减伤）──
export const MAX_WALL_LEVEL = 3;
export const WALL_LEVELS = [
  { level: 1, name: '铁丝木障', maxHp: 280, coins: 0, reflect: 0 },
  { level: 2, name: '石砌壁垒', maxHp: 500, coins: 135, reflect: 4 },
  { level: 3, name: '高压电网墙', maxHp: 800, coins: 270, reflect: 10 },
];

export const MAX_FORT_LEVEL = 3;
export const FORT_LEVELS = [
  { level: 1, name: '木石酒馆', maxHp: 170, coins: 0, desc: '屋顶+20%伤·+20%程·换弹+25%·掩体-35%火球伤' },
  { level: 2, name: '石堡要塞', maxHp: 300, coins: 175, desc: '屋顶+28%伤·掩体-45% · 守卫火炮自动开火 · 大屋300血' },
  { level: 3, name: '哥特铁堡', maxHp: 480, coins: 340, desc: '屋顶+36%伤·掩体-55% · 双联火炮 · 屋顶慢回血+夜修墙' },
];

// ── 消耗品 & 商店售价 ──
export const WALL_REPAIR_COST = 16;
export const FORT_REPAIR_COST = 22;
export const SHOP_GRENADE_COST = 35;
export const SHOP_ARMOR_COST = 40;
export const SHOP_MEDKIT_COST = 30;
export const SHOP_REROLL_COST = 15;
export const MAX_GRENADES = 5;

// ── 深夜小食堂：6 道递进菜单（兼作堂食招牌菜 & 明日战前私房特餐）──
export type MealId = 'spicy_skewer' | 'hearty_stew' | 'iron_steak' | 'mixed_grill' | 'elite_hotpot' | 'apocalypse_feast';
export interface MealDef {
  id: MealId; name: string; icon: string; desc: string;
  unlockDay: number; meatCost: number; basePay: number; tags: string[];
  dmgMul: number; armor: number; haste: number; heal: number;
}
export const MEALS: Record<MealId, MealDef> = {
  spicy_skewer:     { id: 'spicy_skewer',     name: '炭烤香辣肉串', icon: 'ic_dish_skewer', desc: '明日所有武器伤害 +22%',                   unlockDay: 1, meatCost: 1, basePay: 18, tags: ['辣', '家常'],                 dmgMul: 0.22, armor: 0,  haste: 0,    heal: 0 },
  hearty_stew:      { id: 'hearty_stew',      name: '末世暖胃肉汤', icon: 'ic_dish_stew',   desc: '立即回 35 血 + 明日开局 +35 护甲',          unlockDay: 2, meatCost: 2, basePay: 28, tags: ['鲜嫩', '饱腹'],               dmgMul: 0,    armor: 35, haste: 0,    heal: 35 },
  iron_steak:       { id: 'iron_steak',       name: '铁板滋滋厚排', icon: 'ic_dish_steak',  desc: '明日攻速 +20% 且伤害 +12%',                unlockDay: 3, meatCost: 2, basePay: 35, tags: ['高蛋白', '烟熏'],             dmgMul: 0.12, armor: 15, haste: 0.2,  heal: 0 },
  mixed_grill:      { id: 'mixed_grill',      name: '碳火三拼盛宴', icon: 'ic_dish_grill',  desc: '回 15 血 · 明日伤害 +28% 且攻速 +15%',     unlockDay: 4, meatCost: 3, basePay: 46, tags: ['辣', '重口', '高蛋白'],       dmgMul: 0.28, armor: 15, haste: 0.15, heal: 15 },
  elite_hotpot:     { id: 'elite_hotpot',     name: '地狱异变火锅', icon: 'ic_dish_hotpot', desc: '回 20 血 · 明日伤害 +36% 且护甲 +25',      unlockDay: 5, meatCost: 4, basePay: 60, tags: ['辣', '异变'],                 dmgMul: 0.36, armor: 25, haste: 0.1,  heal: 20 },
  apocalypse_feast: { id: 'apocalypse_feast', name: '终章末日大餐', icon: 'ic_dish_feast',  desc: '回 45 血 · 伤害 +42% · 攻速 +25% · 护甲 +45', unlockDay: 7, meatCost: 5, basePay: 78, tags: ['鲜嫩', '烟熏', '饱腹', '异变'], dmgMul: 0.42, armor: 45, haste: 0.25, heal: 45 },
};
export const MEAL_ORDER: MealId[] = ['spicy_skewer', 'hearty_stew', 'iron_steak', 'mixed_grill', 'elite_hotpot', 'apocalypse_feast'];
export const unlockedMeals = (day: number): MealDef[] => MEAL_ORDER.map((id) => MEALS[id]).filter((m) => m.unlockDay <= day);
export const MEAT_SELL_PRICE = 8; // 每块鲜肉现炒出锅可得 8 金币

export interface DinerGuestDef {
  id: string; name: string; role: string; sprite: string; fps: number;
  dish: MealId; dishName: string; meatCost: number; basePay: number;
  orderQuote: string; thanksQuote: string;
}
export const DINER_GUESTS: DinerGuestDef[] = [
  {
    id: 'agou', name: '阿狗', role: '拾荒新丁', sprite: 'npc_hat', fps: 6,
    dish: 'spicy_skewer', dishName: '炭烤香辣肉串', meatCost: 1, basePay: 22,
    orderQuote: '老板，刚从废墟摸回来，来串冒油的辣肉串暖暖身子！',
    thanksQuote: '嘶哈——焦香麻辣，明天守城我帮你多盯紧东墙！',
  },
  {
    id: 'qijie', name: '七姐', role: '夜巡猎手', sprite: 'npc_woman', fps: 7,
    dish: 'hearty_stew', dishName: '末世暖胃肉汤', meatCost: 2, basePay: 34,
    orderQuote: '夜风太冷了，给我盛碗滚烫的肉汤，撒点黑胡椒。',
    thanksQuote: '这口热汤下肚，浑身的寒气都散了，多谢掌柜！',
  },
  {
    id: 'laobao', name: '老包', role: '防线夜巡者', sprite: 'npc_bearded', fps: 6,
    dish: 'iron_steak', dishName: '铁板滋滋厚排', meatCost: 2, basePay: 42,
    orderQuote: '连着值完夜班快扛不住了，切块最厚的铁板肉排！',
    thanksQuote: '够劲！满口肉汁，待会儿我顺手给你把屋顶支架紧一紧！',
  },
  {
    id: 'niqiu', name: '泥鳅', role: '黑市游商', sprite: 'npc_oldman', fps: 7,
    dish: 'spicy_skewer', dishName: '炭烤香辣肉串', meatCost: 1, basePay: 24,
    orderQuote: '掌柜的，把你压箱底的招牌烤肉端上来，赏金少不了你的！',
    thanksQuote: '绝了！全暮色镇就数你这小酒馆最有人情味，赏金拿好！',
  },
];

// ── 天赋 ──
export type PerkId =
  | 'pierce' | 'ricochet' | 'overkill' | 'lifesteal' | 'incendiary' | 'overclock'
  | 'frostbite' | 'chainkill' | 'vanguard' | 'bloodfrenzy' | 'glasscannon' | 'secondwind'
  | 'rooftop' | 'shrapnel' | 'fortify' | 'shock';

export interface PerkDef { id: PerkId; name: string; desc: string; icon: string; rarity: Rarity }
const extraPerks: Record<string, { name: string; desc: string; rarity: Rarity }> = {
  rooftop:  { name: '居高临下', desc: '站在房顶时伤害再 +20%，射程 +15%', rarity: 'rare' },
  shrapnel: { name: '高爆破片', desc: '手雷与爆炸伤害 +32%，爆炸半径放大', rarity: 'rare' },
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
export const RARITY_WEIGHT: Record<Rarity, number> = { common: 10, rare: 6, epic: 3, legendary: 1 };

// ── 职业（3 大职业全部可用！主厨随小厨房一起开放）──
export type ClassId = 'gunner' | 'engineer' | 'chef';
export interface ClassDef {
  id: ClassId; name: string; role: string; icon: string; passive: string; skill: string; skillDesc: string;
  dur: number; cd: number; comingSoon?: string;
}
export const CLASSES: Record<ClassId, ClassDef> = {
  gunner:   { id: 'gunner', name: '枪手', role: '主角输出', icon: 'wp_rifle', passive: '暴击率 +15%', skill: '鹰眼', skillDesc: '5 秒全穿透 + 必暴', dur: 300, cd: 1080 },
  engineer: { id: 'engineer', name: '工程师', role: '塔防建设', icon: 'ic_turret', passive: '建塔/升塔 -25% 金币，塔伤害 +20%', skill: '过载', skillDesc: '所有炮塔 6 秒攻速 ×2', dur: 360, cd: 1080 },
  chef:     { id: 'chef', name: '主厨', role: '厨房经营', icon: 'ic_chef', passive: '僵尸多掉肉，卖菜/现炒 +35% 金币，特餐效果 +50%', skill: '战地大餐', skillDesc: '回 40% 血 + 8 秒攻速 ×1.4', dur: 480, cd: 1080 },
};
export const CRIT_CHANCE = 0.15;
export const CRIT_MUL = 2;

export const LAST_DAY = 15;
export const DAY_HEAL = 0.3;

// ── 局外成长（更快解锁各把特色神兵，前期就能爽到不同机制）──
export type Unlock = { stars: number; kind: 'weapon'; id: WeaponId } | { stars: number; kind: 'class'; id: ClassId };
export const UNLOCKS: Unlock[] = [
  { stars: 0, kind: 'weapon', id: 'revolver' },
  { stars: 0, kind: 'weapon', id: 'smg' },
  { stars: 0, kind: 'class', id: 'gunner' },
  { stars: 2, kind: 'class', id: 'engineer' },
  { stars: 2, kind: 'weapon', id: 'shotgun' },
  { stars: 4, kind: 'class', id: 'chef' },
  { stars: 4, kind: 'weapon', id: 'assault' },
  { stars: 6, kind: 'weapon', id: 'rifle' },
  { stars: 8, kind: 'weapon', id: 'tesla' },
  { stars: 10, kind: 'weapon', id: 'rocket' },
];
export const unlockedWeapons = (stars: number) => UNLOCKS.flatMap((u) => (u.kind === 'weapon' && stars >= u.stars ? [u.id] : []));
export const unlockedClasses = (stars: number) => UNLOCKS.flatMap((u) => (u.kind === 'class' && stars >= u.stars ? [u.id] : []));
export const classUnlockStars = (id: ClassId) => UNLOCKS.find((u) => u.kind === 'class' && u.id === id)?.stars;
export const nextUnlock = (stars: number) => UNLOCKS.find((u) => stars < u.stars);
export const unlockName = (u: Unlock) => (u.kind === 'weapon' ? WEAPONS[u.id].name : `职业「${CLASSES[u.id].name}」`);
