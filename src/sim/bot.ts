// 自动打的机器人：用来在测试里跑完整一局，量难度曲线。打法很朴素——站在路障后面按住开火，清场后去捡箱子。
import { command, step } from './sim';
import { WALL_X, type GameEvent, type Input, type RunState } from './types';

export function botInput(run: RunState): Input {
  const p = run.player;
  const crate = run.crates[0];
  const goal = run.phase === 'clear' && crate ? crate.x : crate && run.zombies.every((z) => z.x > crate.x + 60) ? crate.x : WALL_X - 60;
  const dx = goal - p.x;
  return { move: Math.abs(dx) < 3 ? 0 : Math.sign(dx), fire: run.zombies.length > 0, jump: false, dodge: false, reload: false, swap: false, skill: run.zombies.length >= 4 };
}

export interface BotReport { won: boolean; ticks: number; days: { day: number; seconds: number; hpLost: number; wallLost: number }[]; events: GameEvent[] }

/** 跑到通关或死亡。每天清场后选第一个天赋，有钱就升星。 */
export function runBot(run: RunState, maxTicks = 60 * 60 * 10): BotReport {
  const report: BotReport = { won: false, ticks: 0, days: [], events: [] };
  let dayStartTick = run.tick, hpLost = 0, wallAtStart = run.wall.hp;
  for (let i = 0; i < maxTicks; i++) {
    if (run.phase === 'perk') { command(run, { t: 'pickPerk', id: run.perkChoices[0] }); continue; }
    if (run.phase === 'camp') {
      const w = run.player.weapons[run.player.weapons.length - 1];
      command(run, { t: 'repairWall' });
      command(run, { t: 'buyStar', weapon: w.id });
      command(run, { t: 'upgradeTurret' });
      command(run, { t: 'nextDay' });
      dayStartTick = run.tick; hpLost = 0; wallAtStart = run.wall.hp;
      continue;
    }
    if (run.phase === 'dead' || run.phase === 'won') break;
    // 机器人手里有更好的枪就换过去
    const best = run.player.weapons.length - 1;
    const input = botInput(run);
    if (run.player.cur !== best) input.swap = true;
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
