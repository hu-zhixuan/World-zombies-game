// 深夜酒馆模拟经营规则：食材与备菜库存、炉火灵感研发、灶台自动出菜、伙计排班与自动技能、派对与VIP委托、日报净利。
import {
  AD_TIERS, DRINKS, MAX_DISH_LV, MAX_RACK_LEVEL, MAX_STAFF_LV, MEALS, MEATS, RACK_LEVELS, RYE_FALLBACK, SPICE_BUY_COST,
  STAFF_POOL, STAFF_TRAIN_COST, TAVERN_UPGRADES, dishEnhanceMeatCost, dishLevelPayMul, dishLevelServings, dishLevelTaste, dishUpgradeCost, partyForDay,
  type AdTierId, type ClassId, type DrinkId, type IngredientId, type MealId, type MeatInventory, type MeatKind,
  type StaffRole, type StaffSkillId, type TavernUpgradeId,
} from '../content/data';
import {
  DAILY_TRENDS, DINER_REVIEW_POOL, FANS_RANKS, QUALITY_META, VIP_CUSTOMERS, VIP_TIERS, getFansRank, getRepTier,
  type AllyId, type DishQuality, type VipDef,
} from '../content/story';
import {
  DINER_PLATE_X, DINER_SEAT_X, IN_MAX_X, IN_MIN_X, IN_STATIONS,
  type CounterDish, type DinerGuest, type DinerShiftState, type GameEvent, type GuestPersonality,
  type HiredStaffState, type RunState,
} from './types';

function rand(run: RunState): number {
  let t = (run.rng += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const hasTavernUpgrade = (run: RunState, id: TavernUpgradeId) => run.diner.upgrades.includes(id);
export const hasAlly = (run: RunState, id: AllyId) => run.story.allies.includes(id);
export const dishLevel = (run: RunState, id: MealId) => Math.max(1, run.diner.dishLevels[id] ?? 1);
export const totalMeat = (m: MeatInventory) => (m.tender ?? 0) + (m.thick ?? 0) + (m.essence ?? 0);
export const meatPrice = (cls: ClassId, kind: MeatKind = 'tender') =>
  Math.round(MEATS[kind].sellPrice * (cls === 'chef' ? 1.35 : 1));

export function dinerRank(run: RunState) {
  return getFansRank(run.diner.fans, run.diner.bestTaste, run.diner.researched.length);
}

export function allyRole(run: RunState, ally: AllyId): StaffRole {
  return run.diner.allyRoles?.[ally] ?? (ally === 'lin' ? 'kitchen' : 'floor');
}

export function staffDef(id: string) {
  return STAFF_POOL.find((s) => s.id === id);
}

export function staffHasSkill(s: { id: string; level: number }, skill: StaffSkillId): boolean {
  const def = staffDef(s.id);
  if (!def) return false;
  return (s.level >= 3 && def.lv3Skill === skill) || (s.level >= 5 && def.lv5Skill === skill);
}

export function maxStaffSlots(run: RunState): number {
  return dinerRank(run).cur.maxStaff;
}

export function dishPrice(run: RunState, id: MealId): number {
  return Math.round(MEALS[id].basePay * dishLevelPayMul(dishLevel(run, id)));
}

export function dishTaste(run: RunState, id: MealId): number {
  return dishLevelTaste(id, dishLevel(run, id));
}

export function dishServings(run: RunState, id: MealId): number {
  return dishLevelServings(id, dishLevel(run, id));
}

export function recalcBestTaste(run: RunState) {
  let best = 0;
  for (const id of run.diner.researched) {
    best = Math.max(best, dishTaste(run, id));
  }
  run.diner.bestTaste = best;
}

export function maxMenuSlots(run: RunState): number {
  const grade = dinerRank(run).cur.grade;
  if (grade === 'E') return 2;
  if (grade === 'D' || grade === 'C') return 3;
  if (grade === 'B') return 4;
  return 5;
}

export function stoveCapacity(run: RunState): number {
  const linCook = hasAlly(run, 'lin') && allyRole(run, 'lin') === 'kitchen';
  const staffCook = run.diner.hiredStaff.some((s) => s.role === 'kitchen');
  return Math.min(3, 1 + (linCook ? 1 : 0) + (staffCook ? 1 : 0));
}

export function passCounterCapacity(run: RunState): number {
  return hasTavernUpgrade(run, 'wide_pass') ? 5 : 4;
}

export function maxSeats(run: RunState): number {
  if (hasTavernUpgrade(run, 'tables_8')) return 8;
  if (hasTavernUpgrade(run, 'tables_6')) return 6;
  return 4;
}

export function dishResearchCost(run: RunState, id: MealId): number {
  const base = MEALS[id]?.researchCost ?? 0;
  if (base <= 0) return 0;
  const mastered = (run.heirloom?.mastery?.[id] ?? 0) > 0;
  return mastered ? Math.max(2, base - 1) : base;
}

export function tavernUpgradeCost(run: RunState, id: TavernUpgradeId): number {
  const base = TAVERN_UPGRADES[id]?.cost ?? 0;
  return run.heirloom?.decor?.includes(id) ? Math.round(base * 0.8) : base;
}

export function buyTavernUpgradeCmd(run: RunState, id: TavernUpgradeId, ev: GameEvent[]): GameEvent[] | null {
  const u = TAVERN_UPGRADES[id];
  if (!u || run.diner.upgrades.includes(id)) return null;
  if (id === 'tables_8' && !run.diner.upgrades.includes('tables_6')) return null;
  const cost = tavernUpgradeCost(run, id);
  if (run.coins < cost) return null;
  run.coins -= cost;
  run.diner.upgrades.push(id);
  ev.push({ t: 'shop', item: u.name });
  return ev;
}

export function hasIngredients(run: RunState, cost: Partial<Record<IngredientId, number>>): boolean {
  if ((cost.tender ?? 0) > run.meats.tender) return false;
  if ((cost.thick ?? 0) > run.meats.thick) return false;
  if ((cost.essence ?? 0) > run.meats.essence) return false;
  if ((cost.spice ?? 0) > run.spice) return false;
  return true;
}

export function spendIngredients(run: RunState, cost: Partial<Record<IngredientId, number>>) {
  run.meats.tender -= cost.tender ?? 0;
  run.meats.thick -= cost.thick ?? 0;
  run.meats.essence -= cost.essence ?? 0;
  run.spice -= cost.spice ?? 0;
}

export function formatRecipeCost(cost: Partial<Record<IngredientId, number>>): string {
  const parts: string[] = [];
  if (cost.tender) parts.push(`${cost.tender}嫩`);
  if (cost.thick) parts.push(`${cost.thick}厚`);
  if (cost.essence) parts.push(`${cost.essence}髓`);
  if (cost.spice) parts.push(`${cost.spice}香`);
  return parts.join('+');
}

export function pourQuality(fill: number, fastTap = false): DishQuality {
  const legSpan = fastTap ? 0.045 : 0.03;
  const lo = fastTap ? 0.70 : 0.74;
  const hi = fastTap ? 0.92 : 0.90;
  if (Math.abs(fill - 0.82) <= legSpan) return 'legendary';
  if (fill >= lo && fill <= hi) return 'perfect';
  if (fill >= 0.48 && fill <= 0.98) return 'good';
  return 'poor';
}

export function makeIdleShift(keepSpiceSpent = 0): DinerShiftState {
  return {
    mode: 'prep',
    timer: 0,
    duration: 45 * 60,
    spawnCd: 0,
    servedCount: 0,
    drinkCount: 0,
    cleanedCount: 0,
    lostCount: 0,
    ryeCount: 0,
    coinsEarned: 0,
    tipsEarned: 0,
    partyBonusCoins: 0,
    fansEarned: 0,
    spiceSpentCoins: keepSpiceSpent,
    combo: 0,
    bestCombo: 0,
    sauce: 100,
    maxSauce: 100,
    sauceStalled: false,
    kitchenOrders: [],
    dirtyTables: [],
    counterDishes: [],
    report: null,
  };
}

export function rollDailyTrend(run: RunState) {
  const researchedMeals = run.diner.researched.map((id) => MEALS[id]);
  const activeTags = new Set(researchedMeals.flatMap((m) => m.tags));
  const pool = DAILY_TRENDS.filter((t) => t.unlockDay <= Math.max(1, run.day) && activeTags.has(t.tag) && t.id !== run.diner.trendId);
  const src = pool.length ? pool : DAILY_TRENDS.filter((t) => t.unlockDay <= 1);
  const picked = src[Math.floor(rand(run) * src.length)] ?? DAILY_TRENDS[0];
  run.diner.trendId = picked.id;
  run.diner.trendTag = picked.tag;
  run.diner.trendTitle = picked.title;
}

const VIP_ORDER_LINES: Record<string, string> = {
  agou: '掌柜，求给我留一口热乎肉菜就行，我扫地擦桌都干！',
  laobao: '连守三夜防线了，来份最够劲的热肉提提神！',
  qijie: '刚锻完一批铜齿轮与炮架，上最扎实管饱的菜，少敷衍我！',
  niqiu: '掌柜的，把招牌菜端上来，好吃明天再给你带稀罕门路！',
  gaolaotou: '确定没藏窃听符印吧？给我盛份热腾腾又干净的菜！',
  guying: '高热量。尽快上菜。不废话。',
  huanyin: '整条长街都在传暮夜里的故事啦——上你们酒馆最拿手的招牌硬菜！',
  tongshu: '发条铁胃涩滞，需要滚烫油脂与烈性热肉润滑机件。',
  dashan: '大山……大山饿了，想吃热乎乎的大块肉肉……',
  baishi: '妙极了！请务必上一份辛烈浓菜，助我印证今夜秘药方！',
  jinlaoban: '净水生意刚谈完，端上你们酒馆最拿手的菜色试试成色。',
  wumingke: '风雪太大……在角落安静吃一碗热菜便走。',
  yanlao: '百年前这里曾是老城区最体面的大旅店……能请我尝一口昔日招牌风味吗？',
  kuangya: '哈哈哈！闻到香味了！拿最扎实的硬菜上来！',
  guancezhe: '十五夜星象正往酒馆汇聚——胡掌柜，来道拿手好菜让我尝尝今夜火候。',
};

const PREF_MAP: Record<string, MealId[]> = {
  cheap: ['spicy_skewer', 'hearty_stew'],
  stimulating: ['spicy_skewer', 'amber_egg_hash', 'abyss_marrow_pot'],
  mechanical: ['iron_steak', 'honey_glazed_ribs'],
  tactical: ['iron_steak', 'melted_cheese_roast', 'apocalypse_feast'],
  dark: ['abyss_marrow_pot', 'berry_meat_tart', 'apocalypse_feast'],
  mutant: ['berry_meat_tart', 'abyss_marrow_pot'],
  soup: ['hearty_stew', 'smoked_bone_broth', 'crimson_carrot_braise'],
  french: ['melted_cheese_roast', 'crimson_carrot_braise', 'apocalypse_feast'],
  premium: ['apocalypse_feast', 'abyss_marrow_pot', 'berry_meat_tart'],
  meat: ['iron_steak', 'honey_glazed_ribs', 'garlic_cold_cut'],
  cookie: ['garlic_cold_cut', 'amber_egg_hash'],
  plain: ['smoked_bone_broth', 'hearty_stew'],
};

function pickGuestMeal(run: RunState, vip: VipDef, forceTrend: boolean, candidates?: MealId[]): MealId {
  const pool = candidates && candidates.length > 0 ? candidates : run.diner.menu;
  const fallback = pool.length > 0 ? pool : run.diner.researched;
  if (forceTrend) {
    const tHit = fallback.find((id) => MEALS[id].tags.includes(run.diner.trendTag));
    if (tHit) return tHit;
  }
  const prefs = PREF_MAP[vip.preferredDishPref] ?? [];
  const prefHit = prefs.find((id) => fallback.includes(id));
  if (prefHit && rand(run) < 0.72) return prefHit;
  return fallback[Math.floor(rand(run) * fallback.length)] ?? 'spicy_skewer';
}

function rollPersonality(run: RunState, vip: VipDef): GuestPersonality {
  if (vip.personality.includes('急') || vip.id === 'guying') return 'hurried';
  if (vip.tier === 'gold' || vip.tier === 'platinum' || vip.tier === 'diamond') {
    const r = rand(run);
    if (r < 0.45) return 'gourmet';
    if (r < 0.7) return 'hurried';
    return 'regular';
  }
  const r = rand(run);
  if (r < 0.25) return 'hurried';
  if (r < 0.45) return 'drinker';
  if (r < 0.62) return 'gourmet';
  return 'regular';
}

function buildVipPool(run: RunState, count: number, excludeIds: Set<string>): VipDef[] {
  const unlocked = VIP_CUSTOMERS.filter((v) => v.unlockFans <= run.diner.fans);
  const chosen: VipDef[] = [];
  const usedIds = new Set(excludeIds);

  const unmet = unlocked.filter((v) => !usedIds.has(v.id) && !run.diner.metVips.includes(v.id));
  for (const v of unmet) {
    if (chosen.length >= Math.min(2, count)) break;
    chosen.push(v);
    usedIds.add(v.id);
  }
  while (chosen.length < count) {
    const pool = unlocked.filter((v) => !usedIds.has(v.id));
    const src = pool.length > 0 ? pool : VIP_CUSTOMERS.filter((v) => !usedIds.has(v.id));
    const fallback = src.length > 0 ? src : unlocked;
    if (fallback.length === 0) break;
    let roll = rand(run) * fallback.reduce((s, v) => s + v.weight, 0);
    let pick = fallback[0];
    for (const v of fallback) {
      roll -= v.weight;
      if (roll < 0) { pick = v; break; }
    }
    chosen.push(pick);
    usedIds.add(pick.id);
  }
  return chosen;
}

function activeParty(run: RunState) {
  return partyForDay(run.day).active;
}

function isPartyDish(run: RunState, dishId: MealId): boolean {
  const party = activeParty(run);
  return !!party && MEALS[dishId].tags.some((t) => party.tags.includes(t));
}

function computeDishPay(run: RunState, dishId: MealId, vip: VipDef, trendMatch: boolean, personality: GuestPersonality): number {
  const meal = MEALS[dishId];
  const repTier = getRepTier(run.diner.rep);
  const chefMul = run.cls === 'chef' ? 1.35 : 1;
  const lvMul = dishLevelPayMul(dishLevel(run, dishId));
  const gourmetMul = personality === 'gourmet' ? 1.25 : 1;
  const party = activeParty(run);
  const partyMul = party && meal.tags.some((t) => party.tags.includes(t)) ? party.payMul : 1;
  return Math.round(
    (meal.basePay * 0.72 + run.day * 0.6) * lvMul * chefMul * gourmetMul * partyMul
    * (0.85 + vip.tipBonus * 0.2) * (1 + repTier.bonusMul) * (trendMatch ? 1.35 : 1),
  );
}

/** 从今日菜单与库存中挑一道能做的菜：消耗 1 份备菜；若备菜见底且开启自动补货则自动补一锅；VIP特邀点菜可跨槽现做；全断货则返回 null */
function claimMenuServing(run: RunState, preferredId?: MealId, allowOffMenu = false): MealId | null {
  if (allowOffMenu && preferredId && run.diner.researched.includes(preferredId)) {
    const stock = run.diner.menuStock[preferredId] ?? 0;
    if (stock > 0) {
      run.diner.menuStock[preferredId] = stock - 1;
      return preferredId;
    }
    if (hasIngredients(run, MEALS[preferredId].cost)) {
      spendIngredients(run, MEALS[preferredId].cost);
      const batch = dishServings(run, preferredId);
      run.diner.menuStock[preferredId] = Math.max(0, batch - 1);
      return preferredId;
    }
  }
  const menuList = run.diner.menu.length > 0 ? run.diner.menu : ['spicy_skewer' as MealId];
  const order = preferredId && menuList.includes(preferredId)
    ? [preferredId, ...menuList.filter((id) => id !== preferredId)]
    : menuList;

  for (const id of order) {
    const stock = run.diner.menuStock[id] ?? 0;
    if (stock > 0) {
      run.diner.menuStock[id] = stock - 1;
      return id;
    }
    if (run.diner.autoSupply[id] && hasIngredients(run, MEALS[id].cost)) {
      spendIngredients(run, MEALS[id].cost);
      const batch = dishServings(run, id);
      run.diner.menuStock[id] = Math.max(0, batch - 1);
      return id;
    }
  }
  return null;
}

/** 桌前点单后进入后厨自动出菜队列 */
export function enqueueGuestOrder(run: RunState, g: DinerGuest) {
  if (g.orderKind !== 'dish' || g.served) return;
  if (run.dinerShift.kitchenOrders.some((o) => o.guestId === g.id)) return;
  if (run.dinerShift.counterDishes.some((c) => c.guestId === g.id)) return;
  if (run.carryingDish?.guestId === g.id) return;
  if (run.diner.hiredStaff.some((st) => st.carrying?.guestId === g.id)) return;

  const claimed = claimMenuServing(run, g.dish, !!g.isVipRequest);
  if (claimed) {
    if (claimed !== g.dish) {
      const vip = VIP_CUSTOMERS.find((v) => v.id === g.vipId) ?? VIP_CUSTOMERS[0];
      g.dish = claimed;
      g.dishName = MEALS[claimed].name;
      g.trendMatch = MEALS[claimed].tags.includes(run.diner.trendTag);
      g.isVipRequest = false;
      g.requestBonusCoins = undefined;
      g.pay = computeDishPay(run, claimed, vip, g.trendMatch, g.personality);
    }
    const m = MEALS[claimed];
    run.dinerShift.kitchenOrders.push({
      id: run.nextId++,
      guestId: g.id,
      dish: claimed,
      dishName: m.name,
      ticksLeft: m.cookTicks,
      totalTicks: m.cookTicks,
      sauceCost: m.sauceCost,
    });
  } else {
    g.isRye = true;
    g.isVipRequest = false;
    g.requestBonusCoins = undefined;
    g.dishName = RYE_FALLBACK.name;
    g.pay = RYE_FALLBACK.pay;
    g.trendMatch = false;
    g.orderQuote = '备菜全卖空了……只能先来块干硬黑麦饼垫垫肚子！';
    run.dinerShift.ryeCount++;
    run.dinerShift.kitchenOrders.push({
      id: run.nextId++,
      guestId: g.id,
      dish: 'rye',
      dishName: RYE_FALLBACK.name,
      ticksLeft: RYE_FALLBACK.cookTicks,
      totalTicks: RYE_FALLBACK.cookTicks,
      sauceCost: 0,
      isRye: true,
    });
  }
}

export function rollDinerGuests(run: RunState) {
  const chosen = buildVipPool(run, 3, new Set<string>());
  const seatOrder = [0, 1, 3];
  const guests: DinerGuest[] = chosen.map((vip, idx) => {
    const seatIdx = seatOrder[idx] ?? idx;
    const personality = rollPersonality(run, vip);
    const dishId = pickGuestMeal(run, vip, idx === 0, run.diner.menu);
    const meal = MEALS[dishId];
    const trendMatch = meal.tags.includes(run.diner.trendTag);
    const shortName = vip.name.includes('·') ? vip.name.split('·').pop()! : vip.name;
    const pay = computeDishPay(run, dishId, vip, trendMatch, personality);
    return {
      id: `${vip.id}_${run.day}_${idx}`,
      vipId: vip.id,
      tier: vip.tier,
      personality,
      name: shortName,
      role: vip.name.includes('·') ? vip.name.split('·')[0] : VIP_TIERS[vip.tier].name,
      sprite: vip.sprite,
      x: DINER_SEAT_X[seatIdx] ?? 266,
      seatIdx,
      targetX: DINER_SEAT_X[seatIdx] ?? 266,
      walkState: 'seated',
      facing: seatIdx % 2 === 0 ? 1 : -1,
      orderKind: 'dish',
      dish: dishId,
      dishName: meal.name,
      pay,
      trendMatch,
      orderQuote: VIP_ORDER_LINES[vip.id] ?? vip.bg,
      thanksQuote: vip.reactions.good,
      served: false,
      patience: 9999,
      maxPatience: 9999,
      eatT: 0,
    };
  });
  run.guests = guests;
}

export function spawnShiftGuest(run: RunState): DinerGuest | null {
  const occupied = new Set(run.guests.filter((g) => g.walkState !== 'leaving').map((g) => g.seatIdx));
  const dirty = new Set(run.dinerShift.dirtyTables.map((d) => d.seatIdx));
  const seats = [0, 1, 3, 2, 4, 5, 6, 7].slice(0, maxSeats(run));
  const seatIdx = seats.find((i) => !occupied.has(i) && !dirty.has(i));
  if (seatIdx === undefined) return null;

  const activeVips = new Set(run.guests.map((g) => g.vipId));
  const vip = buildVipPool(run, 1, activeVips)[0] ?? VIP_CUSTOMERS[0];
  const repTier = getRepTier(run.diner.rep);
  const personality = rollPersonality(run, vip);
  const patMul = (personality === 'hurried' ? 0.72 : personality === 'gourmet' ? 1.18 : 1)
    * (hasTavernUpgrade(run, 'warm_lantern') ? 1.28 : 1);
  const maxPatience = Math.round((1560 + rand(run) * 280) * patMul);

  const drinkChance = personality === 'drinker' ? 0.65 : 0.30;
  const hasVipReqAlready = run.guests.some((o) => o.isVipRequest);
  const wantVipReq = run.day >= 2 && !hasVipReqAlready && rand(run) < 0.45;
  const wantDrink = !wantVipReq && rand(run) < drinkChance;
  const shortName = vip.name.includes('·') ? vip.name.split('·').pop()! : vip.name;

  if (wantDrink) {
    const drinkId: DrinkId = rand(run) < 0.56 ? 'beer' : 'tea';
    const dDef = DRINKS[drinkId];
    const tapMul = hasTavernUpgrade(run, 'fast_tap') ? 1.25 : 1;
    const pay = Math.round(dDef.pay * (run.cls === 'chef' ? 1.25 : 1) * tapMul * (0.85 + vip.tipBonus * 0.2) * (1 + repTier.bonusMul));
    const g: DinerGuest = {
      id: `${vip.id}_rush_${run.nextId++}`,
      vipId: vip.id,
      tier: vip.tier,
      personality,
      name: shortName,
      role: vip.name.includes('·') ? vip.name.split('·')[0] : VIP_TIERS[vip.tier].name,
      sprite: vip.sprite,
      x: IN_STATIONS.door,
      seatIdx,
      targetX: DINER_SEAT_X[seatIdx] ?? 266,
      walkState: 'entering',
      facing: -1,
      orderKind: 'drink',
      dish: run.diner.menu[0] ?? 'spicy_skewer',
      drink: drinkId,
      dishName: dDef.name,
      pay,
      trendMatch: false,
      orderQuote: dDef.orderQuote,
      thanksQuote: vip.reactions.good,
      served: false,
      patience: maxPatience,
      maxPatience,
      eatT: 0,
    };
    run.guests.push(g);
    return g;
  }

  let dishId = pickGuestMeal(run, vip, rand(run) < 0.4, run.diner.menu);
  let isVipRequest = false;
  let requestBonusCoins: number | undefined;
  if (wantVipReq) {
    const readyResearched = run.diner.researched.filter(
      (id) => (run.diner.menuStock[id] ?? 0) > 0 || hasIngredients(run, MEALS[id].cost),
    );
    const sigPool = readyResearched.filter((id) => !MEALS[id].defaultUnlocked);
    const vipPool = sigPool.length > 0 ? sigPool : readyResearched;
    if (vipPool.length > 0) {
      dishId = pickGuestMeal(run, vip, false, vipPool);
      isVipRequest = true;
      requestBonusCoins = Math.round(MEALS[dishId].basePay * 0.45);
    }
  }
  const meal = MEALS[dishId];
  const trendMatch = meal.tags.includes(run.diner.trendTag);
  const pay = computeDishPay(run, dishId, vip, trendMatch, personality);
  const g: DinerGuest = {
    id: `${vip.id}_rush_${run.nextId++}`,
    vipId: vip.id,
    tier: vip.tier,
    personality,
    name: shortName,
    role: vip.name.includes('·') ? vip.name.split('·')[0] : VIP_TIERS[vip.tier].name,
    sprite: vip.sprite,
    x: IN_STATIONS.door,
    seatIdx,
    targetX: DINER_SEAT_X[seatIdx] ?? 266,
    walkState: 'entering',
    facing: -1,
    orderKind: 'dish',
    dish: dishId,
    dishName: meal.name,
    pay,
    trendMatch,
    isVipRequest,
    requestBonusCoins,
    orderQuote: isVipRequest
      ? `特邀点名：请为我端来【${meal.name}】，赶在耐心过半前必有厚赏与炉火灵感！`
      : (VIP_ORDER_LINES[vip.id] ?? vip.bg),
    thanksQuote: vip.reactions.good,
    served: false,
    patience: maxPatience,
    maxPatience,
    eatT: 0,
  };
  run.guests.push(g);
  return g;
}

export function startShiftCmd(run: RunState, ev: GameEvent[]): GameEvent[] | null {
  if (run.phase !== 'camp' || !run.inside || run.dinerShift.mode === 'open') return null;
  if (run.diner.menu.length === 0) run.diner.menu = [run.diner.researched[0] ?? 'spicy_skewer'];
  const duration = (hasTavernUpgrade(run, 'warm_lantern') ? 55 : 45) * 60;
  const baseMaxP = Math.round(1620 * (hasTavernUpgrade(run, 'warm_lantern') ? 1.28 : 1));
  const keepSpiceSpent = run.dinerShift.spiceSpentCoins ?? 0;

  run.carryingDish = null;
  run.pourMinigame = null;
  run.carryingDrink = null;
  run.dinerShift = makeIdleShift(keepSpiceSpent);
  run.dinerShift.mode = 'open';
  run.dinerShift.timer = duration;
  run.dinerShift.duration = duration;
  run.dinerShift.spawnCd = 95;
  for (const st of run.diner.hiredStaff) {
    st.carrying = null;
    st.targetId = null;
    st.task = 'idle';
    st.taskT = 0;
  }

  run.guests = run.guests
    .filter((g) => !g.served && g.walkState !== 'leaving')
    .map((g) => {
      const mul = g.personality === 'hurried' ? 0.72 : g.personality === 'gourmet' ? 1.18 : 1;
      const maxP = Math.round(baseMaxP * mul);
      return { ...g, walkState: 'seated' as const, maxPatience: maxP, patience: maxP, eatT: 0 };
    });

  for (const g of run.guests) {
    if (g.orderKind === 'dish' && !g.served && g.walkState === 'seated') {
      enqueueGuestOrder(run, g);
    }
  }
  if (run.guests.length < 3) spawnShiftGuest(run);
  ev.push({ t: 'shiftOpen', duration });
  return ev;
}

export function finishShiftToSummary(run: RunState, ev: GameEvent[]) {
  const s = run.dinerShift;
  if (s.mode !== 'open') return;
  s.mode = 'summary';
  s.timer = 0;
  run.pourMinigame = null;
  run.carryingDish = null;
  run.carryingDrink = null;
  s.kitchenOrders = [];
  for (const st of run.diner.hiredStaff) {
    st.carrying = null;
    st.targetId = null;
    st.task = 'idle';
    st.taskT = 0;
  }
  run.guests = run.guests.filter((g) => g.walkState === 'seated' && !g.angry);

  const realServed = Math.max(0, s.servedCount - s.ryeCount);
  const rawRating = 2.4
    + Math.min(2.1, realServed * 0.34 + s.bestCombo * 0.06)
    + (run.diner.bestTaste >= 140 ? 0.3 : 0)
    - s.ryeCount * 0.45
    - s.lostCount * 0.55
    - s.dirtyTables.length * 0.12;
  const rating = Math.round(Math.max(1.0, Math.min(5.0, rawRating)) * 10) / 10;
  const flameEarned = Math.max(2, Math.round(rating * 1.4) + (realServed >= 4 ? 1 : 0));
  run.diner.flame += flameEarned;

  const activeWage = run.diner.hiredStaff
    .filter((st) => st.role !== 'rest')
    .reduce((sum, st) => sum + (staffDef(st.id)?.dailyWage ?? 14), 0);
  const rankIdx = Math.max(0, FANS_RANKS.findIndex((r) => r.grade === dinerRank(run).cur.grade));
  const upkeepCost = run.day >= 2 ? 4 + rankIdx * 3 + run.diner.rackLevel * 2 : 0;
  const paidExpense = Math.min(run.coins, activeWage + upkeepCost);
  run.coins -= paidExpense;

  const partyBonusCoins = s.partyBonusCoins ?? 0;
  const drinkCoins = Math.round(s.drinkCount * 15);
  const dishCoins = Math.max(0, s.coinsEarned - drinkCoins - partyBonusCoins);
  const netProfit = s.coinsEarned + s.tipsEarned - s.spiceSpentCoins - activeWage - upkeepCost;
  s.report = {
    dishCoins,
    drinkCoins,
    tipsCoins: s.tipsEarned,
    partyBonusCoins,
    spiceExpense: s.spiceSpentCoins,
    staffWages: activeWage,
    upkeepCost,
    ryePenaltyCount: s.ryeCount,
    angryCount: s.lostCount,
    dirtyLeftCount: s.dirtyTables.length,
    rating,
    flameEarned,
    netProfit,
  };

  ev.push({
    t: 'shiftEnd',
    served: s.servedCount,
    coins: s.coinsEarned,
    tips: s.tipsEarned,
    fans: s.fansEarned,
    bestCombo: s.bestCombo,
    rating,
    flameEarned,
  });
}

export function stepTavernShift(run: RunState, ev: GameEvent[]) {
  if (!run.inside) return;

  if (run.pourMinigame) {
    run.pourMinigame.fill += run.pourMinigame.speed;
    if (run.pourMinigame.fill >= 1.04) {
      const pour = run.pourMinigame;
      run.pourMinigame = null;
      run.carryingDrink = { drink: pour.drink, guestId: pour.guestId, quality: 'poor' };
      ev.push({ t: 'pourDone', drink: pour.drink, quality: 'poor' });
    }
  }

  const s = run.dinerShift;
  if (s.mode !== 'open') return;

  // ── 1. 后厨自动出菜 & 辣酱消耗（辣酱耗尽则非黑麦饼订单卡单，直到玩家/自动磨酱手去石臼磨酱）──
  const cap = passCounterCapacity(run);
  const stoveSlots = stoveCapacity(run);
  const linCook = hasAlly(run, 'lin') && allyRole(run, 'lin') === 'kitchen';
  const cookStaff = run.diner.hiredStaff.filter((st) => st.role === 'kitchen');
  const fastCookBonus = cookStaff.reduce((sum, st) => sum + 0.22 + (staffHasSkill(st, 'fast_cook') ? 0.18 : 0), 0);
  const hasExtraPlate = cookStaff.some((st) => staffHasSkill(st, 'extra_plate'));
  const speedMul = (linCook ? 1.25 : 1) * (1 + fastCookBonus) * (run.cls === 'chef' ? 1.15 : 1);

  if (s.kitchenOrders.length > 0 && s.counterDishes.length < cap) {
    const active = s.kitchenOrders.slice(0, stoveSlots);
    const doneIds = new Set<number>();
    for (const order of active) {
      const needsSauce = !order.isRye && order.sauceCost > 0;
      if (needsSauce && s.sauce <= 0) {
        if (!s.sauceStalled) {
          s.sauceStalled = true;
          ev.push({ t: 'sauceEmpty' });
        }
        continue;
      }
      if (needsSauce) {
        const drain = (order.sauceCost / Math.max(1, order.totalTicks)) * speedMul;
        s.sauce = Math.max(0, s.sauce - drain);
        if (s.sauce <= 0 && !s.sauceStalled) {
          s.sauceStalled = true;
          ev.push({ t: 'sauceEmpty' });
        }
      }
      order.ticksLeft -= speedMul;
      if (order.ticksLeft <= 0 && s.counterDishes.length < cap) {
        const quality: DishQuality = order.isRye ? 'poor' : linCook || cookStaff.length > 0 || run.cls === 'chef' ? 'perfect' : 'good';
        const cDish: CounterDish = {
          id: run.nextId++,
          guestId: order.guestId,
          dish: order.dish,
          dishName: order.dishName,
          quality,
          isRye: order.isRye,
        };
        s.counterDishes.push(cDish);
        doneIds.add(order.id);
        ev.push({ t: 'kitchenDone', dish: order.dish, dishName: order.dishName, isRye: order.isRye });

        if (!order.isRye && hasExtraPlate && s.counterDishes.length < cap && rand(run) < 0.28) {
          const otherWaiting = run.guests.find(
            (og) => og.orderKind === 'dish' && !og.served && og.walkState === 'seated'
              && og.id !== order.guestId
              && !s.counterDishes.some((c) => c.guestId === og.id)
              && run.carryingDish?.guestId !== og.id
              && !run.diner.hiredStaff.some((st) => st.carrying?.guestId === og.id),
          );
          if (otherWaiting) {
            s.counterDishes.push({
              id: run.nextId++,
              guestId: otherWaiting.id,
              dish: order.dish,
              dishName: order.dishName,
              quality: 'perfect',
            });
            ev.push({ t: 'kitchenDone', dish: order.dish, dishName: order.dishName, extraPlate: true });
          }
        }
      }
    }
    if (doneIds.size > 0) {
      s.kitchenOrders = s.kitchenOrders.filter((o) => !doneIds.has(o.id));
    }
  }

  // ── 2. 客人进店、点单、耐心计时与用餐离席 ──
  const walkSpeed = hasTavernUpgrade(run, 'wide_pass') ? 1.15 : 0.92;
  const zhaoFloor = hasAlly(run, 'zhao') && allyRole(run, 'zhao') === 'floor';
  const drainMul = (hasTavernUpgrade(run, 'warm_lantern') ? 0.72 : 1) * (zhaoFloor ? 0.85 : 1) * (s.sauceStalled ? 1.25 : 1);
  const nextGuests: DinerGuest[] = [];

  for (const g of run.guests) {
    if (g.walkState === 'entering') {
      const d = g.targetX - g.x;
      if (Math.abs(d) <= 1.5) {
        g.x = g.targetX;
        g.walkState = 'seated';
        g.facing = g.seatIdx % 2 === 0 ? 1 : -1;
        if (g.orderKind === 'dish') enqueueGuestOrder(run, g);
      } else {
        const vx = Math.sign(d) * Math.min(walkSpeed, Math.abs(d));
        g.x += vx;
        g.facing = vx >= 0 ? 1 : -1;
      }
      nextGuests.push(g);
      continue;
    }

    if (g.walkState === 'leaving') {
      const d = g.targetX - g.x;
      if (Math.abs(d) <= 4) continue;
      const vx = Math.sign(d) * Math.min(1.2, Math.abs(d));
      g.x += vx;
      g.facing = vx >= 0 ? 1 : -1;
      nextGuests.push(g);
      continue;
    }

    if (!g.served) {
      g.patience -= drainMul;
      if (g.patience <= 0) {
        g.patience = 0;
        g.angry = true;
        g.walkState = 'leaving';
        g.targetX = IN_STATIONS.door;
        g.facing = 1;
        s.kitchenOrders = s.kitchenOrders.filter((o) => o.guestId !== g.id);
        s.counterDishes = s.counterDishes.filter((c) => c.guestId !== g.id);
        if (run.carryingDish?.guestId === g.id) run.carryingDish = null;
        if (run.carryingDrink?.guestId === g.id) run.carryingDrink.guestId = null;
        for (const st of run.diner.hiredStaff) {
          if (st.carrying?.guestId === g.id) { st.carrying = null; st.targetId = null; }
        }
        s.lostCount++;
        s.combo = 0;
        run.diner.rep = Math.max(0, run.diner.rep - (g.personality === 'gourmet' ? 2 : 1));
        ev.push({ t: 'guestAngry', guestId: g.id, name: g.name });
      }
      nextGuests.push(g);
      continue;
    }

    if (g.eatT > 0) {
      g.eatT--;
      if (g.eatT <= 0) {
        s.dirtyTables.push({
          id: run.nextId++,
          seatIdx: g.seatIdx,
          x: DINER_PLATE_X[g.seatIdx] ?? g.x,
          createdTick: run.tick,
        });
        g.walkState = 'leaving';
        g.targetX = IN_STATIONS.door;
        g.facing = 1;
      }
    }
    nextGuests.push(g);
  }
  run.guests = nextGuests;

  const activeCount = run.guests.filter((g) => g.walkState !== 'leaving').length;
  const seatCap = maxSeats(run);
  if (s.timer > 180 && activeCount + s.dirtyTables.length < seatCap) {
    if (s.spawnCd > 0) s.spawnCd--;
    if (s.spawnCd <= 0) {
      spawnShiftGuest(run);
      s.spawnCd = (seatCap >= 6 ? 128 : 165) + Math.floor(rand(run) * 65);
    }
  }

  if (--s.timer <= 0) {
    finishShiftToSummary(run, ev);
  }
}

export function completeServeGuest(
  run: RunState,
  g: DinerGuest,
  quality: DishQuality,
  ev: GameEvent[],
  spendFallbackMeat: boolean,
  isDrink = false,
  isRyeOverride?: boolean,
) {
  const isRye = !!(isRyeOverride ?? g.isRye);
  const qMeta = QUALITY_META[quality];
  const vip = VIP_CUSTOMERS.find((v) => v.id === g.vipId);
  if (spendFallbackMeat && !isRye) {
    const cost = MEALS[g.dish].cost;
    if (hasIngredients(run, cost)) spendIngredients(run, cost);
    else if ((run.diner.menuStock[g.dish] ?? 0) > 0) run.diner.menuStock[g.dish]! -= 1;
  }

  g.served = true;
  g.qualityServed = quality;
  g.reactionQuote = isRye
    ? '这干硬黑麦饼啃得牙酸……明夜记得多备些热菜啊！'
    : vip?.reactions[quality] ?? g.thanksQuote;

  const isRush = run.dinerShift.mode === 'open';
  g.eatT = isRush ? 180 : 0;

  let comboTip = 0;
  let vipRequestClear = false;
  if (isRush) {
    if (isRye) {
      run.dinerShift.combo = 0;
    } else {
      run.dinerShift.combo++;
      run.dinerShift.bestCombo = Math.max(run.dinerShift.bestCombo, run.dinerShift.combo);
      comboTip = Math.min(20, (run.dinerShift.combo - 1) * 3);
      if (g.personality === 'hurried' && g.patience >= g.maxPatience * 0.45) {
        comboTip += Math.max(4, Math.round(g.pay * 0.25));
      }
      if (g.personality === 'drinker' && isDrink && (quality === 'perfect' || quality === 'legendary')) {
        comboTip += 5;
      }
      if (g.isVipRequest && g.patience >= g.maxPatience * 0.45) {
        vipRequestClear = true;
        comboTip += g.requestBonusCoins ?? Math.round(g.pay * 0.4);
        run.diner.flame += 2;
      }
    }
  } else if (g.isVipRequest && !isRye) {
    vipRequestClear = true;
    comboTip += g.requestBonusCoins ?? Math.round(g.pay * 0.4);
    run.diner.flame += 2;
  }

  const beforeRank = dinerRank(run).cur.grade;
  const party = activeParty(run);
  const partyMatch = !isRye && !isDrink && isPartyDish(run, g.dish);
  const baseCoins = isRye ? RYE_FALLBACK.pay : Math.round(g.pay * qMeta.payMul);
  const partyBonusPart = partyMatch && party ? Math.round(baseCoins * (1 - 1 / party.payMul)) : 0;
  const finalCoins = baseCoins + comboTip;
  const zhaoMul = hasAlly(run, 'zhao') && allyRole(run, 'zhao') === 'floor' ? 1.3 : 1;
  const chefFans = run.cls === 'chef' ? 1.25 : 1;
  const trendFans = g.trendMatch ? 2 : 1;
  const partyFansMul = partyMatch && party ? party.fansMul : 1;
  const tierFans = g.tier === 'bronze' ? 1 : g.tier === 'silver' ? 1.2 : g.tier === 'gold' ? 1.4 : g.tier === 'platinum' ? 1.7 : 2.1;
  const drinkDef = isDrink && g.drink ? DRINKS[g.drink] : null;
  const gourmetFans = !isRye && g.personality === 'gourmet' ? 5 : 0;
  const fansGain = isRye
    ? 0
    : drinkDef
      ? Math.round(drinkDef.fans * qMeta.payMul * zhaoMul * chefFans * tierFans)
      : Math.round(qMeta.fans * trendFans * partyFansMul * zhaoMul * chefFans * tierFans) + gourmetFans;
  const repDelta = isRye
    ? (g.personality === 'gourmet' ? -2 : RYE_FALLBACK.rep)
    : drinkDef
      ? drinkDef.rep + (quality === 'legendary' ? 1 : 0)
      : qMeta.rep + (g.trendMatch ? 1 : 0) + (vipRequestClear ? 1 : 0);

  run.coins += finalCoins;
  run.diner.fans += fansGain;
  run.diner.rep = Math.max(0, run.diner.rep + repDelta);
  run.diner.servedTotal++;
  if (isRush) {
    run.dinerShift.servedCount++;
    if (isDrink) run.dinerShift.drinkCount++;
    run.dinerShift.coinsEarned += baseCoins;
    run.dinerShift.tipsEarned += comboTip;
    run.dinerShift.partyBonusCoins = (run.dinerShift.partyBonusCoins ?? 0) + partyBonusPart;
    run.dinerShift.fansEarned += fansGain;
  }

  const firstMeet = !run.diner.metVips.includes(g.vipId);
  if (firstMeet) run.diner.metVips.push(g.vipId);

  const pool = DINER_REVIEW_POOL[quality];
  const revText = isRye
    ? '今夜酒馆菜单卖断了，只啃到干硬黑麦饼……掌柜明日快多备热菜啊！'
    : vipRequestClear
      ? `点名的【${g.dishName}】趁热送到了！掌柜实在靠谱，额外奉上炉火心得！`
      : pool[Math.floor(rand(run) * pool.length)] ?? g.reactionQuote;
  run.diner.reviews.unshift({
    id: run.nextId++,
    author: g.name,
    tierName: VIP_TIERS[g.tier].name,
    dishName: isRye ? RYE_FALLBACK.name : g.dishName,
    quality,
    text: revText,
    fansDelta: fansGain,
  });
  if (run.diner.reviews.length > 12) run.diner.reviews.length = 12;

  const allServed = !isRush && run.guests.length > 0 && run.guests.every((o) => o.served);
  let totalCoins = finalCoins;
  if (allServed) {
    const tip = run.cls === 'chef' ? 28 : 18;
    run.coins += tip;
    totalCoins += tip;
    run.diner.fans += 8;
    run.diner.rep += 1;
    run.player.hp = Math.min(run.player.maxHp, run.player.hp + 15);
  }

  const afterRank = dinerRank(run).cur;
  const rankUp = afterRank.grade !== beforeRank ? `${afterRank.grade}级·${afterRank.name}` : undefined;
  if (rankUp) {
    run.coins += 25;
    run.spice += 2;
  }
  ev.push({
    t: 'serve', guestId: g.id, vipId: g.vipId, name: g.name, dishName: isRye ? RYE_FALLBACK.name : g.dishName,
    quality, coins: totalCoins, fans: fansGain + (allServed ? 8 : 0), rep: repDelta + (allServed ? 1 : 0),
    quote: g.reactionQuote, allServed, firstMeet, trendMatch: g.trendMatch, partyMatch, vipRequestClear, rankUp, isRye,
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
}

function grantRankUpSupply(run: RunState, beforeGrade: string, ev: GameEvent[]): string | undefined {
  const after = dinerRank(run).cur;
  if (after.grade === beforeGrade) return undefined;
  run.coins += 25;
  run.spice += 2;
  const label = `${after.grade}级·${after.name}`;
  ev.push({ t: 'shop', item: `晋升 ${label} (+25金/+2香料)` });
  return label;
}

export function researchDishCmd(run: RunState, id: MealId, ev: GameEvent[]): GameEvent[] | null {
  if (run.phase !== 'camp') return null;
  const m = MEALS[id];
  if (!m || run.diner.researched.includes(id)) return null;
  const rCost = dishResearchCost(run, id);
  if (run.diner.flame < rCost) return null;
  const beforeGrade = dinerRank(run).cur.grade;
  run.diner.flame -= rCost;
  run.diner.researched.push(id);
  if (!run.diner.dishLevels[id]) run.diner.dishLevels[id] = 1;
  if (run.diner.menu.length < maxMenuSlots(run) && !run.diner.menu.includes(id)) {
    run.diner.menu.push(id);
  }
  recalcBestTaste(run);
  ev.push({ t: 'research', id, flameLeft: run.diner.flame });
  grantRankUpSupply(run, beforeGrade, ev);
  return ev;
}

export function upgradeDishCmd(run: RunState, id: MealId, ev: GameEvent[]): GameEvent[] | null {
  if (run.phase !== 'camp' || !run.diner.researched.includes(id)) return null;
  const m = MEALS[id];
  if (!m) return null;
  const lv = dishLevel(run, id);
  if (lv >= MAX_DISH_LV) return null;
  const coinCost = dishUpgradeCost(id, lv);
  const meatCost = dishEnhanceMeatCost(id, lv);
  if (run.coins < coinCost || !hasIngredients(run, meatCost)) return null;
  const beforeGrade = dinerRank(run).cur.grade;
  run.coins -= coinCost;
  spendIngredients(run, meatCost);
  run.diner.dishLevels[id] = lv + 1;
  recalcBestTaste(run);
  for (const g of run.guests) {
    if (!g.served && !g.isRye && g.orderKind === 'dish' && g.dish === id) {
      g.pay = Math.round((g.pay * dishLevelPayMul(lv + 1)) / dishLevelPayMul(lv));
    }
  }
  ev.push({ t: 'shop', item: `${m.name} Lv.${lv + 1}` });
  grantRankUpSupply(run, beforeGrade, ev);
  return ev;
}

export function toggleMenuDishCmd(run: RunState, id: MealId, ev: GameEvent[]): GameEvent[] | null {
  if (!run.diner.researched.includes(id)) return null;
  const idx = run.diner.menu.indexOf(id);
  if (idx >= 0) {
    if (run.diner.menu.length <= 1) return null;
    run.diner.menu.splice(idx, 1);
  } else {
    if (run.diner.menu.length >= maxMenuSlots(run)) return null;
    run.diner.menu.push(id);
  }
  return ev;
}

export function toggleAutoSupplyCmd(run: RunState, id: MealId, ev: GameEvent[]): GameEvent[] | null {
  if (!run.diner.researched.includes(id)) return null;
  run.diner.autoSupply[id] = !run.diner.autoSupply[id];
  return ev;
}

export function prepDishCmd(run: RunState, id: MealId, batchesRaw: number | undefined, ev: GameEvent[]): GameEvent[] | null {
  if (run.phase !== 'camp' || !run.diner.researched.includes(id)) return null;
  const batches = Math.max(1, Math.floor(batchesRaw ?? 1));
  const m = MEALS[id];
  let added = 0;
  for (let i = 0; i < batches; i++) {
    if (!hasIngredients(run, m.cost)) break;
    spendIngredients(run, m.cost);
    const inc = dishServings(run, id);
    run.diner.menuStock[id] = Math.min(99, (run.diner.menuStock[id] ?? 0) + inc);
    added += inc;
  }
  if (added <= 0) return null;
  ev.push({ t: 'prepDish', id, servingsAdded: added });
  return ev;
}

export function buySpiceCmd(run: RunState, countRaw: number | undefined, ev: GameEvent[]): GameEvent[] | null {
  if (run.phase !== 'camp') return null;
  const count = Math.max(1, Math.floor(countRaw ?? 1));
  const totalCost = count * SPICE_BUY_COST;
  if (run.coins < totalCost) return null;
  run.coins -= totalCost;
  run.spice += count;
  run.dinerShift.spiceSpentCoins += totalCost;
  ev.push({ t: 'shop', item: `秘酿香料 ×${count}` });
  return ev;
}

export function sellMeatKindCmd(run: RunState, kind: MeatKind, count: number, ev: GameEvent[]): GameEvent[] | null {
  const n = Math.min(run.meats[kind] ?? 0, Math.max(0, Math.floor(count)));
  if (n <= 0) return null;
  const earned = n * meatPrice(run.cls, kind);
  run.meats[kind] -= n;
  run.coins += earned;
  ev.push({ t: 'cook', meat: n, coins: earned });
  return ev;
}

export function grindMortarCmd(run: RunState, ev: GameEvent[]): GameEvent[] | null {
  if (run.phase !== 'camp' || !run.inside || run.dinerShift.mode !== 'open') return null;
  const s = run.dinerShift;
  if (s.sauce >= s.maxSauce) return null;
  s.sauce = Math.min(s.maxSauce, s.sauce + 65);
  s.sauceStalled = false;
  ev.push({ t: 'grindSauce', sauce: Math.round(s.sauce) });
  return ev;
}

const GRADE_ORDER: readonly string[] = ['E', 'D', 'C', 'B', 'A', 'S'];

export function rollApplicants(run: RunState, tier?: AdTierId | null) {
  const rankIdx = Math.max(0, GRADE_ORDER.indexOf(dinerRank(run).cur.grade));
  const boostIdx = tier ? Math.max(rankIdx, AD_TIERS[tier].maxGradeIdx) : Math.max(rankIdx, run.day >= 3 ? 1 : 0);
  const owned = new Set(run.diner.hiredStaff.map((s) => s.id));
  const candidates = STAFF_POOL.filter((def) => {
    if (owned.has(def.id)) return false;
    return GRADE_ORDER.indexOf(def.unlockGrade) <= boostIdx;
  });
  const pool = [...candidates];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand(run) * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const ad = tier ? AD_TIERS[tier] : null;
  const count = ad ? ad.count : 2;
  const startLevel = ad ? ad.minLv : 1;
  run.diner.applicants = pool.slice(0, count).map((d) => ({ id: d.id, startLevel }));
}

export function postRecruitmentCmd(run: RunState, tier: AdTierId, ev: GameEvent[]): GameEvent[] | null {
  if (run.phase !== 'camp') return null;
  const ad = AD_TIERS[tier];
  if (!ad || run.coins < ad.cost) return null;
  run.coins -= ad.cost;
  run.diner.adTier = tier;
  rollApplicants(run, tier);
  ev.push({ t: 'shop', item: `${ad.name} · 应聘已更新` });
  return ev;
}

export function hireStaffCmd(run: RunState, id: string, ev: GameEvent[]): GameEvent[] | null {
  if (run.phase !== 'camp') return null;
  const def = staffDef(id);
  if (!def) return null;
  if (run.diner.hiredStaff.some((s) => s.id === id)) return null;
  if (run.diner.hiredStaff.length >= maxStaffSlots(run)) return null;
  if (run.coins < def.hireCost) return null;
  const app = run.diner.applicants.find((a) => a.id === id);
  if (!app) return null;

  run.coins -= def.hireCost;
  run.diner.applicants = run.diner.applicants.filter((a) => a.id !== id);
  const idx = run.diner.hiredStaff.length;
  const startX = def.specialty === 'kitchen' ? IN_STATIONS.kitchen + 22 + idx * 8 : 220 + idx * 14;
  run.diner.hiredStaff.push({
    id,
    level: Math.max(1, Math.min(MAX_STAFF_LV, app.startLevel)),
    role: def.specialty,
    x: Math.min(IN_MAX_X, Math.max(IN_MIN_X, startX)),
    vx: 0,
    facing: -1,
    task: 'idle',
    taskT: 0,
    targetId: null,
    carrying: null,
  });
  ev.push({ t: 'shop', item: `聘请 · ${def.name}` });
  return ev;
}

export function setStaffRoleCmd(run: RunState, id: string, role: StaffRole, ev: GameEvent[]): GameEvent[] | null {
  if (run.phase !== 'camp') return null;
  const st = run.diner.hiredStaff.find((s) => s.id === id);
  if (!st) return null;
  st.role = role;
  st.task = 'idle';
  st.taskT = 0;
  st.targetId = null;
  st.carrying = null;
  return ev;
}

export function trainStaffCmd(run: RunState, id: string, ev: GameEvent[]): GameEvent[] | null {
  if (run.phase !== 'camp') return null;
  const st = run.diner.hiredStaff.find((s) => s.id === id);
  const def = staffDef(id);
  if (!st || !def || st.level >= MAX_STAFF_LV) return null;
  const cost = STAFF_TRAIN_COST[st.level] ?? 999;
  if (run.coins < cost) return null;
  run.coins -= cost;
  st.level++;
  ev.push({ t: 'shop', item: `${def.name} Lv.${st.level}` });
  return ev;
}

export function setAllyRoleCmd(run: RunState, ally: AllyId, role: StaffRole, ev: GameEvent[]): GameEvent[] | null {
  if (run.phase !== 'camp' || !run.story.allies.includes(ally)) return null;
  if (!run.diner.allyRoles) run.diner.allyRoles = {};
  run.diner.allyRoles[ally] = role;
  const rt = run.allies[ally];
  if (rt) {
    rt.staffTask = 'idle';
    rt.staffT = 0;
    rt.staffGuestId = undefined;
  }
  return ev;
}

export function upgradeRackCmd(run: RunState, ev: GameEvent[]): GameEvent[] | null {
  if (run.phase !== 'camp' || run.day < 4) return null;
  if (run.diner.rackLevel >= MAX_RACK_LEVEL) return null;
  const next = RACK_LEVELS[run.diner.rackLevel];
  if (!next || run.coins < next.cost) return null;
  run.coins -= next.cost;
  run.diner.rackLevel = next.level;
  ev.push({ t: 'shop', item: next.name });
  return ev;
}

export function resolveNightPrepAndDispatch(run: RunState, ev: GameEvent[]) {
  // 1. 结算外出派遣（招募伙计 + 助战战友）
  let spiceGain = 0;
  const meatGain: MeatInventory = { tender: 0, thick: 0, essence: 0 };
  const names: string[] = [];

  for (const st of run.diner.hiredStaff) {
    if (st.role !== 'dispatch') continue;
    const def = staffDef(st.id);
    if (def) names.push(def.name);
    const hasHaul = staffHasSkill(st, 'spice_haul');
    spiceGain += hasHaul ? 4 : 2;
    meatGain.tender += 1 + Math.floor(st.level / 2);
    if (run.day >= 4 || hasHaul) meatGain.thick += hasHaul ? 2 : 1;
    if (hasHaul && run.day >= 6) meatGain.essence += 1;
  }
  for (const allyId of run.story.allies) {
    if (allyRole(run, allyId) !== 'dispatch') continue;
    spiceGain += 1;
    meatGain.tender += 1;
    if (run.day >= 5) meatGain.thick += 1;
    names.push(allyId === 'zhang' ? '老张' : allyId === 'lin' ? '小林' : allyId === 'qiang' ? '阿强' : '小赵');
  }

  if (names.length > 0) {
    run.spice += spiceGain;
    run.meats.tender += meatGain.tender;
    run.meats.thick += meatGain.thick;
    run.meats.essence += meatGain.essence;
    const parts: string[] = [];
    if (spiceGain > 0) parts.push(`香料+${spiceGain}`);
    if (meatGain.tender > 0) parts.push(`嫩肉+${meatGain.tender}`);
    if (meatGain.thick > 0) parts.push(`厚肉+${meatGain.thick}`);
    if (meatGain.essence > 0) parts.push(`魔髓+${meatGain.essence}`);
    const log = `${names.join('、')}派遣归来：${parts.join(' · ')}`;
    run.diner.lastDispatchLog = log;
    ev.push({ t: 'dispatchReturn', log, spice: spiceGain, meats: meatGain });
  } else {
    run.diner.lastDispatchLog = '';
  }

  // 2. 结算后院贮肉架日产出（第 4 日起）
  if (run.day >= 4 && run.diner.rackLevel >= 1) {
    const rk = RACK_LEVELS[Math.min(MAX_RACK_LEVEL, run.diner.rackLevel) - 1];
    if (rk) {
      run.meats.tender += rk.tender;
      run.meats.thick += rk.thick;
      run.meats.essence += rk.essence;
      ev.push({ t: 'rackHarvest', tender: rk.tender, thick: rk.thick, essence: rk.essence });
    }
  }

  // 3. 刷新招工名单 & 检查今夜派对
  if (run.day >= 2 || run.diner.adTier) {
    rollApplicants(run, run.diner.adTier);
    run.diner.adTier = null;
  }
  const pInfo = partyForDay(run.day);
  if (pInfo.active) {
    ev.push({ t: 'partyStart', partyId: pInfo.active.id, name: pInfo.active.name });
  }
}

function stepStaffMoveTo(st: HiredStaffState, targetX: number, speed: number, restFacing: 1 | -1): boolean {
  const gx = Math.max(IN_MIN_X, Math.min(IN_MAX_X, targetX));
  const d = gx - st.x;
  const tol = Math.abs(st.vx) > 0.05 ? 4 : 8;
  if (Math.abs(d) > tol) {
    st.vx = Math.sign(d) * Math.min(speed, Math.abs(d));
    st.x = Math.max(IN_MIN_X, Math.min(IN_MAX_X, st.x + st.vx));
    st.facing = st.vx >= 0 ? 1 : -1;
    return false;
  }
  st.vx = 0;
  st.facing = restFacing;
  return true;
}

export function stepStaffCamp(run: RunState, ev: GameEvent[]) {
  const inside = run.inside;
  const rush = inside && run.dinerShift.mode === 'open';
  const s = run.dinerShift;

  const claimedPlates = new Set<number>();
  const claimedGuests = new Set<string>();
  const claimedCounter = new Set<number>();
  if (run.carryingDish?.guestId) claimedGuests.add(run.carryingDish.guestId);
  for (const st of run.diner.hiredStaff) {
    if (st.carrying?.guestId) claimedGuests.add(st.carrying.guestId);
    if (typeof st.targetId === 'number') {
      if (st.task === 'clean') claimedPlates.add(st.targetId);
      else if (st.task === 'serve') claimedCounter.add(st.targetId);
    } else if (typeof st.targetId === 'string' && st.targetId.startsWith('drink:')) {
      claimedGuests.add(st.targetId.slice(6));
    }
  }

  for (let idx = 0; idx < run.diner.hiredStaff.length; idx++) {
    const st = run.diner.hiredStaff[idx];
    const def = staffDef(st.id);
    if (!def) continue;

    if (!inside || !rush) {
      st.carrying = null;
      st.targetId = null;
      st.taskT = 0;
      if (st.role === 'dispatch' || !inside) {
        st.vx = 0;
        st.task = 'idle';
        continue;
      }
      const restX = st.role === 'kitchen'
        ? Math.max(IN_MIN_X + 10, IN_STATIONS.kitchen - 16 - idx * 8)
        : st.role === 'rest'
          ? IN_STATIONS.kitchen - 24
          : 215 + idx * 14;
      st.task = 'idle';
      stepStaffMoveTo(st, restX, 0.7, st.role === 'kitchen' ? 1 : -1);
      continue;
    }

    if (st.role === 'dispatch' || st.role === 'rest') {
      st.vx = 0;
      st.task = 'idle';
      st.taskT = 0;
      st.carrying = null;
      st.targetId = null;
      continue;
    }

    // ── 手里端着盘子或刚打好的饮品：直接送去桌前 ──
    if (st.carrying) {
      const dest = run.guests.find((o) => o.id === st.carrying!.guestId && !o.served && o.walkState === 'seated');
      if (!dest) {
        st.carrying = null;
        st.task = 'idle';
        st.taskT = 0;
        continue;
      }
      st.task = 'serve';
      if (stepStaffMoveTo(st, dest.x, 1.18, dest.seatIdx % 2 === 0 ? 1 : -1)) {
        st.taskT++;
        if (st.taskT >= 12) {
          completeServeGuest(run, dest, st.carrying.quality, ev, false, false, st.carrying.isRye);
          st.carrying = null;
          st.targetId = null;
          st.task = 'idle';
          st.taskT = 0;
        }
      }
      continue;
    }

    if (typeof st.targetId === 'string' && st.targetId.startsWith('drink:')) {
      const gid = st.targetId.slice(6);
      const dest = run.guests.find((o) => o.id === gid && !o.served && o.walkState === 'seated' && o.orderKind === 'drink');
      if (!dest) {
        st.targetId = null;
        st.task = 'idle';
        st.taskT = 0;
        continue;
      }
      st.task = 'drink';
      if (stepStaffMoveTo(st, dest.x, 1.18, dest.seatIdx % 2 === 0 ? 1 : -1)) {
        st.taskT++;
        if (st.taskT >= 12) {
          completeServeGuest(run, dest, 'perfect', ev, false, true);
          st.targetId = null;
          st.task = 'idle';
          st.taskT = 0;
        }
      }
      continue;
    }

    // ── 自动磨酱技能（Lv.3 / Lv.5 解锁） ──
    if (staffHasSkill(st, 'auto_mortar') && s.sauce <= 42) {
      st.task = 'mortar';
      if (stepStaffMoveTo(st, IN_STATIONS.mortar, 1.15, -1)) {
        st.taskT++;
        if (st.taskT >= 32) {
          s.sauce = Math.min(s.maxSauce, s.sauce + 58);
          s.sauceStalled = false;
          ev.push({ t: 'grindSauce', sauce: Math.round(s.sauce), byStaff: def.name });
          st.taskT = 0;
          st.task = 'idle';
        }
      }
      continue;
    }

    // ── 后厨职位：镇守砖炉加速出菜 ──
    if (st.role === 'kitchen') {
      st.task = s.kitchenOrders.length > 0 ? 'cook' : 'idle';
      st.taskT = 0;
      stepStaffMoveTo(st, Math.max(IN_MIN_X + 10, IN_STATIONS.kitchen - 16 - idx * 8), 1.0, 1);
      continue;
    }

    // ── 大堂职位 1：自动收脏盘（Lv.3 手脚麻利即时收，否则兜底陈旧脏盘） ──
    const canFastClean = staffHasSkill(st, 'auto_clean');
    const cleanTarget = (typeof st.targetId === 'number' && st.task === 'clean'
      ? s.dirtyTables.find((dp) => dp.id === st.targetId)
      : undefined)
      ?? s.dirtyTables.find((dp) => !claimedPlates.has(dp.id) && (canFastClean || run.tick - dp.createdTick >= 240));
    if (cleanTarget) {
      st.task = 'clean';
      st.targetId = cleanTarget.id;
      claimedPlates.add(cleanTarget.id);
      if (stepStaffMoveTo(st, cleanTarget.x, 1.15, cleanTarget.x >= st.x ? 1 : -1)) {
        st.taskT++;
        if (st.taskT >= (canFastClean ? 30 : 48)) {
          const i = s.dirtyTables.findIndex((dp) => dp.id === cleanTarget.id);
          if (i >= 0) {
            s.dirtyTables.splice(i, 1);
            const tip = 2;
            run.coins += tip;
            s.coinsEarned += tip;
            s.cleanedCount++;
            ev.push({ t: 'tableClean', x: cleanTarget.x, coins: tip, byStaff: def.name });
          }
          st.targetId = null;
          st.task = 'idle';
          st.taskT = 0;
        }
      }
      continue;
    }

    // ── 大堂职位 2：自动打茶/黑啤（Lv.3/5 酒水熟手） ──
    if (staffHasSkill(st, 'auto_drink')) {
      const drinkGuest = run.guests
        .filter((g) => g.orderKind === 'drink' && !g.served && g.walkState === 'seated' && !claimedGuests.has(g.id))
        .sort((a, b) => a.patience - b.patience)[0];
      if (drinkGuest) {
        st.task = 'drink';
        if (stepStaffMoveTo(st, IN_STATIONS.drink, 1.15, -1)) {
          st.taskT++;
          if (st.taskT >= 40) {
            st.targetId = `drink:${drinkGuest.id}`;
            claimedGuests.add(drinkGuest.id);
            st.taskT = 0;
          }
        }
        continue;
      }
    }

    // ── 大堂职位 3：从传菜台帮端菜上桌（出锅积压 >= 2 或 lv >= 2 时主动取菜） ──
    const cd = (typeof st.targetId === 'number' && st.task === 'serve'
      ? s.counterDishes.find((c) => c.id === st.targetId)
      : undefined)
      ?? (s.counterDishes.length >= (st.level >= 2 ? 1 : 2)
        ? s.counterDishes.find((c) => !claimedCounter.has(c.id))
        : undefined);
    if (cd) {
      const dest = run.guests.find((o) => o.id === cd.guestId && !o.served && o.walkState === 'seated')
        ?? run.guests.find((o) => o.orderKind === 'dish' && !o.served && o.walkState === 'seated');
      if (dest) {
        st.task = 'serve';
        st.targetId = cd.id;
        claimedCounter.add(cd.id);
        if (stepStaffMoveTo(st, IN_STATIONS.pass, 1.12, -1)) {
          st.taskT++;
          if (st.taskT >= 16) {
            const cIdx = s.counterDishes.findIndex((c) => c.id === cd.id);
            if (cIdx >= 0) {
              const [picked] = s.counterDishes.splice(cIdx, 1);
              st.carrying = { guestId: dest.id, dish: picked.dish, dishName: picked.dishName, quality: picked.quality, isRye: picked.isRye };
              claimedGuests.add(dest.id);
            }
            st.targetId = null;
            st.taskT = 0;
          }
        }
        continue;
      }
    }

    st.task = 'idle';
    st.targetId = null;
    st.taskT = 0;
    stepStaffMoveTo(st, 224 + idx * 14, 0.9, -1);
  }
}

