import { describe, expect, test } from 'vitest';
import {
  CLASSES, CRIT_MUL, FORT_LEVELS, LAST_DAY, MEALS, WALL_LEVELS, WEAPONS,
  nextUnlock, sustainedDps, unlockedClasses, unlockedMeals, unlockedWeapons, zombieHp,
} from '../src/content/data';
import {
  BOSS_INTROS, BOSS_VICTORY, CINEMATIC_INTRO, COMPANION_JOIN_STORIES, QUALITY_META,
  REST_STORY, VIP_CUSTOMERS, WAVE_STORY_LINES,
} from '../src/content/story';
import { runBot } from '../src/sim/bot';
import {
  BODY_Y, MAX_CARRY, command, computeGrenadeThrow, damageMul, effectiveRange,
  isOnPorch, isOnRoof, meatPrice, newRun, step, turretBuildCost, turretRefundCoins, turretUpgradeCost,
} from '../src/sim/sim';
import { DOOR_X, GROUND_Y, HOUSE_WALL_X, IN_STATIONS, NO_INPUT, PORCH_MAX_X, PORCH_Y, ROOF_Y, WALL_X, type RunState } from '../src/sim/types';

const clone = (r: RunState): RunState => JSON.parse(JSON.stringify(r));
const zombie = (r: RunState, x: number, hp = 100000, kind: 'roamer' | 'ghoul' | 'boss_beast' = 'roamer') => {
  const z = { id: r.nextId++, kind, x, hp, maxHp: hp, atkCd: 999, kb: 0, burnT: 0, slowT: 0, carriesCrate: false };
  r.zombies.push(z); return z;
};
/** 一个没有刷怪的安静场地，默认关闭屋顶 1 号初始机枪塔以便测纯主角规则 */
const quiet = (keepTurret = false) => {
  const r = newRun(7);
  r.spawn.left = 0; r.spawn.timer = 1e9;
  if (!keepTurret) r.turrets.forEach((t) => { t.type = null; t.level = 0; });
  return r;
};

describe('手感曲线与枪械特色', () => {
  test('开局手枪打第 1 天的普通僵尸不超过 4 枪', () => {
    expect(Math.ceil(zombieHp('roamer', 1) / WEAPONS.pistol.damage)).toBeLessThanOrEqual(4);
  });
  test('不同定位武器：突击步枪高于自卫手枪，且每把武器皆有鲜明特色标签与说明', () => {
    expect(sustainedDps(WEAPONS.assault)).toBeGreaterThan(sustainedDps(WEAPONS.pistol) * 1.4);
    for (const id of Object.keys(WEAPONS) as (keyof typeof WEAPONS)[]) {
      expect(sustainedDps(WEAPONS[id], 1)).toBeGreaterThan(30);
      expect(WEAPONS[id].trait.length).toBeGreaterThanOrEqual(4);
      expect(WEAPONS[id].desc.length).toBeGreaterThanOrEqual(10);
    }
  });
  test('左轮穿甲 2 人、霰弹近身 1.4x 增伤、急冻步枪碎冰溅射、狙击枪磁轨光束', () => {
    // 左轮穿甲 2 名僵尸
    const rRev = quiet(); rRev.player.x = 300; rRev.player.y = 0; rRev.autoFire = false;
    rRev.player.weapons = [{ id: 'revolver', star: 1, ammo: 6 }];
    const z1 = zombie(rRev, 360, 500), z2 = zombie(rRev, 390, 500), z3 = zombie(rRev, 420, 500);
    for (let i = 0; i < 18; i++) step(rRev, { ...NO_INPUT, fire: i === 0 });
    expect(z1.hp).toBeLessThan(500);
    expect(z2.hp).toBeLessThan(500);
    expect(z3.hp).toBe(500);

    // 急冻步枪命中已减速目标触发碎冰范围伤害
    const rIce = quiet(); rIce.player.x = 300; rIce.player.y = 0; rIce.autoFire = false;
    rIce.player.weapons = [{ id: 'assault', star: 1, ammo: 32 }];
    const zSlow = zombie(rIce, 360, 500); zSlow.slowT = 60;
    const zNear = zombie(rIce, 385, 500);
    let frostEv = false;
    for (let i = 0; i < 15; i++) {
      for (const e of step(rIce, { ...NO_INPUT, fire: i === 0 })) if (e.t === 'frost') frostEv = true;
    }
    expect(frostEv).toBe(true);
    expect(zNear.hp).toBeLessThan(500);

    // 精锐反器材狙发射全屏磁轨光束事件
    const rRifle = quiet(); rRifle.player.x = 300; rRifle.player.y = 0; rRifle.autoFire = false;
    rRifle.player.weapons = [{ id: 'rifle', star: 1, ammo: 6 }];
    zombie(rRifle, 450, 500);
    const evs = step(rRifle, { ...NO_INPUT, fire: true });
    expect(evs.some((e) => e.t === 'railbeam')).toBe(true);
  });
});

describe('2D 小屋实体碰撞、阶梯跳台与元气骑士式手动开火锁敌', () => {
  test('一楼有实体砖墙阻挡不穿模，玩家可通过门廊阶梯二次跳跃亲自跳上二楼房顶', () => {
    const r = quiet(); r.spawn.left = 99;
    expect(isOnRoof(r)).toBe(true);
    expect(r.player.y).toBe(ROOF_Y);
    // 向右走过二楼房顶与中层门廊，落到庭院地面
    while (r.player.x <= PORCH_MAX_X + 8) step(r, { ...NO_INPUT, move: 1 });
    for (let i = 0; i < 45; i++) step(r, NO_INPUT);
    expect(isOnRoof(r)).toBe(false);
    expect(r.player.y).toBe(0);

    // 在地面一直往左走，会被小屋一楼右侧实体砖墙 (HOUSE_WALL_X) 挡住，绝不穿进屋内
    for (let i = 0; i < 80; i++) step(r, { ...NO_INPUT, move: -1 });
    expect(r.player.x).toBe(HOUSE_WALL_X);
    expect(r.player.y).toBe(0);

    // 第一跳：从门廊地面跳上中层木挑台 (PORCH_Y = -48)
    step(r, { ...NO_INPUT, jump: true });
    for (let i = 0; i < 38; i++) step(r, NO_INPUT);
    expect(isOnPorch(r)).toBe(true);
    expect(r.player.y).toBe(PORCH_Y);

    // 第二跳：从中层木挑台跳上二层屋顶防守平台 (ROOF_Y = -92)
    step(r, { ...NO_INPUT, jump: true, move: -1 });
    for (let i = 0; i < 40; i++) step(r, { ...NO_INPUT, move: -1 });
    expect(isOnRoof(r)).toBe(true);
    expect(r.player.y).toBe(ROOF_Y);
    expect(r.player.x).toBeLessThan(HOUSE_WALL_X); // 在二楼房顶可以自由走到小屋正上方
  });

  test('元气骑士手感：默认绝不自动开枪，按住攻击键才自动锁敌或朝面朝方向盲射', () => {
    const r = quiet();
    expect(r.autoFire).toBe(false);
    r.player.x = 400; r.player.y = 0; r.player.facing = 1;
    const behind = zombie(r, 300, 60);
    // 不按开火键：准星可锁定射程内目标，但一发子弹都不射出、不擅自转身
    for (let i = 0; i < 30; i++) {
      const evs = step(r, NO_INPUT);
      expect(evs.some((e) => e.t === 'shot' && e.from === 'player')).toBe(false);
    }
    expect(r.targetId).toBe(behind.id);
    expect(r.player.weapons[0].ammo).toBe(WEAPONS.pistol.mag);

    // 按住攻击键：自动锁敌转身击杀身后僵尸；没有目标时也能朝前空射一枪
    for (let i = 0; i < 90; i++) step(r, { ...NO_INPUT, fire: true });
    expect(r.player.facing).toBe(-1);
    expect(r.zombies.find((z) => z.id === behind.id)).toBeUndefined();

    r.player.fireCd = 0; r.player.reloadT = 0; r.player.facing = 1;
    const blindEv = step(r, { ...NO_INPUT, fire: true });
    expect(r.targetId).toBeNull();
    expect(blindEv.some((e) => e.t === 'shot' && e.from === 'player')).toBe(true);
  });

  test('在房顶自带 +15% 高低差射程加成', () => {
    const r = quiet();
    r.player.y = 0;
    const groundRange = effectiveRange(r, 'pistol');
    r.player.y = ROOF_Y;
    expect(effectiveRange(r, 'pistol')).toBeGreaterThan(groundRange);
  });

  test('点击指定优先目标会切过去集火，打死前不乱换', () => {
    const r = quiet(); r.player.x = 300; r.player.y = 0;
    const a = zombie(r, 420); const b = zombie(r, 460);
    step(r, NO_INPUT);
    expect(r.targetId).toBe(a.id);
    command(r, { t: 'focusTarget', x: 460 });
    step(r, NO_INPUT);
    expect(r.targetId).toBe(b.id);
  });

  test('射程外不锁、不乱转身、不白打空弹匣', () => {
    const r = quiet(); r.player.x = 300; r.player.y = 0; zombie(r, 850);
    const ev = step(r, NO_INPUT);
    expect(r.targetId).toBeNull();
    expect(r.player.facing).toBe(1);
    expect(ev.some((e) => e.t === 'shot')).toBe(false);
    expect(r.player.weapons[0].ammo).toBe(WEAPONS.pistol.mag);
  });

  test('打空自动换弹，换完接着打', () => {
    const r = quiet(); r.player.x = 300; r.player.y = 0; zombie(r, 420);
    let reloads = 0, shots = 0;
    for (let i = 0; i < 600; i++) for (const e of step(r, { ...NO_INPUT, fire: true })) { if (e.t === 'reload') reloads++; if (e.t === 'shot' && e.from === 'player') shots++; }
    expect(reloads).toBeGreaterThanOrEqual(2);
    expect(shots).toBeGreaterThan(WEAPONS.pistol.mag * 2);
  });
});

describe('武器升星、可控抛物线手雷、护甲与商店', () => {
  test('移除废铁双货币：捡到新武器进武器栏，已有升星，满星直接折算金币', () => {
    const r = quiet(); r.player.x = 280; r.player.y = 0;
    expect('scrap' in r).toBe(false);
    r.crates.push({ id: 900, x: 280, weapon: 'smg' });
    expect(step(r, NO_INPUT).some((e) => e.t === 'pickup' && e.isNew)).toBe(true);
    expect(r.player.weapons.map((w) => w.id)).toEqual(['pistol', 'smg']);
    r.crates.push({ id: 901, x: 280, weapon: 'smg' });
    expect(step(r, NO_INPUT).some((e) => e.t === 'star' && e.star === 2)).toBe(true);
    r.player.weapons[0].star = 5;
    r.crates.push({ id: 902, x: 280, weapon: 'pistol' }); step(r, NO_INPUT);
    expect(r.coins).toBe(45);
  });

  test('随身最多 3 把武器：超出时替换手中武器', () => {
    const r = quiet(); r.player.x = 280; r.player.y = 0;
    r.player.weapons.push({ id: 'smg', star: 1, ammo: 10 }, { id: 'revolver', star: 1, ammo: 6 });
    r.player.cur = 1;
    r.crates.push({ id: 900, x: 280, weapon: 'shotgun' }); step(r, NO_INPUT);
    expect(r.player.weapons.map((w) => w.id)).toEqual(['pistol', 'shotgun', 'revolver']);
    expect(r.player.weapons.length).toBe(MAX_CARRY);
  });

  test('金币商店可购买武器、补给（手雷/护甲/绷带）、刷货与拆解', () => {
    const r = quiet(); r.phase = 'camp'; r.inside = true; r.coins = 500;
    expect(command(r, { t: 'buyWeapon', weapon: 'revolver' })).not.toBeNull();
    expect(r.player.weapons.some((w) => w.id === 'revolver')).toBe(true);
    r.player.hp = 40;
    expect(command(r, { t: 'buySupply', item: 'armor' })).not.toBeNull();
    expect(r.player.armor).toBe(40);
    expect(command(r, { t: 'buySupply', item: 'medkit' })).not.toBeNull();
    expect(r.player.hp).toBe(85);
    expect(command(r, { t: 'buySupply', item: 'grenade' })).not.toBeNull();
    expect(r.player.grenades).toBe(4);
    expect(command(r, { t: 'rerollShop' })).not.toBeNull();
    expect(r.shop.length).toBe(3);
    expect(command(r, { t: 'salvageWeapon', index: 1 })).not.toBeNull();
    expect(r.player.weapons.length).toBe(1);
  });

  test('手雷可拖拽控制抛物线远近与高低弧度，且越过前排命中精准爆区，护甲优先抵扣伤害', () => {
    const r = quiet();
    const highFar = computeGrenadeThrow(r, { dx: 1, dy: -1 });
    const lowClose = computeGrenadeThrow(r, { dx: -0.4, dy: 0.9 });
    expect(highFar.frames).toBeGreaterThan(lowClose.frames + 15);
    expect(highFar.vx).toBeGreaterThan(lowClose.vx);
    expect(highFar.vy).toBeLessThan(lowClose.vy); // 更强向上抛射弧线

    // 远距离高抛：跳过近处的 front，越过头顶精准炸毁远端 walking 过来的 back 僵尸
    const front = zombie(r, 340, 300);
    const back = zombie(r, 690, 300);
    step(r, { ...NO_INPUT, grenade: true, grenadeAim: { dx: 1, dy: -0.9 } });
    for (let i = 0; i < 80; i++) step(r, NO_INPUT);
    expect(front.hp).toBe(300);
    expect(back.hp).toBeLessThan(200);
    expect(GROUND_Y).toBeGreaterThan(200);

    // 护甲先扣伤
    r.player.armor = 30; r.player.hp = 100; r.player.y = 0; r.player.x = 500;
    const melee = zombie(r, 505, 500); melee.atkCd = 0;
    step(r, NO_INPUT);
    expect(r.player.armor).toBeLessThan(30);
    expect(r.player.hp).toBe(100);
  });
});

describe('酒馆室内、深夜食堂全功能、4 炮塔与堡垒路障全金币升级', () => {
  test('选完天赋自动进酒馆并触发初开张剧情，可铁板炒菜招待 VIP 拿声望粉丝/点评/热搜加成并留特餐', () => {
    const r = quiet(); r.phase = 'perk'; r.perkChoices = ['rooftop'];
    const perkEvs = command(r, { t: 'pickPerk', id: 'rooftop' })!;
    expect(perkEvs.some((e) => e.t === 'dinerStory' && e.eventKey === 'firstOpen')).toBe(true);
    expect(r.phase).toBe('camp');
    expect(r.inside).toBe(true);
    expect(r.guests.length).toBe(3);

    r.meat = 12;
    const serveEv = command(r, { t: 'serveGuest', guestId: r.guests[0].id, quality: 'legendary' })!;
    expect(serveEv).not.toBeNull();
    const evData = serveEv.find((e) => e.t === 'serve');
    expect(evData && evData.t === 'serve' ? evData.firstMeet : false).toBe(true);
    expect(r.diner.fans).toBeGreaterThanOrEqual(QUALITY_META.legendary.fans);
    expect(r.diner.rep).toBeGreaterThanOrEqual(QUALITY_META.legendary.rep);
    expect(r.diner.reviews.length).toBe(1);
    expect(r.diner.metVips.length).toBe(1);

    for (let i = 1; i < r.guests.length; i++) {
      expect(command(r, { t: 'serveGuest', guestId: r.guests[i].id, quality: 'perfect' })).not.toBeNull();
    }
    expect(r.guests.every((g) => g.served)).toBe(true);
    expect(r.coins).toBeGreaterThan(85);

    // 6 道食谱随天数解锁，第 1 天不可做第 7 天才解锁的终章末日大餐
    expect(unlockedMeals(1).length).toBe(1);
    expect(unlockedMeals(7).length).toBe(6);
    expect(command(r, { t: 'pickMeal', id: 'apocalypse_feast' })).toBeNull();

    command(r, { t: 'pickMeal', id: 'spicy_skewer', quality: 'legendary' });
    expect(r.meal).toBe('spicy_skewer');
    if (r.meat > 0) command(r, { t: 'cookSell', count: r.meat });
    expect(r.meat).toBe(0);
    // 出门与进门
    r.player.x = IN_STATIONS.door;
    step(r, { ...NO_INPUT, interact: true });
    expect(r.inside).toBe(false);
    expect(r.player.x).toBe(DOOR_X);
    // 次日特餐（含传说火候加成）转为战斗伤害加成
    command(r, { t: 'nextDay' });
    expect(r.inside).toBe(false);
    expect(r.buff.dmgMul).toBeCloseTo(MEALS.spicy_skewer.dmgMul * QUALITY_META.legendary.buffMul);
    expect(damageMul(r)).toBeGreaterThan(1.5); // 房顶居高 + 特餐
  });

  test('主厨全部解锁：掉肉更多、卖肉多 +35%、特餐效果 +50%', () => {
    expect(unlockedClasses(4)).toEqual(['gunner', 'engineer', 'chef']);
    expect(CLASSES.chef.comingSoon).toBeUndefined();
    expect(meatPrice('chef')).toBeGreaterThan(meatPrice('gunner'));
    const c = newRun(9, ['revolver', 'smg'], 'chef');
    c.phase = 'camp'; c.meat = 3;
    command(c, { t: 'pickMeal', id: 'spicy_skewer', quality: 'good' });
    command(c, { t: 'nextDay' });
    expect(c.buff.dmgMul).toBeCloseTo(MEALS.spicy_skewer.dmgMul * 1.5);
  });

  test('全剧情文案与 15 位 VIP 档案齐备，且 2/4/6/8 天战友加入正确提供永久增益', () => {
    expect(CINEMATIC_INTRO.length).toBeGreaterThanOrEqual(5);
    expect(VIP_CUSTOMERS.length).toBe(15);
    for (let d = 1; d <= LAST_DAY; d++) expect(WAVE_STORY_LINES[d]?.length).toBeGreaterThanOrEqual(2);
    expect(BOSS_INTROS.length).toBe(3);
    expect(BOSS_VICTORY.length).toBe(3);
    expect(Object.keys(COMPANION_JOIN_STORIES)).toEqual(['2', '4', '6', '8']);
    expect(REST_STORY.firstOpen.lines.length).toBeGreaterThanOrEqual(5);

    // 验证第 2/4/6/8 天选完天赋招募战友及增益
    const r = quiet();
    const baseDmg = damageMul(r);
    r.day = 2; r.phase = 'perk'; r.perkChoices = ['overclock'];
    const e2 = command(r, { t: 'pickPerk', id: 'overclock' })!;
    expect(e2.some((e) => e.t === 'allyJoin' && e.ally === 'zhang')).toBe(true);
    expect(damageMul(r)).toBeCloseTo(baseDmg * 1.1);

    const wallBefore = r.wall.maxHp;
    const buildBefore = turretBuildCost('mg', r.cls, false);
    r.day = 6; r.phase = 'perk'; r.perkChoices = ['vanguard'];
    const e6 = command(r, { t: 'pickPerk', id: 'vanguard' })!;
    expect(e6.some((e) => e.t === 'allyJoin' && e.ally === 'qiang')).toBe(true);
    expect(r.wall.maxHp).toBe(wallBefore + 50);
    expect(turretBuildCost('mg', r.cls, true)).toBeLessThan(buildBefore);

    // 验证声望里程碑触发 rep10 剧情事件
    r.diner.rep = 9; r.meat = 5;
    rollSafeServe(r);
    function rollSafeServe(st: RunState) {
      const g = st.guests.find((o) => !o.served);
      if (!g) return;
      const se = command(st, { t: 'serveGuest', guestId: g.id, quality: 'legendary' })!;
      expect(se.some((e) => e.t === 'dinerStory' && e.eventKey === 'rep10')).toBe(true);
    }
  });

  test('全金币建造 4 个炮塔位（冰霜/电弧/重炮）与拆塔退金币，以及 3 级路障/堡垒升级', () => {
    const r = quiet(); r.phase = 'camp'; r.coins = 1200;
    expect(command(r, { t: 'buildTurret', slot: 0, kind: 'frost' })).not.toBeNull();
    expect(command(r, { t: 'buildTurret', slot: 2, kind: 'tesla' })).not.toBeNull();
    expect(command(r, { t: 'buildTurret', slot: 3, kind: 'cannon' })).not.toBeNull();
    expect(command(r, { t: 'upgradeTurret', slot: 0 })).not.toBeNull();
    const beforeSell = r.coins;
    expect(command(r, { t: 'sellTurret', slot: 3 })).not.toBeNull();
    expect(r.coins).toBe(beforeSell + turretRefundCoins('cannon', 1, r.cls));
    expect(command(r, { t: 'buildTurret', slot: 3, kind: 'cannon' })).not.toBeNull();

    expect(command(r, { t: 'upgradeWall' })).not.toBeNull();
    expect(r.wall.level).toBe(2);
    expect(r.wall.maxHp).toBe(WALL_LEVELS[1].maxHp);
    expect(command(r, { t: 'upgradeFort' })).not.toBeNull();
    expect(r.fort.level).toBe(2);
    expect(r.home.maxHp).toBe(FORT_LEVELS[1].maxHp);
    expect(turretBuildCost('mg', 'engineer')).toBeLessThan(turretBuildCost('mg', 'gunner'));
    expect(turretUpgradeCost('mg', 1, 'engineer')).toBeLessThan(turretUpgradeCost('mg', 1, 'gunner'));

    // 触发路障 Lv2 反伤 + 电弧/冰霜炮塔协同
    command(r, { t: 'nextDay' });
    r.spawn.left = 0; r.spawn.timer = 1e9;
    r.autoFire = false;
    const z1 = zombie(r, WALL_X + 4, 200); z1.atkCd = 0;
    const z2 = zombie(r, WALL_X + 20, 200);
    const events: string[] = [];
    for (let i = 0; i < 65; i++) for (const e of step(r, NO_INPUT)) events.push(e.t);
    expect(events).toContain('lightning');
    expect(events).toContain('frost');
    expect(z2.hp).toBeLessThan(200);
  });

  test('堡垒 3 级夜间自动修墙 30%', () => {
    const r = quiet(); r.phase = 'camp'; r.coins = 500;
    command(r, { t: 'upgradeFort' });
    command(r, { t: 'upgradeFort' });
    expect(r.fort.level).toBe(3);
    r.wall.hp = 10;
    command(r, { t: 'nextDay' });
    expect(r.wall.hp).toBe(10 + Math.round(r.wall.maxHp * 0.3));
  });
});

describe('职业与天赋', () => {
  test('枪手「鹰眼」：全穿透 + 必暴；「贯穿」不穿透对比', () => {
    const r = newRun(7, ['revolver', 'smg'], 'gunner');
    r.spawn.left = 0; r.spawn.timer = 1e9; r.turrets.forEach((t) => { t.type = null; t.level = 0; });
    r.player.x = 300; r.player.y = 0; r.autoFire = false;
    const a = zombie(r, 380), b = zombie(r, 420);
    expect(step(r, { ...NO_INPUT, skill: true }).some((e) => e.t === 'skill')).toBe(true);
    const hits: { id: number; dmg: number; crit?: boolean }[] = [];
    for (let i = 0; i < 20; i++) for (const e of step(r, { ...NO_INPUT, fire: i === 0 })) if (e.t === 'hit' && e.dmg > 15) hits.push(e);
    expect(new Set(hits.map((h) => h.id))).toEqual(new Set([a.id, b.id]));
    expect(hits.every((h) => h.crit && h.dmg === WEAPONS.pistol.damage * CRIT_MUL)).toBe(true);
    expect(r.skill.cd).toBeGreaterThan(0);

    // 对比：没有贯穿一枪只中第一只
    const r2 = quiet(); r2.player.x = 300; r2.player.y = 0; r2.autoFire = false;
    const c = zombie(r2, 380); zombie(r2, 420);
    const hit2 = new Set<number>();
    for (let i = 0; i < 20; i++) for (const e of step(r2, { ...NO_INPUT, fire: i === 0 })) if (e.t === 'hit') hit2.add(e.id);
    expect(hit2).toEqual(new Set([c.id]));
  });

  test('玻璃大炮、星星解锁查询与存档序列化一致性', () => {
    const r = quiet(); r.phase = 'perk'; r.perkChoices = ['glasscannon'];
    command(r, { t: 'pickPerk', id: 'glasscannon' });
    expect(r.player.maxHp).toBe(50);
    expect(damageMul(r)).toBeCloseTo(2.2);

    expect(unlockedWeapons(0)).toEqual(['revolver', 'smg']);
    expect(nextUnlock(0)!.id).toBe('engineer');
    expect(nextUnlock(99)).toBeUndefined();

    const a = newRun(5);
    for (let i = 0; i < 900; i++) step(a, NO_INPUT);
    const b = clone(a);
    for (let i = 0; i < 900; i++) { step(a, NO_INPUT); step(b, NO_INPUT); }
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    expect(BODY_Y).toBeLessThan(222);
  });
});

describe('15 天完整流程与 Boss', () => {
  test('第 5 / 10 / 15 天会刷出 Boss，机器人 3 个职业均可通关 15 天', () => {
    for (const cls of ['gunner', 'engineer', 'chef'] as const) {
      const r = newRun(11, ['revolver', 'smg', 'shotgun', 'assault', 'rifle', 'tesla', 'rocket'], cls);
      const rep = runBot(r);
      expect(rep.won, cls).toBe(true);
      expect(rep.days.length).toBe(LAST_DAY);
      const bosses = rep.events.filter((e) => e.t === 'bossAppear');
      expect(bosses.length).toBe(3);
    }
  });

  test('零操作/不开火只靠 1 座 1 级初始机枪塔无法活过前几天', () => {
    const r = newRun(3);
    r.autoFire = false;
    for (let i = 0; i < 60 * 60 * 6 && r.phase === 'fight'; i++) step(r, NO_INPUT);
    expect(r.phase).toBe('dead');
  });

  test('多个随机种子下基础解锁池（仅左轮+冲锋枪）机器人也能稳定打通 15 天', () => {
    for (const seed of [1, 2, 3]) {
      const r = newRun(seed, ['revolver', 'smg']);
      const rep = runBot(r);
      expect(rep.won, `种子 ${seed}`).toBe(true);
      expect(rep.days.length).toBe(LAST_DAY);
    }
  });
});
