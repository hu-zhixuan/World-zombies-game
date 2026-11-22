// 规则层：纯计算，不碰浏览器。固定每秒 60 步；随机数带种子；同样的种子和输入一定得到同样的结果。
import {
  CLASSES, CRIT_CHANCE, CRIT_MUL, DIFFICULTIES, FORT_LEVELS, FORT_REPAIR_COST, LAST_DAY, MAX_FORT_LEVEL, MAX_GRENADES, MAX_STAR, MAX_WALL_LEVEL,
  MEALS, MEAL_ORDER, PERKS, RARITY_WEIGHT, SHOP_ARMOR_COST, SHOP_GRENADE_COST, SHOP_MEDKIT_COST, SHOP_REROLL_COST, STAR_COST, TURRETS,
  WALL_LEVELS, WALL_REPAIR_COST, WEAPONS, ZOMBIES, bossForDay, dayZombieCount, defaultResearchedMeals, extraBullets, magSize, starMul, zombieHp,
  type ClassId, type DifficultyId, type DrinkId, type MealId, type PerkId, type TavernUpgradeId, type TurretType, type WeaponId, type ZombieKind,
} from '../content/data';
import {
  COMPANION_JOIN_STORIES, DAILY_TRENDS,
  type AllyId, type DishQuality,
} from '../content/story';
import {
  ALLY_POS, DOOR_X, GROUND_Y, HOME_X, HOUSE_WALL_X, IN_MAX_X, IN_MIN_X, IN_STATIONS, LADDER_X, PLAYER_MAX_X, PLAYER_MIN_X,
  PORCH_MAX_X, PORCH_MIN_X, PORCH_Y, ROOF_MAX_X, ROOF_MIN_X, ROOF_Y, SPAWN_X,
  TURRET_SLOTS, WALL_X, type AllyRuntime, type Bullet, type Command, type CounterDish, type DinerGuest, type GameEvent, type Input, type RunState, type StationId, type TurretTargetMode, type Zombie,
} from './types';
import {
  activateDishBattleBuff, allyRole, applyGuestBattleSupport, buySpiceCmd, buyTavernUpgradeCmd, completeServeGuest, computeTomorrowBattleBuff,
  dinerRank, dishLevel, dishPrice, dishResearchCost, dishServings, dishTaste, dishXp, dishXpTarget, feastAllCmd,
  finishShiftToSummary, formatRecipeCost, gainDishXp, grindMortarCmd, hasIngredients, hasTavernUpgrade, hireStaffCmd,
  makeIdleShift, maxMenuSlots, maxSeats, maxStaffSlots, meatPrice, passCounterCapacity, postRecruitmentCmd, pourQuality,
  prepDishCmd, progressBattleContract, researchDishCmd, resolveNightPrepAndDispatch, rollBattleContract, rollDailyTrend, rollDinerGuests, sellMeatKindCmd,
  setAllyRoleCmd, setStaffRoleCmd, spendIngredients, staffDef, staffHasSkill, startShiftCmd, stepStaffCamp,
  stepTavernShift, stoveCapacity, tavernUpgradeCost, tavernWallMaxBonus, toggleAutoSupplyCmd, toggleMenuDishCmd, totalMeat, trainStaffCmd,
  upgradeDishCmd, upgradeRackCmd, vipSupportKind,
} from './diner';

export {
  activateDishBattleBuff, allyRole, applyGuestBattleSupport, computeTomorrowBattleBuff, dinerRank, dishLevel, dishPrice, dishResearchCost, dishServings, dishTaste,
  dishXp, dishXpTarget, formatRecipeCost, hasIngredients, hasTavernUpgrade, maxMenuSlots, maxSeats, maxStaffSlots, meatPrice, passCounterCapacity, pourQuality,
  rollBattleContract, staffDef, staffHasSkill, stoveCapacity, tavernUpgradeCost, tavernWallMaxBonus, totalMeat, vipSupportKind,
};

export const MAX_CARRY = 2;
export const GRENADE_G = 0.26;
const GRAVITY = 0.32;
const JUMP_V = -6.5;
const MOVE_SPEED = 2.2;
const DODGE_TICKS = 14;
const DODGE_SPEED = 4.4;
const DODGE_CD = 60;
const ZOMBIE_REACH = 18;
export const BODY_Y = GROUND_Y - 22; // 地面僵尸身体中心的高度
export const MUZZLE_Y = GROUND_Y - 31;
export const FORT_GUN_X = 166;
export const FORT_GUN_Y = GROUND_Y + ROOF_Y - 18;

/** 僵尸当前 2D 受击与瞄准中心纵坐标（兼容地面怪、低空夜翼魔蝠与高大首领） */
export const zombieBodyY = (z: Zombie): number =>
  GROUND_Y + (z.y ?? 0) - (z.kind === 'bat' ? 14 : ZOMBIES[z.kind].boss ? 34 : 22);

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

/** 房屋/屋顶高地防守增益：站上酒馆门廊或二楼屋顶可获得显著火力、暴击、射程、换弹与矮墙掩体减伤（酒馆暖琥珀吊灯额外加成高地暴击与射程）。 */
export function houseBuff(run: RunState): HouseBuff {
  const flv = Math.max(1, run.fort.level);
  const lanternCrit = hasTavernUpgrade(run, 'warm_lantern') ? 0.12 : 0;
  const lanternRange = hasTavernUpgrade(run, 'warm_lantern') ? 0.10 : 0;
  if (isOnRoof(run)) {
    const dmgMul = flv >= 3 ? 1.36 : flv === 2 ? 1.28 : 1.20;
    const rangeBonus = (flv >= 3 ? 0.35 : flv === 2 ? 0.25 : 0.20) + lanternRange;
    const critBonus = (flv >= 3 ? 0.18 : flv === 2 ? 0.14 : 0.10) + lanternCrit;
    const reloadHaste = flv >= 3 ? 0.40 : flv === 2 ? 0.32 : 0.25;
    const rangedCover = flv >= 3 ? 0.45 : flv === 2 ? 0.35 : 0.25;
    const name = flv >= 3 ? '铁堡屋顶' : flv === 2 ? '石堡屋顶' : '酒馆屋顶';
    return { zone: 'roof', name, dmgMul, rangeBonus, critBonus, reloadHaste, rangedCover, meleeImmune: true };
  }
  if (isOnPorch(run)) {
    return { zone: 'porch', name: '门廊木台', dmgMul: 1.12, rangeBonus: 0.10 + lanternRange, critBonus: 0.05 + lanternCrit, reloadHaste: 0.12, rangedCover: 0.15, meleeImmune: true };
  }
  return { zone: 'ground', name: '前院平地', dmgMul: 1.0, rangeBonus: 0, critBonus: 0, reloadHaste: 0, rangedCover: 0, meleeImmune: false };
}

export const turretBuildCost = (kind: TurretType, cls: ClassId, hasQiang = false, smithDiscount = false) =>
  Math.ceil(TURRETS[kind].buildCoins * (cls === 'engineer' ? 0.75 : 1) * (hasQiang ? 0.9 : 1) * (smithDiscount ? 0.85 : 1));
export const turretUpgradeCost = (kind: TurretType, level: number, cls: ClassId, hasQiang = false, smithDiscount = false) =>
  Math.ceil((TURRETS[kind].upgradeCoins[level] ?? 0) * (cls === 'engineer' ? 0.75 : 1) * (hasQiang ? 0.9 : 1) * (smithDiscount ? 0.85 : 1));
export const turretRefundCoins = (kind: TurretType, level: number, cls: ClassId, hasQiang = false) => {
  let spent = turretBuildCost(kind, cls, hasQiang);
  for (let l = 1; l < level; l++) spent += turretUpgradeCost(kind, l, cls, hasQiang);
  return Math.max(20, Math.floor(spent * 0.5));
};
export const weaponDamage = (id: WeaponId, star: number) => WEAPONS[id].damage * starMul(star);

/** 主角射程（在门廊/屋顶享受高低差加成，居高临下天赋额外叠加） */
export function effectiveRange(run: RunState, id: WeaponId = curWeapon(run).id): number {
  const hb = houseBuff(run);
  const perkBonus = isOnRoof(run) && has(run, 'rooftop') ? 0.15 : 0;
  return Math.round(WEAPONS[id].range * (1 + hb.rangeBonus + perkBonus));
}

/** 伤害倍率：酒馆战备料理 × 双层传菜架硬件加成 × 屋顶/门廊高地 × 战友 × 天赋。 */
export function damageMul(run: RunState): number {
  const p = run.player;
  const hb = houseBuff(run);
  let m = (1 + run.buff.dmgMul) * hb.dmgMul;
  if (hasTavernUpgrade(run, 'wide_pass')) m *= 1.15;
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

/** 室内靠近的功能工位 */
export function nearbyStation(run: RunState): StationId | null {
  if (!run.inside) return null;
  let best: StationId | null = null, bd = 28;
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

export type CampInteractTarget =
  | { kind: 'pourFinish'; x: number; drink: DrinkId; guestId: string | null }
  | { kind: 'serveDrink'; x: number; guest: DinerGuest }
  | { kind: 'serveCarried'; x: number; guest: DinerGuest }
  | { kind: 'cleanTable'; x: number; plateId: number; seatIdx: number }
  | { kind: 'pickCounter'; x: number; counterDish: CounterDish }
  | { kind: 'grindMortar'; x: number; sauce: number; maxSauce: number }
  | { kind: 'pourStart'; x: number; drink: DrinkId; guest: DinerGuest | null }
  | { kind: 'guestTalk'; x: number; guest: DinerGuest }
  | { kind: 'allyTalk'; x: number; ally: AllyId }
  | { kind: 'kitchen'; x: number }
  | { kind: 'pass'; x: number }
  | { kind: 'drink'; x: number }
  | { kind: 'shop'; x: number }
  | { kind: 'workshop'; x: number }
  | { kind: 'turretSlot'; slot: number; x: number; y: number }
  | { kind: 'wallSpot'; x: number; y: number }
  | { kind: 'fortSpot'; x: number; y: number }
  | { kind: 'doorOut'; x: number }
  | { kind: 'doorIn'; x: number };

/** 营地（室内与室外）走近可交互的对象：室外炮台/壁垒/大屋实地建造、酒馆传菜/斟酒/上菜/收碗/搭话、行商、工坊、进出木门 */
export function nearbyCampTarget(run: RunState): CampInteractTarget | null {
  if (run.phase !== 'camp') return null;
  const p = run.player;
  if (!run.inside) {
    if (Math.abs(p.x - DOOR_X) <= 30 && p.y > -24) return { kind: 'doorIn', x: DOOR_X };
    const extCands: { d: number; target: CampInteractTarget }[] = [];
    // 室外 4 处炮塔基座（屋顶2处 + 庭院2处）支持实地直建/升级
    for (let i = 0; i < TURRET_SLOTS.length; i++) {
      const sl = TURRET_SLOTS[i];
      const onMatchTier = sl.roof ? p.y <= ROOF_Y + 18 : p.y >= -24;
      const dx = Math.abs(p.x - sl.x);
      if (onMatchTier && dx <= 30) {
        extCands.push({ d: dx - 2, target: { kind: 'turretSlot', slot: i, x: sl.x, y: sl.roof ? ROOF_Y : 0 } });
      }
    }
    // 前院防线壁垒实地修补与升级
    if (p.y >= -24 && Math.abs(p.x - WALL_X) <= 34) {
      extCands.push({ d: Math.abs(p.x - WALL_X) - 1, target: { kind: 'wallSpot', x: WALL_X, y: 0 } });
    }
    // 屋顶大屋核心（加固要塞）
    if (p.y <= ROOF_Y + 18 && Math.abs(p.x - 166) <= 32) {
      extCands.push({ d: Math.abs(p.x - 166), target: { kind: 'fortSpot', x: 166, y: ROOF_Y } });
    }
    for (const allyId of run.story.allies) {
      const pos = ALLY_POS[allyId];
      const ax = run.allies[allyId]?.x ?? pos.extX;
      const ay = run.allies[allyId]?.y ?? pos.extY;
      const dx = Math.abs(p.x - ax);
      const dy = Math.abs(p.y - ay);
      if (dx <= 28 && dy <= 16) {
        extCands.push({ d: dx + 4, target: { kind: 'allyTalk', x: ax, ally: allyId } });
      }
    }
    extCands.sort((a, b) => a.d - b.d);
    return extCands[0]?.target ?? null;
  }

  if (run.pourMinigame && Math.abs(p.x - IN_STATIONS.drink) <= 46) {
    return { kind: 'pourFinish', x: IN_STATIONS.drink, drink: run.pourMinigame.drink, guestId: run.pourMinigame.guestId };
  }

  const cands: { effD: number; target: CampInteractTarget }[] = [];
  const push = (effD: number, target: CampInteractTarget) => cands.push({ effD, target });

  // 1. 手上端菜 / 端酒优先送到对应餐桌
  if (run.carryingDrink) {
    const targetG = run.guests.find((o) => o.id === run.carryingDrink!.guestId && !o.served && o.walkState !== 'leaving')
      ?? run.guests.find((o) => o.orderKind === 'drink' && !o.served && o.walkState === 'seated' && o.drink === run.carryingDrink!.drink)
      ?? run.guests.find((o) => o.orderKind === 'drink' && !o.served && o.walkState === 'seated');
    if (targetG) {
      const dg = Math.abs(p.x - targetG.x);
      if (dg <= 36) push(dg - 14, { kind: 'serveDrink', x: targetG.x, guest: targetG });
    }
  }
  if (run.carryingDish) {
    const targetG = run.guests.find((o) => o.id === run.carryingDish!.guestId && !o.served && o.walkState !== 'leaving')
      ?? run.guests.find((o) => o.orderKind === 'dish' && !o.served && o.walkState === 'seated' && !o.isRye && o.dish === run.carryingDish!.dish)
      ?? run.guests.find((o) => o.orderKind === 'dish' && !o.served && o.walkState === 'seated');
    if (targetG) {
      const dg = Math.abs(p.x - targetG.x);
      if (dg <= 36) push(dg - 14, { kind: 'serveCarried', x: targetG.x, guest: targetG });
    }
  }

  // 2. 空手时可收走餐桌上的脏盘子
  if (!run.carryingDish && !run.carryingDrink) {
    for (const dp of run.dinerShift.dirtyTables) {
      const d = Math.abs(p.x - dp.x);
      if (d <= 28) push(d - 5, { kind: 'cleanTable', x: dp.x, plateId: dp.id, seatIdx: dp.seatIdx });
    }
  }

  // 3. 左墙红砖灶台（备菜 / 菜单 / 炉火灵感研发）
  const dk = Math.abs(p.x - IN_STATIONS.kitchen);
  if (dk <= 24) {
    push(dk + (run.dinerShift.mode === 'open' ? 6 : 0), { kind: 'kitchen', x: IN_STATIONS.kitchen });
  }

  // 4. 石臼磨酱台（营业中磨辛香辣酱，缺酱时高优提示）
  const dm = Math.abs(p.x - IN_STATIONS.mortar);
  if (dm <= 22 && run.dinerShift.mode === 'open' && run.dinerShift.sauce < run.dinerShift.maxSauce) {
    const urg = run.dinerShift.sauce <= 35 ? -8 : 0;
    push(dm + urg, {
      kind: 'grindMortar',
      x: IN_STATIONS.mortar,
      sauce: Math.round(run.dinerShift.sauce),
      maxSauce: run.dinerShift.maxSauce,
    });
  }

  // 5. 橡木传菜台 (pass)
  const dpd = Math.abs(p.x - IN_STATIONS.pass);
  if (dpd <= 22) {
    if (!run.carryingDish && !run.carryingDrink && run.dinerShift.counterDishes.length > 0) {
      const cd = run.dinerShift.counterDishes[0];
      push(dpd - 4, { kind: 'pickCounter', x: IN_STATIONS.pass, counterDish: cd });
    } else if (run.dinerShift.mode === 'open') {
      push(dpd + 4, { kind: 'pass', x: IN_STATIONS.pass });
    }
  }

  // 6. 原木啤酒/热茶桶 (drink)
  const ddr = Math.abs(p.x - IN_STATIONS.drink);
  if (ddr <= 22) {
    if (!run.carryingDish && !run.carryingDrink) {
      const drinkGuest = run.guests
        .filter((g) => g.orderKind === 'drink' && !g.served && g.walkState === 'seated')
        .sort((a, b) => a.patience - b.patience)[0] ?? null;
      if (drinkGuest) {
        push(ddr - 3, { kind: 'pourStart', x: IN_STATIONS.drink, drink: drinkGuest.drink ?? 'beer', guest: drinkGuest });
      } else {
        push(ddr + 4, { kind: 'drink', x: IN_STATIONS.drink });
      }
    } else {
      push(ddr + 6, { kind: 'drink', x: IN_STATIONS.drink });
    }
  }

  const ds = Math.abs(p.x - IN_STATIONS.shop);
  if (ds <= 24) push(ds, { kind: 'shop', x: IN_STATIONS.shop });

  const dw = Math.abs(p.x - IN_STATIONS.workshop);
  if (dw <= 24) push(dw, { kind: 'workshop', x: IN_STATIONS.workshop });

  const dd = Math.abs(p.x - IN_STATIONS.door);
  if (dd <= 26) push(dd, { kind: 'doorOut', x: IN_STATIONS.door });

  // 7. 与在座食客搭话
  for (const g of run.guests) {
    if (g.walkState === 'leaving') continue;
    const isCarryMatch = (run.carryingDish && run.carryingDish.guestId === g.id)
      || (run.carryingDrink && run.carryingDrink.guestId === g.id);
    if (isCarryMatch) continue;
    const dg = Math.abs(p.x - g.x);
    if (dg <= 22) push(dg + 1, { kind: 'guestTalk', x: g.x, guest: g });
  }

  // 8. 与室内战友交谈
  for (const allyId of run.story.allies) {
    const ax = run.allies[allyId]?.x ?? ALLY_POS[allyId].intX;
    const da = Math.abs(p.x - ax);
    if (da <= 26) push(da + 2, { kind: 'allyTalk', x: ax, ally: allyId });
  }

  cands.sort((a, b) => a.effD - b.effD);
  return cands[0]?.target ?? null;
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

const makeAllyRuntime = (k: AllyId, inside: boolean): AllyRuntime => {
  const pos = ALLY_POS[k];
  const facing: 1 | -1 = inside && pos.intFlip ? -1 : 1;
  return {
    cd: 0,
    atkT: 0,
    facing,
    x: inside ? pos.intX : pos.extX,
    y: inside ? 0 : pos.extY,
    vx: 0,
    state: 'idle',
    dir: k === 'qiang' && !inside ? -1 : facing,
    pauseT: 0,
    atkSeq: 0,
    fireDone: true,
    atkTargetId: null,
    staffTask: 'idle',
    staffT: 0,
    staffGuestId: undefined,
  };
};

function syncAlliesPos(run: RunState, inside: boolean) {
  for (const k of ['zhang', 'lin', 'qiang', 'zhao'] as const) {
    run.allies[k] = makeAllyRuntime(k, inside);
  }
}

/** 开一局。pool 是这一局能掉落/进货的武器（局外解锁的那些），heirloom 为跨局轻度酒馆传承。 */
export function newRun(
  seed = 1,
  pool: WeaponId[] = ['revolver', 'smg'],
  cls: ClassId = 'gunner',
  difficulty: DifficultyId = 'normal',
  heirloom?: { metVips?: string[]; mastery?: Partial<Record<MealId, number>>; decor?: TavernUpgradeId[] },
): RunState {
  const turrets = TURRET_SLOTS.map(() => ({ type: null, level: 0, cd: 0, aim: 0, mode: 'near' as const }));
  const hMet = heirloom?.metVips ?? [];
  const hDecor = heirloom?.decor ?? [];
  const hFlame = Math.min(3, Math.floor(hMet.length / 3));
  const run: RunState = {
    seed, rng: seed >>> 0, tick: 0, nextId: 1, day: 0, phase: 'camp', phaseT: 0,
    inside: false, autoFire: false, difficulty,
    player: {
      x: 238, y: ROOF_Y, vx: 0, vy: 0, facing: 1, dropIgnoreT: 0, hp: 100, maxHp: 100, armor: 0, maxArmor: 80, hurtT: 0, healCarry: 0,
      dodgeT: 0, dodgeCd: 0, dodgeDir: 1, fireCd: 0, reloadT: 0, shootT: 0,
      burstLeft: 0, burstCd: 0, smgHeat: 0, smgShots: 0, grenades: 2,
      weapons: [{ id: 'pistol', star: 1, ammo: WEAPONS.pistol.mag }], cur: 0,
    },
    zombies: [], bullets: [], fires: [], grenades: [], enemyProjs: [], crates: [], turrets,
    allies: {
      zhang: makeAllyRuntime('zhang', false),
      lin:   makeAllyRuntime('lin', false),
      qiang: makeAllyRuntime('qiang', false),
      zhao:  makeAllyRuntime('zhao', false),
    },
    wall: { level: 1, hp: WALL_LEVELS[0].maxHp, maxHp: WALL_LEVELS[0].maxHp },
    home: { hp: FORT_LEVELS[0].maxHp, maxHp: FORT_LEVELS[0].maxHp },
    fort: { level: 1, cd: 0, aim: 0 },
    spawn: { left: 0, timer: 0, total: 0, killed: 0, crateAt: 0, bossKind: null, bossSpawned: false },
    coins: 0,
    meats: { tender: 0, thick: 0, essence: 0 },
    spice: 1 + (hDecor.length > 0 ? 1 : 0),
    kills: 0,
    meal: null, mealQuality: 'good', guests: [],
    carryingDish: null,
    pourMinigame: null, carryingDrink: null,
    dinerShift: makeIdleShift(0),
    diner: {
      rep: 0, fans: 0, flame: hFlame, bestTaste: 120,
      trendId: DAILY_TRENDS[0].id, trendTag: DAILY_TRENDS[0].tag, trendTitle: DAILY_TRENDS[0].title,
      servedTotal: 0, metVips: [], reviews: [],
      researched: defaultResearchedMeals(),
      dishLevels: Object.fromEntries(MEAL_ORDER.map((id) => [id, (heirloom?.mastery?.[id] ?? 1) >= 2 ? 2 : 1])),
      menu: [...MEAL_ORDER],
      menuStock: {},
      autoSupply: {},
      upgrades: [],
      hiredStaff: [],
      applicants: [],
      adTier: null,
      rackLevel: 0,
      lastDispatchLog: '',
      allyRoles: {},
      feastDishes: [],
      supportsTriggered: [],
      smithDiscount: false,
      extraCrates: 0,
      allyFuryNext: false,
    },
    story: { allies: [], seenEvents: [] },
    buff: { dmgMul: 0, haste: 0, turretMul: 0, critBonus: 0, frostRounds: false, allyFury: false }, shop: [],
    perks: [], perkChoices: [], targetId: null, priorityId: null,
    pool: [...pool], chain: { n: 0, t: 0 }, vanguardT: 0, cls, skill: { t: 0, cd: 0 },
    endless: false,
    heirloom: heirloom ? { metVips: [...hMet], mastery: { ...(heirloom.mastery ?? {}) }, decor: [...hDecor] } : undefined,
  };
  rollShopOffers(run);
  startDay(run, []);
  return run;
}

function startDay(run: RunState, ev: GameEvent[]) {
  run.day++;
  run.phase = 'fight'; run.phaseT = 0; run.inside = false;
  run.player.x = 238; run.player.y = ROOF_Y; run.player.vy = 0; run.player.dropIgnoreT = 0; run.player.facing = 1;
  run.player.burstLeft = 0; run.player.burstCd = 0; run.player.smgHeat = 0;
  run.carryingDish = null; run.pourMinigame = null; run.carryingDrink = null;
  run.dinerShift = makeIdleShift(0);
  syncAlliesPos(run, false);
  const diff = run.difficulty ?? 'normal';
  const total = dayZombieCount(run.day, diff);
  const hasArmsCrate = (run.diner.extraCrates ?? 0) > 0;
  const crateAt = run.day === 1 || hasArmsCrate || rand(run) < 0.45 ? Math.floor(total / 2) : -1;
  const bossKind = bossForDay(run.day);
  run.spawn = { left: total, timer: 46, total, killed: 0, crateAt, bossKind, bossSpawned: false };
  run.bullets = []; run.fires = []; run.grenades = []; run.enemyProjs = [];
  run.chain = { n: 0, t: 0 }; run.vanguardT = 0; run.skill = { t: 0, cd: 0 };
  rollDailyTrend(run);
  rollBattleContract(run);

  // 结算酒馆晚宴对今日主战场的全部战备增益（支持单道特餐或多道堂食料理叠加）
  const tb = computeTomorrowBattleBuff(run);
  if (tb.dishes.length > 0 || tb.allyFury) {
    run.buff = {
      dmgMul: tb.dmgMul,
      haste: tb.haste,
      turretMul: tb.turretMul,
      critBonus: tb.critBonus,
      frostRounds: tb.frostRounds,
      allyFury: tb.allyFury,
    };
    if (tb.armor > 0) {
      run.player.armor = Math.min(run.player.maxArmor, run.player.armor + tb.armor);
    }
    if (tb.bonusGrenades > 0) {
      run.player.grenades = Math.min(MAX_GRENADES, run.player.grenades + tb.bonusGrenades);
    }
    if (tb.allyFury) {
      run.vanguardT = Math.max(run.vanguardT, 480);
    }
    run.meal = null;
    run.mealQuality = 'good';
  } else {
    run.buff = { dmgMul: 0, haste: 0, turretMul: 0, critBonus: 0, frostRounds: false, allyFury: false };
  }

  // 军火游商支援：开战直接在前院空投一口武器升星箱
  if (hasArmsCrate) {
    const pool: WeaponId[] = ['pistol', ...run.pool];
    const unowned = pool.filter((id) => !run.player.weapons.some((w) => w.id === id));
    const weapon = unowned.length > 0
      ? unowned[Math.floor(rand(run) * unowned.length)]
      : pool[Math.floor(rand(run) * pool.length)];
    run.crates.push({ id: run.nextId++, x: Math.min(PLAYER_MAX_X - 40, WALL_X - 36), weapon });
  }
  run.diner.feastDishes = [];
  run.diner.supportsTriggered = [];
  run.diner.allyFuryNext = false;
  run.diner.smithDiscount = false;
  run.diner.extraCrates = 0;

  // 精铜酒栓永久主战场战备：每晚开战自动补给 +35 铁甲与 +1 爆炎弹
  if (hasTavernUpgrade(run, 'fast_tap')) {
    run.player.armor = Math.min(run.player.maxArmor, run.player.armor + 35);
    run.player.grenades = Math.min(MAX_GRENADES, run.player.grenades + 1);
  }
  if (has(run, 'secondwind')) run.player.hp = Math.min(run.player.maxHp, run.player.hp + run.player.maxHp * 0.25);
  if (has(run, 'fortify')) run.player.armor = Math.min(run.player.maxArmor, run.player.armor + 25);
  if (run.fort.level >= 3) run.wall.hp = Math.min(run.wall.maxHp, run.wall.hp + Math.round(run.wall.maxHp * 0.2));
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
  const hp = zombieHp(kind, run.day, run.difficulty ?? 'normal');
  const index = run.spawn.total - run.spawn.left;
  const y = kind === 'bat' ? -(78 + Math.round(rand(run) * 28)) : kind === 'ghoul' ? -(68 + Math.round(rand(run) * 26)) : 0;
  run.zombies.push({
    id: run.nextId++, kind, x: SPAWN_X + rand(run) * 44, y, hp, maxHp: hp,
    atkCd: 12, kb: 0, burnT: 0, slowT: 0, stunT: 0, freezeT: 0, carriesCrate: !forcedKind && index === run.spawn.crateAt,
  });
}

/** 自动锁定（360° 2D 距离）：优先打玩家点击指定的目标，否则选射程内最近的地面或空中魔物。 */
function pickTarget(run: RunState): Zombie | null {
  const p = run.player, range = effectiveRange(run);
  const py = GROUND_Y + p.y - 26;
  const dist2D = (z: Zombie) => Math.hypot(z.x - p.x, zombieBodyY(z) - py);
  if (run.priorityId !== null) {
    const pri = run.zombies.find((z) => z.id === run.priorityId);
    if (pri && pri.hp > 0 && dist2D(pri) <= range * 1.15) return pri;
    if (!pri || pri.hp <= 0) run.priorityId = null;
  }
  const cur = run.zombies.find((z) => z.id === run.targetId);
  if (cur && cur.hp > 0 && dist2D(cur) <= range * 1.1) return cur;
  let best: Zombie | null = null, bd = range;
  for (const z of run.zombies) {
    const d = dist2D(z);
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
  p.hurtT = 18;
  ev.push({ t: 'hurt', dmg: finalDmg, blocked, cover: covered > 0 ? covered : undefined });
}

const enemyDmg = (raw: number, day: number, diff: DifficultyId = 'normal') =>
  Math.round(raw * (1 + (Math.max(1, day) - 1) * 0.08) * DIFFICULTIES[diff].dmgMul);

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
  const isBoss = !!ZOMBIES[z.kind].boss;
  if (opts.kb) z.kb = Math.max(z.kb, opts.kb * (isBoss ? 0.12 : 1));
  if (opts.slow) z.slowT = Math.max(z.slowT, opts.slow);
  if (opts.freeze) z.freezeT = Math.max(z.freezeT, Math.round(opts.freeze * (isBoss ? 0.25 : 1)));
  if (opts.stun) {
    const s = Math.round(opts.stun * (isBoss ? 0.15 : 1));
    if (s > 0) z.stunT = Math.max(z.stunT, s);
  }
  const dir: 1 | -1 = opts.dir ?? (z.x >= run.player.x ? 1 : -1);
  const heavy = opts.heavy || (opts.kb ?? 0) >= 2.5 || opts.weaponId === 'revolver' || opts.weaponId === 'shotgun' || opts.weaponId === 'rifle' || opts.weaponId === 'rocket';
  const zy = zombieBodyY(z);
  ev.push({
    t: 'hit', id: z.id, x: z.x, y: zy, dmg: Math.round(dmg),
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

  // 猎手双铳特色：击杀立即回膛 2 发弹药
  if (opts.byPlayer && opts.weaponId === 'pistol') {
    const pw = run.player.weapons.find((w) => w.id === 'pistol');
    if (pw) pw.ammo = Math.min(magSize('pistol', pw.star), pw.ammo + 2);
  }

  const def = ZOMBIES[z.kind];
  run.coins += def.coins; run.kills++; run.spawn.killed++;
  const chef = run.cls === 'chef';
  const meatKind = def.meatKind;
  const baseMeat = def.meat > 1 || meatKind === 'essence'
    ? def.meat + (chef ? 1 : 0)
    : (rand(run) < (chef ? 0.48 : 0.34) ? 1 : 0);
  const preserved = isOnRoof(run) || z.freezeT > 0 || z.stunT > 0 || !!opts.crit;
  const meatDrop = baseMeat > 0 && preserved ? baseMeat * 2 : baseMeat;
  run.meats[meatKind] += meatDrop;

  if (has(run, 'chainkill')) run.chain = { n: Math.min(8, run.chain.n + 1), t: 180 };
  ev.push({
    t: 'kill', id: z.id, x: z.x, y: zy, kind: z.kind, coins: def.coins,
    meat: meatDrop, meatKind, preserved: preserved && meatDrop > 0, dir, crit: opts.crit, boss: def.boss,
  });
  const cId = run.diner.contract?.id;
  if (cId === 'rooftop_hunt' && (isOnRoof(run) || isOnPorch(run))) progressBattleContract(run, 1, ev);
  else if (cId === 'crit_blast' && (opts.crit || opts.burn || heavy)) progressBattleContract(run, 1, ev);
  else if (cId === 'elite_purge' && (def.boss || z.kind === 'bruiser' || z.kind === 'bat' || z.kind === 'ghoul')) progressBattleContract(run, 1, ev);
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
    ev.push({ t: 'boom', x: z.x, y: zy, r });
    for (const o of run.zombies) if (o !== z && o.hp > 0 && Math.hypot(o.x - z.x, zombieBodyY(o) - zy) <= r) damageZombie(run, o, boom, ev, { byPlayer: false, kb: 2, dir: o.x >= z.x ? 1 : -1, heavy: true });
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
    const cy = zombieBodyY(cur);
    pts.push({ x: cur.x, y: cy });
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
    const fromX: number = cur.x, fromY: number = cy;
    cur = run.zombies.filter((o) => o.hp > 0 && !hit.has(o.id) && Math.hypot(o.x - fromX, zombieBodyY(o) - fromY) <= 165)
      .sort((a, b) => Math.hypot(a.x - fromX, zombieBodyY(a) - fromY) - Math.hypot(b.x - fromX, zombieBodyY(b) - fromY))[0];
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
    const d = Math.hypot(z.x - x, zombieBodyY(z) - y);
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

/** 向目标发射一发/一组 360° 实体弹丸或瞬发射线（支持上下前后全向瞄准、空地打击）。 */
function launchWeaponShot(run: RunState, target: Zombie | null, ev: GameEvent[], consumeAmmo: boolean) {
  const p = run.player, ow = curWeapon(run), def = WEAPONS[ow.id];
  const shoulderX = p.x, shoulderY = GROUND_Y + p.y - 31;
  let dx: number = p.facing, dy = 0, aimLen = 200;
  if (target) {
    const tx = target.x - shoulderX, ty = zombieBodyY(target) - shoulderY;
    aimLen = Math.hypot(tx, ty) || 1;
    dx = tx / aimLen; dy = ty / aimLen;
  }
  const muzzleReach = Math.min(20, Math.max(8, aimLen * 0.45));
  const mx = shoulderX + dx * muzzleReach, my = shoulderY + dy * muzzleReach;
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

  // 1. 猩红圣铳：全方向 360° 瞬发穿透整条光路敌军 + 对重甲/首领 +35%（★5 +50%）破甲伤
  if (def.hitscan) {
    const x2 = mx + dx * range, y2 = my + dy * range;
    ev.push({ t: 'railbeam', x1: mx, y1: my, x2, y2, crit });
    const byDist = [...run.zombies]
      .map((z) => ({ z, d: Math.hypot(z.x - mx, zombieBodyY(z) - my) }))
      .sort((a, b) => a.d - b.d);
    for (const { z } of byDist) {
      if (z.hp <= 0) continue;
      const zDef = ZOMBIES[z.kind];
      const zcy = zombieBodyY(z);
      const t = (z.x - mx) * dx + (zcy - my) * dy;
      if (t < -14 || t > range + 24) continue;
      const closestX = mx + dx * Math.max(0, t), closestY = my + dy * Math.max(0, t);
      const hw = zDef.boss ? 26 : z.kind === 'bat' ? 16 : 14;
      const hh = zDef.boss ? 58 : z.kind === 'bat' ? 16 : 30;
      if (Math.abs(closestX - z.x) > hw || Math.abs(closestY - zcy) > hh) continue;
      const armorBreaker = zDef.boss || z.kind === 'bruiser' ? (ow.star >= 5 ? 1.5 : 1.35) : 1.0;
      damageZombie(run, z, dmg * armorBreaker, ev, {
        byPlayer: true, crit, kb: 2.8, weaponId: 'rifle', dir: dx >= 0 ? 1 : -1, heavy: true,
      });
      if (has(run, 'incendiary') && z.hp > 0 && rand(run) < 0.25) z.burnT = 180;
      if (has(run, 'frostbite')) z.slowT = Math.max(z.slowT, 135);
      if (has(run, 'shock') && z.hp > 0 && rand(run) < 0.2) {
        const next = run.zombies.find((o) => o.id !== z.id && o.hp > 0 && Math.hypot(o.x - z.x, zombieBodyY(o) - zcy) <= 145);
        if (next) fireLightning(run, z.x, zcy, next, dmg * 0.45, 2, ev, { byPlayer: true, color: 'shock' });
      }
    }
    ev.push({ t: 'shot', x: mx, y: my, from: 'player', weapon: ow.id, ang });
    if (consumeAmmo && ow.ammo <= 0) startReload(run, ev);
    return;
  }

  // 2. 秘蓝法杖：多段雷链 + 麻痹定身 + 元素超载
  if (def.chain) {
    if (target) {
      const jumps = def.chain + (ow.star >= 3 ? 1 : 0) + (ow.star >= 5 ? 1 : 0) + (has(run, 'shock') ? 2 : 0);
      fireLightning(run, mx, my, target, dmg, jumps, ev, { byPlayer: true, crit, color: 'tesla', stun: 22 });
    } else {
      ev.push({ t: 'lightning', pts: [{ x: mx, y: my }, { x: mx + dx * 135, y: my + dy * 135 + (rand(run) - 0.5) * 16 }], color: 'tesla' });
    }
    ev.push({ t: 'shot', x: mx, y: my, from: 'player', weapon: ow.id, ang });
    if (consumeAmmo && ow.ammo <= 0) startReload(run, ev);
    return;
  }

  // 3. 实体弹丸组（猎手双铳 / 重锤左轮 / 连珠火铳 / 双管龙息铳 / 寒霜连铳 / 焦土爆炎炮）
  const bonusAt5 = def.burst ? 0 : extraBullets(ow.id, ow.star);
  const count = (def.pellets ?? 1) + bonusAt5;
  const rocketSplitScale = def.aoe && count > 1 ? 0.56 : 1;
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
      startY: my,
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

  // 连珠火铳蓄热变速（按住越久射速越快，interval 从 9 步一路缩至 4 步）
  const baseInt = ow.id === 'smg'
    ? Math.max(4, Math.round(def.interval * (1 - 0.55 * p.smgHeat)))
    : def.interval;
  p.fireCd = Math.max(2, Math.round((baseInt * (has(run, 'pierce') ? 1.08 : 1)) / playerHaste(run)));
  p.shootT = 10;

  // 猎手双铳：一发扳机排队二连点射
  if (def.burst && def.burst > 1) {
    p.burstLeft = def.burst - 1;
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
 * 计算爆炎弹投掷初速度与起点（支持拖拽控曲线，或未拖拽时智能抛向最近尸群）：
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
  if (p.dropIgnoreT > 0) p.dropIgnoreT--;
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
    p.dodgeT = DODGE_TICKS; p.dodgeCd = run.inside && run.dinerShift.mode === 'open' ? 26 : DODGE_CD;
    p.dodgeDir = move !== 0 ? (move > 0 ? 1 : -1) : p.facing;
    ev.push({ t: 'dodge' });
  }
  const rushSpeedMul = run.inside && run.dinerShift.mode === 'open' ? 1.28 : 1;
  if (p.dodgeT > 0) { p.dodgeT--; p.vx = p.dodgeDir * DODGE_SPEED * (run.inside ? 1.12 : 1); }
  else p.vx = move * MOVE_SPEED * rushSpeedMul;

  if (run.inside) {
    if (input.jump && p.y === 0) p.vy = JUMP_V * 0.72;
    p.vy += GRAVITY; p.y += p.vy;
    if (p.y >= 0) { p.y = 0; p.vy = 0; }
    p.x = Math.max(IN_MIN_X, Math.min(IN_MAX_X, p.x + p.vx));
    if (move !== 0 && p.dodgeT === 0) p.facing = move > 0 ? 1 : -1;
    if (run.pourMinigame && Math.abs(p.x - IN_STATIONS.drink) > 46) {
      run.pourMinigame = null;
    }
    if (input.interact && nearbyStation(run) === 'door' && run.phase === 'camp') command(run, { t: 'exitHouse' });
    return;
  }

  // 室外与房顶 2D 实体碰撞 + 阶梯跳跃动线（一楼砖墙 -> 中层木制挑台 -> 二层屋顶平台 + 泰拉瑞亚式 ↓ 穿层下跳）
  const prevY = p.y;
  const onGround = Math.abs(p.y) <= 0.5;
  const onPorch = p.x >= PORCH_MIN_X && p.x <= PORCH_MAX_X && Math.abs(p.y - PORCH_Y) <= 2 && p.dropIgnoreT === 0;
  const onRoof = p.x >= ROOF_MIN_X && p.x <= ROOF_MAX_X && Math.abs(p.y - ROOF_Y) <= 2 && p.dropIgnoreT === 0;
  const canDropFromRoof = onRoof && p.x >= PORCH_MIN_X - 10;
  if (input.down && (onPorch || canDropFromRoof) && p.vy >= 0) {
    p.dropIgnoreT = 9;
    p.y += 3;
    p.vy = 1.6;
  } else if (input.jump && (onGround || onPorch || onRoof) && p.vy >= 0) {
    p.vy = JUMP_V;
    ev.push({ t: 'jump', onRoof });
  }

  let minX = HOUSE_WALL_X;
  if (p.y <= ROOF_Y + 4) minX = PLAYER_MIN_X;
  else if (p.y <= PORCH_Y + 4) minX = PORCH_MIN_X;
  p.x = Math.max(minX, Math.min(PLAYER_MAX_X, p.x + p.vx));

  const ignorePlatforms = p.dropIgnoreT > 0 || input.down;
  const nowInRoof = p.x >= ROOF_MIN_X && p.x <= ROOF_MAX_X;
  const nowInPorch = p.x >= PORCH_MIN_X && p.x <= PORCH_MAX_X;
  const standingRoof = !ignorePlatforms && nowInRoof && Math.abs(p.y - ROOF_Y) < 0.01 && p.vy === 0;
  const standingPorch = !ignorePlatforms && !standingRoof && nowInPorch && Math.abs(p.y - PORCH_Y) < 0.01 && p.vy === 0;

  if (!standingRoof && !standingPorch && (p.y < 0 || p.vy < 0 || ignorePlatforms)) {
    p.vy += GRAVITY;
    p.y += p.vy;
  }
  if (!ignorePlatforms && nowInRoof && prevY <= ROOF_Y + 6 && p.y >= ROOF_Y && p.vy >= 0) {
    p.y = ROOF_Y;
    p.vy = 0;
    if (prevY < ROOF_Y - 1 || prevY > ROOF_Y + 1) ev.push({ t: 'roof', onRoof: true });
  } else if (!ignorePlatforms && nowInPorch && prevY <= PORCH_Y + 6 && p.y >= PORCH_Y && p.vy >= 0) {
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
    const interval = run.fort.level >= 3 ? 210 : 320;
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

  // 处理二连点射待发队列（猎手双铳二连）
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
    if (z.burnT > 0) { z.burnT--; if (z.burnT % 30 === 0) damageZombie(run, z, 9 + Math.floor(run.day * 1.4 + Math.min(40, z.maxHp * 0.015)), ev, { byPlayer: false, burn: true }); }
    if (z.hp <= 0) continue;
    if (z.slowT > 0) z.slowT--;
    if (z.freezeT > 0) z.freezeT--;
    if (z.stunT > 0) { z.stunT--; if (!def.boss) continue; }
    if (z.kb > 0) { z.x += z.kb; z.kb *= 0.7; if (z.kb < 0.2) z.kb = 0; if (!def.boss) continue; }

    const scaledDmg = enemyDmg(def.damage, run.day, run.difficulty ?? 'normal');

    // 空中近战魔物（夜翼魔蝠）：越过前院木障，低空盘旋俯冲撕咬屋顶守夜人或酒馆木门
    if (def.flying && !def.ranged) {
      const targetY = !run.inside && Math.abs(p.x - z.x) < 420
        ? Math.max(-118, Math.min(-24, p.y - 16))
        : -82;
      const hoverY = targetY + Math.sin(run.tick * 0.14 + z.id) * 6;
      z.y += (hoverY - z.y) * 0.08;
      const goalX = !run.inside && p.x < z.x + 120 ? Math.max(PLAYER_MIN_X + 12, p.x) : HOME_X;
      const nearFlyPlayer = !run.inside && p.dodgeT === 0 && Math.hypot(p.x - z.x, (p.y - 18) - z.y) <= 24;
      const atHome = z.x <= HOME_X + 12;
      if (nearFlyPlayer || atHome) {
        if (z.atkCd === 0) {
          z.atkCd = def.attackEvery;
          if (nearFlyPlayer) applyPlayerDamage(run, scaledDmg, ev, false);
          else { run.home.hp = Math.max(0, run.home.hp - scaledDmg); ev.push({ t: 'homeHit' }); }
        }
        continue;
      }
      const moveFactor = z.freezeT > 0 ? 0.16 : z.slowT > 0 ? 0.52 : 1;
      if (z.x > goalX + 6) z.x -= def.speed * moveFactor;
      else if (z.x < goalX - 6) z.x += def.speed * 0.7 * moveFactor;
      continue;
    }
    if (def.flying && def.ranged) {
      const hoverY = -74 + Math.sin(run.tick * 0.08 + z.id) * 10;
      z.y += (hoverY - z.y) * 0.06;
    }

    // 远程魔物（提灯怨灵、暴君、深渊魔王）进入可交火射程后停止前压，抛射高弧幽火打击主角或前线路障
    const rangedStopX = def.boss ? WALL_X + 245 : WALL_X + 215;
    if (def.ranged && z.x <= rangedStopX && z.x >= WALL_X + 24) {
      if (z.atkCd === 0) {
        z.atkCd = Math.round(def.attackEvery * (def.boss ? 0.96 : 1.08));
        const onRoofOrPorch = isOnRoof(run) || isOnPorch(run);
        const aimPlayer = !run.inside && Math.abs(p.x - z.x) <= 520 && (rand(run) < (onRoofOrPorch ? 0.68 : 0.82));
        const tx = aimPlayer ? p.x : (run.wall.hp > 0 ? WALL_X : HOME_X);
        const ty = aimPlayer ? (GROUND_Y + p.y - 24) : (GROUND_Y - 14);
        const sx = z.x - 10, sy = zombieBodyY(z);
        const dx = tx - sx, dist = Math.abs(dx) || 1;
        const speed = def.boss ? 4.5 : 3.9;
        const frames = Math.max(aimPlayer ? 28 : 16, dist / speed);
        const g = 0.11;
        const vy = (ty - sy) / frames - 0.5 * g * (frames - 1);
        run.enemyProjs.push({ x: sx, y: sy, vx: Math.sign(dx) * speed, vy, dmg: Math.round(scaledDmg * 0.9), life: 165 });
        continue;
      }
    }

    const nearPlayer = !run.inside && p.dodgeT === 0 && Math.abs(p.x - z.x) <= ZOMBIE_REACH && p.y > -24;
    const atWall = run.wall.hp > 0 && z.x <= WALL_X + 16 && z.x >= WALL_X - 8;
    const atHome = z.x <= HOME_X + 8;
    if (nearPlayer || atWall || atHome) {
      if (z.atkCd > 0) continue;
      z.atkCd = def.attackEvery;
      if (nearPlayer) {
        applyPlayerDamage(run, scaledDmg, ev, false);
      } else if (atWall) {
        run.wall.hp = Math.max(0, run.wall.hp - scaledDmg);
        ev.push({ t: 'wallHit', reflect: reflectDmg > 0 });
        if (has(run, 'vanguard')) run.vanguardT = 300;
        if (reflectDmg > 0) damageZombie(run, z, reflectDmg, ev, { byPlayer: false });
      } else {
        run.home.hp = Math.max(0, run.home.hp - scaledDmg);
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
        if (z.hp > 0 && Math.abs(z.x - f.x) <= f.r && zombieBodyY(z) >= GROUND_Y - 52) {
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
  const dishTurretMul = 1 + (run.buff.turretMul ?? 0);
  const haste = (1 + run.buff.haste) * (1 + (run.buff.turretMul ?? 0) * 0.5) * overclock * engActive;

  for (let i = 0; i < run.turrets.length; i++) {
    const slot = run.turrets[i];
    if (!slot.type || slot.level <= 0) continue;
    const def = TURRETS[slot.type], lv = def.levels[slot.level - 1];
    if (slot.cd > 0) { slot.cd--; continue; }
    const pos = turretWorldPos(i);
    const range = def.range + (pos.roof ? 55 : 0);
    const mode: TurretTargetMode = slot.mode ?? 'near';
    const inRange = run.zombies
      .filter((z) => z.hp > 0 && Math.hypot(z.x - pos.x, zombieBodyY(z) - pos.muzzleY) <= range);
    if (inRange.length === 0) continue;

    inRange.sort((a, b) => {
      if (mode === 'boss') {
        const ba = ZOMBIES[a.kind].boss ? 1 : 0, bb = ZOMBIES[b.kind].boss ? 1 : 0;
        if (ba !== bb) return bb - ba;
        if (Math.abs(b.maxHp - a.maxHp) > 40) return b.maxHp - a.maxHp;
      } else if (mode === 'air') {
        const fa = ZOMBIES[a.kind].flying ? 1 : 0, fb = ZOMBIES[b.kind].flying ? 1 : 0;
        if (fa !== fb) return fb - fa;
      }
      return Math.hypot(a.x - pos.x, zombieBodyY(a) - pos.muzzleY) - Math.hypot(b.x - pos.x, zombieBodyY(b) - pos.muzzleY);
    });
    const best = inRange[0];

    slot.cd = Math.max(2, Math.round(lv.cooldown / haste));
    const dmg = Math.round(lv.damage * (eng ? 1.2 : 1) * dishTurretMul);
    const dx = best.x - pos.x, dy = zombieBodyY(best) - pos.muzzleY, len = Math.hypot(dx, dy) || 1;
    slot.aim = Math.atan2(dy, dx);
    const ox = pos.x + (dx / len) * 10, oy = pos.muzzleY + (dy / len) * 10;

    if (slot.type === 'tesla') {
      fireLightning(run, pos.x, pos.muzzleY, best, dmg, lv.chain ?? 3, ev, { byPlayer: false, color: 'tesla', stun: 12 });
    } else if (slot.type === 'frost') {
      run.bullets.push({
        x: ox, y: oy, vx: (dx / len) * 7.5, vy: (dy / len) * 7.5,
        dmg, life: 60, from: 'turret', pierce: false, crit: false, bounces: 0, hit: [],
        aoe: lv.aoe ?? 56, slow: 150, kind: 'frost',
      });
    } else if (slot.type === 'cannon') {
      run.bullets.push({
        x: ox, y: oy, vx: (dx / len) * 7.2, vy: (dy / len) * 7.2,
        dmg, life: 70, from: 'turret', pierce: false, crit: false, bounces: 0, hit: [],
        aoe: lv.aoe ?? 70, kind: 'cannon',
      });
    } else {
      run.bullets.push({
        x: ox, y: oy, vx: (dx / len) * 9.5, vy: (dy / len) * 9.5,
        dmg, life: 48, from: 'turret', pierce: false, crit: false, bounces: 0, hit: [], kind: 'normal',
      });
    }
    ev.push({ t: 'shot', x: ox, y: oy, from: 'turret', turret: slot.type, ang: slot.aim });
  }

  // 堡垒 2 级以上屋顶自带守卫火炮（360° 防空防地）
  if (run.fort.level >= 2) {
    if (run.fort.cd > 0) run.fort.cd--;
    else {
      let best: Zombie | null = null, bd = 400;
      for (const z of run.zombies) {
        const d = Math.hypot(z.x - FORT_GUN_X, zombieBodyY(z) - FORT_GUN_Y);
        if (d <= bd) { bd = d; best = z; }
      }
      if (best) {
        const lv3 = run.fort.level >= 3;
        run.fort.cd = Math.round((lv3 ? 56 : 92) / ((1 + run.buff.haste) * (1 + (run.buff.turretMul ?? 0) * 0.5)));
        const dx = best.x - FORT_GUN_X, dy = zombieBodyY(best) - FORT_GUN_Y, len = Math.hypot(dx, dy) || 1;
        run.fort.aim = Math.atan2(dy, dx);
        const shots = lv3 ? 2 : 1;
        const ox = FORT_GUN_X + (dx / len) * 10, oy = FORT_GUN_Y + (dy / len) * 10;
        const fortDmg = Math.round((lv3 ? 54 : 38) * dishTurretMul);
        for (let s = 0; s < shots; s++) {
          const offset = (s - (shots - 1) * 0.5) * 0.06;
          const ca = Math.cos(offset), sa = Math.sin(offset);
          const vx = ((dx / len) * ca - (dy / len) * sa) * 10;
          const vy = ((dx / len) * sa + (dy / len) * ca) * 10;
          run.bullets.push({
            x: ox, y: oy, vx, vy, dmg: fortDmg, life: 54,
            from: 'fort', pierce: false, crit: false, bounces: 0, hit: [], kind: 'normal',
          });
        }
        ev.push({ t: 'shot', x: ox, y: oy, from: 'fort', ang: run.fort.aim });
      }
    }
  }
}

function patrolWithPause(rt: AllyRuntime, minX: number, maxX: number, speed: number, pauseTicks: number) {
  if (rt.pauseT > 0) {
    rt.pauseT--;
    rt.vx = 0;
    rt.state = 'idle';
    return;
  }
  if (rt.x <= minX) {
    rt.x = minX;
    rt.dir = 1;
    rt.vx = 0;
    rt.state = 'idle';
    rt.pauseT = pauseTicks;
    return;
  }
  if (rt.x >= maxX) {
    rt.x = maxX;
    rt.dir = -1;
    rt.vx = 0;
    rt.state = 'idle';
    rt.pauseT = pauseTicks;
    return;
  }
  rt.vx = rt.dir * speed;
  rt.x = Math.max(minX, Math.min(maxX, rt.x + rt.vx));
  rt.facing = rt.vx >= 0 ? 1 : -1;
  rt.state = 'move';
}

function stepAllyTo(rt: AllyRuntime, targetX: number, minX: number, maxX: number, speed: number, restFacing: 1 | -1, hysteresis = false): boolean {
  const gx = Math.max(minX, Math.min(maxX, targetX));
  const d = gx - rt.x;
  const tol = hysteresis ? (rt.state === 'move' ? 4 : 10) : 5;
  if (Math.abs(d) > tol) {
    rt.vx = Math.sign(d) * Math.min(speed, Math.abs(d));
    rt.x = Math.max(minX, Math.min(maxX, rt.x + rt.vx));
    rt.facing = rt.vx >= 0 ? 1 : -1;
    rt.state = 'move';
    rt.pauseT = 0;
    return false;
  }
  rt.vx = 0;
  rt.state = 'idle';
  rt.facing = restFacing;
  return true;
}

/** 休整夜晚战友平稳驻守，或在营业冲刺期辅助看灶与兜底溢出的传菜台/陈旧脏盘 */
function stepAlliesCamp(run: RunState, ev: GameEvent[]) {
  const inside = run.inside;
  const rush = inside && run.dinerShift.mode === 'open';
  const passCap = passCounterCapacity(run);

  for (const allyId of run.story.allies) {
    const rt = run.allies[allyId];
    if (!rt) continue;
    const pos = ALLY_POS[allyId];
    const role = allyRole(run, allyId);
    const anchorX = inside ? pos.intX : pos.extX;
    rt.y = inside ? 0 : pos.extY;
    rt.atkT = 0;
    rt.fireDone = true;

    if (role === 'dispatch' && inside) {
      rt.vx = 0;
      rt.state = 'idle';
      rt.staffTask = 'idle';
      rt.staffT = 0;
      rt.staffGuestId = undefined;
      continue;
    }

    if (!rush || role === 'rest') {
      rt.staffTask = 'idle';
      rt.staffT = 0;
      rt.staffGuestId = undefined;
      if (rt.pauseT === undefined) rt.pauseT = 0;
      patrolWithPause(rt, anchorX - 8, anchorX + 8, 0.22, 68 + (allyId.length % 3) * 18);
      if (rt.state === 'idle') rt.facing = inside && pos.intFlip ? -1 : 1;
      continue;
    }

    if (role === 'kitchen') {
      if (run.dinerShift.kitchenOrders.length > 0) {
        rt.staffTask = 'cook';
        stepAllyTo(rt, IN_STATIONS.kitchen + 18, IN_MIN_X, IN_MAX_X, 1.05, -1);
      } else {
        rt.staffTask = 'idle';
        rt.staffT = 0;
        stepAllyTo(rt, anchorX, IN_MIN_X, IN_MAX_X, 0.9, pos.intFlip ? -1 : 1);
      }
      continue;
    }

    if (allyId === 'qiang') {
      const dp = run.dinerShift.dirtyTables.find((d) => run.tick - d.createdTick >= 280);
      if (dp) {
        rt.staffTask = 'clean';
        const arrived = stepAllyTo(rt, dp.x, IN_MIN_X, IN_MAX_X, 1.2, dp.x >= rt.x ? 1 : -1);
        if (arrived) {
          rt.staffT = (rt.staffT ?? 0) + 1;
          if (rt.staffT >= 45) {
            const idx = run.dinerShift.dirtyTables.findIndex((d) => d.id === dp.id);
            if (idx >= 0) {
              run.dinerShift.dirtyTables.splice(idx, 1);
              const tip = 2;
              run.coins += tip;
              run.dinerShift.coinsEarned += tip;
              run.dinerShift.cleanedCount++;
              ev.push({ t: 'tableClean', x: dp.x, coins: tip, byAlly: 'qiang' });
            }
            rt.staffT = 0;
          }
        }
      } else {
        rt.staffTask = 'idle';
        rt.staffT = 0;
        stepAllyTo(rt, anchorX, IN_MIN_X, IN_MAX_X, 1.0, pos.intFlip ? -1 : 1);
      }
    } else if (allyId === 'zhang') {
      const overflowing = run.dinerShift.counterDishes.length >= Math.max(2, passCap - 1);
      const cd = run.dinerShift.counterDishes.find((c) => c.id === Number(rt.staffGuestId))
        ?? (overflowing ? run.dinerShift.counterDishes[0] : undefined);
      const destGuest = cd
        ? (run.guests.find((o) => o.id === cd.guestId && !o.served && o.walkState === 'seated')
          ?? run.guests.find((o) => o.orderKind === 'dish' && !o.served && o.walkState === 'seated'))
        : undefined;
      if (cd && destGuest) {
        rt.staffTask = 'serve';
        if (rt.staffGuestId !== String(cd.id)) {
          const atPass = stepAllyTo(rt, IN_STATIONS.pass, IN_MIN_X, IN_MAX_X, 1.2, -1);
          if (atPass) {
            rt.staffGuestId = String(cd.id);
            rt.staffT = 0;
          }
        } else {
          const atTable = stepAllyTo(rt, destGuest.x, IN_MIN_X, IN_MAX_X, 1.2, destGuest.seatIdx % 2 === 0 ? 1 : -1);
          if (atTable) {
            rt.staffT = (rt.staffT ?? 0) + 1;
            if (rt.staffT >= 16) {
              const idx = run.dinerShift.counterDishes.findIndex((c) => c.id === cd.id);
              if (idx >= 0) {
                run.dinerShift.counterDishes.splice(idx, 1);
                completeServeGuest(run, destGuest, cd.quality, ev, false, false, cd.isRye);
              }
              rt.staffGuestId = undefined;
              rt.staffT = 0;
            }
          }
        }
      } else {
        rt.staffTask = 'host';
        rt.staffT = 0;
        rt.staffGuestId = undefined;
        stepAllyTo(rt, anchorX, IN_MIN_X, IN_MAX_X, 0.95, pos.intFlip ? -1 : 1);
      }
    } else {
      rt.staffTask = 'host';
      rt.staffT = 0;
      const busyGuest = run.guests.find((o) => !o.served && o.walkState === 'seated' && (o.seatIdx === 1 || o.seatIdx === 2));
      const hostFace: 1 | -1 = busyGuest ? (busyGuest.x >= anchorX ? 1 : -1) : -1;
      stepAllyTo(rt, anchorX, IN_MIN_X, IN_MAX_X, 0.85, hostFace);
    }
  }
}

/** 四位驻守战友真实参战：动作帧与出手判定严格同步，冷静站位索敌、零太空步倒走（受酒馆【猎魔同袍·战友狂飙】与【双层传菜架】加成） */
function stepAllies(run: RunState, ev: GameEvent[]) {
  if (run.inside || (run.phase !== 'fight' && run.phase !== 'clear')) return;
  const p = run.player;
  const fury = !!run.buff.allyFury;
  const allyDmgMul = (fury ? 1.35 : 1) * (hasTavernUpgrade(run, 'wide_pass') ? 1.15 : 1);
  const cdMul = fury ? 0.75 : 1;

  for (const allyId of run.story.allies) {
    const rt = run.allies[allyId];
    if (!rt) continue;
    const pos = ALLY_POS[allyId];
    if (typeof rt.x !== 'number') {
      rt.x = pos.extX; rt.y = pos.extY; rt.vx = 0; rt.state = 'idle'; rt.dir = allyId === 'qiang' ? -1 : 1;
      rt.pauseT = 0; rt.atkSeq = 0; rt.fireDone = true;
    }
    rt.y = pos.extY;
    if (rt.cd > 0) rt.cd--;

    if (run.phase === 'fight') {
      if (allyId === 'lin' && run.tick % 240 === 0 && p.hp > 0 && p.hp < p.maxHp) {
        p.hp = Math.min(p.maxHp, p.hp + (fury ? 2 : 1));
      }
      if (allyId === 'qiang' && run.tick % 180 === 0 && run.wall.hp > 0 && run.wall.hp < run.wall.maxHp) {
        run.wall.hp = Math.min(run.wall.maxHp, run.wall.hp + (fury ? 6 : 3));
      }
    }

    const ay = GROUND_Y + rt.y - 26;

    if (rt.atkT > 0) {
      rt.atkT--;
      rt.vx = 0;
      rt.state = 'atk';
      const strikeTick = allyId === 'zhang' ? 11 : allyId === 'lin' ? 15 : allyId === 'qiang' ? 16 : 18;
      if (rt.atkT === strikeTick && !rt.fireDone) {
        rt.fireDone = true;
        if (allyId === 'qiang') {
          const targets = run.zombies.filter((z) => z.hp > 0 && (z.y ?? 0) >= -36 && Math.hypot(z.x - rt.x, zombieBodyY(z) - ay) <= 84);
          if (targets.length > 0) {
            rt.facing = targets[0].x >= rt.x ? 1 : -1;
            const dmg = Math.round((17 + run.day * 1.8) * allyDmgMul);
            for (const z of targets) {
              damageZombie(run, z, dmg, ev, { byPlayer: false, kb: 4.4, dir: z.x >= rt.x ? 1 : -1, heavy: true });
            }
          }
          ev.push({ t: 'shot', x: rt.x + rt.facing * 24, y: ay, from: 'ally', ally: 'qiang', ang: rt.facing > 0 ? 0 : Math.PI });
        } else {
          const maxR = allyId === 'zhang' ? 460 : allyId === 'lin' ? 390 : 490;
          const findTarget = () => {
            const pinned = rt.atkTargetId != null ? run.zombies.find((z) => z.id === rt.atkTargetId && z.hp > 0 && Math.hypot(z.x - rt.x, zombieBodyY(z) - ay) <= maxR) : undefined;
            if (pinned) return pinned;
            return run.zombies
              .filter((z) => z.hp > 0 && Math.hypot(z.x - rt.x, zombieBodyY(z) - ay) <= maxR)
              .sort((a, b) => {
                if (allyId === 'zhao') {
                  const fa = ZOMBIES[a.kind].flying ? 1 : 0, fb = ZOMBIES[b.kind].flying ? 1 : 0;
                  if (fa !== fb) return fb - fa;
                }
                return Math.hypot(a.x - rt.x, zombieBodyY(a) - ay) - Math.hypot(b.x - rt.x, zombieBodyY(b) - ay);
              })[0];
          };
          const liveTarget = findTarget();
          const dx = liveTarget ? liveTarget.x - rt.x : rt.facing;
          const dy = liveTarget ? zombieBodyY(liveTarget) - ay : 0;
          const len = Math.hypot(dx, dy) || 1;
          if (liveTarget) rt.facing = dx >= 0 ? 1 : -1;
          const ox = rt.x + (dx / len) * 14, oy = ay + (dy / len) * 14;
          const ang = Math.atan2(dy, dx);
          if (allyId === 'zhang') {
            run.bullets.push({
              x: ox, y: oy, vx: (dx / len) * 13.5, vy: (dy / len) * 13.5,
              dmg: Math.round((13 + run.day * 1.5) * allyDmgMul), life: 42,
              from: 'ally', allyId: 'zhang', pierce: true, pierceLeft: 2, crit: false, bounces: 0, hit: [], kind: 'spear',
            });
          } else if (allyId === 'lin') {
            run.bullets.push({
              x: ox, y: oy, vx: (dx / len) * 9.5, vy: (dy / len) * 9.5,
              dmg: Math.round((12 + run.day * 1.25) * allyDmgMul), life: 45,
              from: 'ally', allyId: 'lin', pierce: false, crit: false, bounces: 0, hit: [], aoe: 44, burn: 105, kind: 'firebolt',
            });
          } else {
            run.bullets.push({
              x: ox, y: oy, vx: (dx / len) * 15, vy: (dy / len) * 15,
              dmg: Math.round((11 + run.day * 1.35) * allyDmgMul), life: 40,
              from: 'ally', allyId: 'zhao', pierce: false, crit: false, bounces: 0, hit: [], kind: 'qi',
            });
          }
          ev.push({ t: 'shot', x: ox, y: oy, from: 'ally', ally: allyId, ang });
        }
      }
      if (rt.atkT > 0) continue;
    }

    if (allyId === 'zhang') {
      const best = run.zombies
        .filter((z) => z.hp > 0 && Math.hypot(z.x - rt.x, zombieBodyY(z) - ay) <= 450)
        .sort((a, b) => Math.hypot(a.x - rt.x, zombieBodyY(a) - ay) - Math.hypot(b.x - rt.x, zombieBodyY(b) - ay))[0];
      if (!best) {
        patrolWithPause(rt, 124, 198, 0.58, 60);
        if (rt.state === 'idle') rt.facing = 1;
        continue;
      }
      if (rt.cd === 0) {
        rt.cd = Math.round(72 * cdMul); rt.atkT = 20; rt.vx = 0; rt.state = 'atk';
        rt.facing = best.x >= rt.x ? 1 : -1;
        rt.atkSeq = (rt.atkSeq ?? 0) + 1;
        rt.fireDone = false;
        rt.atkTargetId = best.id;
        rt.pauseT = 0;
        continue;
      }
      const vantageX = best.x > 300 ? 196 : Math.max(122, Math.min(224, best.x - 44));
      stepAllyTo(rt, vantageX, 118, ROOF_MAX_X - 18, 0.72, best.x >= rt.x ? 1 : -1);
    } else if (allyId === 'lin') {
      const best = run.zombies
        .filter((z) => z.hp > 0 && Math.hypot(z.x - rt.x, zombieBodyY(z) - ay) <= 375)
        .sort((a, b) => Math.hypot(a.x - rt.x, zombieBodyY(a) - ay) - Math.hypot(b.x - rt.x, zombieBodyY(b) - ay))[0];
      if (!best) {
        patrolWithPause(rt, PORCH_MIN_X + 14, PORCH_MAX_X - 16, 0.42, 70);
        if (rt.state === 'idle') rt.facing = 1;
        continue;
      }
      if (rt.cd === 0) {
        rt.cd = Math.round(84 * cdMul); rt.atkT = 40; rt.vx = 0; rt.state = 'atk';
        rt.facing = best.x >= rt.x ? 1 : -1;
        rt.atkSeq = (rt.atkSeq ?? 0) + 1;
        rt.fireDone = false;
        rt.atkTargetId = best.id;
        rt.pauseT = 0;
        continue;
      }
      const vantageX = best.x >= rt.x ? 278 : 250;
      stepAllyTo(rt, vantageX, PORCH_MIN_X + 10, PORCH_MAX_X - 10, 0.48, best.x >= rt.x ? 1 : -1);
    } else if (allyId === 'qiang') {
      const nearestEnemy = run.zombies
        .filter((z) => z.hp > 0 && (z.y ?? 0) >= -36 && z.x <= WALL_X + 70)
        .sort((a, b) => Math.abs(a.x - rt.x) - Math.abs(b.x - rt.x))[0];
      const inStrikeRange = run.zombies.filter((z) => z.hp > 0 && (z.y ?? 0) >= -36 && Math.hypot(z.x - rt.x, zombieBodyY(z) - ay) <= 84);
      if (inStrikeRange.length > 0 && rt.cd === 0) {
        rt.cd = Math.round(72 * cdMul); rt.atkT = 26; rt.vx = 0; rt.state = 'atk';
        rt.facing = inStrikeRange[0].x >= rt.x ? 1 : -1;
        rt.atkSeq = (rt.atkSeq ?? 0) + 1;
        rt.fireDone = false;
        rt.atkTargetId = inStrikeRange[0].id;
        rt.pauseT = 0;
      } else if (nearestEnemy) {
        const goalX = Math.max(278, Math.min(WALL_X - 10, nearestEnemy.x - 24));
        stepAllyTo(rt, goalX, 278, WALL_X - 8, 1.45, nearestEnemy.x >= rt.x ? 1 : -1, true);
      } else {
        stepAllyTo(rt, WALL_X - 24, 278, WALL_X - 8, 1.0, 1, true);
      }
    } else if (allyId === 'zhao') {
      const best = run.zombies
        .filter((z) => z.hp > 0 && Math.hypot(z.x - rt.x, zombieBodyY(z) - ay) <= 480)
        .sort((a, b) => {
          const fa = ZOMBIES[a.kind].flying ? 1 : 0, fb = ZOMBIES[b.kind].flying ? 1 : 0;
          if (fa !== fb) return fb - fa;
          return Math.hypot(a.x - rt.x, zombieBodyY(a) - ay) - Math.hypot(b.x - rt.x, zombieBodyY(b) - ay);
        })[0];
      if (!best) {
        patrolWithPause(rt, ROOF_MIN_X + 14, 108, 0.7, 64);
        if (rt.state === 'idle') rt.facing = 1;
        continue;
      }
      if (rt.cd === 0) {
        rt.cd = Math.round(54 * cdMul); rt.atkT = 24; rt.vx = 0; rt.state = 'atk';
        rt.facing = best.x >= rt.x ? 1 : -1;
        rt.atkSeq = (rt.atkSeq ?? 0) + 1;
        rt.fireDone = false;
        rt.atkTargetId = best.id;
        rt.pauseT = 0;
        continue;
      }
      const vantageX = ZOMBIES[best.kind].flying ? 86 : best.x > 260 ? 104 : 64;
      stepAllyTo(rt, vantageX, ROOF_MIN_X + 10, 114, 0.78, best.x >= rt.x ? 1 : -1);
    }
  }
}

function stepBullets(run: RunState, ev: GameEvent[]) {
  const out: Bullet[] = [];
  const spawned: Bullet[] = [];
  for (const b of run.bullets) {
    // 焦土爆炎炮追踪火弹在半空柔和转向锁定最近 2D 敌群
    if (b.homing && b.life > 2) {
      const steerTarget = run.zombies.filter((z) => z.hp > 0 && !b.hit.includes(z.id) && Math.hypot(z.x - b.x, zombieBodyY(z) - b.y) <= 230)
        .sort((a, c) => Math.hypot(a.x - b.x, zombieBodyY(a) - b.y) - Math.hypot(c.x - b.x, zombieBodyY(c) - b.y))[0];
      if (steerTarget) {
        const sp = Math.hypot(b.vx, b.vy) || 8.8;
        const tx = steerTarget.x - b.x, ty = zombieBodyY(steerTarget) - b.y, len = Math.hypot(tx, ty) || 1;
        const dvx = (tx / len) * sp, dvy = (ty / len) * sp;
        b.vx += (dvx - b.vx) * 0.14;
        b.vy += (dvy - b.vy) * 0.14;
      }
    }

    b.x += b.vx; b.y += b.vy; b.life--;
    let alive = b.life > 0 && b.y < GROUND_Y + 4 && b.y > -120 && b.x > -40 && b.x < SPAWN_X + 60;
    if (alive) {
      for (const z of run.zombies) {
        if (z.hp <= 0 || b.hit.includes(z.id)) continue;
        const defZ = ZOMBIES[z.kind];
        const zcy = zombieBodyY(z);
        const hitW = defZ.boss ? 25 : z.kind === 'bat' ? 16 : 14;
        const hitTop = GROUND_Y + (z.y ?? 0) - (defZ.boss ? 108 : z.kind === 'bat' ? 30 : 56);
        const hitBot = GROUND_Y + (z.y ?? 0) + (z.kind === 'bat' ? 4 : 2);
        if (Math.abs(b.x - z.x) > hitW || b.y < hitTop || b.y > hitBot) continue;
        b.hit.push(z.id);
        const byPlayer = b.from === 'player';

        if (b.kind === 'frost' && b.aoe) {
          ev.push({ t: 'frost', x: b.x, y: b.y, r: b.aoe });
          for (const o of run.zombies) if (o.hp > 0 && Math.hypot(o.x - b.x, zombieBodyY(o) - b.y) <= b.aoe) damageZombie(run, o, b.dmg, ev, { byPlayer: false, slow: b.slow ?? 150 });
          alive = false;
          break;
        }
        if (b.kind === 'firebolt' && b.aoe) {
          explodeAt(run, b.x, Math.min(BODY_Y, b.y), b.aoe, b.dmg, ev, false, true, false);
          alive = false;
          break;
        }
        if ((b.kind === 'rocket' || b.kind === 'cannon') && b.aoe) {
          explodeAt(run, b.x, Math.min(BODY_Y, b.y), b.aoe, b.dmg, ev, byPlayer, b.kind === 'rocket', b.kind === 'rocket');
          alive = false;
          break;
        }

        const wasSlowed = z.slowT > 0 || z.freezeT > 0;
        const closeHit = b.closeBoost && b.startX !== undefined && Math.hypot(z.x - b.startX, zcy - (b.startY ?? zcy)) <= 205;
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

        // 寒霜连铳特色：命中已减速目标深冻定身并引爆碎冰溅射
        if (byPlayer && b.shatter && wasSlowed) {
          const shatterR = curWeapon(run).id === 'assault' && curWeapon(run).star >= 5 ? 58 : 48;
          ev.push({ t: 'frost', x: z.x, y: zcy, r: shatterR });
          for (const o of run.zombies) {
            if (o.id !== z.id && o.hp > 0 && Math.hypot(o.x - z.x, zombieBodyY(o) - zcy) <= shatterR) {
              damageZombie(run, o, b.dmg * 0.55, ev, { byPlayer: true, slow: 115, freeze: 36, weaponId: b.weaponId });
            }
          }
        }
        if (byPlayer && has(run, 'incendiary') && z.hp > 0 && rand(run) < 0.25) z.burnT = 180;
        if (byPlayer && has(run, 'frostbite')) z.slowT = 135;
        if (byPlayer && has(run, 'shock') && z.hp > 0 && rand(run) < 0.25) {
          const next = run.zombies.find((o) => o.id !== z.id && o.hp > 0 && Math.hypot(o.x - z.x, zombieBodyY(o) - zcy) <= 145);
          if (next) fireLightning(run, z.x, zcy, next, b.dmg * 0.55, 2, ev, { byPlayer: true, color: 'shock' });
        }

        // 重锤左轮先天跳弹追击 + 弹射天赋叠加
        if (byPlayer && ((b.ricochetLeft ?? 0) > 0 || (has(run, 'ricochet') && b.bounces < 3 && rand(run) < 0.55))) {
          const next = run.zombies.filter((o) => o.hp > 0 && !b.hit.includes(o.id) && Math.hypot(o.x - z.x, zombieBodyY(o) - zcy) <= 165)
            .sort((a, c) => Math.hypot(a.x - z.x, zombieBodyY(a) - zcy) - Math.hypot(c.x - z.x, zombieBodyY(c) - zcy))[0];
          if (next) {
            const sp = Math.hypot(b.vx, b.vy), nx = next.x - z.x, ny = zombieBodyY(next) - b.y, nlen = Math.hypot(nx, ny) || 1;
            const useWeaponBounce = (b.ricochetLeft ?? 0) > 0;
            spawned.push({
              ...b,
              x: z.x, y: zcy,
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
    // 爆炎重弹/黑铁重炮落到地面直接爆开并铺设焦土火海
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
    const hitZ = run.zombies.some((z) => {
      if (z.hp <= 0) return false;
      const top = GROUND_Y + (z.y ?? 0) - (ZOMBIES[z.kind].boss ? 96 : z.kind === 'bat' ? 28 : 48);
      const bot = GROUND_Y + (z.y ?? 0) + 6;
      return Math.abs(g.x - z.x) <= 20 && g.y >= top && g.y <= bot;
    });
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
    stepTavernShift(run, ev);
    stepAlliesCamp(run, ev);
    stepStaffCamp(run, ev);
    return ev;
  }
  if (run.phase !== 'fight' && run.phase !== 'clear') return ev;

  run.tick++; run.phaseT++;
  stepPlayer(run, input, ev);

  if (run.phase === 'fight') {
    if (run.spawn.left > 0 && --run.spawn.timer <= 0) {
      const day1Normal = run.day === 1 && (run.difficulty ?? 'normal') === 'normal';
      const groupCap = day1Normal ? 1 : run.day === 1 ? 1.35 : 1.7 + run.day * 0.44;
      const group = Math.min(run.spawn.left, 1 + Math.floor(rand(run) * groupCap));
      for (let i = 0; i < group; i++) { spawnZombie(run); run.spawn.left--; }
      if (run.spawn.bossKind && !run.spawn.bossSpawned && run.spawn.left <= Math.floor(run.spawn.total / 2)) {
        run.spawn.bossSpawned = true;
        spawnZombie(run, run.spawn.bossKind);
        ev.push({ t: 'bossAppear', kind: run.spawn.bossKind });
      }
      run.spawn.timer = day1Normal
        ? 48 + Math.floor(rand(run) * 14)
        : run.day === 1
          ? 40 + Math.floor(rand(run) * 14)
          : Math.round(Math.max(10, 25 - run.day * 0.9) * (0.52 + group * 0.42)) + Math.floor(rand(run) * 8);
    }
  }

  stepZombies(run, ev);
  stepFires(run, ev);
  stepTurrets(run, ev);
  stepAllies(run, ev);
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
    if (run.diner.contract?.id === 'iron_wall' && !run.diner.contract.done && run.wall.hp >= run.wall.maxHp * 0.5) {
      progressBattleContract(run, 1, ev);
    }
    ev.push({ t: 'dayClear', day: run.day });
  } else if (run.phase === 'clear' && run.phaseT >= 110 && (run.crates.length === 0 || run.phaseT >= 220)) {
    while (run.crates.length > 0) {
      const c = run.crates.shift()!;
      collectCrate(run, c.weapon, ev);
    }
    if (run.day >= LAST_DAY && !run.endless) {
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
      if (picks.length > 0) {
        run.perkChoices = picks;
        run.phase = 'perk';
      } else {
        enterCampSession(run, ev);
      }
    }
  }
  return ev;
}

const qiangWallBonus = (run: RunState) => (hasAlly(run, 'qiang') ? 50 : 0) + tavernWallMaxBonus(run);

function enterCampSession(run: RunState, ev: GameEvent[]) {
  run.phase = 'camp';
  run.inside = true;
  run.player.x = IN_STATIONS.kitchen + 20;
  run.player.y = 0;
  run.player.vy = 0;
  run.player.facing = -1;
  syncAlliesPos(run, true);
  run.carryingDish = null;
  run.pourMinigame = null;
  run.carryingDrink = null;
  run.dinerShift = makeIdleShift(0);
  rollShopOffers(run);
  rollDinerGuests(run);
  resolveNightPrepAndDispatch(run, ev);
  ev.push({ t: 'inside', inside: true });
}

/** 面板和按钮的指令。成功返回事件，不满足条件（钱不够、时机不对）返回 null。 */
export function command(run: RunState, cmd: Command): GameEvent[] | null {
  const ev: GameEvent[] = [];
  switch (cmd.t) {
    case 'pickPerk': {
      if (run.phase !== 'perk' || !run.perkChoices.includes(cmd.id)) return null;
      run.perks.push(cmd.id); run.perkChoices = [];
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

      enterCampSession(run, ev);
      return ev;
    }
    case 'nextDay': {
      if (run.phase !== 'camp') return null;
      const healFrac = DIFFICULTIES[run.difficulty ?? 'normal'].nightHeal;
      const linFlat = hasAlly(run, 'lin') ? (run.difficulty === 'nightmare' ? 6 : 12) : 0;
      run.player.hp = Math.min(run.player.maxHp, Math.round(run.player.hp + run.player.maxHp * healFrac + linFlat));
      run.crates = [];
      for (const w of run.player.weapons) w.ammo = magSize(w.id, w.star);
      startDay(run, ev);
      return ev;
    }
    case 'enterEndless': {
      if (run.phase !== 'won') return null;
      run.endless = true;
      run.player.hp = run.player.maxHp;
      run.crates = [];
      for (const w of run.player.weapons) w.ammo = magSize(w.id, w.star);
      enterCampSession(run, ev);
      ev.push({ t: 'endlessEnter' });
      return ev;
    }
    case 'nextEndlessNight': {
      if (run.phase !== 'camp' || !run.endless) return null;
      run.day++;
      const healFrac = Math.max(0.25, DIFFICULTIES[run.difficulty ?? 'normal'].nightHeal);
      run.player.hp = Math.min(run.player.maxHp, Math.round(run.player.hp + run.player.maxHp * healFrac));
      run.crates = [];
      for (const w of run.player.weapons) w.ammo = magSize(w.id, w.star);
      const tb = computeTomorrowBattleBuff(run);
      if (tb.dishes.length > 0 || tb.allyFury) {
        run.buff = {
          dmgMul: tb.dmgMul,
          haste: tb.haste,
          turretMul: tb.turretMul,
          critBonus: tb.critBonus,
          frostRounds: tb.frostRounds,
          allyFury: tb.allyFury,
        };
        if (tb.armor > 0) run.player.armor = Math.min(run.player.maxArmor, run.player.armor + tb.armor);
        run.meal = null;
        run.mealQuality = 'good';
      } else {
        run.buff = { dmgMul: 0, haste: 0, turretMul: 0, critBonus: 0, frostRounds: false, allyFury: false };
      }
      run.diner.feastDishes = [];
      run.diner.supportsTriggered = [];
      rollDailyTrend(run);
      rollBattleContract(run);
      enterCampSession(run, ev);
      ev.push({ t: 'dayStart', day: run.day });
      return ev;
    }
    case 'enterHouse':
      if (run.phase !== 'camp' || run.inside) return null;
      run.inside = true; run.player.x = IN_STATIONS.door - 24; run.player.y = 0; run.player.vy = 0; run.player.facing = -1;
      syncAlliesPos(run, true);
      ev.push({ t: 'inside', inside: true });
      return ev;
    case 'exitHouse':
      if (run.phase !== 'camp' || !run.inside) return null;
      run.inside = false; run.player.x = DOOR_X; run.player.y = 0; run.player.vy = 0; run.player.facing = 1;
      syncAlliesPos(run, false);
      run.carryingDish = null; run.pourMinigame = null; run.carryingDrink = null;
      if (run.dinerShift.mode !== 'prep') run.dinerShift = makeIdleShift(run.dinerShift.spiceSpentCoins);
      ev.push({ t: 'inside', inside: false });
      return ev;
    case 'startShift': {
      return startShiftCmd(run, ev);
    }
    case 'closeShift': {
      if (run.phase !== 'camp' || run.dinerShift.mode !== 'open') return null;
      finishShiftToSummary(run, ev);
      return ev;
    }
    case 'finishSummary': {
      if (run.dinerShift.mode !== 'summary') return null;
      run.dinerShift = makeIdleShift(0);
      run.guests = run.guests
        .filter((g) => !g.served && g.walkState !== 'leaving' && !g.angry)
        .map((g) => ({ ...g, patience: 9999, maxPatience: 9999, eatT: 0 }));
      return ev;
    }
    case 'toggleMenuDish': {
      return toggleMenuDishCmd(run, cmd.id, ev);
    }
    case 'upgradeDish': {
      return upgradeDishCmd(run, cmd.id, ev);
    }
    case 'buyTavernUpgrade': {
      return buyTavernUpgradeCmd(run, cmd.id, ev);
    }
    case 'postRecruitment': {
      return postRecruitmentCmd(run, cmd.tier, ev);
    }
    case 'hireStaff': {
      return hireStaffCmd(run, cmd.id, ev);
    }
    case 'setStaffRole': {
      return setStaffRoleCmd(run, cmd.id, cmd.role, ev);
    }
    case 'trainStaff': {
      return trainStaffCmd(run, cmd.id, ev);
    }
    case 'setAllyRole': {
      return setAllyRoleCmd(run, cmd.ally, cmd.role, ev);
    }
    case 'upgradeRack': {
      return upgradeRackCmd(run, ev);
    }
    case 'startPour': {
      if (run.phase !== 'camp' || !run.inside || run.carryingDish || run.carryingDrink || run.pourMinigame) return null;
      const guest = (cmd.guestId ? run.guests.find((o) => o.id === cmd.guestId && !o.served && o.walkState !== 'leaving') : undefined)
        ?? run.guests.filter((o) => o.orderKind === 'drink' && !o.served && o.walkState === 'seated' && o.drink === cmd.drink).sort((a, b) => a.patience - b.patience)[0]
        ?? run.guests.filter((o) => o.orderKind === 'drink' && !o.served && o.walkState === 'seated').sort((a, b) => a.patience - b.patience)[0];
      const drinkId: DrinkId = guest?.drink ?? cmd.drink;
      run.pourMinigame = {
        drink: drinkId,
        guestId: guest?.id ?? null,
        fill: 0,
        speed: 0.015,
        startedTick: run.tick,
      };
      return ev;
    }
    case 'stopPour': {
      if (run.phase !== 'camp' || !run.inside || !run.pourMinigame) return null;
      const pour = run.pourMinigame;
      run.pourMinigame = null;
      const quality = pourQuality(pour.fill, hasTavernUpgrade(run, 'fast_tap'));
      run.carryingDrink = { drink: pour.drink, guestId: pour.guestId, quality };
      ev.push({ t: 'pourDone', drink: pour.drink, quality });
      return ev;
    }
    case 'cancelPour': {
      if (!run.pourMinigame) return null;
      run.pourMinigame = null;
      return ev;
    }
    case 'serveDrink': {
      if (run.phase !== 'camp' || !run.inside || !run.carryingDrink) return null;
      const carried = run.carryingDrink;
      const g = (cmd.guestId ? run.guests.find((o) => o.id === cmd.guestId && !o.served && o.walkState !== 'leaving') : undefined)
        ?? (carried.guestId ? run.guests.find((o) => o.id === carried.guestId && !o.served && o.walkState !== 'leaving') : undefined)
        ?? run.guests.filter((o) => o.orderKind === 'drink' && !o.served && o.walkState === 'seated' && o.drink === carried.drink)[0]
        ?? run.guests.find((o) => o.orderKind === 'drink' && !o.served && o.walkState === 'seated');
      run.carryingDrink = null;
      if (!g) return ev;
      completeServeGuest(run, g, carried.quality, ev, false, true);
      return ev;
    }
    case 'cleanTable': {
      if (run.phase !== 'camp' || !run.inside) return null;
      const idx = run.dinerShift.dirtyTables.findIndex((dp) => dp.id === cmd.plateId);
      if (idx < 0) return null;
      const [dp] = run.dinerShift.dirtyTables.splice(idx, 1);
      const tip = run.cls === 'chef' ? 4 : 3;
      run.coins += tip;
      run.dinerShift.coinsEarned += tip;
      run.dinerShift.cleanedCount++;
      ev.push({ t: 'tableClean', x: dp.x, coins: tip });
      return ev;
    }
    case 'pickCounterDish': {
      if (run.phase !== 'camp' || !run.inside || run.carryingDish || run.carryingDrink || run.pourMinigame) return null;
      const list = run.dinerShift.counterDishes;
      if (list.length === 0) return null;
      const idx = cmd.id !== undefined ? Math.max(0, list.findIndex((c) => c.id === cmd.id)) : 0;
      const [cd] = list.splice(idx, 1);
      run.carryingDish = { guestId: cd.guestId, dish: cd.dish, dishName: cd.dishName, quality: cd.quality, isRye: cd.isRye };
      return ev;
    }
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
      const cost = turretBuildCost(cmd.kind, run.cls, hasAlly(run, 'qiang'), !!run.diner.smithDiscount);
      if (run.coins < cost) return null;
      run.coins -= cost;
      slot.type = cmd.kind; slot.level = 1; slot.cd = 0; slot.aim = 0; slot.mode = 'near';
      const meta = TURRET_SLOTS[cmd.slot];
      ev.push({ t: 'build', kind: 'turret' });
      ev.push({ t: 'fortify', x: meta.x, y: meta.roof ? ROOF_Y - 12 : -18, label: `${TURRETS[cmd.kind].name} 落成!` });
      return ev;
    }
    case 'upgradeTurret': {
      const slot = run.turrets[cmd.slot];
      if (!slot || !slot.type || slot.level >= TURRETS[slot.type].levels.length) return null;
      const cost = turretUpgradeCost(slot.type, slot.level, run.cls, hasAlly(run, 'qiang'), !!run.diner.smithDiscount);
      if (run.coins < cost) return null;
      run.coins -= cost; slot.level++;
      const meta = TURRET_SLOTS[cmd.slot];
      ev.push({ t: 'build', kind: 'turret' });
      ev.push({ t: 'fortify', x: meta.x, y: meta.roof ? ROOF_Y - 12 : -18, label: `${TURRETS[slot.type].name} Lv.${slot.level}!` });
      return ev;
    }
    case 'cycleTurretMode': {
      const slot = run.turrets[cmd.slot];
      if (!slot || !slot.type) return null;
      const order: TurretTargetMode[] = ['near', 'boss', 'air'];
      slot.mode = order[(order.indexOf(slot.mode ?? 'near') + 1) % order.length];
      return ev;
    }
    case 'sellTurret': {
      const slot = run.turrets[cmd.slot];
      if (!slot || !slot.type) return null;
      run.coins += turretRefundCoins(slot.type, slot.level, run.cls, hasAlly(run, 'qiang'));
      slot.type = null; slot.level = 0; slot.cd = 0; slot.mode = 'near';
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
      ev.push({ t: 'fortify', x: WALL_X, y: -28, label: `${next.name} Lv.${run.wall.level}!` });
      return ev;
    }
    case 'repairWall':
      if (run.wall.hp >= run.wall.maxHp || run.coins < WALL_REPAIR_COST) return null;
      run.coins -= WALL_REPAIR_COST; run.wall.hp = run.wall.maxHp;
      ev.push({ t: 'build', kind: 'wall' });
      ev.push({ t: 'fortify', x: WALL_X, y: -28, label: '防线已修满!' });
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
      ev.push({ t: 'fortify', x: 166, y: ROOF_Y - 14, label: `${next.name} Lv.${run.fort.level}!` });
      return ev;
    }
    case 'repairFort':
      if (run.home.hp >= run.home.maxHp || run.coins < FORT_REPAIR_COST) return null;
      run.coins -= FORT_REPAIR_COST; run.home.hp = run.home.maxHp;
      ev.push({ t: 'build', kind: 'fort' });
      ev.push({ t: 'fortify', x: 166, y: ROOF_Y - 14, label: '大屋已修满!' });
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
        ev.push({ t: 'shop', item: '爆炎弹 ×2' });
        return ev;
      }
      if (cmd.item === 'armor') {
        if (p.armor >= p.maxArmor || run.coins < SHOP_ARMOR_COST) return null;
        run.coins -= SHOP_ARMOR_COST; p.armor = Math.min(p.maxArmor, p.armor + 40);
        ev.push({ t: 'shop', item: '镶铁护甲 +40' });
        return ev;
      }
      if (cmd.item === 'medkit') {
        if (p.hp >= p.maxHp || run.coins < SHOP_MEDKIT_COST) return null;
        run.coins -= SHOP_MEDKIT_COST; p.hp = Math.min(p.maxHp, p.hp + 45);
        ev.push({ t: 'shop', item: '秘药汤剂 +45' });
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
    case 'serveCarried': {
      if (run.phase !== 'camp' || !run.inside || !run.carryingDish) return null;
      const carried = run.carryingDish;
      const g = run.guests.find((o) => o.id === carried.guestId && !o.served && o.walkState !== 'leaving')
        ?? run.guests.find((o) => o.orderKind === 'dish' && !o.served && o.walkState === 'seated' && !o.isRye && o.dish === carried.dish)
        ?? run.guests.find((o) => o.orderKind === 'dish' && !o.served && o.walkState === 'seated');
      run.carryingDish = null;
      if (!g) return ev;
      completeServeGuest(run, g, carried.quality, ev, false, false, carried.isRye);
      return ev;
    }
    case 'serveGuest': {
      if (run.phase !== 'camp') return null;
      const g = run.guests.find((o) => o.id === cmd.guestId && !o.served && o.walkState !== 'leaving');
      if (!g) return null;
      if (g.orderKind === 'dish' && !g.isRye) {
        if ((run.diner.menuStock[g.dish] ?? 0) > 0) {
          run.diner.menuStock[g.dish]! -= 1;
        } else if (!hasIngredients(run, MEALS[g.dish].cost)) {
          return null;
        } else {
          spendIngredients(run, MEALS[g.dish].cost);
        }
      }
      if (run.carryingDish?.guestId === g.id) run.carryingDish = null;
      completeServeGuest(run, g, cmd.quality ?? 'good', ev, false, g.orderKind === 'drink', g.isRye);
      return ev;
    }
    case 'feastAll': {
      return feastAllCmd(run, ev);
    }
    case 'cookSell': {
      return sellMeatKindCmd(run, 'tender', cmd.count, ev);
    }
    case 'sellMeatKind': {
      return sellMeatKindCmd(run, cmd.kind, cmd.count, ev);
    }
    case 'buySpice': {
      return buySpiceCmd(run, cmd.count, ev);
    }
    case 'grindMortar': {
      return grindMortarCmd(run, ev);
    }
    case 'researchDish': {
      return researchDishCmd(run, cmd.id, ev);
    }
    case 'prepDish': {
      return prepDishCmd(run, cmd.id, cmd.batches, ev);
    }
    case 'toggleAutoSupply': {
      return toggleAutoSupplyCmd(run, cmd.id, ev);
    }
    case 'pickMeal': {
      if (run.phase !== 'camp') return null;
      const m = MEALS[cmd.id];
      if (!m || !run.diner.researched.includes(cmd.id)) return null;
      if ((run.diner.feastDishes ?? []).includes(cmd.id)) return null;
      if ((run.diner.menuStock[cmd.id] ?? 0) > 0) {
        run.diner.menuStock[cmd.id]! -= 1;
      } else if (hasIngredients(run, m.cost)) {
        spendIngredients(run, m.cost);
      } else {
        return null;
      }
      const quality: DishQuality = cmd.quality ?? 'good';
      activateDishBattleBuff(run, cmd.id, quality, run.meal === null);
      gainDishXp(run, cmd.id, ev, 1);
      run.diner.fans += 8;
      ev.push({ t: 'meal', id: cmd.id, quality });
      return ev;
    }
  }
}
