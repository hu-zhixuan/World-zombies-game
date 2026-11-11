import { describe, expect, test } from 'vitest';
import { CLASSES, CRIT_MUL, LAST_DAY, STAR_COST, TURRET, WEAPONS, magSize, nextUnlock, starMul, sustainedDps, unlockedClasses, unlockedWeapons, zombieHp } from '../src/content/data';
import { runBot } from '../src/sim/bot';
import { MAX_CARRY, command, damageMul, newRun, step, turretUpgradeCost } from '../src/sim/sim';
import { NO_INPUT, type RunState } from '../src/sim/types';

const clone = (r: RunState): RunState => JSON.parse(JSON.stringify(r));
const zombie = (r: RunState, x: number, hp = 100000) => {
  const z = { id: r.nextId++, kind: 'roamer' as const, x, hp, maxHp: hp, atkCd: 999, kb: 0, burnT: 0, slowT: 0, carriesCrate: false };
  r.zombies.push(z); return z;
};
/** 一个没有刷怪的安静场地，方便单独测某条规则 */
const quiet = () => { const r = newRun(7); r.spawn.left = 0; r.spawn.timer = 1e9; return r; };

describe('手感曲线', () => {
  test('开局手枪打第 1 天的普通僵尸不超过 4 枪', () => {
    expect(Math.ceil(zombieHp('roamer', 1) / WEAPONS.pistol.damage)).toBeLessThanOrEqual(4);
  });
  test('跟得上进度的武器，击杀时间全程在 0.5～1.5 秒', () => {
    const expected: [number, keyof typeof WEAPONS, number][] = [[1, 'pistol', 1], [2, 'smg', 1], [3, 'smg', 1], [3, 'shotgun', 1], [3, 'rifle', 1], [4, 'smg', 2], [5, 'smg', 3], [5, 'shotgun', 2]];
    for (const [day, w, star] of expected) {
      const ttk = zombieHp('roamer', day) / sustainedDps(WEAPONS[w], star);
      expect(ttk, `第 ${day} 天 ${w} ★${star}`).toBeGreaterThan(0.5);
      expect(ttk, `第 ${day} 天 ${w} ★${star}`).toBeLessThan(1.5);
    }
  });
  test('稀有度对应强度：蓝武比白武强', () => {
    expect(sustainedDps(WEAPONS.smg)).toBeGreaterThan(sustainedDps(WEAPONS.pistol) * 1.5);
  });
});

describe('瞄准', () => {
  test('按住开火会自动转身打射程内最近的僵尸，包括身后的', () => {
    const r = quiet(); r.player.x = 400; r.player.facing = 1;
    const behind = zombie(r, 300, 60); zombie(r, 800);
    for (let i = 0; i < 90; i++) step(r, { ...NO_INPUT, fire: true });
    expect(r.player.facing).toBe(-1);
    expect(r.zombies.find((z) => z.id === behind.id)).toBeUndefined();
  });
  test('锁住的目标不会因为另一只稍微近一点就换', () => {
    const r = quiet(); r.player.x = 300;
    const a = zombie(r, 420); step(r, NO_INPUT);
    expect(r.targetId).toBe(a.id);
    zombie(r, 410); step(r, NO_INPUT);
    expect(r.targetId).toBe(a.id);
  });
  test('射程外不锁、不乱转身、不开枪', () => {
    const r = quiet(); r.player.x = 100; zombie(r, 800);
    const ev = step(r, { ...NO_INPUT, fire: true });
    expect(r.targetId).toBeNull();
    expect(r.player.facing).toBe(1);
    expect(ev.some((e) => e.t === 'shot')).toBe(false); // 不白白打空弹匣
    expect(r.player.weapons[0].ammo).toBe(WEAPONS.pistol.mag);
  });
  test('打空自动换弹，换完接着打', () => {
    const r = quiet(); r.player.x = 300; zombie(r, 420);
    let reloads = 0, shots = 0;
    for (let i = 0; i < 600; i++) for (const e of step(r, { ...NO_INPUT, fire: true })) { if (e.t === 'reload') reloads++; if (e.t === 'shot' && e.from === 'player') shots++; }
    expect(reloads).toBeGreaterThanOrEqual(2);
    expect(shots).toBeGreaterThan(WEAPONS.pistol.mag * 2);
  });
});

describe('武器升星', () => {
  test('捡到没有的武器是新武器，捡到已有的升一星', () => {
    const r = quiet(); r.player.x = 200;
    r.crates.push({ id: 900, x: 200, weapon: 'smg' });
    expect(step(r, NO_INPUT).some((e) => e.t === 'pickup' && e.isNew)).toBe(true);
    expect(r.player.weapons.map((w) => w.id)).toEqual(['pistol', 'smg']);
    r.crates.push({ id: 901, x: 200, weapon: 'smg' });
    expect(step(r, NO_INPUT).some((e) => e.t === 'star' && e.star === 2)).toBe(true);
    expect(r.player.weapons[1].star).toBe(2);
  });
  test('工坊花金币升星：钱不够不行，升完伤害 +35%', () => {
    const r = quiet(); r.phase = 'camp';
    expect(command(r, { t: 'buyStar', weapon: 'pistol' })).toBeNull();
    r.coins = STAR_COST[1];
    expect(command(r, { t: 'buyStar', weapon: 'pistol' })).not.toBeNull();
    expect(r.coins).toBe(0);
    expect(r.player.weapons[0].star).toBe(2);
    expect(starMul(2)).toBeCloseTo(1.35);
  });
  test('满星后再捡到转成废铁', () => {
    const r = quiet(); r.player.x = 200; r.player.weapons[0].star = 5;
    r.crates.push({ id: 900, x: 200, weapon: 'pistol' }); step(r, NO_INPUT);
    expect(r.player.weapons[0].star).toBe(5);
    expect(r.scrap).toBe(4);
  });
});

describe('成长', () => {
  test('★3 弹匣 +50%，★5 每次多打出子弹', () => {
    expect(magSize('pistol', 2)).toBe(12);
    expect(magSize('pistol', 3)).toBe(18);
    const r = quiet(); r.player.x = 300; r.player.weapons[0].star = 5; r.player.weapons[0].ammo = magSize('pistol', 5); zombie(r, 400);
    step(r, { ...NO_INPUT, fire: true });
    expect(r.bullets.filter((b) => b.from === 'player').length).toBe(2);
    expect(r.player.weapons[0].ammo).toBe(magSize('pistol', 5) - 1); // 多打的那颗不多耗子弹
  });
  test('随身最多两把：满了捡到新武器会换掉手里这把', () => {
    const r = quiet(); r.player.x = 200; r.player.weapons.push({ id: 'smg', star: 2, ammo: 5 }); r.player.cur = 1;
    r.crates.push({ id: 900, x: 200, weapon: 'shotgun' }); step(r, NO_INPUT);
    expect(r.player.weapons.map((w) => w.id)).toEqual(['pistol', 'shotgun']);
    expect(r.player.weapons.length).toBe(MAX_CARRY);
  });
  test('只会掉出已经解锁的武器', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const r = newRun(seed, ['smg']); runBot(r);
      expect(r.player.weapons.every((w) => w.id === 'pistol' || w.id === 'smg'), `种子 ${seed}`).toBe(true);
    }
  });
  test('受的伤会带到明天：休息一晚只回 30%', () => {
    const r = quiet(); r.phase = 'camp'; r.player.hp = 20;
    command(r, { t: 'nextDay' });
    expect(r.player.hp).toBe(50);
  });
  test('星星解锁新武器进掉落池', () => {
    expect(unlockedWeapons(0)).toEqual(['smg']);
    expect(unlockedWeapons(3)).toEqual(['smg', 'shotgun']);
    expect(nextUnlock(3)!.id).toBe('rifle');
    expect(nextUnlock(99)).toBeUndefined();
    // 职业也靠星星解锁：一开始只有枪手，2 颗星解锁工程师；主厨要等食堂做出来
    expect(unlockedClasses(0)).toEqual(['gunner']);
    expect(nextUnlock(0)!.id).toBe('engineer');
    expect(unlockedClasses(99)).toEqual(['gunner', 'engineer']);
    expect(CLASSES.chef.comingSoon).toBeTruthy();
  });
});

describe('职业', () => {
  test('枪手「鹰眼」：持续时间内必暴、全穿透，之后进冷却', () => {
    const r = newRun(7, ['smg'], 'gunner'); r.spawn.left = 0; r.spawn.timer = 1e9; r.player.x = 300;
    const a = zombie(r, 380), b = zombie(r, 420);
    expect(step(r, { ...NO_INPUT, skill: true }).some((e) => e.t === 'skill')).toBe(true);
    const hits: { id: number; dmg: number; crit?: boolean }[] = [];
    for (let i = 0; i < 20; i++) for (const e of step(r, { ...NO_INPUT, fire: i === 0 })) if (e.t === 'hit' && e.dmg > 15) hits.push(e);
    expect(new Set(hits.map((h) => h.id))).toEqual(new Set([a.id, b.id]));
    expect(hits.every((h) => h.crit && h.dmg === WEAPONS.pistol.damage * CRIT_MUL)).toBe(true);
    expect(r.skill.cd).toBeGreaterThan(0);
    expect(step(r, { ...NO_INPUT, skill: true }).some((e) => e.t === 'skill')).toBe(false);
  });
  test('工程师：升塔便宜 25%，塔伤害 +20%，「过载」时塔攻速翻倍', () => {
    const count = (cls: 'gunner' | 'engineer', skill: boolean) => {
      const r = newRun(7, ['smg'], cls); r.spawn.left = 0; r.spawn.timer = 1e9; r.player.x = 60; zombie(r, 400);
      let shots = 0, dmg = 0;
      for (let i = 0; i < 300; i++) for (const e of step(r, { ...NO_INPUT, skill: skill && i === 0 })) { if (e.t === 'shot' && e.from === 'turret') shots++; if (e.t === 'hit') dmg = e.dmg; }
      return { shots, dmg, cost: turretUpgradeCost(r) };
    };
    const base = count('gunner', false), eng = count('engineer', false), over = count('engineer', true);
    expect(eng.dmg).toBe(Math.round(TURRET.levels[0].damage * 1.2));
    expect(eng.cost).toBeLessThan(base.cost);
    expect(over.shots).toBeGreaterThan(eng.shots * 1.8);
  });
  test('两个能选的职业机器人都能打完', () => {
    for (const cls of ['gunner', 'engineer'] as const) expect(runBot(newRun(11, ['smg'], cls)).won, cls).toBe(true);
  });
});

describe('天赋', () => {
  test('三选一给出 3 个不重复、还没拿过的天赋', () => {
    const r = newRun(9); r.perks.push('lifesteal');
    r.spawn.left = 0; r.zombies = []; r.phase = 'clear'; r.phaseT = 9999;
    step(r, NO_INPUT);
    expect(r.phase).toBe('perk');
    expect(new Set(r.perkChoices).size).toBe(3);
    expect(r.perkChoices).not.toContain('lifesteal');
  });
  test('玻璃大炮：伤害 ×2.2，最大生命减半', () => {
    const r = quiet(); r.phase = 'perk'; r.perkChoices = ['glasscannon'];
    command(r, { t: 'pickPerk', id: 'glasscannon' });
    expect(r.player.maxHp).toBe(50);
    expect(damageMul(r)).toBeCloseTo(2.2);
  });
  test('连锁处决：连杀叠伤害，断了清零', () => {
    const r = quiet(); r.perks.push('chainkill'); r.player.x = 300;
    zombie(r, 380, 10); zombie(r, 400, 10); zombie(r, 890); // 远处留一只，让这一天不结束
    for (let i = 0; i < 60; i++) step(r, { ...NO_INPUT, fire: true });
    expect(damageMul(r)).toBeCloseTo(1.2);
    for (let i = 0; i < 200; i++) step(r, NO_INPUT);
    expect(damageMul(r)).toBe(1);
  });
  test('贯穿：一发子弹能打到一条线上的两只', () => {
    const r = quiet(); r.perks.push('pierce'); r.player.x = 300;
    const a = zombie(r, 380), b = zombie(r, 420);
    const hit = new Set<number>();
    for (let i = 0; i < 20; i++) for (const e of step(r, { ...NO_INPUT, fire: i === 0 })) if (e.t === 'hit') hit.add(e.id);
    expect(hit).toEqual(new Set([a.id, b.id]));
  });
  test('没有贯穿时子弹打到第一只就消失', () => {
    const r = quiet(); r.player.x = 300;
    const a = zombie(r, 380); zombie(r, 420);
    const hit = new Set<number>();
    for (let i = 0; i < 20; i++) for (const e of step(r, { ...NO_INPUT, fire: i === 0 })) if (e.t === 'hit') hit.add(e.id);
    expect(hit).toEqual(new Set([a.id]));
  });
});

describe('一整局', () => {
  test('同样的种子跑出同样的结果', () => {
    const a = newRun(42), b = newRun(42);
    runBot(a); runBot(b);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
  test('存档读回来接着玩，和没存过一模一样', () => {
    const a = newRun(5);
    for (let i = 0; i < 900; i++) step(a, { ...NO_INPUT, fire: true });
    const b = clone(a);
    for (let i = 0; i < 900; i++) { step(a, { ...NO_INPUT, fire: true }); step(b, { ...NO_INPUT, fire: true }); }
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });
  test('机器人能打完全部天数，每天的节奏在合理范围', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const r = newRun(seed);
      const rep = runBot(r);
      expect(rep.won, `种子 ${seed}`).toBe(true);
      expect(rep.days.length).toBe(LAST_DAY);
      for (const d of rep.days) {
        expect(d.seconds, `种子 ${seed} 第 ${d.day} 天用时`).toBeGreaterThan(15);
        expect(d.seconds, `种子 ${seed} 第 ${d.day} 天用时`).toBeLessThan(90);
      }
    }
  });
  test('塔不会自己把怪清光：玩家不开火会输', () => {
    const r = newRun(3);
    for (let i = 0; i < 60 * 60 * 6 && r.phase === 'fight'; i++) step(r, NO_INPUT);
    expect(r.phase).toBe('dead');
  });
});
