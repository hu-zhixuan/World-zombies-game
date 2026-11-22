// 自动打的机器人：用来在测试里跑完整 15 天流程，检验难度曲线与各模块经济联动。
import { MAX_DISH_LV, MEALS, MEAL_ORDER, MEAT_ORDER, WEAPONS, ZOMBIES, dishEnhanceMeatCost, dishUpgradeCost, type TurretType } from '../content/data';
import { MAX_CARRY, command, hasIngredients, hasTavernUpgrade, isOnPorch, isOnRoof, step, tavernUpgradeCost } from './sim';
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
    const stepTarget = isOnPorch(run) ? ROOF_MAX_X - 12 : PORCH_MAX_X - 20;
    move = Math.abs(stepTarget - p.x) < 4 ? -1 : Math.sign(stepTarget - p.x);
    if (p.x <= PORCH_MAX_X && p.vy === 0) jump = true;
  } else {
    const spot = ROOF_MAX_X - 68; // 留出后撤闪避空间，不从屋檐冲掉下楼
    move = Math.abs(spot - p.x) < 4 ? 0 : Math.sign(spot - p.x);
  }
  const incomingFireball = run.enemyProjs.some((ep) => Math.abs(ep.x - p.x) < 32 && Math.abs(ep.y - (222 + p.y - 20)) < 26);
  const wantDodge = incomingFireball && p.dodgeCd === 0;
  if (wantDodge && isOnRoof(run)) move = p.x > 140 ? -1 : 1;
  const crowdNearWall = run.zombies.filter((z) => z.x <= WALL_X + 65).length >= 5 || run.zombies.some((z) => ZOMBIES[z.kind].boss);
  return {
    ...NO_INPUT,
    move,
    jump,
    fire: run.targetId !== null,
    dodge: wantDodge,
    skill: run.zombies.length >= 4 && run.skill.cd === 0,
    grenade: crowdNearWall && p.grenades > 0 && run.zombies.length >= 4,
  };
}

export interface BotReport { won: boolean; ticks: number; days: { day: number; seconds: number; hpLost: number; wallLost: number }[]; events: GameEvent[] }

function manageCamp(run: RunState) {
  // 1. 暮夜战备酒馆：一键犒赏堂食食客（赚取赏金 + 触发铁匠85折/军火空投/药师回甲/同袍狂飙 + 叠加明日战场料理增益）
  for (const id of [...MEAL_ORDER].reverse()) {
    const lv = run.diner.dishLevels[id] ?? 1;
    if (lv < MAX_DISH_LV && run.coins >= dishUpgradeCost(id, lv) + 120 && hasIngredients(run, dishEnhanceMeatCost(id, lv))) {
      command(run, { t: 'upgradeDish', id });
      break;
    }
  }
  for (const uid of ['fast_tap', 'wide_pass', 'tables_6', 'warm_lantern'] as const) {
    if (!hasTavernUpgrade(run, uid) && run.coins >= tavernUpgradeCost(run, uid) + 140) {
      command(run, { t: 'buyTavernUpgrade', id: uid });
      break;
    }
  }
  command(run, { t: 'feastAll' });
  if (!run.meal && (run.diner.feastDishes?.length ?? 0) === 0) {
    const wantId = run.player.hp < run.player.maxHp * 0.7 && hasIngredients(run, MEALS.hearty_stew.cost)
      ? 'hearty_stew'
      : [...MEAL_ORDER].reverse().find((id) => hasIngredients(run, MEALS[id].cost));
    if (wantId) command(run, { t: 'pickMeal', id: wantId, quality: 'perfect' });
  }
  for (const k of MEAT_ORDER) {
    if (run.meats[k] > 0) command(run, { t: 'sellMeatKind', kind: k, count: run.meats[k] });
  }

  // 2. 优先修补防线，先建寒霜水晶塔减速与雷鸣臼炮控场，再逐步加固墙壁/堡垒与主力武器
  command(run, { t: 'repairWall' });
  command(run, { t: 'repairFort' });
  if (run.day >= 2 && run.wall.level < 2) command(run, { t: 'upgradeWall' });

  const earlyOrder: [number, TurretType][] = [[0, 'frost'], [2, 'tesla']];
  for (const [slot, kind] of earlyOrder) {
    if (!run.turrets[slot].type) command(run, { t: 'buildTurret', slot, kind });
  }

  const offers = [...run.shop].sort((a, b) => WEAPONS[b].price - WEAPONS[a].price);
  for (const id of offers) {
    if (run.player.weapons.some((w) => w.id === id) || WEAPONS[id].price > run.coins) continue;
    const minScore = Math.min(...run.player.weapons.map((w) => WEAPONS[w.id].price * (1 + 0.35 * (w.star - 1))));
    if (run.player.weapons.length < MAX_CARRY || WEAPONS[id].price > minScore + 20) {
      if (run.player.weapons.length >= MAX_CARRY) {
        let worstIdx = 0, worstS = Infinity;
        run.player.weapons.forEach((w, idx) => {
          const sc = WEAPONS[w.id].price * (1 + 0.35 * (w.star - 1));
          if (sc < worstS) { worstS = sc; worstIdx = idx; }
        });
        run.player.cur = worstIdx;
      }
      command(run, { t: 'buyWeapon', weapon: id });
    }
  }
  const order: [number, TurretType][] = [[0, 'frost'], [2, 'tesla'], [3, 'cannon'], [1, 'mg']];
  for (const [slot, kind] of order) {
    if (!run.turrets[slot].type) command(run, { t: 'buildTurret', slot, kind });
  }
  if (run.day >= 4) command(run, { t: 'upgradeWall' });
  if (run.day >= 4) command(run, { t: 'upgradeFort' });

  const ranked = [...run.player.weapons].sort((a, b) => WEAPONS[b.id].price - WEAPONS[a.id].price);
  for (const w of ranked) {
    if (w.id === 'pistol' && ranked.some((o) => o.id !== 'pistol')) continue;
    command(run, { t: 'buyStar', weapon: w.id });
  }
  for (let i = 0; i < run.turrets.length; i++) command(run, { t: 'upgradeTurret', slot: i });

  if (run.player.hp < run.player.maxHp * 0.65) command(run, { t: 'buySupply', item: 'medkit' });
  if (run.player.grenades < 2) command(run, { t: 'buySupply', item: 'grenade' });
  if (run.player.armor < 25) command(run, { t: 'buySupply', item: 'armor' });
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
