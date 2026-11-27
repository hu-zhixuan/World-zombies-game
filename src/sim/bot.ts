// 自动打的机器人：用来在测试里跑完整 15 天流程，检验难度曲线与各模块经济联动。
import { MEAT_ORDER, WEAPONS, ZOMBIES, type TurretType } from '../content/data';
import { MAX_CARRY, command, isOnPorch, isOnRoof, nearbyWeaponCrate, step } from './sim';
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
  const nearWc = nearbyWeaponCrate(run);
  const canQuickPick = !!nearWc && (
    p.weapons.length < MAX_CARRY
    || p.weapons.some((w) => w.id === nearWc.weapon)
  );
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
    interact: canQuickPick,
    skill: run.zombies.length >= 4 && run.skill.cd === 0,
    grenade: crowdNearWall && p.grenades > 0 && run.zombies.length >= 4,
  };
}

export interface BotReport { won: boolean; ticks: number; days: { day: number; seconds: number; hpLost: number; wallLost: number }[]; events: GameEvent[] }

function manageCamp(run: RunState) {
  // 1. 直接开张烤肉接待（火候停金区出锅 + 端肉上桌得赏金与明日战备），多余生肉换金
  if (run.inside && run.guests.some((g) => !g.served)) {
    command(run, { t: 'startShift' });
    for (const g of run.guests) {
      if (g.served || (run.meats.tender + run.meats.thick + run.meats.essence <= 0)) break;
      if (!command(run, { t: 'startGrill', guestId: g.id })) break;
      let guard = 0;
      while (run.grillMinigame && guard++ < 90) {
        if (Math.abs(run.grillMinigame.fill - 0.79) <= 0.04) break;
        step(run, NO_INPUT);
      }
      command(run, { t: 'stopGrill' });
      if (run.carryingDish) command(run, { t: 'serveCarried' });
    }
    if (run.dinerShift.mode === 'open') command(run, { t: 'closeShift' });
    if (run.dinerShift.mode === 'summary') command(run, { t: 'finishSummary' });
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
      let replaceIndex: number | undefined;
      if (run.player.weapons.length >= MAX_CARRY) {
        let worstIdx = 0, worstS = Infinity;
        run.player.weapons.forEach((w, idx) => {
          const sc = WEAPONS[w.id].price * (1 + 0.35 * (w.star - 1));
          if (sc < worstS) { worstS = sc; worstIdx = idx; }
        });
        replaceIndex = worstIdx;
      }
      command(run, { t: 'buyWeapon', weapon: id, replaceIndex });
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
    const nearWc = nearbyWeaponCrate(run);
    if (nearWc && run.player.weapons.length >= MAX_CARRY && !run.player.weapons.some((w) => w.id === nearWc.weapon)) {
      let worstIdx = 0, worstS = Infinity;
      run.player.weapons.forEach((w, idx) => {
        const sc = WEAPONS[w.id].price * (1 + 0.35 * (w.star - 1));
        if (sc < worstS) { worstS = sc; worstIdx = idx; }
      });
      const minOwnedScore = worstS;
      if (WEAPONS[nearWc.weapon].price > minOwnedScore + 15) {
        command(run, { t: 'pickupCrate', crateId: nearWc.id, replaceIndex: worstIdx });
      }
    }
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
