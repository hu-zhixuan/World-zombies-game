// 规则层：纯计算，不碰浏览器。固定每秒 60 步；随机数带种子；同样的种子和输入一定得到同样的结果。
import {
  CLASSES, CRIT_CHANCE, CRIT_MUL, DAY_HEAL, DINER_GUESTS, FORT_LEVELS, FORT_REPAIR_COST, LAST_DAY, MAX_FORT_LEVEL, MAX_GRENADES, MAX_STAR, MAX_WALL_LEVEL,
  MEALS, MEAT_SELL_PRICE, PERKS, RARITY_WEIGHT, SHOP_ARMOR_COST, SHOP_GRENADE_COST, SHOP_MEDKIT_COST, SHOP_REROLL_COST, STAR_COST, TURRETS,
  WALL_LEVELS, WALL_REPAIR_COST, WEAPONS, ZOMBIES, bossForDay, dayZombieCount, extraBullets, magSize, starMul, zombieHp,
  type ClassId, type PerkId, type TurretType, type WeaponId, type ZombieKind,
} from '../content/data';
import {
  DINER_SEAT_X, DOOR_X, GROUND_Y, HOME_X, HOUSE_WALL_X, IN_MAX_X, IN_MIN_X, IN_STATIONS, LADDER_X, PLAYER_MAX_X, PLAYER_MIN_X,
  PORCH_MAX_X, PORCH_MIN_X, PORCH_Y, ROOF_MAX_X, ROOF_MIN_X, ROOF_Y, SPAWN_X,
  TURRET_SLOTS, WALL_X, type Bullet, type Command, type DinerGuest, type GameEvent, type Input, type RunState, type StationId, type Zombie,
} from './types';

export const MAX_CARRY = 3;
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
export const curWeapon = (run: RunState) => run.player.weapons[run.player.cur];
const skillActive = (run: RunState, cls: ClassId) => run.cls === cls && run.skill.t > 0;
export const isOnRoof = (run: RunState) => !run.inside && run.player.y <= ROOF_Y + 2 && run.player.x >= ROOF_MIN_X && run.player.x <= ROOF_MAX_X;
export const isOnPorch = (run: RunState) => !run.inside && Math.abs(run.player.y - PORCH_Y) <= 2 && run.player.x >= PORCH_MIN_X && run.player.x <= PORCH_MAX_X;

export const turretBuildCost = (kind: TurretType, cls: ClassId) => Math.ceil(TURRETS[kind].buildScrap * (cls === 'engineer' ? 0.75 : 1));
export const turretUpgradeCost = (kind: TurretType, level: number, cls: ClassId) =>
  Math.ceil((TURRETS[kind].upgradeScrap[level] ?? 0) * (cls === 'engineer' ? 0.75 : 1));
export const turretRefundScrap = (kind: TurretType, level: number, cls: ClassId) => {
  let spent = turretBuildCost(kind, cls);
  for (let l = 1; l < level; l++) spent += turretUpgradeCost(kind, l, cls);
  return Math.max(2, Math.floor(spent * 0.5));
};
export const meatPrice = (cls: ClassId) => Math.round(MEAT_SELL_PRICE * (cls === 'chef' ? 1.35 : 1));
export const weaponDamage = (id: WeaponId, star: number) => WEAPONS[id].damage * starMul(star);

/** 主角射程（在房顶有居高加成，堡垒 3 级再加 15%） */
export function effectiveRange(run: RunState, id: WeaponId = curWeapon(run).id): number {
  let m = 1;
  if (isOnRoof(run)) {
    m += 0.15;
    if (has(run, 'rooftop')) m += 0.2;
    if (run.fort.level >= 3) m += 0.15;
  }
  return Math.round(WEAPONS[id].range * m);
}

/** 伤害倍率：天赋 × 特餐 × 房顶高低差。 */
export function damageMul(run: RunState): number {
  const p = run.player;
  let m = 1 + run.buff.dmgMul;
  if (isOnRoof(run) && has(run, 'rooftop')) m *= 1.3;
  if (has(run, 'glasscannon')) m *= 2.2;
  if (has(run, 'bloodfrenzy')) m *= 1 + (1 - p.hp / p.maxHp) * 0.8;
  if (has(run, 'chainkill')) m *= 1 + Math.min(0.8, run.chain.n * 0.1);
  if (has(run, 'vanguard') && run.vanguardT > 0) m *= 1.5;
  return m;
}

/** 攻速倍率（1.0 为基础） */
const playerHaste = (run: RunState) => 1 + run.buff.haste + (skillActive(run, 'chef') ? 0.4 : 0);

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

function rollDinerGuests(run: RunState) {
  const pool = [...DINER_GUESTS];
  const picked: DinerGuest[] = [];
  const chefMul = run.cls === 'chef' ? 1.35 : 1;
  for (let i = 0; i < 3 && pool.length > 0; i++) {
    const idx = Math.floor(rand(run) * pool.length);
    const g = pool.splice(idx, 1)[0];
    const pay = Math.round((g.basePay + run.day * 2) * chefMul);
    picked.push({
      id: g.id, name: g.name, role: g.role, sprite: g.sprite,
      x: DINER_SEAT_X[i] ?? 300,
      dish: g.dish, dishName: g.dishName, meatCost: g.meatCost, pay,
      orderQuote: g.orderQuote, thanksQuote: g.thanksQuote, served: false,
    });
  }
  run.guests = picked;
}

/** 开一局。pool 是这一局能掉落/进货的武器（局外解锁的那些）。 */
export function newRun(seed = 1, pool: WeaponId[] = ['revolver', 'smg'], cls: ClassId = 'gunner'): RunState {
  const turrets = TURRET_SLOTS.map((_, idx) => (idx === 1 ? { type: 'mg' as const, level: 1, cd: 0, aim: 0 } : { type: null, level: 0, cd: 0, aim: 0 }));
  const run: RunState = {
    seed, rng: seed >>> 0, tick: 0, nextId: 1, day: 0, phase: 'camp', phaseT: 0,
    inside: false, autoFire: true,
    player: {
      x: 215, y: ROOF_Y, vx: 0, vy: 0, facing: 1, hp: 100, maxHp: 100, armor: 0, maxArmor: 80, hurtT: 0, healCarry: 0,
      dodgeT: 0, dodgeCd: 0, dodgeDir: 1, fireCd: 0, reloadT: 0, shootT: 0, grenades: 2,
      weapons: [{ id: 'pistol', star: 1, ammo: WEAPONS.pistol.mag }], cur: 0,
    },
    zombies: [], bullets: [], grenades: [], enemyProjs: [], crates: [], turrets,
    wall: { level: 1, hp: WALL_LEVELS[0].maxHp, maxHp: WALL_LEVELS[0].maxHp },
    home: { hp: FORT_LEVELS[0].maxHp, maxHp: FORT_LEVELS[0].maxHp },
    fort: { level: 1, cd: 0, aim: 0 },
    spawn: { left: 0, timer: 0, total: 0, killed: 0, crateAt: 0, bossKind: null, bossSpawned: false },
    coins: 0, scrap: 0, meat: 0, kills: 0,
    meal: null, guests: [], buff: { dmgMul: 0, haste: 0 }, shop: [],
    perks: [], perkChoices: [], targetId: null, priorityId: null,
    pool: [...pool], chain: { n: 0, t: 0 }, vanguardT: 0, cls, skill: { t: 0, cd: 0 },
  };
  rollShopOffers(run);
  rollDinerGuests(run);
  startDay(run, []);
  return run;
}

function startDay(run: RunState, ev: GameEvent[]) {
  run.day++;
  run.phase = 'fight'; run.phaseT = 0; run.inside = false;
  run.player.x = 215; run.player.y = ROOF_Y; run.player.vy = 0; run.player.facing = 1;
  const total = dayZombieCount(run.day);
  const crateAt = run.day === 1 || rand(run) < 0.4 ? Math.floor(total / 2) : -1;
  const bossKind = bossForDay(run.day);
  run.spawn = { left: total, timer: 80, total, killed: 0, crateAt, bossKind, bossSpawned: false };
  run.bullets = []; run.grenades = []; run.enemyProjs = [];
  run.chain = { n: 0, t: 0 }; run.vanguardT = 0; run.skill = { t: 0, cd: 0 };

  // 将昨晚烹饪的战前特餐转为今天的战斗增益
  const mealBoost = run.cls === 'chef' ? 1.5 : 1;
  if (run.meal) {
    const m = MEALS[run.meal];
    run.buff = { dmgMul: m.dmgMul * mealBoost, haste: m.haste * mealBoost };
    run.player.armor = Math.min(run.player.maxArmor, run.player.armor + Math.round(m.armor * mealBoost));
    run.meal = null;
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
    atkCd: 0, kb: 0, burnT: 0, slowT: 0, carriesCrate: !forcedKind && index === run.spawn.crateAt,
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

function applyPlayerDamage(run: RunState, rawDmg: number, ev: GameEvent[]) {
  const p = run.player;
  if (p.dodgeT > 0 || p.hurtT > 0) return;
  const blocked = Math.min(p.armor, rawDmg);
  p.armor -= blocked;
  const hpDmg = rawDmg - blocked;
  p.hp -= hpDmg;
  p.hurtT = 30;
  ev.push({ t: 'hurt', dmg: rawDmg, blocked });
}

function damageZombie(
  run: RunState,
  z: Zombie,
  dmg: number,
  ev: GameEvent[],
  opts: { byPlayer: boolean; burn?: boolean; kb?: number; crit?: boolean; slow?: number; weaponId?: WeaponId },
) {
  if (z.hp <= 0) return;
  const before = z.hp;
  z.hp -= dmg;
  if (opts.kb) z.kb = Math.max(z.kb, ZOMBIES[z.kind].boss ? opts.kb * 0.25 : opts.kb);
  if (opts.slow) z.slowT = Math.max(z.slowT, opts.slow);
  ev.push({ t: 'hit', id: z.id, x: z.x, y: BODY_Y, dmg: Math.round(dmg), burn: opts.burn, crit: opts.crit, slow: !!opts.slow });
  if (opts.byPlayer && has(run, 'lifesteal')) {
    const p = run.player;
    p.healCarry += Math.min(dmg, before) * 0.08;
    const whole = Math.floor(p.healCarry);
    if (whole > 0) { p.hp = Math.min(p.maxHp, p.hp + whole); p.healCarry -= whole; }
  }
  if (z.hp > 0) return;

  // 战术自卫手枪特色：击杀立即回膛 2 发子弹
  if (opts.byPlayer && (opts.weaponId === 'pistol' || curWeapon(run).id === 'pistol')) {
    const cw = curWeapon(run);
    if (cw.id === 'pistol') {
      cw.ammo = Math.min(magSize('pistol', cw.star), cw.ammo + 2);
    }
  }

  const def = ZOMBIES[z.kind];
  run.coins += def.coins; run.kills++; run.spawn.killed++;
  const scrapChance = def.boss ? 1 : 0.34;
  if (rand(run) < scrapChance) run.scrap += def.boss ? 5 : 1;
  const chef = run.cls === 'chef';
  const meatDrop = def.meat > 1 ? def.meat + (chef ? 1 : 0) : (rand(run) < (chef ? 0.85 : 0.5) ? 1 : 0);
  run.meat += meatDrop;

  if (has(run, 'chainkill')) run.chain = { n: Math.min(8, run.chain.n + 1), t: 180 };
  ev.push({ t: 'kill', id: z.id, x: z.x, kind: z.kind, coins: def.coins, meat: meatDrop });

  if (z.carriesCrate) {
    const pool: WeaponId[] = ['pistol', ...run.pool];
    const unowned = pool.filter((id) => !run.player.weapons.some((w) => w.id === id));
    const weapon = unowned.length && (run.day === 1 || rand(run) < 0.45)
      ? unowned[Math.floor(rand(run) * unowned.length)]
      : pool[Math.floor(rand(run) * pool.length)];
    run.crates.push({ id: run.nextId++, x: Math.min(Math.max(z.x, HOME_X + 20), PLAYER_MAX_X - 20), weapon });
  }
  if (opts.byPlayer && has(run, 'overkill') && z.hp < 0) {
    const boom = -z.hp * 2, r = 44 * (has(run, 'shrapnel') ? 1.35 : 1);
    ev.push({ t: 'boom', x: z.x, y: BODY_Y, r });
    for (const o of run.zombies) if (o !== z && o.hp > 0 && Math.abs(o.x - z.x) <= r) damageZombie(run, o, boom, ev, { byPlayer: false, kb: 2 });
  }
}

function collectCrate(run: RunState, weapon: WeaponId, ev: GameEvent[]) {
  const p = run.player;
  const owned = p.weapons.find((w) => w.id === weapon);
  if (!owned) {
    const fresh = { id: weapon, star: 1, ammo: magSize(weapon, 1) };
    if (p.weapons.length >= MAX_CARRY) { p.weapons[p.cur] = fresh; run.scrap += 3; }
    else { p.weapons.push(fresh); p.cur = p.weapons.length - 1; }
    p.reloadT = 0;
    ev.push({ t: 'pickup', weapon, star: 1, isNew: true });
  } else if (owned.star < MAX_STAR) {
    owned.star++; owned.ammo = magSize(owned.id, owned.star);
    ev.push({ t: 'pickup', weapon, star: owned.star, isNew: false });
    ev.push({ t: 'star', weapon, star: owned.star });
  } else {
    run.scrap += 4;
    ev.push({ t: 'pickup', weapon, star: owned.star, isNew: false });
  }
}

function fireLightning(
  run: RunState,
  sx: number, sy: number, first: Zombie, dmg: number, jumps: number,
  ev: GameEvent[],
  opts: { byPlayer: boolean; crit?: boolean; color: 'tesla' | 'shock' },
) {
  const pts: { x: number; y: number }[] = [{ x: sx, y: sy }];
  const hit = new Set<number>();
  let cur: Zombie | undefined = first;
  let curDmg = dmg;
  for (let i = 0; i < jumps && cur; i++) {
    hit.add(cur.id);
    pts.push({ x: cur.x, y: BODY_Y });
    damageZombie(run, cur, curDmg, ev, { byPlayer: opts.byPlayer, crit: opts.crit, kb: 0.8 });
    curDmg *= 0.78;
    const fromX: number = cur.x;
    cur = run.zombies.filter((o) => o.hp > 0 && !hit.has(o.id) && Math.abs(o.x - fromX) <= 135)
      .sort((a, b) => Math.abs(a.x - fromX) - Math.abs(b.x - fromX))[0];
  }
  if (pts.length >= 2) ev.push({ t: 'lightning', pts, color: opts.color });
}

function explodeAt(run: RunState, x: number, y: number, r: number, dmg: number, ev: GameEvent[], byPlayer: boolean, burn = false) {
  const shrapMul = has(run, 'shrapnel') ? 1.45 : 1;
  const rMul = has(run, 'shrapnel') ? 1.35 : 1;
  const finalR = Math.round(r * rMul);
  const finalDmg = dmg * (byPlayer ? shrapMul : 1);
  ev.push({ t: 'boom', x, y, r: finalR });
  for (const z of run.zombies) {
    if (z.hp <= 0) continue;
    const d = Math.abs(z.x - x);
    if (d <= finalR) {
      damageZombie(run, z, finalDmg * (1 - 0.35 * (d / Math.max(1, finalR))), ev, { byPlayer, kb: 3.5 });
      if (burn && z.hp > 0) z.burnT = Math.max(z.burnT, 120);
    }
  }
}

function fire(run: RunState, target: Zombie, ev: GameEvent[]) {
  const p = run.player, ow = curWeapon(run), def = WEAPONS[ow.id];
  if (ow.ammo <= 0) { startReload(run, ev); return; }
  ow.ammo--;
  p.fireCd = Math.max(2, Math.round((def.interval * (has(run, 'pierce') ? 1.25 : 1)) / playerHaste(run)));
  p.shootT = 10;
  const mx = p.x + p.facing * 26, my = MUZZLE_Y + p.y;
  const tx = target.x - mx, ty = BODY_Y - my, len = Math.hypot(tx, ty) || 1;
  const dx = tx / len, dy = ty / len;
  const hawkeye = skillActive(run, 'gunner');
  const baseCrit = (run.cls === 'gunner' ? CRIT_CHANCE : 0) + (ow.id === 'pistol' ? 0.2 : 0);
  const crit = hawkeye || (baseCrit > 0 && rand(run) < baseCrit);
  const dmg = weaponDamage(ow.id, ow.star) * damageMul(run) * (crit ? CRIT_MUL : 1);

  if (def.chain) {
    const jumps = def.chain + (has(run, 'shock') ? 2 : 0) + (ow.star >= 5 ? 1 : 0);
    fireLightning(run, mx, my, target, dmg, jumps, ev, { byPlayer: true, crit, color: 'tesla' });
    ev.push({ t: 'shot', x: mx, y: my, from: 'player', weapon: ow.id });
    if (ow.ammo <= 0) startReload(run, ev);
    return;
  }

  const fullPierce = !!def.pierce || has(run, 'pierce') || hawkeye;
  const range = effectiveRange(run, ow.id);
  if (ow.id === 'rifle') {
    ev.push({ t: 'railbeam', x1: mx, y1: my, x2: mx + dx * range, y2: my + dy * range });
  }

  const count = (def.pellets ?? 1) + extraBullets(ow.id, ow.star);
  for (let i = 0; i < count; i++) {
    const a = def.spread ? (rand(run) - 0.5) * 2 * def.spread : i === 0 ? 0 : (i % 2 ? 0.05 : -0.05) * Math.ceil(i / 2);
    const c = Math.cos(a), s = Math.sin(a);
    run.bullets.push({
      x: mx, y: my, vx: (dx * c - dy * s) * def.speed, vy: (dx * s + dy * c) * def.speed, dmg,
      life: Math.ceil((range + 70) / def.speed), from: 'player',
      pierce: fullPierce || (def.pierceCount ?? 1) > 1,
      pierceLeft: fullPierce ? 99 : (def.pierceCount ?? 1),
      crit, bounces: 0, hit: [],
      aoe: def.aoe, slow: def.slow, kind: def.aoe ? 'rocket' : 'normal',
      weaponId: ow.id, startX: mx,
      closeBoost: ow.id === 'shotgun',
      shatter: ow.id === 'assault',
    });
  }
  ev.push({ t: 'shot', x: mx, y: my, from: 'player', weapon: ow.id });
  if (ow.ammo <= 0) startReload(run, ev);
}

function startReload(run: RunState, ev: GameEvent[]) {
  const p = run.player, ow = curWeapon(run), def = WEAPONS[ow.id];
  if (p.reloadT > 0 || ow.ammo >= magSize(ow.id, ow.star)) return;
  p.reloadT = Math.max(18, Math.round(def.reload / playerHaste(run)));
  ev.push({ t: 'reload' });
}

function throwGrenade(run: RunState, ev: GameEvent[]) {
  const p = run.player;
  if (p.grenades <= 0 || run.inside || run.phase !== 'fight') return;
  p.grenades--;
  const target = pickTarget(run) ?? run.zombies[0];
  const sy = GROUND_Y + p.y - 26;
  const dir = target ? (target.x >= p.x ? 1 : -1) : p.facing;
  const sx = p.x + dir * 16;
  const tx = target ? target.x : sx + dir * 170;
  const vy = p.y <= ROOF_Y ? -2.2 : -4.8;
  const g = 0.26;
  const dy = Math.max(10, GROUND_Y - 12 - sy);
  const frames = (-vy + Math.sqrt(vy * vy + 2 * g * dy)) / g;
  const vx = dir * Math.min(8.5, Math.max(2.2, Math.abs(tx - sx) / Math.max(12, frames)));
  run.grenades.push({
    x: sx, y: sy, vx, vy,
    dmg: 95 + run.day * 18, r: 66,
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
  }

  // 水平移动：按角色当前高度判定一楼实体砖墙 / 中层挑台边界，绝不穿模进屋体内部
  let minX = HOUSE_WALL_X;
  if (p.y <= ROOF_Y + 4) {
    minX = PLAYER_MIN_X;
  } else if (p.y <= PORCH_Y + 4) {
    minX = PORCH_MIN_X;
  }
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

  if (input.interact && nearbyExterior(run) === 'door' && run.phase === 'camp') {
    command(run, { t: 'enterHouse' });
    return;
  }

  if (input.swap && p.weapons.length > 1) { p.cur = (p.cur + 1) % p.weapons.length; p.reloadT = 0; p.fireCd = 8; }
  if (input.reload) startReload(run, ev);
  if (input.grenade) throwGrenade(run, ev);

  const target = pickTarget(run);
  run.targetId = target ? target.id : null;
  const wantFire = run.autoFire || input.fire;
  if (wantFire && target) p.facing = target.x >= p.x ? 1 : -1;
  else if (move !== 0 && p.dodgeT === 0) p.facing = move > 0 ? 1 : -1;
  if (wantFire && target && p.fireCd === 0 && p.reloadT === 0 && p.dodgeT === 0) fire(run, target, ev);

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
    if (z.burnT > 0) { z.burnT--; if (z.burnT % 30 === 0) damageZombie(run, z, 5, ev, { byPlayer: false, burn: true }); }
    if (z.hp <= 0) continue;
    if (z.slowT > 0) z.slowT--;
    if (z.kb > 0) { z.x += z.kb; z.kb *= 0.7; if (z.kb < 0.2) z.kb = 0; continue; }

    // 远程僵尸（燃烧食尸鬼、地狱兽、深渊魔王）会在中距离抛射火球砸路障或打房顶主角
    if (def.ranged && z.x <= WALL_X + 210 && z.x >= WALL_X + 36) {
      if (z.atkCd === 0) {
        z.atkCd = Math.round(def.attackEvery * 1.4);
        const aimRoof = !run.inside && isOnRoof(run) && Math.abs(p.x - z.x) <= 440 && rand(run) < 0.6;
        const tx = aimRoof ? p.x : (run.wall.hp > 0 ? WALL_X : HOME_X);
        const ty = aimRoof ? (GROUND_Y + p.y - 22) : (GROUND_Y - 22);
        const sx = z.x - 10, sy = BODY_Y - 8;
        const dx = tx - sx, dist = Math.abs(dx) || 1;
        const speed = def.boss ? 4.4 : 3.6;
        const frames = Math.max(18, dist / speed);
        const vy = (ty - sy) / frames - 0.5 * 0.08 * frames;
        run.enemyProjs.push({ x: sx, y: sy, vx: Math.sign(dx) * speed, vy, dmg: Math.round(def.damage * 0.85), life: 150 });
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
        applyPlayerDamage(run, def.damage, ev);
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
    z.x -= def.speed * (z.slowT > 0 ? 0.55 : 1);
  }
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
    const range = def.range + (pos.roof ? 80 : 0);
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
      fireLightning(run, pos.x, pos.muzzleY, best, dmg, lv.chain ?? 3, ev, { byPlayer: false, color: 'tesla' });
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
      let best: Zombie | null = null, bd = 410;
      for (const z of run.zombies) {
        const d = Math.abs(z.x - FORT_GUN_X);
        if (z.x > FORT_GUN_X && d <= bd) { bd = d; best = z; }
      }
      if (best) {
        const lv3 = run.fort.level >= 3;
        run.fort.cd = Math.round((lv3 ? 52 : 88) / (1 + run.buff.haste));
        const dx = best.x - FORT_GUN_X, dy = BODY_Y - FORT_GUN_Y, len = Math.hypot(dx, dy) || 1;
        run.fort.aim = Math.atan2(dy, dx);
        const shots = lv3 ? 2 : 1;
        for (let s = 0; s < shots; s++) {
          const offset = (s - (shots - 1) * 0.5) * 0.06;
          const ca = Math.cos(offset), sa = Math.sin(offset);
          const vx = ((dx / len) * ca - (dy / len) * sa) * 10;
          const vy = ((dx / len) * sa + (dy / len) * ca) * 10;
          run.bullets.push({
            x: FORT_GUN_X + 10, y: FORT_GUN_Y, vx, vy, dmg: lv3 ? 58 : 42, life: 54,
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
          explodeAt(run, b.x, Math.min(BODY_Y, b.y), b.aoe, b.dmg, ev, byPlayer, b.kind === 'rocket');
          alive = false;
          break;
        }
        const wasSlowed = z.slowT > 0;
        const closeHit = b.closeBoost && b.startX !== undefined && Math.abs(z.x - b.startX) <= 135;
        const hitDmg = b.dmg * (closeHit ? 1.4 : 1);
        const kb = closeHit ? 4.4 : b.weaponId === 'revolver' ? 3.6 : byPlayer ? 1.6 : 0.6;
        damageZombie(run, z, hitDmg, ev, { byPlayer, kb, crit: b.crit || closeHit, slow: b.slow, weaponId: b.weaponId });

        // 极地急冻步枪特色：命中已冰冻减速的目标触发碎冰范围溅射
        if (byPlayer && b.shatter && wasSlowed) {
          ev.push({ t: 'frost', x: z.x, y: BODY_Y, r: 44 });
          for (const o of run.zombies) {
            if (o.id !== z.id && o.hp > 0 && Math.abs(o.x - z.x) <= 44) {
              damageZombie(run, o, b.dmg * 0.48, ev, { byPlayer: true, slow: 90, weaponId: b.weaponId });
            }
          }
        }
        if (byPlayer && has(run, 'incendiary') && z.hp > 0 && rand(run) < 0.25) z.burnT = 180;
        if (byPlayer && has(run, 'frostbite')) z.slowT = 135;
        if (byPlayer && has(run, 'shock') && z.hp > 0 && rand(run) < 0.25) {
          const next = run.zombies.find((o) => o.id !== z.id && o.hp > 0 && Math.abs(o.x - z.x) <= 130);
          if (next) fireLightning(run, z.x, BODY_Y, next, b.dmg * 0.55, 2, ev, { byPlayer: true, color: 'shock' });
        }
        if (byPlayer && has(run, 'ricochet') && b.bounces < 3 && rand(run) < 0.5) {
          const next = run.zombies.filter((o) => o.hp > 0 && !b.hit.includes(o.id) && Math.abs(o.x - z.x) <= 130)
            .sort((a, c) => Math.abs(a.x - z.x) - Math.abs(c.x - z.x))[0];
          if (next) {
            const sp = Math.hypot(b.vx, b.vy), nx = next.x - z.x, ny = BODY_Y - b.y, nlen = Math.hypot(nx, ny) || 1;
            spawned.push({ ...b, x: z.x, y: BODY_Y, vx: (nx / nlen) * sp, vy: (ny / nlen) * sp, dmg: b.dmg * 0.72, life: 22, bounces: b.bounces + 1, hit: [...b.hit] });
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
    // 火箭弹/重炮落到地面直接炸
    if (!alive && b.life > 0 && b.y >= GROUND_Y + 2 && (b.kind === 'rocket' || b.kind === 'cannon') && b.aoe && b.hit.length === 0) {
      explodeAt(run, b.x, GROUND_Y - 12, b.aoe, b.dmg, ev, b.from === 'player', b.kind === 'rocket');
    }
    if (alive) out.push(b);
  }
  run.bullets = out.concat(spawned);
}

function stepGrenades(run: RunState, ev: GameEvent[]) {
  const out: typeof run.grenades = [];
  for (const g of run.grenades) {
    g.x += g.vx; g.y += g.vy; g.vy += 0.26;
    const hitZ = run.zombies.some((z) => z.hp > 0 && Math.abs(g.x - z.x) <= 18 && g.y >= GROUND_Y - 46);
    if (hitZ || g.y >= GROUND_Y - 4) {
      explodeAt(run, g.x, Math.min(GROUND_Y - 14, g.y), g.r, g.dmg, ev, true, true);
    } else if (g.x >= 0 && g.x <= SPAWN_X) {
      out.push(g);
    }
  }
  run.grenades = out;
}

function stepEnemyProjs(run: RunState, ev: GameEvent[]) {
  const p = run.player, out: typeof run.enemyProjs = [];
  for (const ep of run.enemyProjs) {
    ep.x += ep.vx; ep.y += ep.vy; ep.vy += 0.08; ep.life--;
    if (ep.life <= 0 || ep.y >= GROUND_Y + 2 || ep.x < 0) continue;
    if (!run.inside && Math.abs(ep.x - p.x) <= 15 && ep.y >= GROUND_Y + p.y - 40 && ep.y <= GROUND_Y + p.y + 4) {
      applyPlayerDamage(run, ep.dmg, ev);
      continue;
    }
    if (run.wall.hp > 0 && Math.abs(ep.x - WALL_X) <= 16 && ep.y >= GROUND_Y - 46) {
      run.wall.hp = Math.max(0, run.wall.hp - Math.round(ep.dmg * 0.7));
      ev.push({ t: 'wallHit' });
      continue;
    }
    if (Math.abs(ep.x - HOME_X) <= 16 && ep.y >= GROUND_Y - 90) {
      run.home.hp = Math.max(0, run.home.hp - Math.round(ep.dmg * 0.7));
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
      const group = Math.min(run.spawn.left, 1 + Math.floor(rand(run) * (1.2 + run.day * 0.55)));
      for (let i = 0; i < group; i++) { spawnZombie(run); run.spawn.left--; }
      if (run.spawn.bossKind && !run.spawn.bossSpawned && run.spawn.left <= Math.floor(run.spawn.total / 2)) {
        run.spawn.bossSpawned = true;
        spawnZombie(run, run.spawn.bossKind);
        ev.push({ t: 'bossAppear', kind: run.spawn.bossKind });
      }
      run.spawn.timer = Math.round(Math.max(16, (38 - run.day * 1.4)) * (0.7 + group * 0.7)) + Math.floor(rand(run) * 18);
    }
  }

  stepZombies(run, ev);
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
    // 若玩家一直在房顶防守，过一会帮他把地面残留的箱子自动收回，不丢掉落
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

/** 面板和按钮的指令。成功返回事件，不满足条件（钱不够、时机不对）返回 null。 */
export function command(run: RunState, cmd: Command): GameEvent[] | null {
  const ev: GameEvent[] = [];
  switch (cmd.t) {
    case 'pickPerk': {
      if (run.phase !== 'perk' || !run.perkChoices.includes(cmd.id)) return null;
      run.perks.push(cmd.id); run.perkChoices = []; run.phase = 'camp';
      if (cmd.id === 'glasscannon') { const p = run.player; p.maxHp = Math.round(p.maxHp / 2); p.hp = Math.min(p.hp, p.maxHp); }
      if (cmd.id === 'fortify') {
        const nextWallMax = Math.round(WALL_LEVELS[run.wall.level - 1].maxHp * 1.4);
        const nextHomeMax = Math.round(FORT_LEVELS[run.fort.level - 1].maxHp * 1.4);
        run.wall.hp += nextWallMax - run.wall.maxHp; run.wall.maxHp = nextWallMax;
        run.home.hp += nextHomeMax - run.home.maxHp; run.home.maxHp = nextHomeMax;
        run.player.armor = Math.min(run.player.maxArmor, run.player.armor + 25);
      }
      // 晚上自动回到酒馆屋里招待食客、做饭、逛工坊
      run.inside = true; run.player.x = IN_STATIONS.kitchen + 40; run.player.y = 0; run.player.vy = 0;
      rollShopOffers(run);
      rollDinerGuests(run);
      ev.push({ t: 'inside', inside: true });
      return ev;
    }
    case 'nextDay':
      if (run.phase !== 'camp') return null;
      run.player.hp = Math.min(run.player.maxHp, Math.round(run.player.hp + run.player.maxHp * DAY_HEAL));
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
      const cost = turretBuildCost(cmd.kind, run.cls);
      if (run.scrap < cost) return null;
      run.scrap -= cost;
      slot.type = cmd.kind; slot.level = 1; slot.cd = 0; slot.aim = 0;
      ev.push({ t: 'build', kind: 'turret' });
      return ev;
    }
    case 'upgradeTurret': {
      const slot = run.turrets[cmd.slot];
      if (!slot || !slot.type || slot.level >= TURRETS[slot.type].levels.length) return null;
      const cost = turretUpgradeCost(slot.type, slot.level, run.cls);
      if (run.scrap < cost) return null;
      run.scrap -= cost; slot.level++;
      ev.push({ t: 'build', kind: 'turret' });
      return ev;
    }
    case 'scrapTurret': {
      const slot = run.turrets[cmd.slot];
      if (!slot || !slot.type) return null;
      run.scrap += turretRefundScrap(slot.type, slot.level, run.cls);
      slot.type = null; slot.level = 0; slot.cd = 0;
      return ev;
    }
    case 'upgradeWall': {
      if (run.wall.level >= MAX_WALL_LEVEL) return null;
      const next = WALL_LEVELS[run.wall.level];
      if (run.coins < next.coins || run.scrap < next.scrap) return null;
      run.coins -= next.coins; run.scrap -= next.scrap;
      run.wall.level++;
      run.wall.maxHp = Math.round(next.maxHp * (has(run, 'fortify') ? 1.4 : 1));
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
      if (run.coins < next.coins || run.scrap < next.scrap) return null;
      run.coins -= next.coins; run.scrap -= next.scrap;
      run.fort.level++;
      const newMax = Math.round(next.maxHp * (has(run, 'fortify') ? 1.4 : 1));
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
      if (run.player.weapons.length >= MAX_CARRY) { run.player.weapons[run.player.cur] = fresh; run.scrap += 3; }
      else { run.player.weapons.push(fresh); run.player.cur = run.player.weapons.length - 1; }
      run.player.reloadT = 0;
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
      run.coins += 25 + removed.star * 15; run.scrap += 3;
      return ev;
    }
    case 'serveGuest': {
      if (run.phase !== 'camp') return null;
      const g = run.guests.find((o) => o.id === cmd.guestId && !o.served);
      if (!g || run.meat < g.meatCost) return null;
      run.meat -= g.meatCost;
      g.served = true;
      run.coins += g.pay;
      const allServed = run.guests.length > 0 && run.guests.every((o) => o.served);
      let totalCoins = g.pay;
      if (allServed) {
        const tip = run.cls === 'chef' ? 24 : 16;
        run.coins += tip;
        totalCoins += tip;
        run.player.hp = Math.min(run.player.maxHp, run.player.hp + 15);
      }
      ev.push({ t: 'serve', guestId: g.id, name: g.name, dishName: g.dishName, coins: totalCoins, quote: g.thanksQuote, allServed });
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
      if (run.meat < m.meatCost) return null;
      run.meat -= m.meatCost; run.meal = cmd.id;
      if (cmd.id === 'hearty_stew') {
        const heal = Math.round(40 * (run.cls === 'chef' ? 1.5 : 1));
        run.player.hp = Math.min(run.player.maxHp, run.player.hp + heal);
      }
      ev.push({ t: 'meal', id: cmd.id });
      return ev;
    }
  }
}
