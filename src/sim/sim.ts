// 规则层：纯计算，不碰浏览器。固定每秒 60 步；随机数带种子；同样的种子和输入一定得到同样的结果。
import {
  DAY_HEAL, LAST_DAY, MAX_STAR, PERKS, RARITY_WEIGHT, STAR_COST, TURRET, WALL_REPAIR_COST, WEAPONS, ZOMBIES,
  dayZombieCount, extraBullets, magSize, starMul, zombieHp, type PerkId, type WeaponId, type ZombieKind,
} from '../content/data';
import {
  GROUND_Y, HOME_X, PLAYER_MAX_X, PLAYER_MIN_X, SPAWN_X, TURRET_X, WALL_X,
  type Bullet, type Command, type GameEvent, type Input, type RunState, type Zombie,
} from './types';

export const MAX_CARRY = 2;
const GRAVITY = 0.3;
const JUMP_V = -5.2;
const MOVE_SPEED = 2;
const DODGE_TICKS = 14;
const DODGE_SPEED = 4.2;
const DODGE_CD = 60;
const ZOMBIE_REACH = 16;
const BODY_Y = GROUND_Y - 22; // 僵尸身体中心的高度
export const MUZZLE_Y = GROUND_Y - 31;
export const TURRET_Y = GROUND_Y - 80;

function rand(run: RunState): number { // mulberry32
  let t = (run.rng += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** 开一局。pool 是这一局能掉落的武器（局外解锁的那些）。 */
export function newRun(seed = 1, pool: WeaponId[] = ['smg']): RunState {
  const run: RunState = {
    seed, rng: seed >>> 0, tick: 0, nextId: 1, day: 0, phase: 'camp', phaseT: 0,
    player: {
      x: 200, y: 0, vx: 0, vy: 0, facing: 1, hp: 100, maxHp: 100, hurtT: 0, healCarry: 0,
      dodgeT: 0, dodgeCd: 0, dodgeDir: 1, fireCd: 0, reloadT: 0, shootT: 0,
      weapons: [{ id: 'pistol', star: 1, ammo: WEAPONS.pistol.mag }], cur: 0,
    },
    zombies: [], bullets: [], crates: [], turret: { x: TURRET_X, level: 1, cd: 0, aim: 0 },
    wall: { hp: 220, maxHp: 220 }, home: { hp: 100, maxHp: 100 },
    spawn: { left: 0, timer: 0, total: 0, killed: 0, crateAt: 0 },
    coins: 0, scrap: 0, kills: 0, perks: [], perkChoices: [], targetId: null,
    pool: [...pool], chain: { n: 0, t: 0 }, vanguardT: 0,
  };
  startDay(run, []);
  return run;
}

const has = (run: RunState, id: PerkId) => run.perks.includes(id);
export const curWeapon = (run: RunState) => run.player.weapons[run.player.cur];
export const weaponDamage = (id: WeaponId, star: number) => WEAPONS[id].damage * starMul(star);
/** 伤害的唯一入口：武器基础 × 星级 × 天赋带来的临时倍率。别处不许再乘。 */
export function damageMul(run: RunState): number {
  const p = run.player;
  let m = 1;
  if (has(run, 'glasscannon')) m *= 2.2;
  if (has(run, 'bloodfrenzy')) m *= 1 + (1 - p.hp / p.maxHp) * 0.8;
  if (has(run, 'chainkill')) m *= 1 + Math.min(0.8, run.chain.n * 0.1);
  if (has(run, 'vanguard') && run.vanguardT > 0) m *= 1.5;
  return m;
}
/** 清场条件：这一天的僵尸都出完了，而且都死了 */
export const dayRemaining = (run: RunState) => run.spawn.left + run.zombies.length;

function startDay(run: RunState, ev: GameEvent[]) {
  run.day++;
  run.phase = 'fight'; run.phaseT = 0;
  const total = dayZombieCount(run.day);
  // 武器箱：第一天必出，之后一半的天数会出
  const crateAt = run.day === 1 || rand(run) < 0.35 ? Math.floor(total / 2) : -1;
  run.spawn = { left: total, timer: 90, total, killed: 0, crateAt };
  run.bullets = []; run.chain = { n: 0, t: 0 }; run.vanguardT = 0;
  if (has(run, 'secondwind')) run.player.hp = Math.min(run.player.maxHp, run.player.hp + run.player.maxHp * 0.25);
  ev.push({ t: 'dayStart', day: run.day });
}

function spawnZombie(run: RunState) {
  const kinds = (Object.keys(ZOMBIES) as ZombieKind[]).filter((k) => ZOMBIES[k].firstDay <= run.day);
  // 按权重抽种类：普通的最多，壮汉最少
  let roll = rand(run) * kinds.reduce((sum, k) => sum + ZOMBIES[k].weight, 0), kind = kinds[0];
  for (const k of kinds) { roll -= ZOMBIES[k].weight; if (roll < 0) { kind = k; break; } }
  const hp = zombieHp(kind, run.day);
  const index = run.spawn.total - run.spawn.left;
  run.zombies.push({
    id: run.nextId++, kind, x: SPAWN_X + rand(run) * 46, hp, maxHp: hp,
    atkCd: 0, kb: 0, burnT: 0, slowT: 0, carriesCrate: index === run.spawn.crateAt,
  });
}

/** 自动锁定：射程内离主角最近的僵尸；已经锁住的那只只要还在射程边上就不换，避免来回跳。 */
function pickTarget(run: RunState): Zombie | null {
  const p = run.player, range = WEAPONS[curWeapon(run).id].range;
  const cur = run.zombies.find((z) => z.id === run.targetId);
  if (cur && Math.abs(cur.x - p.x) <= range * 1.1) return cur;
  let best: Zombie | null = null, bd = range;
  for (const z of run.zombies) {
    const d = Math.abs(z.x - p.x);
    if (d <= bd) { bd = d; best = z; }
  }
  return best;
}

function damageZombie(run: RunState, z: Zombie, dmg: number, ev: GameEvent[], opts: { byPlayer: boolean; burn?: boolean; kb?: number }) {
  if (z.hp <= 0) return;
  const before = z.hp;
  z.hp -= dmg;
  if (opts.kb) z.kb = Math.max(z.kb, opts.kb);
  ev.push({ t: 'hit', id: z.id, x: z.x, y: BODY_Y, dmg: Math.round(dmg), burn: opts.burn });
  if (opts.byPlayer && has(run, 'lifesteal')) {
    const p = run.player;
    p.healCarry += Math.min(dmg, before) * 0.08;
    const whole = Math.floor(p.healCarry);
    if (whole > 0) { p.hp = Math.min(p.maxHp, p.hp + whole); p.healCarry -= whole; }
  }
  if (z.hp > 0) return;
  const def = ZOMBIES[z.kind];
  run.coins += def.coins; run.kills++; run.spawn.killed++;
  if (rand(run) < 0.3) run.scrap++;
  if (has(run, 'chainkill')) run.chain = { n: Math.min(8, run.chain.n + 1), t: 180 };
  ev.push({ t: 'kill', id: z.id, x: z.x, kind: z.kind, coins: def.coins });
  if (z.carriesCrate) {
    // 第一天一定给一把新武器，之后在已有和没有的武器里随机：捡到已有的就是升星
    const pool: WeaponId[] = ['pistol', ...run.pool];
    const unowned = pool.filter((id) => !run.player.weapons.some((w) => w.id === id));
    const weapon = unowned.length && (run.day === 1 || rand(run) < 0.4) ? unowned[Math.floor(rand(run) * unowned.length)] : pool[Math.floor(rand(run) * pool.length)];
    run.crates.push({ id: run.nextId++, x: Math.min(Math.max(z.x, PLAYER_MIN_X + 20), PLAYER_MAX_X - 20), weapon });
  }
  if (opts.byPlayer && has(run, 'overkill') && z.hp < 0) {
    const boom = -z.hp * 2, r = 42;
    ev.push({ t: 'boom', x: z.x, y: BODY_Y, r });
    for (const o of run.zombies) if (o !== z && o.hp > 0 && Math.abs(o.x - z.x) <= r) damageZombie(run, o, boom, ev, { byPlayer: false, kb: 2 });
  }
}

function fire(run: RunState, target: Zombie, ev: GameEvent[]) {
  const p = run.player, ow = curWeapon(run), def = WEAPONS[ow.id];
  if (ow.ammo <= 0) { startReload(run, ev); return; }
  ow.ammo--;
  p.fireCd = Math.round(def.interval * (has(run, 'pierce') ? 1.25 : 1));
  p.shootT = 10;
  const mx = p.x + p.facing * 26, my = MUZZLE_Y + p.y;
  const tx = target.x - mx, ty = BODY_Y - my, len = Math.hypot(tx, ty) || 1;
  const dx = tx / len, dy = ty / len;
  const dmg = weaponDamage(ow.id, ow.star) * damageMul(run);
  const count = (def.pellets ?? 1) + extraBullets(ow.id, ow.star);
  for (let i = 0; i < count; i++) {
    // 霰弹每颗随机散开；单发武器多打出的那颗稍微错开一点
    const a = def.spread ? (rand(run) - 0.5) * 2 * def.spread : i === 0 ? 0 : (i % 2 ? 0.05 : -0.05) * Math.ceil(i / 2);
    const c = Math.cos(a), s = Math.sin(a);
    run.bullets.push({
      x: mx, y: my, vx: (dx * c - dy * s) * def.speed, vy: (dx * s + dy * c) * def.speed, dmg,
      life: Math.ceil((def.range + 60) / def.speed), from: 'player', pierce: !!def.pierce || has(run, 'pierce'), bounces: 0, hit: [],
    });
  }
  ev.push({ t: 'shot', x: mx, y: my, from: 'player' });
  if (ow.ammo <= 0) startReload(run, ev);
}

function startReload(run: RunState, ev: GameEvent[]) {
  const p = run.player, ow = curWeapon(run), def = WEAPONS[ow.id];
  if (p.reloadT > 0 || ow.ammo >= magSize(ow.id, ow.star)) return;
  p.reloadT = def.reload;
  ev.push({ t: 'reload' });
}

function stepPlayer(run: RunState, input: Input, ev: GameEvent[]) {
  const p = run.player;
  if (p.hurtT > 0) p.hurtT--;
  if (p.dodgeCd > 0) p.dodgeCd--;
  if (p.fireCd > 0) p.fireCd--;
  if (p.shootT > 0) p.shootT--;
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
  if (input.jump && p.y === 0) p.vy = JUMP_V;
  p.vy += GRAVITY; p.y += p.vy;
  if (p.y >= 0) { p.y = 0; p.vy = 0; }
  p.x = Math.max(PLAYER_MIN_X, Math.min(PLAYER_MAX_X, p.x + p.vx));

  if (input.swap && p.weapons.length > 1) { p.cur = (p.cur + 1) % p.weapons.length; p.reloadT = 0; p.fireCd = 8; }
  if (input.reload) startReload(run, ev);

  const target = pickTarget(run);
  run.targetId = target ? target.id : null;
  // 朝向：开火时盯着目标；不开火时跟着移动方向
  if (input.fire && target) p.facing = target.x >= p.x ? 1 : -1;
  else if (move !== 0 && p.dodgeT === 0) p.facing = move > 0 ? 1 : -1;
  // 射程内有目标才开枪：按住开火等僵尸过来时不会白白打空弹匣
  if (input.fire && target && p.fireCd === 0 && p.reloadT === 0 && p.dodgeT === 0) fire(run, target, ev);

  for (let i = run.crates.length - 1; i >= 0; i--) {
    const c = run.crates[i];
    if (Math.abs(c.x - p.x) > 18 || p.y < -12) continue;
    run.crates.splice(i, 1);
    const owned = p.weapons.find((w) => w.id === c.weapon);
    if (!owned) {
      // 随身最多两把：满了就换掉手里这把，旧的拆成废铁
      const fresh = { id: c.weapon, star: 1, ammo: magSize(c.weapon, 1) };
      if (p.weapons.length >= MAX_CARRY) { p.weapons[p.cur] = fresh; run.scrap += 2; }
      else { p.weapons.push(fresh); p.cur = p.weapons.length - 1; }
      p.reloadT = 0;
      ev.push({ t: 'pickup', weapon: c.weapon, star: 1, isNew: true });
    } else if (owned.star < MAX_STAR) {
      owned.star++; owned.ammo = magSize(owned.id, owned.star);
      ev.push({ t: 'pickup', weapon: c.weapon, star: owned.star, isNew: false });
      ev.push({ t: 'star', weapon: c.weapon, star: owned.star });
    } else { run.scrap += 4; ev.push({ t: 'pickup', weapon: c.weapon, star: owned.star, isNew: false }); }
  }
}

function stepZombies(run: RunState, ev: GameEvent[]) {
  const p = run.player;
  for (const z of run.zombies) {
    const def = ZOMBIES[z.kind];
    if (z.atkCd > 0) z.atkCd--;
    if (z.burnT > 0) { z.burnT--; if (z.burnT % 30 === 0) damageZombie(run, z, 4, ev, { byPlayer: false, burn: true }); }
    if (z.hp <= 0) continue;
    if (z.slowT > 0) z.slowT--;
    if (z.kb > 0) { z.x += z.kb; z.kb *= 0.7; if (z.kb < 0.2) z.kb = 0; continue; }
    const nearPlayer = Math.abs(p.x - z.x) <= ZOMBIE_REACH && p.y > -24;
    const atWall = run.wall.hp > 0 && z.x <= WALL_X + 14 && z.x >= WALL_X - 6;
    const atHome = z.x <= HOME_X + 8;
    if (nearPlayer || atWall || atHome) {
      if (z.atkCd > 0) continue;
      z.atkCd = def.attackEvery;
      if (nearPlayer) {
        if (p.dodgeT === 0 && p.hurtT === 0) { p.hp -= def.damage; p.hurtT = 30; ev.push({ t: 'hurt', dmg: def.damage }); }
      } else if (atWall) { run.wall.hp = Math.max(0, run.wall.hp - def.damage); ev.push({ t: 'wallHit' }); if (has(run, 'vanguard')) run.vanguardT = 300; }
      else { run.home.hp = Math.max(0, run.home.hp - def.damage); ev.push({ t: 'homeHit' }); }
      continue;
    }
    z.x -= def.speed * (z.slowT > 0 ? 0.7 : 1);
  }
}

function stepTurret(run: RunState, ev: GameEvent[]) {
  const t = run.turret, lv = TURRET.levels[t.level - 1];
  if (t.cd > 0) { t.cd--; return; }
  let best: Zombie | null = null, bd = TURRET.range;
  for (const z of run.zombies) { const d = Math.abs(z.x - t.x); if (z.x > t.x && d <= bd) { bd = d; best = z; } }
  if (!best) return;
  t.cd = Math.round(lv.cooldown * (has(run, 'overclock') ? 1 / 1.2 : 1));
  const dx = best.x - t.x, dy = BODY_Y - TURRET_Y, len = Math.hypot(dx, dy);
  t.aim = Math.atan2(dy, dx);
  run.bullets.push({ x: t.x + 10, y: TURRET_Y, vx: (dx / len) * 9, vy: (dy / len) * 9, dmg: lv.damage, life: 40, from: 'turret', pierce: false, bounces: 0, hit: [] });
  ev.push({ t: 'shot', x: t.x + 10, y: TURRET_Y, from: 'turret' });
}

function stepBullets(run: RunState, ev: GameEvent[]) {
  const out: Bullet[] = [];
  const spawned: Bullet[] = [];
  for (const b of run.bullets) {
    b.x += b.vx; b.y += b.vy; b.life--;
    let alive = b.life > 0 && b.y < GROUND_Y + 4;
    if (alive) for (const z of run.zombies) {
      if (z.hp <= 0 || b.hit.includes(z.id)) continue;
      if (Math.abs(b.x - z.x) > 11 || b.y < GROUND_Y - 44 || b.y > GROUND_Y) continue;
      b.hit.push(z.id);
      const byPlayer = b.from === 'player';
      damageZombie(run, z, b.dmg, ev, { byPlayer, kb: byPlayer ? 1.6 : 0.6 });
      if (byPlayer && has(run, 'incendiary') && z.hp > 0 && rand(run) < 0.25) z.burnT = 180;
      if (byPlayer && has(run, 'frostbite')) z.slowT = 120;
      if (byPlayer && has(run, 'ricochet') && b.bounces < 3 && rand(run) < 0.5) {
        const next = run.zombies.filter((o) => o.hp > 0 && !b.hit.includes(o.id) && Math.abs(o.x - z.x) <= 120)
          .sort((a, c) => Math.abs(a.x - z.x) - Math.abs(c.x - z.x))[0];
        if (next) {
          const sp = Math.hypot(b.vx, b.vy), dir = next.x >= z.x ? 1 : -1;
          spawned.push({ ...b, x: z.x, y: BODY_Y, vx: dir * sp, vy: 0, dmg: b.dmg * 0.7, life: 20, bounces: b.bounces + 1, hit: [...b.hit] });
        }
      }
      if (!b.pierce) { alive = false; break; }
    }
    if (alive) out.push(b);
  }
  run.bullets = out.concat(spawned);
}

/** 推进一步。返回这一步发生的事件。 */
export function step(run: RunState, input: Input): GameEvent[] {
  const ev: GameEvent[] = [];
  if (run.phase !== 'fight' && run.phase !== 'clear') return ev;
  run.tick++; run.phaseT++;
  stepPlayer(run, input, ev);
  if (run.phase === 'fight') {
    if (run.spawn.left > 0 && --run.spawn.timer <= 0) {
      // 僵尸成群来：一次来一小拨，越往后一拨越大。一只一只来的话永远打不到路障，没有压力
      const group = Math.min(run.spawn.left, 1 + Math.floor(rand(run) * (1.4 + run.day * 0.9)));
      for (let i = 0; i < group; i++) { spawnZombie(run); run.spawn.left--; }
      run.spawn.timer = Math.round((34 - run.day * 2) * (0.7 + group * 0.75)) + Math.floor(rand(run) * 20);
    }
  }
  stepZombies(run, ev);
  stepTurret(run, ev);
  stepBullets(run, ev);
  run.zombies = run.zombies.filter((z) => z.hp > 0);

  if (run.player.hp <= 0 || run.home.hp <= 0) { run.player.hp = Math.max(0, run.player.hp); run.phase = 'dead'; ev.push({ t: 'dead' }); return ev; }
  if (run.phase === 'fight' && dayRemaining(run) === 0) { run.phase = 'clear'; run.phaseT = 0; ev.push({ t: 'dayClear', day: run.day }); }
  else if (run.phase === 'clear' && run.phaseT >= 150 && (run.crates.length === 0 || run.phaseT >= 600)) {
    // 清场后留一小段时间；地上还有箱子就多等一会儿让玩家去捡。然后三选一（最后一天直接通关）
    if (run.day >= LAST_DAY) { run.phase = 'won'; ev.push({ t: 'won' }); }
    else {
      // 按稀有度加权抽 3 个还没拿过的
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
    case 'pickPerk':
      if (run.phase !== 'perk' || !run.perkChoices.includes(cmd.id)) return null;
      run.perks.push(cmd.id); run.perkChoices = []; run.phase = 'camp';
      if (cmd.id === 'glasscannon') { const p = run.player; p.maxHp = Math.round(p.maxHp / 2); p.hp = Math.min(p.hp, p.maxHp); }
      return ev;
    case 'nextDay':
      if (run.phase !== 'camp') return null;
      run.player.hp = Math.min(run.player.maxHp, Math.round(run.player.hp + run.player.maxHp * DAY_HEAL)); run.player.x = 200; run.crates = [];
      for (const w of run.player.weapons) w.ammo = magSize(w.id, w.star);
      startDay(run, ev);
      return ev;
    case 'buyStar': {
      const w = run.player.weapons.find((o) => o.id === cmd.weapon);
      if (!w || w.star >= MAX_STAR || run.coins < STAR_COST[w.star]) return null;
      run.coins -= STAR_COST[w.star]; w.star++; w.ammo = magSize(w.id, w.star);
      ev.push({ t: 'star', weapon: w.id, star: w.star });
      return ev;
    }
    case 'upgradeTurret': {
      const t = run.turret;
      if (t.level >= TURRET.levels.length || run.scrap < TURRET.upgradeScrap[t.level]) return null;
      run.scrap -= TURRET.upgradeScrap[t.level]; t.level++;
      return ev;
    }
    case 'repairWall':
      if (run.wall.hp >= run.wall.maxHp || run.coins < WALL_REPAIR_COST) return null;
      run.coins -= WALL_REPAIR_COST; run.wall.hp = run.wall.maxHp;
      return ev;
  }
}
