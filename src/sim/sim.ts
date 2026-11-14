// 规则层：纯计算，不碰浏览器。固定每秒 60 步；随机数带种子；同样的种子和输入一定得到同样的结果。
import {
  CLASSES, CRIT_CHANCE, CRIT_MUL, DAY_HEAL, FORT_LEVELS, FORT_REPAIR_COST, LAST_DAY, MAX_FORT_LEVEL, MAX_GRENADES, MAX_STAR, MAX_WALL_LEVEL,
  MEALS, MEAT_SELL_PRICE, PERKS, RARITY_WEIGHT, SHOP_ARMOR_COST, SHOP_GRENADE_COST, SHOP_MEDKIT_COST, SHOP_REROLL_COST, STAR_COST, TURRETS,
  WALL_LEVELS, WALL_REPAIR_COST, WEAPONS, ZOMBIES, bossForDay, dayZombieCount, extraBullets, magSize, starMul, unlockedMeals, zombieHp,
  type ClassId, type MealId, type PerkId, type TurretType, type WeaponId, type ZombieKind,
} from '../content/data';
import {
  COMPANION_JOIN_STORIES, DAILY_TRENDS, DINER_REVIEW_POOL, QUALITY_META, VIP_CUSTOMERS, VIP_TIERS, getFansRank, getRepTier,
  type AllyId, type DishQuality, type VipDef,
} from '../content/story';
import {
  DINER_SEAT_X, DOOR_X, GROUND_Y, HOME_X, HOUSE_WALL_X, IN_MAX_X, IN_MIN_X, IN_STATIONS, LADDER_X, PLAYER_MAX_X, PLAYER_MIN_X,
  PORCH_MAX_X, PORCH_MIN_X, PORCH_Y, ROOF_MAX_X, ROOF_MIN_X, ROOF_Y, SPAWN_X,
  TURRET_SLOTS, WALL_X, type Bullet, type Command, type DinerGuest, type GameEvent, type Input, type RunState, type StationId, type Zombie,
} from './types';

export const MAX_CARRY = 3;
export const GRENADE_G = 0.26;
const GRAVITY = 0.32;
const JUMP_V = -6.5;
const MOVE_SPEED = 2.2;
const DODGE_TICKS = 14;
const DODGE_SPEED = 4.4;
const DODGE_CD = 60;
const ZOMBIE_REACH = 18;
export const BODY_Y = GROUND_Y - 22; // 僵尸身体中心的高度
export const MUZZLE_Y = GROUND_Y - 31;
export const FORT_GUN_X = 166;
export const FORT_GUN_Y = GROUND_Y + ROOF_Y - 18;

function rand(run: RunState): number { // mulberry32
  let t = (run.rng += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** 炮塔槽位的世界坐标 (x, 底座地面 Y, 炮口开火 Y) */
export function turretWorldPos(slot: number) {
  const s = TURRET_SLOTS[slot] ?? TURRET_SLOTS[0];
  const baseY = GROUND_Y + s.y;
  return { x: s.x, baseY, muzzleY: baseY - 18, roof: s.roof, name: s.name };
}

const has = (run: RunState, id: PerkId) => run.perks.includes(id);
export const hasAlly = (run: RunState, id: AllyId) => run.story.allies.includes(id);
export const curWeapon = (run: RunState) => run.player.weapons[run.player.cur];
const skillActive = (run: RunState, cls: ClassId) => run.cls === cls && run.skill.t > 0;
export const isOnRoof = (run: RunState) => !run.inside && run.player.y <= ROOF_Y + 2 && run.player.x >= ROOF_MIN_X && run.player.x <= ROOF_MAX_X;
export const isOnPorch = (run: RunState) => !run.inside && Math.abs(run.player.y - PORCH_Y) <= 2 && run.player.x >= PORCH_MIN_X && run.player.x <= PORCH_MAX_X;

export interface HouseBuff {
  zone: 'roof' | 'porch' | 'ground';
  name: string;
  dmgMul: number;
  rangeBonus: number;
  critBonus: number;
  reloadHaste: number;
  rangedCover: number;
  meleeImmune: boolean;
}

/** 房屋/屋顶高地防守增益：站上酒馆门廊或二楼屋顶可获得显著火力、暴击、射程、换弹与矮墙掩体减伤。 */
export function houseBuff(run: RunState): HouseBuff {
  const flv = Math.max(1, run.fort.level);
  if (isOnRoof(run)) {
    const dmgMul = flv >= 3 ? 1.36 : flv === 2 ? 1.28 : 1.20;
    const rangeBonus = flv >= 3 ? 0.35 : flv === 2 ? 0.25 : 0.20;
    const critBonus = flv >= 3 ? 0.18 : flv === 2 ? 0.14 : 0.10;
    const reloadHaste = flv >= 3 ? 0.40 : flv === 2 ? 0.32 : 0.25;
    const rangedCover = flv >= 3 ? 0.55 : flv === 2 ? 0.45 : 0.35;
    const name = flv >= 3 ? '铁堡屋顶' : flv === 2 ? '石堡屋顶' : '酒馆屋顶';
    return { zone: 'roof', name, dmgMul, rangeBonus, critBonus, reloadHaste, rangedCover, meleeImmune: true };
  }
  if (isOnPorch(run)) {
    return { zone: 'porch', name: '门廊木台', dmgMul: 1.12, rangeBonus: 0.10, critBonus: 0.05, reloadHaste: 0.12, rangedCover: 0.20, meleeImmune: true };
  }
  return { zone: 'ground', name: '前院平地', dmgMul: 1.0, rangeBonus: 0, critBonus: 0, reloadHaste: 0, rangedCover: 0, meleeImmune: false };
}

export const turretBuildCost = (kind: TurretType, cls: ClassId, hasQiang = false) =>
  Math.ceil(TURRETS[kind].buildCoins * (cls === 'engineer' ? 0.75 : 1) * (hasQiang ? 0.9 : 1));
export const turretUpgradeCost = (kind: TurretType, level: number, cls: ClassId, hasQiang = false) =>
  Math.ceil((TURRETS[kind].upgradeCoins[level] ?? 0) * (cls === 'engineer' ? 0.75 : 1) * (hasQiang ? 0.9 : 1));
export const turretRefundCoins = (kind: TurretType, level: number, cls: ClassId, hasQiang = false) => {
  let spent = turretBuildCost(kind, cls, hasQiang);
  for (let l = 1; l < level; l++) spent += turretUpgradeCost(kind, l, cls, hasQiang);
  return Math.max(20, Math.floor(spent * 0.5));
};
export const meatPrice = (cls: ClassId) => Math.round(MEAT_SELL_PRICE * (cls === 'chef' ? 1.35 : 1));
export const weaponDamage = (id: WeaponId, star: number) => WEAPONS[id].damage * starMul(star);

/** 主角射程（在门廊/屋顶享受高低差加成，居高临下天赋额外叠加） */
export function effectiveRange(run: RunState, id: WeaponId = curWeapon(run).id): number {
  const hb = houseBuff(run);
  const perkBonus = isOnRoof(run) && has(run, 'rooftop') ? 0.15 : 0;
  return Math.round(WEAPONS[id].range * (1 + hb.rangeBonus + perkBonus));
}

/** 伤害倍率：特餐 × 屋顶/门廊高地 × 战友 × 天赋。 */
export function damageMul(run: RunState): number {
  const p = run.player;
  const hb = houseBuff(run);
  let m = (1 + run.buff.dmgMul) * hb.dmgMul;
  if (hasAlly(run, 'zhang')) m *= 1.1;
  if (isOnRoof(run) && has(run, 'rooftop')) m *= 1.2;
  if (has(run, 'glasscannon')) m *= 1.65;
  if (has(run, 'bloodfrenzy')) m *= 1 + (1 - p.hp / p.maxHp) * 0.55;
  if (has(run, 'chainkill')) m *= 1 + Math.min(0.42, run.chain.n * 0.07);
  if (has(run, 'vanguard') && run.vanguardT > 0) m *= 1.35;
  return m;
}

/** 换弹与攻速倍率（1.0 为基础，站在屋顶换弹明显更快） */
const playerHaste = (run: RunState) => 1 + run.buff.haste + (skillActive(run, 'chef') ? 0.4 : 0) + (isOnRoof(run) ? 0.08 : 0);
const reloadHaste = (run: RunState) => 1 + run.buff.haste + houseBuff(run).reloadHaste;

/** 清场条件：这一天的僵尸都出完了，而且都死了 */
export const dayRemaining = (run: RunState) => run.spawn.left + run.zombies.length;

/** 室内靠近的交互点 */
export function nearbyStation(run: RunState): StationId | null {
  if (!run.inside) return null;
  let best: StationId | null = null, bd = 54;
  for (const [k, sx] of Object.entries(IN_STATIONS) as [StationId, number][]) {
    const d = Math.abs(run.player.x - sx);
    if (d <= bd) { bd = d; best = k; }
  }
  return best;
}

/** 室外靠近的交互点（房门 / 门廊阶梯） */
export function nearbyExterior(run: RunState): 'door' | 'ladder' | null {
  if (run.inside) return null;
  const p = run.player;
  if (Math.abs(p.x - DOOR_X) <= 32 && p.y > -24) return 'door';
  if (Math.abs(p.x - LADDER_X) <= 36) return 'ladder';
  return null;
}

function rollShopOffers(run: RunState) {
  const all = Array.from(new Set<WeaponId>(['revolver', 'smg', ...run.pool, 'pistol']));
  const unowned = all.filter((id) => !run.player.weapons.some((w) => w.id === id));
  const picks: WeaponId[] = [];
  const source = [...unowned];
  while (picks.length < 3 && source.length > 0) {
    const idx = Math.floor(rand(run) * source.length);
    picks.push(source.splice(idx, 1)[0]);
  }
  const rest = all.filter((id) => !picks.includes(id));
  while (picks.length < 3 && rest.length > 0) {
    const idx = Math.floor(rand(run) * rest.length);
    picks.push(rest.splice(idx, 1)[0]);
  }
  run.shop = picks;
}

function rollDailyTrend(run: RunState) {
  const availableMeals = unlockedMeals(Math.max(1, run.day));
  const allTags = new Set(availableMeals.flatMap((m) => m.tags));
  const pool = DAILY_TRENDS.filter((t) => t.unlockDay <= Math.max(1, run.day) && allTags.has(t.tag) && t.id !== run.diner.trendId);
  const src = pool.length ? pool : DAILY_TRENDS.filter((t) => t.unlockDay <= 1);
  const picked = src[Math.floor(rand(run) * src.length)] ?? DAILY_TRENDS[0];
  run.diner.trendId = picked.id;
  run.diner.trendTag = picked.tag;
  run.diner.trendTitle = picked.title;
}

const VIP_ORDER_LINES: Record<string, string> = {
  agou: '老板，求给我留一口热乎肉串就行，我扫地洗碗都行！',
  laobao: '连守七十二小时防线了，来份最够劲的热菜提提神！',
  qijie: '刚拧完一天螺栓，上最扎实管饱的菜，少敷衍我！',
  niqiu: '掌柜的，把招牌菜端上来，好吃明天再给你带稀罕门路！',
  gaolaotou: '确定没藏窃听机关吧？给我盛份热腾腾又干净的菜！',
  guying: '高热量。五分钟内上菜。不废话。',
  huanyin: '短波频道正播着哩——上你们暮色酒馆最拿手的招牌硬菜！',
  tongshu: '发条铁胃涩滞，需要滚烫油脂与烈性热肉润滑机件。',
  dashan: '大山……大山饿了，想吃热乎乎的大块肉肉……',
  baishi: '妙极了！请务必上一份辛烈浓菜，助我印证今夜秘药方！',
  jinlaoban: '净水生意刚谈完，端上你们酒馆最拿手的菜色试试成色。',
  wumingke: '风沙太大……在角落安静吃一碗热汤便走。',
  yanlao: '百年前这里曾是老城区最好的大酒店……能请我尝一口战前风味吗？',
  kuangya: '哈哈哈！闻到香味了！拿最扎实的硬菜上来！',
  guancezhe: '十五夜星象正往酒馆汇聚——莫掌柜，来道招牌让我尝尝今夜火候。',
};

function pickGuestMeal(run: RunState, vip: VipDef, forceTrend: boolean): MealId {
  const list = unlockedMeals(Math.max(1, run.day));
  if (forceTrend) {
    const tHit = list.find((m) => m.tags.includes(run.diner.trendTag));
    if (tHit) return tHit.id;
  }
  const prefMap: Record<string, MealId[]> = {
    cheap: ['spicy_skewer'],
    stimulating: ['spicy_skewer', 'mixed_grill', 'elite_hotpot'],
    mechanical: ['iron_steak', 'mixed_grill'],
    tactical: ['iron_steak', 'apocalypse_feast'],
    dark: ['elite_hotpot', 'apocalypse_feast'],
    mutant: ['elite_hotpot', 'apocalypse_feast'],
    soup: ['hearty_stew'],
    french: ['apocalypse_feast', 'hearty_stew'],
    premium: ['apocalypse_feast', 'iron_steak'],
  };
  const prefs = prefMap[vip.preferredDishPref] ?? [];
  const prefHit = prefs.find((id) => list.some((m) => m.id === id));
  if (prefHit && rand(run) < 0.72) return prefHit;
  return list[Math.floor(rand(run) * list.length)].id;
}

function rollDinerGuests(run: RunState) {
  const unlocked = VIP_CUSTOMERS.filter((v) => v.unlockFans <= run.diner.fans);
  const chosen: VipDef[] = [];
  const usedIds = new Set<string>();

  const unmet = unlocked.filter((v) => !run.diner.metVips.includes(v.id));
  for (const v of unmet) {
    if (chosen.length >= 2) break;
    chosen.push(v);
    usedIds.add(v.id);
  }
  while (chosen.length < 3) {
    const pool = unlocked.filter((v) => !usedIds.has(v.id));
    const src = pool.length > 0 ? pool : VIP_CUSTOMERS.filter((v) => !usedIds.has(v.id));
    if (src.length === 0) break;
    let roll = rand(run) * src.reduce((s, v) => s + v.weight, 0);
    let pick = src[0];
    for (const v of src) {
      roll -= v.weight;
      if (roll < 0) { pick = v; break; }
    }
    chosen.push(pick);
    usedIds.add(pick.id);
  }

  const repTier = getRepTier(run.diner.rep);
  const chefMul = run.cls === 'chef' ? 1.35 : 1;
  const guests: DinerGuest[] = chosen.map((vip, idx) => {
    const dishId = pickGuestMeal(run, vip, idx === 0);
    const meal = MEALS[dishId];
    const trendMatch = meal.tags.includes(run.diner.trendTag);
    const shortName = vip.name.includes('·') ? vip.name.split('·').pop()! : vip.name;
    const pay = Math.round((meal.basePay * 0.8 + run.day * 1.1) * chefMul * (0.8 + vip.tipBonus * 0.22) * (1 + repTier.bonusMul) * (trendMatch ? 1.35 : 1));
    return {
      id: `${vip.id}_${run.day}_${idx}`,
      vipId: vip.id,
      tier: vip.tier,
      name: shortName,
      role: vip.name.includes('·') ? vip.name.split('·')[0] : VIP_TIERS[vip.tier].name,
      sprite: vip.sprite,
      x: DINER_SEAT_X[idx] ?? 300,
      dish: dishId,
      dishName: meal.name,
      meatCost: meal.meatCost,
      pay,
      trendMatch,
      orderQuote: VIP_ORDER_LINES[vip.id] ?? vip.bg,
      thanksQuote: vip.reactions.good,
      served: false,
    };
  });
  run.guests = guests;
}

/** 开一局。pool 是这一局能掉落/进货的武器（局外解锁的那些）。 */
export function newRun(seed = 1, pool: WeaponId[] = ['revolver', 'smg'], cls: ClassId = 'gunner'): RunState {
  const turrets = TURRET_SLOTS.map((_, idx) => (idx === 1 ? { type: 'mg' as const, level: 1, cd: 0, aim: 0 } : { type: null, level: 0, cd: 0, aim: 0 }));
  const run: RunState = {
    seed, rng: seed >>> 0, tick: 0, nextId: 1, day: 0, phase: 'camp', phaseT: 0,
    inside: false, autoFire: false,
    player: {
      x: 194, y: ROOF_Y, vx: 0, vy: 0, facing: 1, hp: 100, maxHp: 100, armor: 0, maxArmor: 80, hurtT: 0, healCarry: 0,
      dodgeT: 0, dodgeCd: 0, dodgeDir: 1, fireCd: 0, reloadT: 0, shootT: 0,
      burstLeft: 0, burstCd: 0, smgHeat: 0, smgShots: 0, grenades: 2,
      weapons: [{ id: 'pistol', star: 1, ammo: WEAPONS.pistol.mag }], cur: 0,
    },
    zombies: [], bullets: [], fires: [], grenades: [], enemyProjs: [], crates: [], turrets,
    wall: { level: 1, hp: WALL_LEVELS[0].maxHp, maxHp: WALL_LEVELS[0].maxHp },
    home: { hp: FORT_LEVELS[0].maxHp, maxHp: FORT_LEVELS[0].maxHp },
    fort: { level: 1, cd: 0, aim: 0 },
    spawn: { left: 0, timer: 0, total: 0, killed: 0, crateAt: 0, bossKind: null, bossSpawned: false },
    coins: 0, meat: 0, kills: 0,
    meal: null, mealQuality: 'good', guests: [],
    diner: { rep: 0, fans: 0, trendId: DAILY_TRENDS[0].id, trendTag: DAILY_TRENDS[0].tag, trendTitle: DAILY_TRENDS[0].title, servedTotal: 0, metVips: [], reviews: [] },
    story: { allies: [], seenEvents: [] },
    buff: { dmgMul: 0, haste: 0 }, shop: [],
    perks: [], perkChoices: [], targetId: null, priorityId: null,
    pool: [...pool], chain: { n: 0, t: 0 }, vanguardT: 0, cls, skill: { t: 0, cd: 0 },
  };
  rollShopOffers(run);
  startDay(run, []);
  return run;
}

function startDay(run: RunState, ev: GameEvent[]) {
  run.day++;
  run.phase = 'fight'; run.phaseT = 0; run.inside = false;
  run.player.x = 194; run.player.y = ROOF_Y; run.player.vy = 0; run.player.facing = 1;
  run.player.burstLeft = 0; run.player.burstCd = 0; run.player.smgHeat = 0;
  const total = dayZombieCount(run.day);
  const crateAt = run.day === 1 || rand(run) < 0.45 ? Math.floor(total / 2) : -1;
  const bossKind = bossForDay(run.day);
  run.spawn = { left: total, timer: 54, total, killed: 0, crateAt, bossKind, bossSpawned: false };
  run.bullets = []; run.fires = []; run.grenades = []; run.enemyProjs = [];
  run.chain = { n: 0, t: 0 }; run.vanguardT = 0; run.skill = { t: 0, cd: 0 };
  rollDailyTrend(run);

  const mealBoost = (run.cls === 'chef' ? 1.5 : 1) * QUALITY_META[run.mealQuality ?? 'good'].buffMul;
  if (run.meal) {
    const m = MEALS[run.meal];
    run.buff = { dmgMul: m.dmgMul * mealBoost, haste: m.haste * mealBoost };
    run.player.armor = Math.min(run.player.maxArmor, run.player.armor + Math.round(m.armor * mealBoost));
    run.meal = null;
    run.mealQuality = 'good';
  } else {
    run.buff = { dmgMul: 0, haste: 0 };
  }
  if (has(run, 'secondwind')) run.player.hp = Math.min(run.player.maxHp, run.player.hp + run.player.maxHp * 0.25);
  if (has(run, 'fortify')) run.player.armor = Math.min(run.player.maxArmor, run.player.armor + 25);
  if (run.fort.level >= 3) run.wall.hp = Math.min(run.wall.maxHp, run.wall.hp + Math.round(run.wall.maxHp * 0.3));
  ev.push({ t: 'dayStart', day: run.day });
}

function spawnZombie(run: RunState, forcedKind?: ZombieKind) {
  let kind: ZombieKind;
  if (forcedKind) {
    kind = forcedKind;
  } else {
    const kinds = (Object.keys(ZOMBIES) as ZombieKind[]).filter((k) => !ZOMBIES[k].boss && ZOMBIES[k].firstDay <= run.day);
    let roll = rand(run) * kinds.reduce((sum, k) => sum + ZOMBIES[k].weight, 0);
    kind = kinds[0];
    for (const k of kinds) { roll -= ZOMBIES[k].weight; if (roll < 0) { kind = k; break; } }
  }
  const hp = zombieHp(kind, run.day);
  const index = run.spawn.total - run.spawn.left;
  run.zombies.push({
    id: run.nextId++, kind, x: SPAWN_X + rand(run) * 44, hp, maxHp: hp,
    atkCd: 12, kb: 0, burnT: 0, slowT: 0, stunT: 0, freezeT: 0, carriesCrate: !forcedKind && index === run.spawn.crateAt,
  });
}

/** 自动锁定：优先打玩家点击指定的目标，否则选射程内最近的僵尸。 */
function pickTarget(run: RunState): Zombie | null {
  const p = run.player, range = effectiveRange(run);
  if (run.priorityId !== null) {
    const pri = run.zombies.find((z) => z.id === run.priorityId);
    if (pri && pri.hp > 0 && Math.abs(pri.x - p.x) <= range * 1.12) return pri;
    if (!pri || pri.hp <= 0) run.priorityId = null;
  }
  const cur = run.zombies.find((z) => z.id === run.targetId);
  if (cur && cur.hp > 0 && Math.abs(cur.x - p.x) <= range * 1.08) return cur;
  let best: Zombie | null = null, bd = range;
  for (const z of run.zombies) {
    const d = Math.abs(z.x - p.x);
    if (d <= bd) { bd = d; best = z; }
  }
  return best;
}

function applyPlayerDamage(run: RunState, rawDmg: number, ev: GameEvent[], fromRanged = false) {
  const p = run.player;
  if (p.dodgeT > 0 || p.hurtT > 0) return;
  const coverFrac = fromRanged ? houseBuff(run).rangedCover : 0;
  const covered = Math.floor(rawDmg * coverFrac);
  const finalDmg = Math.max(1, rawDmg - covered);
  const blocked = Math.min(p.armor, finalDmg);
  p.armor -= blocked;
  const hpDmg = finalDmg - blocked;
  p.hp -= hpDmg;
  p.hurtT = 30;
  ev.push({ t: 'hurt', dmg: finalDmg, blocked, cover: covered > 0 ? covered : undefined });
}

function damageZombie(
  run: RunState,
  z: Zombie,
  dmg: number,
  ev: GameEvent[],
  opts: {
    byPlayer: boolean; burn?: boolean; kb?: number; crit?: boolean; slow?: number;
    freeze?: number; stun?: number; overload?: boolean; weaponId?: WeaponId; dir?: 1 | -1; heavy?: boolean;
  },
) {
  if (z.hp <= 0) return;
  const before = z.hp;
  z.hp -= dmg;
  const bossScale = ZOMBIES[z.kind].boss ? 0.25 : 1;
  if (opts.kb) z.kb = Math.max(z.kb, opts.kb * bossScale);
  if (opts.slow) z.slowT = Math.max(z.slowT, opts.slow);
  if (opts.freeze) z.freezeT = Math.max(z.freezeT, Math.round(opts.freeze * (ZOMBIES[z.kind].boss ? 0.4 : 1)));
  if (opts.stun) z.stunT = Math.max(z.stunT, Math.round(opts.stun * (ZOMBIES[z.kind].boss ? 0.35 : 1)));
  const dir: 1 | -1 = opts.dir ?? (z.x >= run.player.x ? 1 : -1);
  const heavy = opts.heavy || (opts.kb ?? 0) >= 2.5 || opts.weaponId === 'revolver' || opts.weaponId === 'shotgun' || opts.weaponId === 'rifle' || opts.weaponId === 'rocket';
  ev.push({
    t: 'hit', id: z.id, x: z.x, y: BODY_Y, dmg: Math.round(dmg),
    burn: opts.burn, crit: opts.crit, slow: !!opts.slow, freeze: !!opts.freeze, stun: !!opts.stun, overload: opts.overload,
    dir, weapon: opts.weaponId, heavy,
  });

  if (opts.byPlayer && has(run, 'lifesteal')) {
    const p = run.player;
    p.healCarry += Math.min(dmg, before) * 0.08;
    const whole = Math.floor(p.healCarry);
    if (whole > 0) { p.hp = Math.min(p.maxHp, p.hp + whole); p.healCarry -= whole; }
  }
  if (z.hp > 0) return;

  // 猎手双发手枪特色：击杀立即回膛 2 发子弹
  if (opts.byPlayer && opts.weaponId === 'pistol') {
    const pw = run.player.weapons.find((w) => w.id === 'pistol');
    if (pw) pw.ammo = Math.min(magSize('pistol', pw.star), pw.ammo + 2);
  }

  const def = ZOMBIES[z.kind];
  run.coins += def.coins; run.kills++; run.spawn.killed++;
  const chef = run.cls === 'chef';
  const meatDrop = def.meat > 1 ? def.meat + (chef ? 1 : 0) : (rand(run) < (chef ? 0.56 : 0.38) ? 1 : 0);
  run.meat += meatDrop;

  if (has(run, 'chainkill')) run.chain = { n: Math.min(8, run.chain.n + 1), t: 180 };
  ev.push({ t: 'kill', id: z.id, x: z.x, kind: z.kind, coins: def.coins, meat: meatDrop, dir, crit: opts.crit, boss: def.boss });
  if (def.boss) {
    ev.push({ t: 'bossDead', kind: z.kind, bossIdx: run.day <= 5 ? 0 : run.day <= 10 ? 1 : 2 });
  }

  if (z.carriesCrate) {
    const pool: WeaponId[] = ['pistol', ...run.pool];
    const unowned = pool.filter((id) => !run.player.weapons.some((w) => w.id === id));
    const weapon = unowned.length && (run.day === 1 || rand(run) < 0.45)
      ? unowned[Math.floor(rand(run) * unowned.length)]
      : pool[Math.floor(rand(run) * pool.length)];
    run.crates.push({ id: run.nextId++, x: Math.min(Math.max(z.x, HOME_X + 20), PLAYER_MAX_X - 20), weapon });
  }
  if (opts.byPlayer && has(run, 'overkill') && z.hp < 0) {
    const boom = -z.hp * 1.15, r = 42 * (has(run, 'shrapnel') ? 1.28 : 1);
    ev.push({ t: 'boom', x: z.x, y: BODY_Y, r });
    for (const o of run.zombies) if (o !== z && o.hp > 0 && Math.abs(o.x - z.x) <= r) damageZombie(run, o, boom, ev, { byPlayer: false, kb: 2, dir: o.x >= z.x ? 1 : -1, heavy: true });
  }
}

function collectCrate(run: RunState, weapon: WeaponId, ev: GameEvent[]) {
  const p = run.player;
  const owned = p.weapons.find((w) => w.id === weapon);
  if (!owned) {
    const fresh = { id: weapon, star: 1, ammo: magSize(weapon, 1) };
    if (p.weapons.length >= MAX_CARRY) { p.weapons[p.cur] = fresh; run.coins += 40; }
    else { p.weapons.push(fresh); p.cur = p.weapons.length - 1; }
    p.reloadT = 0; p.burstLeft = 0; p.smgHeat = 0;
    ev.push({ t: 'pickup', weapon, star: 1, isNew: true });
  } else if (owned.star < MAX_STAR) {
    owned.star++; owned.ammo = magSize(owned.id, owned.star);
    ev.push({ t: 'pickup', weapon, star: owned.star, isNew: false });
    ev.push({ t: 'star', weapon, star: owned.star });
  } else {
    run.coins += 45;
    ev.push({ t: 'pickup', weapon, star: owned.star, isNew: false });
  }
}

function fireLightning(
  run: RunState,
  sx: number, sy: number, first: Zombie, dmg: number, jumps: number,
  ev: GameEvent[],
  opts: { byPlayer: boolean; crit?: boolean; color: 'tesla' | 'shock'; stun?: number },
) {
  const pts: { x: number; y: number }[] = [{ x: sx, y: sy }];
  const hit = new Set<number>();
  let cur: Zombie | undefined = first;
  let curDmg = dmg;
  for (let i = 0; i < jumps && cur; i++) {
    hit.add(cur.id);
    pts.push({ x: cur.x, y: BODY_Y });
    const overloaded = opts.byPlayer && (cur.burnT > 0 || cur.slowT > 0 || cur.freezeT > 0);
    damageZombie(run, cur, curDmg * (overloaded ? 1.35 : 1), ev, {
      byPlayer: opts.byPlayer,
      crit: opts.crit,
      kb: 0.9,
      stun: opts.stun,
      overload: overloaded,
      dir: cur.x >= sx ? 1 : -1,
      weaponId: 'tesla',
      heavy: overloaded,
    });
    curDmg *= 0.82;
    const fromX: number = cur.x;
    cur = run.zombies.filter((o) => o.hp > 0 && !hit.has(o.id) && Math.abs(o.x - fromX) <= 155)
      .sort((a, b) => Math.abs(a.x - fromX) - Math.abs(b.x - fromX))[0];
  }
  if (pts.length >= 2) ev.push({ t: 'lightning', pts, color: opts.color });
}

function addGroundFire(run: RunState, x: number, r: number, dmg: number) {
  run.fires.push({ x, r, t: 210, maxT: 210, dmg });
  if (run.fires.length > 6) run.fires.shift();
}

function explodeAt(run: RunState, x: number, y: number, r: number, dmg: number, ev: GameEvent[], byPlayer: boolean, burn = false, scorch = false) {
  const shrapMul = has(run, 'shrapnel') ? 1.32 : 1;
  const rMul = has(run, 'shrapnel') ? 1.28 : 1;
  const finalR = Math.round(r * rMul);
  const finalDmg = dmg * (byPlayer ? shrapMul : 1);
  ev.push({ t: 'boom', x, y, r: finalR });
  for (const z of run.zombies) {
    if (z.hp <= 0) continue;
    const d = Math.abs(z.x - x);
    if (d <= finalR) {
      damageZombie(run, z, finalDmg * (1 - 0.35 * (d / Math.max(1, finalR))), ev, {
        byPlayer, kb: 3.8, burn, weaponId: byPlayer ? 'rocket' : undefined, dir: z.x >= x ? 1 : -1, heavy: true,
      });
      if (burn && z.hp > 0) z.burnT = Math.max(z.burnT, 140);
    }
  }
  if (scorch) {
    addGroundFire(run, x, Math.round(finalR * 0.88), Math.max(12, Math.round(finalDmg * 0.14)));
  }
}

/** 向目标发射一发/一组实体弹丸（也供双发手枪二连补射复用）。 */
function launchWeaponShot(run: RunState, target: Zombie | null, ev: GameEvent[], consumeAmmo: boolean) {
  const p = run.player, ow = curWeapon(run), def = WEAPONS[ow.id];
  const mx = p.x + p.facing * 26, my = MUZZLE_Y + p.y;
  let dx: number = p.facing, dy = 0;
  if (target) {
    const tx = target.x - mx, ty = BODY_Y - my, len = Math.hypot(tx, ty) || 1;
    dx = tx / len; dy = ty / len;
  }
  const ang = Math.atan2(dy, dx);
  const hawkeye = skillActive(run, 'gunner');
  const hb = houseBuff(run);
  const baseCrit = (run.cls === 'gunner' ? CRIT_CHANCE : 0) + (ow.id === 'pistol' ? 0.2 : 0) + hb.critBonus;
  const crit = hawkeye || (baseCrit > 0 && rand(run) < baseCrit);
  const dmg = weaponDamage(ow.id, ow.star) * damageMul(run) * (crit ? CRIT_MUL : 1);
  const range = effectiveRange(run, ow.id);
  const fullPierce = !!def.pierce || has(run, 'pierce') || hawkeye;

  if (ow.id === 'smg') p.smgShots++;
  const hotSmg = ow.id === 'smg' && p.smgHeat >= 0.65 && p.smgShots % 3 === 0;

  // 1. 猩红磁轨激光：扣扳机瞬间全屏 hitscan 穿透整列敌军 + 对重甲/Boss +35%（★5 +50%）破甲伤
  if (def.hitscan) {
    const x2 = mx + dx * range, y2 = my + dy * range;
    ev.push({ t: 'railbeam', x1: mx, y1: my, x2, y2, crit });
    const sorted = [...run.zombies].sort((a, b) => Math.abs(a.x - mx) - Math.abs(b.x - mx));
    for (const z of sorted) {
      if (z.hp <= 0) continue;
      if ((z.x - mx) * dx < -10) continue;
      const distX = Math.abs(z.x - mx);
      if (distX > range + 20) continue;
      const t = Math.abs(dx) > 0.06 ? (z.x - mx) / dx : 0;
      if (t < -10 || t > range + 24) continue;
      const beamY = my + dy * t;
      const zDef = ZOMBIES[z.kind];
      const hitTop = zDef.boss ? GROUND_Y - 114 : GROUND_Y - 58;
      if (beamY < hitTop - 16 || beamY > GROUND_Y + 14) continue;
      const armorBreaker = zDef.boss || z.kind === 'bruiser' ? (ow.star >= 5 ? 1.5 : 1.35) : 1.0;
      damageZombie(run, z, dmg * armorBreaker, ev, {
        byPlayer: true, crit, kb: 2.8, weaponId: 'rifle', dir: dx >= 0 ? 1 : -1, heavy: true,
      });
      if (has(run, 'incendiary') && z.hp > 0 && rand(run) < 0.25) z.burnT = 180;
      if (has(run, 'frostbite')) z.slowT = Math.max(z.slowT, 135);
      if (has(run, 'shock') && z.hp > 0 && rand(run) < 0.2) {
        const next = run.zombies.find((o) => o.id !== z.id && o.hp > 0 && Math.abs(o.x - z.x) <= 130);
        if (next) fireLightning(run, z.x, BODY_Y, next, dmg * 0.45, 2, ev, { byPlayer: true, color: 'shock' });
      }
    }
    ev.push({ t: 'shot', x: mx, y: my, from: 'player', weapon: ow.id, ang });
    if (consumeAmmo && ow.ammo <= 0) startReload(run, ev);
    return;
  }

  // 2. 特斯拉雷暴线圈：多段电弧链 + 麻痹定身 + 元素超载
  if (def.chain) {
    if (target) {
      const jumps = def.chain + (ow.star >= 3 ? 1 : 0) + (ow.star >= 5 ? 1 : 0) + (has(run, 'shock') ? 2 : 0);
      fireLightning(run, mx, my, target, dmg, jumps, ev, { byPlayer: true, crit, color: 'tesla', stun: 22 });
    } else {
      ev.push({ t: 'lightning', pts: [{ x: mx, y: my }, { x: mx + dx * 135, y: my + (rand(run) - 0.5) * 16 }], color: 'tesla' });
    }
    ev.push({ t: 'shot', x: mx, y: my, from: 'player', weapon: ow.id, ang });
    if (consumeAmmo && ow.ammo <= 0) startReload(run, ev);
    return;
  }

  // 3. 实体弹丸组（双发手枪 / 跳弹左轮 / 蓄热机炮 / 龙息霰弹 / 冰暴步枪 / 追踪焦土火箭）
  const bonusAt5 = def.burst ? 0 : extraBullets(ow.id, ow.star);
  const count = (def.pellets ?? 1) + bonusAt5;
  const rocketSplitScale = def.aoe && count > 1 ? 0.68 : 1;
  for (let i = 0; i < count; i++) {
    const spreadRad = def.aoe && count > 1 ? (i % 2 ? 0.16 : -0.16)
      : def.spread ? (rand(run) - 0.5) * 2 * def.spread
      : i === 0 ? 0 : (i % 2 ? 0.05 : -0.05) * Math.ceil(i / 2);
    const c = Math.cos(spreadRad), s = Math.sin(spreadRad);
    const finalDmg = (hotSmg ? dmg * 1.5 : dmg) * rocketSplitScale;
    const pierceCnt = fullPierce ? 99 : hotSmg ? Math.max(2, def.pierceCount ?? 1) : (def.pierceCount ?? 1);
    const ricochetLeft = (def.ricochet ?? 0) + (ow.id === 'revolver' && ow.star >= 5 ? 1 : 0);
    run.bullets.push({
      x: mx, y: my,
      vx: (dx * c - dy * s) * def.speed,
      vy: (dx * s + dy * c) * def.speed,
      dmg: finalDmg,
      life: Math.ceil((range + 70) / def.speed),
      from: 'player',
      pierce: fullPierce || pierceCnt > 1,
      pierceLeft: pierceCnt,
      ricochetLeft,
      crit: crit || hotSmg,
      bounces: 0,
      hit: [],
      aoe: def.aoe,
      slow: def.slow,
      stun: ow.id === 'revolver' ? 18 : undefined,
      burn: hotSmg ? 105 : undefined,
      homing: def.homing,
      kind: def.aoe ? 'rocket' : hotSmg ? 'firebolt' : 'normal',
      weaponId: ow.id,
      startX: mx,
      closeBoost: ow.id === 'shotgun',
      shatter: ow.id === 'assault',
    });
  }
  ev.push({ t: 'shot', x: mx, y: my, from: 'player', weapon: ow.id, ang, hot: hotSmg });
  if (consumeAmmo && ow.ammo <= 0) startReload(run, ev);
}

function fire(run: RunState, target: Zombie | null, ev: GameEvent[]) {
  const p = run.player, ow = curWeapon(run), def = WEAPONS[ow.id];
  if (ow.ammo <= 0) { startReload(run, ev); return; }
  ow.ammo--;

  // 暴风加特林蓄热变速（按住越久射速越快，interval 从 8 步一路缩至 3 步）
  const baseInt = ow.id === 'smg'
    ? Math.max(3, Math.round(def.interval * (1 - 0.62 * p.smgHeat)))
    : def.interval;
  p.fireCd = Math.max(2, Math.round((baseInt * (has(run, 'pierce') ? 1.2 : 1)) / playerHaste(run)));
  p.shootT = 10;

  // 猎手双发手枪：一发扳机排队二连点射（★5 时三连射）
  if (def.burst && def.burst > 1) {
    p.burstLeft = (def.burst - 1) + (ow.star >= 5 ? 1 : 0);
    p.burstCd = 4;
  }
  launchWeaponShot(run, target, ev, true);
}

function startReload(run: RunState, ev: GameEvent[]) {
  const p = run.player, ow = curWeapon(run), def = WEAPONS[ow.id];
  if (p.reloadT > 0 || ow.ammo >= magSize(ow.id, ow.star)) return;
  p.burstLeft = 0; p.burstCd = 0;
  p.reloadT = Math.max(16, Math.round(def.reload / reloadHaste(run)));
  ev.push({ t: 'reload' });
}

/**
 * 计算手榴弹投掷初速度与起点（支持拖拽控曲线，或未拖拽时智能抛向最近尸群）：
 * - dx 控制投掷远近/正反方向；dy 上拉抬高高抛曲线、下拉压低快速平抛。
 */
export function computeGrenadeThrow(run: RunState, aim?: { dx: number; dy: number } | null) {
  const p = run.player;
  const sy = GROUND_Y + p.y - 26;
  const target = pickTarget(run) ?? run.zombies[0];
  const g = GRENADE_G;

  let txOffset: number;
  let frames: number;
  const mag = aim ? Math.hypot(aim.dx, aim.dy) : 0;

  if (aim && mag >= 0.14) {
    const dx = Math.max(-1, Math.min(1, aim.dx));
    const dy = Math.max(-1, Math.min(1, aim.dy));
    txOffset = dx >= 0 ? 185 + dx * 255 : 185 + dx * 335;
    const baseFrames = 24 + Math.abs(txOffset) * 0.048;
    frames = Math.max(15, Math.min(68, Math.round(baseFrames - dy * 17)));
  } else {
    const dir = target ? (target.x >= p.x ? 1 : -1) : p.facing;
    txOffset = target ? target.x - (p.x + dir * 14) : dir * 180;
    frames = p.y <= ROOF_Y ? 30 : 34;
  }

  const dir = txOffset >= 0 ? 1 : -1;
  const sx = p.x + dir * 14;
  const tx = Math.max(30, Math.min(SPAWN_X - 10, sx + txOffset));
  const dy = GROUND_Y - 10 - sy;
  const vx = (tx - sx) / frames;
  const vy = dy / frames - 0.5 * g * (frames - 1);
  return { sx, sy, vx, vy, frames, g, dir };
}

function throwGrenade(run: RunState, aim: { dx: number; dy: number } | null | undefined, ev: GameEvent[]) {
  const p = run.player;
  if (p.grenades <= 0 || run.inside || run.phase !== 'fight') return;
  p.grenades--;
  const traj = computeGrenadeThrow(run, aim);
  p.facing = traj.dir as 1 | -1;
  run.grenades.push({
    x: traj.sx, y: traj.sy, vx: traj.vx, vy: traj.vy,
    dmg: 105 + run.day * 22, r: 70,
  });
  ev.push({ t: 'grenadeThrow' });
}

function stepPlayer(run: RunState, input: Input, ev: GameEvent[]) {
  const p = run.player;
  if (p.hurtT > 0) p.hurtT--;
  if (p.dodgeCd > 0) p.dodgeCd--;
  if (p.fireCd > 0) p.fireCd--;
  if (p.shootT > 0) p.shootT--;
  if (run.skill.t > 0) run.skill.t--;
  if (run.skill.cd > 0) run.skill.cd--;
  if (input.skill && run.skill.cd === 0 && !CLASSES[run.cls].comingSoon) {
    run.skill = { t: CLASSES[run.cls].dur, cd: CLASSES[run.cls].cd };
    if (run.cls === 'chef') p.hp = Math.min(p.maxHp, Math.round(p.hp + p.maxHp * 0.4));
    ev.push({ t: 'skill', cls: run.cls });
  }
  if (p.reloadT > 0 && --p.reloadT === 0) curWeapon(run).ammo = magSize(curWeapon(run).id, curWeapon(run).star);
  if (run.vanguardT > 0) run.vanguardT--;
  if (run.chain.t > 0 && --run.chain.t === 0) run.chain.n = 0;

  const move = Math.max(-1, Math.min(1, input.move));
  if (input.dodge && p.dodgeT === 0 && p.dodgeCd === 0) {
    p.dodgeT = DODGE_TICKS; p.dodgeCd = DODGE_CD;
    p.dodgeDir = move !== 0 ? (move > 0 ? 1 : -1) : p.facing;
    ev.push({ t: 'dodge' });
  }
  if (p.dodgeT > 0) { p.dodgeT--; p.vx = p.dodgeDir * DODGE_SPEED; }
  else p.vx = move * MOVE_SPEED;

  if (run.inside) {
    if (input.jump && p.y === 0) p.vy = JUMP_V * 0.72;
    p.vy += GRAVITY; p.y += p.vy;
    if (p.y >= 0) { p.y = 0; p.vy = 0; }
    p.x = Math.max(IN_MIN_X, Math.min(IN_MAX_X, p.x + p.vx));
    if (move !== 0 && p.dodgeT === 0) p.facing = move > 0 ? 1 : -1;
    if (input.interact && nearbyStation(run) === 'door' && run.phase === 'camp') command(run, { t: 'exitHouse' });
    return;
  }

  // 室外与房顶 2D 实体碰撞 + 阶梯跳跃动线（一楼砖墙 -> 中层木制挑台 -> 二层屋顶平台）
  const prevY = p.y;
  const onGround = Math.abs(p.y) <= 0.5;
  const onPorch = p.x >= PORCH_MIN_X && p.x <= PORCH_MAX_X && Math.abs(p.y - PORCH_Y) <= 2;
  const onRoof = p.x >= ROOF_MIN_X && p.x <= ROOF_MAX_X && Math.abs(p.y - ROOF_Y) <= 2;
  if (input.jump && (onGround || onPorch || onRoof) && p.vy >= 0) {
    p.vy = JUMP_V;
    ev.push({ t: 'jump', onRoof });
  }

  let minX = HOUSE_WALL_X;
  if (p.y <= ROOF_Y + 4) minX = PLAYER_MIN_X;
  else if (p.y <= PORCH_Y + 4) minX = PORCH_MIN_X;
  p.x = Math.max(minX, Math.min(PLAYER_MAX_X, p.x + p.vx));

  const nowInRoof = p.x >= ROOF_MIN_X && p.x <= ROOF_MAX_X;
  const nowInPorch = p.x >= PORCH_MIN_X && p.x <= PORCH_MAX_X;
  const standingRoof = nowInRoof && Math.abs(p.y - ROOF_Y) < 0.01 && p.vy === 0;
  const standingPorch = !standingRoof && nowInPorch && Math.abs(p.y - PORCH_Y) < 0.01 && p.vy === 0;

  if (!standingRoof && !standingPorch && (p.y < 0 || p.vy < 0)) {
    p.vy += GRAVITY;
    p.y += p.vy;
  }
  if (nowInRoof && prevY <= ROOF_Y + 6 && p.y >= ROOF_Y && p.vy >= 0) {
    p.y = ROOF_Y;
    p.vy = 0;
    if (prevY < ROOF_Y - 1 || prevY > ROOF_Y + 1) ev.push({ t: 'roof', onRoof: true });
  } else if (nowInPorch && prevY <= PORCH_Y + 6 && p.y >= PORCH_Y && p.vy >= 0) {
    p.y = PORCH_Y;
    p.vy = 0;
  }
  if (p.y >= 0) {
    if (prevY < -10) ev.push({ t: 'roof', onRoof: false });
    p.y = 0;
    p.vy = 0;
  }

  // 堡垒 2 级+ 站在屋顶享要塞缓慢庇护回血
  if (run.phase === 'fight' && run.fort.level >= 2 && isOnRoof(run)) {
    const interval = run.fort.level >= 3 ? 110 : 170;
    if (run.tick % interval === 0 && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + 1);
  }

  if (input.interact && nearbyExterior(run) === 'door' && run.phase === 'camp') {
    command(run, { t: 'enterHouse' });
    return;
  }

  if (input.swap && p.weapons.length > 1) {
    p.cur = (p.cur + 1) % p.weapons.length;
    p.reloadT = 0; p.fireCd = 8; p.burstLeft = 0; p.burstCd = 0; p.smgHeat = 0;
    ev.push({ t: 'swap', weapon: curWeapon(run).id });
  }
  if (input.reload) startReload(run, ev);
  if (input.grenade) throwGrenade(run, input.grenadeAim, ev);

  const target = pickTarget(run);
  run.targetId = target ? target.id : null;
  const wantFire = run.autoFire || input.fire;
  const holdingSmg = curWeapon(run).id === 'smg' && wantFire && (target || input.fire) && run.phase !== 'camp' && p.reloadT === 0 && p.dodgeT === 0;
  const heatUp = curWeapon(run).star >= 5 ? 0.022 : 0.016;
  p.smgHeat = holdingSmg ? Math.min(1, p.smgHeat + heatUp) : Math.max(0, p.smgHeat - 0.025);
  if (wantFire && target) p.facing = target.x >= p.x ? 1 : -1;
  else if (move !== 0 && p.dodgeT === 0) p.facing = move > 0 ? 1 : -1;

  // 处理二连点射待发队列（手枪二连）
  if (p.burstLeft > 0) {
    if (--p.burstCd <= 0) {
      p.burstLeft--;
      p.burstCd = 4;
      launchWeaponShot(run, target, ev, false);
    }
  } else if (wantFire && (target || input.fire) && run.phase !== 'camp' && p.fireCd === 0 && p.reloadT === 0 && p.dodgeT === 0) {
    fire(run, target, ev);
  }

  for (let i = run.crates.length - 1; i >= 0; i--) {
    const c = run.crates[i];
    if (Math.abs(c.x - p.x) > 22 || p.y < -22) continue;
    run.crates.splice(i, 1);
    collectCrate(run, c.weapon, ev);
  }
}

function stepZombies(run: RunState, ev: GameEvent[]) {
  const p = run.player;
  const reflectDmg = WALL_LEVELS[Math.max(0, run.wall.level - 1)].reflect;
  for (const z of run.zombies) {
    const def = ZOMBIES[z.kind];
    if (z.atkCd > 0) z.atkCd--;
    if (z.burnT > 0) { z.burnT--; if (z.burnT % 30 === 0) damageZombie(run, z, 6 + Math.floor(run.day * 0.6), ev, { byPlayer: false, burn: true }); }
    if (z.hp <= 0) continue;
    if (z.slowT > 0) z.slowT--;
    if (z.freezeT > 0) z.freezeT--;
    if (z.stunT > 0) { z.stunT--; continue; }
    if (z.kb > 0) { z.x += z.kb; z.kb *= 0.7; if (z.kb < 0.2) z.kb = 0; continue; }

    // 远程僵尸（提灯怨灵、暴君、深渊魔王）进入可交火射程后停止前压，抛射高弧火球打击主角或前线路障
    const rangedStopX = def.boss ? WALL_X + 245 : WALL_X + 215;
    if (def.ranged && z.x <= rangedStopX && z.x >= WALL_X + 24) {
      if (z.atkCd === 0) {
        z.atkCd = Math.round(def.attackEvery * (def.boss ? 1.2 : 1.38));
        const onRoofOrPorch = isOnRoof(run) || isOnPorch(run);
        const aimPlayer = !run.inside && Math.abs(p.x - z.x) <= 520 && (rand(run) < (onRoofOrPorch ? 0.56 : 0.72));
        const tx = aimPlayer ? p.x : (run.wall.hp > 0 ? WALL_X : HOME_X);
        const ty = aimPlayer ? (GROUND_Y + p.y - 24) : (GROUND_Y - 14);
        const sx = z.x - 10, sy = BODY_Y - 10;
        const dx = tx - sx, dist = Math.abs(dx) || 1;
        const speed = def.boss ? 4.4 : 3.8;
        const frames = Math.max(aimPlayer ? 28 : 16, dist / speed);
        const g = 0.11;
        const vy = (ty - sy) / frames - 0.5 * g * (frames - 1);
        run.enemyProjs.push({ x: sx, y: sy, vx: Math.sign(dx) * speed, vy, dmg: Math.round(def.damage * 0.85), life: 165 });
        continue;
      }
    }

    const nearPlayer = !run.inside && Math.abs(p.x - z.x) <= ZOMBIE_REACH && p.y > -24;
    const atWall = run.wall.hp > 0 && z.x <= WALL_X + 16 && z.x >= WALL_X - 8;
    const atHome = z.x <= HOME_X + 8;
    if (nearPlayer || atWall || atHome) {
      if (z.atkCd > 0) continue;
      z.atkCd = def.attackEvery;
      if (nearPlayer) {
        applyPlayerDamage(run, def.damage, ev, false);
      } else if (atWall) {
        run.wall.hp = Math.max(0, run.wall.hp - def.damage);
        ev.push({ t: 'wallHit', reflect: reflectDmg > 0 });
        if (has(run, 'vanguard')) run.vanguardT = 300;
        if (reflectDmg > 0) damageZombie(run, z, reflectDmg, ev, { byPlayer: false });
      } else {
        run.home.hp = Math.max(0, run.home.hp - def.damage);
        ev.push({ t: 'homeHit' });
      }
      continue;
    }
    const moveFactor = z.freezeT > 0 ? 0.16 : z.slowT > 0 ? 0.52 : 1;
    z.x -= def.speed * moveFactor;
  }
}

function stepFires(run: RunState, ev: GameEvent[]) {
  const out: typeof run.fires = [];
  for (const f of run.fires) {
    f.t--;
    if (f.t <= 0) continue;
    if (f.t % 20 === 0) {
      for (const z of run.zombies) {
        if (z.hp > 0 && Math.abs(z.x - f.x) <= f.r) {
          damageZombie(run, z, f.dmg, ev, { byPlayer: true, burn: true, weaponId: 'rocket' });
          z.burnT = Math.max(z.burnT, 90);
        }
      }
    }
    out.push(f);
  }
  run.fires = out;
}

function stepTurrets(run: RunState, ev: GameEvent[]) {
  const eng = run.cls === 'engineer';
  const overclock = has(run, 'overclock') ? 1.2 : 1;
  const engActive = skillActive(run, 'engineer') ? 2 : 1;
  const haste = (1 + run.buff.haste) * overclock * engActive;

  for (let i = 0; i < run.turrets.length; i++) {
    const slot = run.turrets[i];
    if (!slot.type || slot.level <= 0) continue;
    const def = TURRETS[slot.type], lv = def.levels[slot.level - 1];
    if (slot.cd > 0) { slot.cd--; continue; }
    const pos = turretWorldPos(i);
    const range = def.range + (pos.roof ? 55 : 0);
    let best: Zombie | null = null, bd = range;
    for (const z of run.zombies) {
      const d = Math.abs(z.x - pos.x);
      if (z.x >= pos.x - 40 && d <= bd) { bd = d; best = z; }
    }
    if (!best) continue;

    slot.cd = Math.max(2, Math.round(lv.cooldown / haste));
    const dmg = Math.round(lv.damage * (eng ? 1.2 : 1));
    const dx = best.x - pos.x, dy = BODY_Y - pos.muzzleY, len = Math.hypot(dx, dy) || 1;
    slot.aim = Math.atan2(dy, dx);

    if (slot.type === 'tesla') {
      fireLightning(run, pos.x, pos.muzzleY, best, dmg, lv.chain ?? 3, ev, { byPlayer: false, color: 'tesla', stun: 12 });
    } else if (slot.type === 'frost') {
      run.bullets.push({
        x: pos.x + 10, y: pos.muzzleY, vx: (dx / len) * 7.5, vy: (dy / len) * 7.5,
        dmg, life: 60, from: 'turret', pierce: false, crit: false, bounces: 0, hit: [],
        aoe: lv.aoe ?? 56, slow: 150, kind: 'frost',
      });
    } else if (slot.type === 'cannon') {
      run.bullets.push({
        x: pos.x + 12, y: pos.muzzleY, vx: (dx / len) * 7.2, vy: (dy / len) * 7.2,
        dmg, life: 70, from: 'turret', pierce: false, crit: false, bounces: 0, hit: [],
        aoe: lv.aoe ?? 70, kind: 'cannon',
      });
    } else {
      run.bullets.push({
        x: pos.x + 10, y: pos.muzzleY, vx: (dx / len) * 9.5, vy: (dy / len) * 9.5,
        dmg, life: 45, from: 'turret', pierce: false, crit: false, bounces: 0, hit: [], kind: 'normal',
      });
    }
    ev.push({ t: 'shot', x: pos.x + 10, y: pos.muzzleY, from: 'turret', turret: slot.type });
  }

  // 堡垒 2 级以上屋顶自带守卫火炮
  if (run.fort.level >= 2) {
    if (run.fort.cd > 0) run.fort.cd--;
    else {
      let best: Zombie | null = null, bd = 385;
      for (const z of run.zombies) {
        const d = Math.abs(z.x - FORT_GUN_X);
        if (z.x > FORT_GUN_X && d <= bd) { bd = d; best = z; }
      }
      if (best) {
        const lv3 = run.fort.level >= 3;
        run.fort.cd = Math.round((lv3 ? 56 : 92) / (1 + run.buff.haste));
        const dx = best.x - FORT_GUN_X, dy = BODY_Y - FORT_GUN_Y, len = Math.hypot(dx, dy) || 1;
        run.fort.aim = Math.atan2(dy, dx);
        const shots = lv3 ? 2 : 1;
        for (let s = 0; s < shots; s++) {
          const offset = (s - (shots - 1) * 0.5) * 0.06;
          const ca = Math.cos(offset), sa = Math.sin(offset);
          const vx = ((dx / len) * ca - (dy / len) * sa) * 10;
          const vy = ((dx / len) * sa + (dy / len) * ca) * 10;
          run.bullets.push({
            x: FORT_GUN_X + 10, y: FORT_GUN_Y, vx, vy, dmg: lv3 ? 54 : 38, life: 54,
            from: 'fort', pierce: false, crit: false, bounces: 0, hit: [], kind: 'normal',
          });
        }
        ev.push({ t: 'shot', x: FORT_GUN_X + 10, y: FORT_GUN_Y, from: 'fort' });
      }
    }
  }
}

function stepBullets(run: RunState, ev: GameEvent[]) {
  const out: Bullet[] = [];
  const spawned: Bullet[] = [];
  for (const b of run.bullets) {
    // 蜂巢追踪火箭在半空柔和转向锁定前方尸群
    if (b.homing && b.life > 2) {
      const steerTarget = run.zombies.filter((z) => z.hp > 0 && !b.hit.includes(z.id) && Math.abs(z.x - b.x) <= 220)
        .sort((a, c) => Math.abs(a.x - b.x) - Math.abs(c.x - b.x))[0];
      if (steerTarget) {
        const sp = Math.hypot(b.vx, b.vy) || 8.8;
        const tx = steerTarget.x - b.x, ty = BODY_Y - b.y, len = Math.hypot(tx, ty) || 1;
        const dvx = (tx / len) * sp, dvy = (ty / len) * sp;
        b.vx += (dvx - b.vx) * 0.14;
        b.vy += (dvy - b.vy) * 0.14;
      }
    }

    b.x += b.vx; b.y += b.vy; b.life--;
    let alive = b.life > 0 && b.y < GROUND_Y + 4;
    if (alive) {
      for (const z of run.zombies) {
        if (z.hp <= 0 || b.hit.includes(z.id)) continue;
        const hitW = ZOMBIES[z.kind].boss ? 24 : 13;
        const hitTop = ZOMBIES[z.kind].boss ? GROUND_Y - 108 : GROUND_Y - 56;
        if (Math.abs(b.x - z.x) > hitW || b.y < hitTop || b.y > GROUND_Y) continue;
        b.hit.push(z.id);
        const byPlayer = b.from === 'player';

        if (b.kind === 'frost' && b.aoe) {
          ev.push({ t: 'frost', x: b.x, y: Math.min(BODY_Y, b.y), r: b.aoe });
          for (const o of run.zombies) if (o.hp > 0 && Math.abs(o.x - b.x) <= b.aoe) damageZombie(run, o, b.dmg, ev, { byPlayer: false, slow: b.slow ?? 150 });
          alive = false;
          break;
        }
        if ((b.kind === 'rocket' || b.kind === 'cannon') && b.aoe) {
          explodeAt(run, b.x, Math.min(BODY_Y, b.y), b.aoe, b.dmg, ev, byPlayer, b.kind === 'rocket', b.kind === 'rocket');
          alive = false;
          break;
        }

        const wasSlowed = z.slowT > 0 || z.freezeT > 0;
        const closeHit = b.closeBoost && b.startX !== undefined && Math.abs(z.x - b.startX) <= 205;
        const hitDmg = b.dmg * (closeHit ? 1.5 : 1);
        const kb = closeHit ? 5.6 : b.weaponId === 'revolver' ? 4.6 : byPlayer ? 1.6 : 0.6;
        const dir: 1 | -1 = b.vx >= 0 ? 1 : -1;
        damageZombie(run, z, hitDmg, ev, {
          byPlayer, kb, crit: b.crit || closeHit, slow: b.slow,
          freeze: byPlayer && b.shatter && wasSlowed ? 65 : undefined,
          stun: b.stun, burn: !!(b.burn || closeHit), weaponId: b.weaponId, dir,
          heavy: !!closeHit || b.weaponId === 'revolver' || b.weaponId === 'rifle' || b.kind === 'firebolt',
        });

        if (b.burn || closeHit) {
          if (z.hp > 0) z.burnT = Math.max(z.burnT, b.burn ?? 120);
        }

        // 极地急冻步枪特色：命中已减速目标深冻定身并引爆碎冰溅射
        if (byPlayer && b.shatter && wasSlowed) {
          const shatterR = curWeapon(run).id === 'assault' && curWeapon(run).star >= 5 ? 58 : 48;
          ev.push({ t: 'frost', x: z.x, y: BODY_Y, r: shatterR });
          for (const o of run.zombies) {
            if (o.id !== z.id && o.hp > 0 && Math.abs(o.x - z.x) <= shatterR) {
              damageZombie(run, o, b.dmg * 0.55, ev, { byPlayer: true, slow: 115, freeze: 36, weaponId: b.weaponId });
            }
          }
        }
        if (byPlayer && has(run, 'incendiary') && z.hp > 0 && rand(run) < 0.25) z.burnT = 180;
        if (byPlayer && has(run, 'frostbite')) z.slowT = 135;
        if (byPlayer && has(run, 'shock') && z.hp > 0 && rand(run) < 0.25) {
          const next = run.zombies.find((o) => o.id !== z.id && o.hp > 0 && Math.abs(o.x - z.x) <= 130);
          if (next) fireLightning(run, z.x, BODY_Y, next, b.dmg * 0.55, 2, ev, { byPlayer: true, color: 'shock' });
        }

        // 重锤左轮先天跳弹追击 + 弹射天赋叠加（仅在消耗本次弹跳次数且防父弹同体重复命中时生成跳弹）
        if (byPlayer && ((b.ricochetLeft ?? 0) > 0 || (has(run, 'ricochet') && b.bounces < 3 && rand(run) < 0.55))) {
          const next = run.zombies.filter((o) => o.hp > 0 && !b.hit.includes(o.id) && Math.abs(o.x - z.x) <= 155)
            .sort((a, c) => Math.abs(a.x - z.x) - Math.abs(c.x - z.x))[0];
          if (next) {
            const sp = Math.hypot(b.vx, b.vy), nx = next.x - z.x, ny = BODY_Y - b.y, nlen = Math.hypot(nx, ny) || 1;
            const useWeaponBounce = (b.ricochetLeft ?? 0) > 0;
            spawned.push({
              ...b,
              x: z.x, y: BODY_Y,
              vx: (nx / nlen) * sp, vy: (ny / nlen) * sp,
              dmg: b.dmg * 0.78, life: 24,
              bounces: b.bounces + 1,
              ricochetLeft: 0,
              pierce: false, pierceLeft: 1,
              hit: [...b.hit],
            });
            b.hit.push(next.id);
            if (useWeaponBounce) b.ricochetLeft = Math.max(0, (b.ricochetLeft ?? 0) - 1);
          }
        }

        if (b.pierceLeft !== undefined) {
          b.pierceLeft--;
          if (b.pierceLeft <= 0) { alive = false; break; }
        } else if (!b.pierce) {
          alive = false;
          break;
        }
      }
    }
    // 火箭弹/重炮落到地面直接爆开并铺设焦土火海
    if (!alive && b.life > 0 && b.y >= GROUND_Y + 2 && (b.kind === 'rocket' || b.kind === 'cannon') && b.aoe && b.hit.length === 0) {
      explodeAt(run, b.x, GROUND_Y - 12, b.aoe, b.dmg, ev, b.from === 'player', b.kind === 'rocket', b.kind === 'rocket');
    }
    if (alive) out.push(b);
  }
  run.bullets = out.concat(spawned);
}

function stepGrenades(run: RunState, ev: GameEvent[]) {
  const out: typeof run.grenades = [];
  for (const g of run.grenades) {
    g.x += g.vx; g.y += g.vy; g.vy += GRENADE_G;
    const hitZ = run.zombies.some((z) => z.hp > 0 && Math.abs(g.x - z.x) <= 18 && g.y >= GROUND_Y - 46);
    if (hitZ || g.y >= GROUND_Y - 4) {
      explodeAt(run, g.x, Math.min(GROUND_Y - 14, g.y), g.r, g.dmg, ev, true, true, false);
    } else if (g.x >= 0 && g.x <= SPAWN_X) {
      out.push(g);
    }
  }
  run.grenades = out;
}

function stepEnemyProjs(run: RunState, ev: GameEvent[]) {
  const p = run.player, out: typeof run.enemyProjs = [];
  for (const ep of run.enemyProjs) {
    ep.x += ep.vx; ep.y += ep.vy; ep.vy += 0.11; ep.life--;
    if (ep.life <= 0 || ep.y >= GROUND_Y + 2 || ep.x < 0) continue;
    if (!run.inside && Math.abs(ep.x - p.x) <= 16 && ep.y >= GROUND_Y + p.y - 42 && ep.y <= GROUND_Y + p.y + 4) {
      applyPlayerDamage(run, ep.dmg, ev, true);
      continue;
    }
    if (run.wall.hp > 0 && Math.abs(ep.x - WALL_X) <= 16 && ep.y >= GROUND_Y - 36) {
      run.wall.hp = Math.max(0, run.wall.hp - Math.round(ep.dmg * 0.75));
      ev.push({ t: 'wallHit' });
      continue;
    }
    if (run.wall.hp <= 0 && Math.abs(ep.x - HOME_X) <= 16 && ep.y >= GROUND_Y - 90) {
      run.home.hp = Math.max(0, run.home.hp - Math.round(ep.dmg * 0.75));
      ev.push({ t: 'homeHit' });
      continue;
    }
    out.push(ep);
  }
  run.enemyProjs = out;
}

/** 推进一步。返回这一步发生的事件。 */
export function step(run: RunState, input: Input): GameEvent[] {
  const ev: GameEvent[] = [];
  if (run.phase === 'camp') {
    run.tick++; run.phaseT++;
    stepPlayer(run, input, ev);
    return ev;
  }
  if (run.phase !== 'fight' && run.phase !== 'clear') return ev;

  run.tick++; run.phaseT++;
  stepPlayer(run, input, ev);

  if (run.phase === 'fight') {
    if (run.spawn.left > 0 && --run.spawn.timer <= 0) {
      const groupCap = run.day === 1 ? 1.15 : 1.7 + run.day * 0.42;
      const group = Math.min(run.spawn.left, 1 + Math.floor(rand(run) * groupCap));
      for (let i = 0; i < group; i++) { spawnZombie(run); run.spawn.left--; }
      if (run.spawn.bossKind && !run.spawn.bossSpawned && run.spawn.left <= Math.floor(run.spawn.total / 2)) {
        run.spawn.bossSpawned = true;
        spawnZombie(run, run.spawn.bossKind);
        ev.push({ t: 'bossAppear', kind: run.spawn.bossKind });
      }
      run.spawn.timer = Math.round(Math.max(12, 28 - run.day * 0.9) * (0.55 + group * 0.45)) + Math.floor(rand(run) * 10);
    }
  }

  stepZombies(run, ev);
  stepFires(run, ev);
  stepTurrets(run, ev);
  stepBullets(run, ev);
  stepGrenades(run, ev);
  stepEnemyProjs(run, ev);
  run.zombies = run.zombies.filter((z) => z.hp > 0);
  if (run.targetId !== null && !run.zombies.some((z) => z.id === run.targetId)) run.targetId = null;

  if (run.player.hp <= 0 || run.home.hp <= 0) {
    run.player.hp = Math.max(0, run.player.hp);
    run.phase = 'dead';
    ev.push({ t: 'dead' });
    return ev;
  }
  if (run.phase === 'fight' && dayRemaining(run) === 0) {
    run.phase = 'clear'; run.phaseT = 0;
    ev.push({ t: 'dayClear', day: run.day });
  } else if (run.phase === 'clear' && run.phaseT >= 110 && (run.crates.length === 0 || run.phaseT >= 220)) {
    while (run.crates.length > 0) {
      const c = run.crates.shift()!;
      collectCrate(run, c.weapon, ev);
    }
    if (run.day >= LAST_DAY) {
      run.phase = 'won';
      ev.push({ t: 'won' });
    } else {
      const pool = PERKS.filter((p) => !run.perks.includes(p.id));
      const picks: PerkId[] = [];
      while (picks.length < 3 && pool.length) {
        let roll = rand(run) * pool.reduce((sum, p) => sum + RARITY_WEIGHT[p.rarity], 0), i = 0;
        while (i < pool.length - 1 && (roll -= RARITY_WEIGHT[pool[i].rarity]) >= 0) i++;
        picks.push(pool.splice(i, 1)[0].id);
      }
      run.perkChoices = picks; run.phase = 'perk';
    }
  }
  return ev;
}

const qiangWallBonus = (run: RunState) => (hasAlly(run, 'qiang') ? 50 : 0);

/** 面板和按钮的指令。成功返回事件，不满足条件（钱不够、时机不对）返回 null。 */
export function command(run: RunState, cmd: Command): GameEvent[] | null {
  const ev: GameEvent[] = [];
  switch (cmd.t) {
    case 'pickPerk': {
      if (run.phase !== 'perk' || !run.perkChoices.includes(cmd.id)) return null;
      run.perks.push(cmd.id); run.perkChoices = []; run.phase = 'camp';
      if (cmd.id === 'glasscannon') { const p = run.player; p.maxHp = Math.round(p.maxHp / 2); p.hp = Math.min(p.hp, p.maxHp); }
      if (cmd.id === 'fortify') {
        const nextWallMax = Math.round(WALL_LEVELS[run.wall.level - 1].maxHp * 1.4) + qiangWallBonus(run);
        const nextHomeMax = Math.round(FORT_LEVELS[run.fort.level - 1].maxHp * 1.4) + qiangWallBonus(run);
        run.wall.hp += nextWallMax - run.wall.maxHp; run.wall.maxHp = nextWallMax;
        run.home.hp += nextHomeMax - run.home.maxHp; run.home.maxHp = nextHomeMax;
        run.player.armor = Math.min(run.player.maxArmor, run.player.armor + 25);
      }

      const join = COMPANION_JOIN_STORIES[run.day];
      if (join && !run.story.allies.includes(join.ally)) {
        run.story.allies.push(join.ally);
        if (join.ally === 'qiang') {
          run.wall.maxHp += 50; run.wall.hp += 50;
          run.home.maxHp += 50; run.home.hp += 50;
        }
        if (join.ally === 'lin') {
          run.player.hp = Math.min(run.player.maxHp, run.player.hp + 18);
        }
        ev.push({ t: 'allyJoin', ally: join.ally, day: run.day });
      }
      if (run.day === 1 && !run.story.seenEvents.includes('firstOpen')) {
        run.story.seenEvents.push('firstOpen');
        ev.push({ t: 'dinerStory', eventKey: 'firstOpen' });
      }

      run.inside = true; run.player.x = IN_STATIONS.kitchen + 40; run.player.y = 0; run.player.vy = 0;
      rollShopOffers(run);
      rollDinerGuests(run);
      ev.push({ t: 'inside', inside: true });
      return ev;
    }
    case 'nextDay':
      if (run.phase !== 'camp') return null;
      run.player.hp = Math.min(run.player.maxHp, Math.round(run.player.hp + run.player.maxHp * DAY_HEAL + (hasAlly(run, 'lin') ? 18 : 0)));
      run.crates = [];
      for (const w of run.player.weapons) w.ammo = magSize(w.id, w.star);
      startDay(run, ev);
      return ev;
    case 'enterHouse':
      if (run.phase !== 'camp' || run.inside) return null;
      run.inside = true; run.player.x = IN_STATIONS.door - 24; run.player.y = 0; run.player.vy = 0; run.player.facing = -1;
      ev.push({ t: 'inside', inside: true });
      return ev;
    case 'exitHouse':
      if (run.phase !== 'camp' || !run.inside) return null;
      run.inside = false; run.player.x = DOOR_X; run.player.y = 0; run.player.vy = 0; run.player.facing = 1;
      ev.push({ t: 'inside', inside: false });
      return ev;
    case 'focusTarget': {
      let best: Zombie | null = null, bd = 72;
      for (const z of run.zombies) {
        const d = Math.abs(z.x - cmd.x);
        if (d < bd) { bd = d; best = z; }
      }
      if (!best) return null;
      run.priorityId = best.id; run.targetId = best.id;
      return ev;
    }
    case 'buyStar': {
      const w = run.player.weapons.find((o) => o.id === cmd.weapon);
      if (!w || w.star >= MAX_STAR || run.coins < STAR_COST[w.star]) return null;
      run.coins -= STAR_COST[w.star]; w.star++; w.ammo = magSize(w.id, w.star);
      ev.push({ t: 'star', weapon: w.id, star: w.star });
      return ev;
    }
    case 'buildTurret': {
      const slot = run.turrets[cmd.slot];
      if (!slot || slot.type !== null) return null;
      const cost = turretBuildCost(cmd.kind, run.cls, hasAlly(run, 'qiang'));
      if (run.coins < cost) return null;
      run.coins -= cost;
      slot.type = cmd.kind; slot.level = 1; slot.cd = 0; slot.aim = 0;
      ev.push({ t: 'build', kind: 'turret' });
      return ev;
    }
    case 'upgradeTurret': {
      const slot = run.turrets[cmd.slot];
      if (!slot || !slot.type || slot.level >= TURRETS[slot.type].levels.length) return null;
      const cost = turretUpgradeCost(slot.type, slot.level, run.cls, hasAlly(run, 'qiang'));
      if (run.coins < cost) return null;
      run.coins -= cost; slot.level++;
      ev.push({ t: 'build', kind: 'turret' });
      return ev;
    }
    case 'sellTurret': {
      const slot = run.turrets[cmd.slot];
      if (!slot || !slot.type) return null;
      run.coins += turretRefundCoins(slot.type, slot.level, run.cls, hasAlly(run, 'qiang'));
      slot.type = null; slot.level = 0; slot.cd = 0;
      return ev;
    }
    case 'upgradeWall': {
      if (run.wall.level >= MAX_WALL_LEVEL) return null;
      const next = WALL_LEVELS[run.wall.level];
      if (run.coins < next.coins) return null;
      run.coins -= next.coins;
      run.wall.level++;
      run.wall.maxHp = Math.round(next.maxHp * (has(run, 'fortify') ? 1.4 : 1)) + qiangWallBonus(run);
      run.wall.hp = run.wall.maxHp;
      ev.push({ t: 'build', kind: 'wall' });
      return ev;
    }
    case 'repairWall':
      if (run.wall.hp >= run.wall.maxHp || run.coins < WALL_REPAIR_COST) return null;
      run.coins -= WALL_REPAIR_COST; run.wall.hp = run.wall.maxHp;
      ev.push({ t: 'build', kind: 'wall' });
      return ev;
    case 'upgradeFort': {
      if (run.fort.level >= MAX_FORT_LEVEL) return null;
      const next = FORT_LEVELS[run.fort.level];
      if (run.coins < next.coins) return null;
      run.coins -= next.coins;
      run.fort.level++;
      const newMax = Math.round(next.maxHp * (has(run, 'fortify') ? 1.4 : 1)) + qiangWallBonus(run);
      run.home.hp = Math.min(newMax, run.home.hp + (newMax - run.home.maxHp) + 40);
      run.home.maxHp = newMax;
      ev.push({ t: 'build', kind: 'fort' });
      return ev;
    }
    case 'repairFort':
      if (run.home.hp >= run.home.maxHp || run.coins < FORT_REPAIR_COST) return null;
      run.coins -= FORT_REPAIR_COST; run.home.hp = run.home.maxHp;
      ev.push({ t: 'build', kind: 'fort' });
      return ev;
    case 'buyWeapon': {
      const def = WEAPONS[cmd.weapon];
      const owned = run.player.weapons.find((w) => w.id === cmd.weapon);
      if (owned) {
        if (owned.star >= MAX_STAR || run.coins < STAR_COST[owned.star]) return null;
        run.coins -= STAR_COST[owned.star]; owned.star++; owned.ammo = magSize(owned.id, owned.star);
        ev.push({ t: 'star', weapon: owned.id, star: owned.star });
        return ev;
      }
      if (run.coins < def.price) return null;
      run.coins -= def.price;
      const fresh = { id: cmd.weapon, star: 1, ammo: magSize(cmd.weapon, 1) };
      if (run.player.weapons.length >= MAX_CARRY) { run.player.weapons[run.player.cur] = fresh; run.coins += 40; }
      else { run.player.weapons.push(fresh); run.player.cur = run.player.weapons.length - 1; }
      run.player.reloadT = 0; run.player.burstLeft = 0; run.player.smgHeat = 0;
      ev.push({ t: 'shop', item: def.name });
      return ev;
    }
    case 'buySupply': {
      const p = run.player;
      if (cmd.item === 'grenade') {
        if (p.grenades >= MAX_GRENADES || run.coins < SHOP_GRENADE_COST) return null;
        run.coins -= SHOP_GRENADE_COST; p.grenades = Math.min(MAX_GRENADES, p.grenades + 2);
        ev.push({ t: 'shop', item: '破片手雷 ×2' });
        return ev;
      }
      if (cmd.item === 'armor') {
        if (p.armor >= p.maxArmor || run.coins < SHOP_ARMOR_COST) return null;
        run.coins -= SHOP_ARMOR_COST; p.armor = Math.min(p.maxArmor, p.armor + 40);
        ev.push({ t: 'shop', item: '防弹护甲 +40' });
        return ev;
      }
      if (cmd.item === 'medkit') {
        if (p.hp >= p.maxHp || run.coins < SHOP_MEDKIT_COST) return null;
        run.coins -= SHOP_MEDKIT_COST; p.hp = Math.min(p.maxHp, p.hp + 45);
        ev.push({ t: 'shop', item: '急救绷带 +45' });
        return ev;
      }
      return null;
    }
    case 'rerollShop':
      if (run.coins < SHOP_REROLL_COST) return null;
      run.coins -= SHOP_REROLL_COST;
      rollShopOffers(run);
      ev.push({ t: 'shop', item: '刷新货物' });
      return ev;
    case 'salvageWeapon': {
      const list = run.player.weapons;
      if (list.length <= 1 || cmd.index < 0 || cmd.index >= list.length) return null;
      const [removed] = list.splice(cmd.index, 1);
      run.player.cur = Math.min(run.player.cur, list.length - 1);
      run.player.burstLeft = 0; run.player.smgHeat = 0;
      run.coins += 45 + removed.star * 20;
      return ev;
    }
    case 'serveGuest': {
      if (run.phase !== 'camp') return null;
      const g = run.guests.find((o) => o.id === cmd.guestId && !o.served);
      if (!g || run.meat < g.meatCost) return null;
      const quality: DishQuality = cmd.quality ?? 'good';
      const qMeta = QUALITY_META[quality];
      const vip = VIP_CUSTOMERS.find((v) => v.id === g.vipId);

      run.meat -= g.meatCost;
      g.served = true;
      g.qualityServed = quality;
      g.reactionQuote = vip?.reactions[quality] ?? g.thanksQuote;

      const beforeRank = getFansRank(run.diner.fans).cur.grade;
      const finalCoins = Math.round(g.pay * qMeta.payMul);
      const zhaoMul = hasAlly(run, 'zhao') ? 1.3 : 1;
      const chefFans = run.cls === 'chef' ? 1.25 : 1;
      const trendFans = g.trendMatch ? 2 : 1;
      const tierFans = g.tier === 'bronze' ? 1 : g.tier === 'silver' ? 1.2 : g.tier === 'gold' ? 1.4 : g.tier === 'platinum' ? 1.7 : 2.1;
      const fansGain = Math.round(qMeta.fans * trendFans * zhaoMul * chefFans * tierFans);
      const repGain = qMeta.rep + (g.trendMatch ? 1 : 0);

      run.coins += finalCoins;
      run.diner.fans += fansGain;
      run.diner.rep += repGain;
      run.diner.servedTotal++;
      const firstMeet = !run.diner.metVips.includes(g.vipId);
      if (firstMeet) run.diner.metVips.push(g.vipId);

      const pool = DINER_REVIEW_POOL[quality];
      const revText = pool[Math.floor(rand(run) * pool.length)] ?? g.reactionQuote;
      run.diner.reviews.unshift({
        id: run.nextId++,
        author: g.name,
        tierName: VIP_TIERS[g.tier].name,
        dishName: g.dishName,
        quality,
        text: revText,
        fansDelta: fansGain,
      });
      if (run.diner.reviews.length > 12) run.diner.reviews.length = 12;

      const allServed = run.guests.length > 0 && run.guests.every((o) => o.served);
      let totalCoins = finalCoins;
      if (allServed) {
        const tip = run.cls === 'chef' ? 28 : 18;
        run.coins += tip;
        totalCoins += tip;
        run.diner.fans += 8;
        run.diner.rep += 1;
        run.player.hp = Math.min(run.player.maxHp, run.player.hp + 15);
      }

      const afterRank = getFansRank(run.diner.fans).cur;
      const rankUp = afterRank.grade !== beforeRank ? `${afterRank.grade}级·${afterRank.name}` : undefined;
      ev.push({
        t: 'serve', guestId: g.id, vipId: g.vipId, name: g.name, dishName: g.dishName,
        quality, coins: totalCoins, fans: fansGain + (allServed ? 8 : 0), rep: repGain + (allServed ? 1 : 0),
        quote: g.reactionQuote, allServed, firstMeet, trendMatch: g.trendMatch, rankUp,
      });

      if (run.diner.rep >= 10 && !run.story.seenEvents.includes('rep10')) {
        run.story.seenEvents.push('rep10');
        ev.push({ t: 'dinerStory', eventKey: 'rep10' });
      } else if (run.diner.rep >= 25 && !run.story.seenEvents.includes('rep25')) {
        run.story.seenEvents.push('rep25');
        ev.push({ t: 'dinerStory', eventKey: 'rep25' });
      } else if (run.diner.rep >= 40 && !run.story.seenEvents.includes('rep40')) {
        run.story.seenEvents.push('rep40');
        ev.push({ t: 'dinerStory', eventKey: 'rep40' });
      }
      return ev;
    }
    case 'cookSell': {
      const n = Math.min(run.meat, Math.max(0, Math.floor(cmd.count)));
      if (n <= 0) return null;
      const earned = n * meatPrice(run.cls);
      run.meat -= n; run.coins += earned;
      ev.push({ t: 'cook', meat: n, coins: earned });
      return ev;
    }
    case 'pickMeal': {
      if (run.phase !== 'camp' || run.meal !== null) return null;
      const m = MEALS[cmd.id];
      if (!m || m.unlockDay > Math.max(1, run.day) || run.meat < m.meatCost) return null;
      const quality: DishQuality = cmd.quality ?? 'good';
      run.meat -= m.meatCost;
      run.meal = cmd.id;
      run.mealQuality = quality;
      if (m.heal > 0) {
        const heal = Math.round(m.heal * (run.cls === 'chef' ? 1.5 : 1) * QUALITY_META[quality].buffMul);
        run.player.hp = Math.min(run.player.maxHp, run.player.hp + heal);
      }
      run.diner.fans += 8;
      ev.push({ t: 'meal', id: cmd.id, quality });
      return ev;
    }
  }
}
