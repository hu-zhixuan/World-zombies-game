// 自动打的机器人：用来在测试里跑完整 15 天流程，检验难度曲线与各模块经济联动。
import { WEAPONS, ZOMBIES, type TurretType } from '../content/data';
import { command, isOnPorch, isOnRoof, step } from './sim';
import { NO_INPUT, PORCH_MAX_X, ROOF_MAX_X, WALL_X, type GameEvent, type Input, type RunState } from './types';

export function botInput(run: RunState): Input {
  const p = run.player;
  const crate = run.crates[0];
  let move = 0;
  let jump = false;
  // 清场时如果有箱子且怪较少，下楼去捡；平常守在房顶前缘附近，若掉在地面则沿阶梯跳回房顶
  if (run.phase === 'clear' && crate) {
    const dx = crate.x - p.x;
    move = Math.abs(dx) < 4 ? 0 : Math.sign(dx);
  } else if (!isOnRoof(run)) {
    const stepTarget = isOnPorch(run) ? ROOF_MAX_X - 8 : PORCH_MAX_X - 20;
    move = Math.abs(stepTarget - p.x) < 4 ? -1 : Math.sign(stepTarget - p.x);
    if (p.x <= PORCH_MAX_X && p.vy === 0) jump = true;
  } else {
    const spot = ROOF_MAX_X - 18; // 站房顶最右侧边缘获得最大向前射程
    move = Math.abs(spot - p.x) < 4 ? 0 : Math.sign(spot - p.x);
  }
  const incomingFireball = run.enemyProjs.some((ep) => Math.abs(ep.x - p.x) < 32 && Math.abs(ep.y - (222 + p.y - 20)) < 26);
  const crowdNearWall = run.zombies.filter((z) => z.x <= WALL_X + 65).length >= 5 || run.zombies.some((z) => ZOMBIES[z.kind].boss);
  return {
    ...NO_INPUT,
    move,
    jump,
    fire: run.zombies.length > 0,
    dodge: incomingFireball && p.dodgeCd === 0,
    skill: run.zombies.length >= 4 && run.skill.cd === 0,
    grenade: crowdNearWall && p.grenades > 0 && run.zombies.length >= 4,
  };
}

export interface BotReport { won: boolean; ticks: number; days: { day: number; seconds: number; hpLost: number; wallLost: number }[]; events: GameEvent[] }

function manageCamp(run: RunState) {
  // 1. 先留一份明天的特餐，再把店里等餐的幸存者食客依次招待上菜，最后将富余鲜肉现炒出锅
  if (run.meat >= 3 && !run.meal) command(run, { t: 'pickMeal', id: run.player.hp < run.player.maxHp * 0.7 ? 'hearty_stew' : 'iron_steak' });
  else if (run.meat >= 2 && !run.meal) command(run, { t: 'pickMeal', id: 'spicy_skewer' });
  for (const g of run.guests) {
    if (!g.served && run.meat >= g.meatCost) command(run, { t: 'serveGuest', guestId: g.id });
  }
  if (run.meat > 0) command(run, { t: 'cookSell', count: run.meat });

  // 2. 修理和升级路障与堡垒
  command(run, { t: 'repairWall' });
  command(run, { t: 'repairFort' });
  if (run.day >= 2) command(run, { t: 'upgradeWall' });
  if (run.day >= 4) command(run, { t: 'upgradeFort' });

  // 3. 用废铁建满 4 个炮塔槽位并优先升级
  const order: [number, TurretType][] = [[0, 'frost'], [2, 'tesla'], [3, 'cannon'], [1, 'mg']];
  for (const [slot, kind] of order) {
    if (!run.turrets[slot].type) command(run, { t: 'buildTurret', slot, kind });
  }
  for (let i = 0; i < run.turrets.length; i++) command(run, { t: 'upgradeTurret', slot: i });

  // 4. 商店购入新武器或给主力升星 + 补充手雷与护甲
  for (const id of run.shop) {
    if (!run.player.weapons.some((w) => w.id === id) && WEAPONS[id].price <= run.coins) {
      command(run, { t: 'buyWeapon', weapon: id });
    }
  }
  const ranked = [...run.player.weapons].sort((a, b) => WEAPONS[b.id].price - WEAPONS[a.id].price);
  for (const w of ranked) command(run, { t: 'buyStar', weapon: w.id });
  if (run.player.grenades < 3) command(run, { t: 'buySupply', item: 'grenade' });
  if (run.player.armor < 30) command(run, { t: 'buySupply', item: 'armor' });
}

/** 跑到通关或死亡。每天清场后选第一个天赋、整备营地与小厨房。 */
export function runBot(run: RunState, maxTicks = 60 * 60 * 25): BotReport {
  const report: BotReport = { won: false, ticks: 0, days: [], events: [] };
  let dayStartTick = run.tick, hpLost = 0, wallAtStart = run.wall.hp;
  for (let i = 0; i < maxTicks; i++) {
    if (run.phase === 'perk') {
      const want = run.perkChoices.find((id) => id === 'rooftop' || id === 'lifesteal' || id === 'shock') ?? run.perkChoices[0];
      command(run, { t: 'pickPerk', id: want });
      continue;
    }
    if (run.phase === 'camp') {
      manageCamp(run);
      command(run, { t: 'nextDay' });
      dayStartTick = run.tick; hpLost = 0; wallAtStart = run.wall.hp;
      continue;
    }
    if (run.phase === 'dead' || run.phase === 'won') break;
    // 手里有价格更高 / 星级更高的武器就切过去
    let bestIdx = 0, bestScore = -1;
    run.player.weapons.forEach((w, idx) => {
      const s = (WEAPONS[w.id].price + 40) * (1 + 0.35 * (w.star - 1));
      if (s > bestScore) { bestScore = s; bestIdx = idx; }
    });
    const input = botInput(run);
    if (run.player.cur !== bestIdx) input.swap = true;
    const ev = step(run, input);
    for (const e of ev) {
      report.events.push(e);
      if (e.t === 'hurt') hpLost += e.dmg;
      if (e.t === 'dayClear') report.days.push({ day: e.day, seconds: (run.tick - dayStartTick) / 60, hpLost, wallLost: wallAtStart - run.wall.hp });
    }
  }
  report.won = run.phase === 'won'; report.ticks = run.tick;
  return report;
}
