import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import {
  CLASSES, CRIT_MUL, DIFFICULTIES, DINER_GUESTS, DRINKS, FORT_LEVELS, LAST_DAY, MEALS, MEAL_ORDER, PERKS, RACK_LEVELS, RYE_FALLBACK, SEAT_UPGRADE_ORDER,
  SPICE_BUY_COST, STAFF_POOL, TAVERN_UPGRADES, TURRETS, WALL_LEVELS, WEAPONS,
  dayZombieCount, dishEnhanceMeatCost, dishUpgradeCost, nextUnlock, partyForDay, sustainedDps, unlockedClasses, unlockedWeapons, zombieHp,
} from '../src/content/data';
import {
  BOSS_INTROS, BOSS_VICTORY, CHAPTER_CARDS, CINEMATIC_INTRO, COMPANION_JOIN_STORIES, DAILY_TRENDS, FANS_RANKS,
  QUALITY_META, REP_TIERS, REST_STORY, STORY_SCENES, VIP_CUSTOMERS, VIP_TIERS, WAVE_STORY_LINES,
} from '../src/content/story';
import { loadMeta, recordRunToMeta, starsEarned } from '../src/app/meta';
import { runBot } from '../src/sim/bot';
import {
  BODY_Y, MAX_CARRY, command, computeGrenadeThrow, damageMul, dinerRank, dishLevel, dishResearchCost, dishServings, dishTaste, effectiveRange,
  houseBuff, isOnPorch, isOnRoof, maxSeats, maxStaffSlots, meatPrice, nearbyCampTarget, newRun, staffHasSkill, step, tavernUpgradeCost, totalMeat,
  turretBuildCost, turretRefundCoins, turretUpgradeCost,
} from '../src/sim/sim';
import {
  ALLY_POS, DINER_PLATE_X, DINER_SEAT_X, DOOR_X, GROUND_Y, HOUSE_WALL_X, IN_STATIONS, NO_INPUT, PORCH_MAX_X, PORCH_Y, ROOF_Y, WALL_X, type RunState,
} from '../src/sim/types';

const clone = (r: RunState): RunState => JSON.parse(JSON.stringify(r));
const zombie = (r: RunState, x: number, hp = 100000, kind: 'roamer' | 'bruiser' | 'bat' | 'ghoul' | 'boss_beast' = 'roamer', y?: number) => {
  const zy = y ?? (kind === 'bat' ? -84 : kind === 'ghoul' ? -72 : 0);
  const z = { id: r.nextId++, kind, x, y: zy, hp, maxHp: hp, atkCd: 999, kb: 0, burnT: 0, slowT: 0, stunT: 0, freezeT: 0, carriesCrate: false };
  r.zombies.push(z); return z;
};
/** 一个没有刷怪的安静场地，默认关闭屋顶 1 号初始火铳塔以便测纯主角规则 */
const quiet = (keepTurret = false) => {
  const r = newRun(7);
  r.spawn.left = 0; r.spawn.timer = 1e9;
  if (!keepTurret) r.turrets.forEach((t) => { t.type = null; t.level = 0; });
  return r;
};

describe('手感曲线与兵器特色', () => {
  test('开局双铳打第 1 天的游荡腐尸不超过 4 击', () => {
    expect(Math.ceil(zombieHp('roamer', 1) / WEAPONS.pistol.damage)).toBeLessThanOrEqual(4);
  });
  test('不同定位兵器：价格与持续输出阶梯合理，且每把兵器皆有鲜明特色标签与说明', () => {
    expect(sustainedDps(WEAPONS.pistol)).toBeLessThan(sustainedDps(WEAPONS.revolver));
    expect(sustainedDps(WEAPONS.revolver)).toBeLessThan(sustainedDps(WEAPONS.smg));
    expect(sustainedDps(WEAPONS.smg)).toBeLessThan(sustainedDps(WEAPONS.shotgun));
    expect(sustainedDps(WEAPONS.shotgun)).toBeLessThan(sustainedDps(WEAPONS.assault));
    expect(sustainedDps(WEAPONS.assault)).toBeLessThan(sustainedDps(WEAPONS.rifle));
    expect(sustainedDps(WEAPONS.assault)).toBeLessThan(sustainedDps(WEAPONS.rocket));
    expect(sustainedDps(WEAPONS.rifle)).toBeLessThan(sustainedDps(WEAPONS.rocket));
    expect(sustainedDps(WEAPONS.tesla)).toBeGreaterThan(sustainedDps(WEAPONS.pistol) * 2.5);
    const turretDps = (t: keyof typeof TURRETS) => (TURRETS[t].levels[0].damage * 60) / TURRETS[t].levels[0].cooldown;
    expect(turretDps('frost')).toBeLessThan(turretDps('mg'));
    expect(turretDps('mg')).toBeLessThan(turretDps('tesla'));
    expect(turretDps('tesla')).toBeLessThan(turretDps('cannon'));
    for (const id of Object.keys(WEAPONS) as (keyof typeof WEAPONS)[]) {
      expect(sustainedDps(WEAPONS[id], 1)).toBeGreaterThan(30);
      expect(WEAPONS[id].trait.length).toBeGreaterThanOrEqual(4);
      expect(WEAPONS[id].desc.length).toBeGreaterThanOrEqual(10);
    }
  });
  test('全 8 把兵器差异化机制：双铳二连回膛、左轮穿甲跳弹震慑、连珠火铳蓄热炽弹、龙息铳轰退爆燃、寒霜连铳深冻碎冰、圣铳破甲、法杖元素超载、追踪爆炎炮', () => {
    // 1. 猎手双铳：1 发扳机打出 2 颗弹丸 + 击杀立即回膛 +2 发弹药
    const rPis = quiet(); rPis.player.x = 300; rPis.player.y = 0; rPis.autoFire = false;
    rPis.player.weapons = [{ id: 'pistol', star: 1, ammo: 5 }];
    const zWeak = zombie(rPis, 350, 20);
    for (let i = 0; i < 10; i++) step(rPis, { ...NO_INPUT, fire: i === 0 });
    expect(zWeak.hp).toBeLessThanOrEqual(0);
    expect(rPis.player.weapons[0].ammo).toBe(6); // 消耗 1 弹，击杀回膛 +2 => 5 - 1 + 2 = 6

    // 2. 重锤左轮：穿甲 2 名目标 + 弹射追击近邻 1 名并击晕震慑，第 4 名不受伤
    const rRev = quiet(); rRev.player.x = 300; rRev.player.y = 0; rRev.autoFire = false;
    rRev.player.weapons = [{ id: 'revolver', star: 1, ammo: 6 }];
    const z1 = zombie(rRev, 360, 500), z2 = zombie(rRev, 390, 500), z3 = zombie(rRev, 420, 500), z4 = zombie(rRev, 455, 500);
    for (let i = 0; i < 18; i++) step(rRev, { ...NO_INPUT, fire: i === 0 });
    expect(z1.hp).toBeLessThan(500);
    expect(z2.hp).toBeLessThan(500);
    expect(z3.hp).toBeLessThan(500);
    expect(z4.hp).toBe(500);
    expect(z1.stunT).toBeGreaterThan(0);

    // 3. 连珠火铳：持续按住开火蓄热飙射速并射出灼烧穿甲火弹 (hot)
    const rSmg = quiet(); rSmg.player.x = 300; rSmg.player.y = 0; rSmg.autoFire = false;
    rSmg.player.weapons = [{ id: 'smg', star: 1, ammo: 44 }];
    zombie(rSmg, 380, 5000);
    let sawHotShot = false;
    for (let i = 0; i < 65; i++) {
      for (const e of step(rSmg, { ...NO_INPUT, fire: true })) if (e.t === 'shot' && e.hot) sawHotShot = true;
    }
    expect(rSmg.player.smgHeat).toBeGreaterThanOrEqual(0.65);
    expect(sawHotShot).toBe(true);

    // 4. 双管龙息铳：近距离 1.5x 增伤并点燃目标
    const rSg = quiet(); rSg.player.x = 300; rSg.player.y = 0; rSg.autoFire = false;
    rSg.player.weapons = [{ id: 'shotgun', star: 1, ammo: 6 }];
    const zClose = zombie(rSg, 360, 500);
    for (let i = 0; i < 12; i++) step(rSg, { ...NO_INPUT, fire: i === 0 });
    expect(500 - zClose.hp).toBeGreaterThanOrEqual(WEAPONS.shotgun.damage * (WEAPONS.shotgun.pellets ?? 6) * 1.4);
    expect(zClose.burnT).toBeGreaterThan(0);

    // 5. 寒霜连铳：命中已减速目标触发深冻定身 + 碎冰范围溅射
    const rIce = quiet(); rIce.player.x = 300; rIce.player.y = 0; rIce.autoFire = false;
    rIce.player.weapons = [{ id: 'assault', star: 1, ammo: 32 }];
    const zSlow = zombie(rIce, 360, 500); zSlow.slowT = 60;
    const zNear = zombie(rIce, 385, 500);
    let frostEv = false;
    for (let i = 0; i < 15; i++) {
      for (const e of step(rIce, { ...NO_INPUT, fire: i === 0 })) if (e.t === 'frost') frostEv = true;
    }
    expect(frostEv).toBe(true);
    expect(zSlow.freezeT).toBeGreaterThan(0);
    expect(zNear.hp).toBeLessThan(500);

    // 6. 猩红圣铳：全屏 hitscan 光束，对重甲(bruiser)/Boss 额外 +35% 破甲伤害
    const rRifle = quiet(); rRifle.player.x = 300; rRifle.player.y = 0; rRifle.autoFire = false;
    rRifle.player.weapons = [{ id: 'rifle', star: 1, ammo: 6 }];
    const norm = zombie(rRifle, 420, 5000, 'roamer');
    const brute = zombie(rRifle, 480, 5000, 'bruiser');
    const evs = step(rRifle, { ...NO_INPUT, fire: true });
    expect(evs.some((e) => e.t === 'railbeam')).toBe(true);
    expect(5000 - brute.hp).toBeGreaterThan(5000 - norm.hp);

    // 7. 秘蓝法杖：多段连锁麻痹 + 命中燃烧目标触发元素超载 (+35%)
    const rTes = quiet(); rTes.player.x = 300; rTes.player.y = 0; rTes.autoFire = false;
    rTes.player.weapons = [{ id: 'tesla', star: 1, ammo: 16 }];
    const zBurn = zombie(rTes, 360, 1000); zBurn.burnT = 90;
    const zChain = zombie(rTes, 410, 1000);
    const tesEvs = step(rTes, { ...NO_INPUT, fire: true });
    expect(tesEvs.some((e) => e.t === 'hit' && e.id === zBurn.id && e.overload)).toBe(true);
    expect(zBurn.stunT).toBeGreaterThan(0);
    expect(zChain.hp).toBeLessThan(1000);

    // 8. 焦土爆炎炮：轻度追踪重弹炸裂并留下地面持续灼烧火海
    const rRoc = quiet(); rRoc.player.x = 300; rRoc.player.y = 0; rRoc.autoFire = false;
    rRoc.player.weapons = [{ id: 'rocket', star: 1, ammo: 4 }];
    zombie(rRoc, 440, 2000);
    for (let i = 0; i < 30; i++) step(rRoc, { ...NO_INPUT, fire: i === 0 });
    expect(rRoc.fires.length).toBeGreaterThanOrEqual(1);
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

  test('泰拉瑞亚式 ↓ 穿层下跳：轻按落门廊、长按穿落地面；飞行夜翼魔蝠与提灯怨灵可被 360° 上下锁敌击杀', () => {
    const r = quiet();
    r.player.x = 248; r.player.y = ROOF_Y;
    // 轻按 ↓ 穿过屋顶落到中层门廊 (PORCH_Y)
    step(r, { ...NO_INPUT, down: true });
    for (let i = 0; i < 25; i++) step(r, NO_INPUT);
    expect(isOnPorch(r)).toBe(true);
    expect(r.player.y).toBe(PORCH_Y);

    // 从门廊继续按 ↓ 穿落前院地面 (GROUND)
    step(r, { ...NO_INPUT, down: true });
    for (let i = 0; i < 30; i++) step(r, NO_INPUT);
    expect(r.player.y).toBe(0);

    // 从屋顶边缘持续按住 ↓ 可一口气穿两层直达地面
    r.player.x = 248; r.player.y = ROOF_Y; r.player.vy = 0;
    for (let i = 0; i < 40; i++) step(r, { ...NO_INPUT, down: true });
    expect(r.player.y).toBe(0);

    // 360° 全向作战：玩家站在地面，头顶上方飞行夜翼魔蝠 (bat) 会俯冲并被仰角子弹击落，身后僵尸也能反身全向击中
    r.player.x = 420; r.player.y = 0; r.player.facing = 1;
    r.player.weapons = [{ id: 'pistol', star: 1, ammo: 10 }];
    const bat = zombie(r, 440, 28, 'bat', -96);
    const ghoul = zombie(r, 700, 100, 'ghoul', -74);
    for (let i = 0; i < 45; i++) step(r, { ...NO_INPUT, fire: true });
    expect(r.zombies.find((z) => z.id === bat.id)).toBeUndefined();
    expect(ghoul.x).toBeLessThanOrEqual(700);
    expect(ghoul.y).toBeLessThan(-50);
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

    r.player.fireCd = 0; r.player.reloadT = 0; r.player.burstLeft = 0; r.player.burstCd = 0; r.player.facing = 1;
    const blindEv = step(r, { ...NO_INPUT, fire: true });
    expect(r.targetId).toBeNull();
    expect(blindEv.some((e) => e.t === 'shot' && e.from === 'player')).toBe(true);
  });

  test('站在屋子与屋顶享有显著攻防增益：高地伤害/射程/暴击/换弹加快、远程掩体减伤与堡垒回血', () => {
    const r = quiet();
    // 默认起点在 Lv.1 酒馆屋顶
    const roofLv1 = houseBuff(r);
    expect(roofLv1.zone).toBe('roof');
    expect(roofLv1.dmgMul).toBeCloseTo(1.2);
    expect(roofLv1.rangeBonus).toBeCloseTo(0.2);
    expect(roofLv1.critBonus).toBeCloseTo(0.1);
    expect(roofLv1.reloadHaste).toBeCloseTo(0.25);
    expect(roofLv1.rangedCover).toBeCloseTo(0.25);
    const roofRange = effectiveRange(r, 'pistol');
    const roofDmg = damageMul(r);
    r.player.weapons[0].ammo = 2;
    step(r, { ...NO_INPUT, reload: true });
    const roofReloadT = r.player.reloadT;

    // 站到门廊（porch）享中档增益
    r.player.reloadT = 0; r.player.x = 266; r.player.y = PORCH_Y;
    expect(houseBuff(r).zone).toBe('porch');
    expect(damageMul(r)).toBeGreaterThan(1.05);
    expect(houseBuff(r).rangedCover).toBeCloseTo(0.15);

    // 下到地面庭院无屋舍高地增益
    r.player.x = 300; r.player.y = 0;
    expect(houseBuff(r).zone).toBe('ground');
    expect(roofRange).toBeGreaterThan(effectiveRange(r, 'pistol'));
    expect(roofDmg).toBeGreaterThan(damageMul(r));
    step(r, { ...NO_INPUT, reload: true });
    expect(roofReloadT).toBeLessThan(r.player.reloadT);
    r.player.reloadT = 0; r.player.weapons[0].ammo = WEAPONS.pistol.mag;

    // 升级 3 级哥特铁堡：屋顶掩体 -45% 远程火球伤 + 自动慢回血
    r.phase = 'camp'; r.coins = 600;
    command(r, { t: 'upgradeFort' });
    command(r, { t: 'upgradeFort' });
    command(r, { t: 'nextDay' });
    r.spawn.left = 0; r.spawn.timer = 1e9;
    expect(r.fort.level).toBe(3);
    expect(houseBuff(r).dmgMul).toBeCloseTo(1.36);
    expect(houseBuff(r).rangedCover).toBeCloseTo(0.45);

    // 远程火球打在 3 级屋顶主角身上应触发掩体减伤并放出 cover 字段
    r.player.hp = 80; r.player.hurtT = 0;
    r.enemyProjs.push({ x: r.player.x, y: GROUND_Y + r.player.y - 20, vx: 0, vy: 0, dmg: 20, life: 10 });
    const hurtEvs = step(r, NO_INPUT);
    const hurtEv = hurtEvs.find((e) => e.t === 'hurt');
    expect(hurtEv && hurtEv.t === 'hurt' ? hurtEv.cover : 0).toBeGreaterThanOrEqual(8);
    expect(hurtEv && hurtEv.t === 'hurt' ? hurtEv.dmg : 99).toBeLessThanOrEqual(12);
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

describe('兵器升星、可控抛物线爆炎弹、铁甲与军械行商', () => {
  test('仅保留金币货币：捡到新兵器进兵器栏，已有升星，满星直接折算金币', () => {
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

  test('随身最多 2 把兵器：超出时替换手中兵器', () => {
    const r = quiet(); r.player.x = 280; r.player.y = 0;
    r.player.weapons.push({ id: 'smg', star: 1, ammo: 10 });
    r.player.cur = 1;
    r.crates.push({ id: 900, x: 280, weapon: 'shotgun' }); step(r, NO_INPUT);
    expect(r.player.weapons.map((w) => w.id)).toEqual(['pistol', 'shotgun']);
    expect(r.player.weapons.length).toBe(MAX_CARRY);
    expect(MAX_CARRY).toBe(2);
  });

  test('军械行商可购买兵器、补给（爆炎弹/铁甲/秘药）、刷货与拆解', () => {
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

  test('爆炎弹可拖拽控制抛物线远近与高低弧度，且越过前排命中精准爆区，铁甲优先抵扣伤害', () => {
    const r = quiet();
    const highFar = computeGrenadeThrow(r, { dx: 1, dy: -1 });
    const lowClose = computeGrenadeThrow(r, { dx: -0.4, dy: 0.9 });
    expect(highFar.frames).toBeGreaterThan(lowClose.frames + 15);
    expect(highFar.vx).toBeGreaterThan(lowClose.vx);
    expect(highFar.vy).toBeLessThan(lowClose.vy); // 更强向上抛射弧线

    // 远距离高抛：跳过近处的 front，越过头顶精准炸毁远端逼近的 back 魔物
    const front = zombie(r, 340, 300);
    const back = zombie(r, 725, 300);
    step(r, { ...NO_INPUT, grenade: true, grenadeAim: { dx: 1, dy: -0.9 } });
    for (let i = 0; i < 80; i++) step(r, NO_INPUT);
    expect(front.hp).toBe(300);
    expect(back.hp).toBeLessThan(200);
    expect(GROUND_Y).toBeGreaterThan(200);

    // 铁甲先扣伤
    r.player.armor = 30; r.player.hp = 100; r.player.y = 0; r.player.x = 500;
    const melee = zombie(r, 505, 500); melee.atkCd = 0;
    step(r, NO_INPUT);
    expect(r.player.armor).toBeLessThan(30);
    expect(r.player.hp).toBe(100);
  });
});

describe('酒馆室内、深夜食堂全功能、4 炮塔与堡垒路障全金币升级', () => {
  test('选完天赋自动进酒馆并触发初开张剧情，可铁板炒菜招待 VIP 拿声望粉丝/点评/今夜热门加成并留特餐', () => {
    const r = quiet(); r.phase = 'perk'; r.perkChoices = ['rooftop'];
    const perkEvs = command(r, { t: 'pickPerk', id: 'rooftop' })!;
    expect(perkEvs.some((e) => e.t === 'dinerStory' && e.eventKey === 'firstOpen')).toBe(true);
    expect(r.phase).toBe('camp');
    expect(r.inside).toBe(true);
    expect(r.guests.length).toBe(3);

    r.meats = { tender: 12, thick: 4, essence: 2 };
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

    // 12 道食谱需靠炉火灵感研发，未研发的长夜全宴不可留餐
    expect(MEAL_ORDER.length).toBe(12);
    expect(r.diner.researched.length).toBe(2);
    expect(command(r, { t: 'pickMeal', id: 'apocalypse_feast' })).toBeNull();

    command(r, { t: 'pickMeal', id: 'spicy_skewer', quality: 'legendary' });
    expect(r.meal).toBe('spicy_skewer');
    if (r.meats.tender > 0) command(r, { t: 'sellMeatKind', kind: 'tender', count: r.meats.tender });
    expect(r.meats.tender).toBe(0);
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

  test('厨师全部解锁：掉肉更多、卖肉多 +35%、特餐效果 +50%', () => {
    expect(unlockedClasses(4)).toEqual(['gunner', 'engineer', 'chef']);
    expect(CLASSES.chef.comingSoon).toBeUndefined();
    expect(meatPrice('chef')).toBeGreaterThan(meatPrice('gunner'));
    const c = newRun(9, ['revolver', 'smg'], 'chef');
    c.phase = 'camp'; c.meats.tender = 3;
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
    expect(REST_STORY.firstOpen.lines.length).toBeGreaterThanOrEqual(4);

    // 验证第 2/4/6/8 天选完天赋招募战友及增益
    const r = quiet();
    const baseInsideDmg = damageMul(r) / houseBuff(r).dmgMul;
    r.day = 2; r.phase = 'perk'; r.perkChoices = ['overclock'];
    const e2 = command(r, { t: 'pickPerk', id: 'overclock' })!;
    expect(e2.some((e) => e.t === 'allyJoin' && e.ally === 'zhang')).toBe(true);
    expect(damageMul(r)).toBeCloseTo(baseInsideDmg * 1.1);

    const wallBefore = r.wall.maxHp;
    const buildBefore = turretBuildCost('mg', r.cls, false);
    r.day = 6; r.phase = 'perk'; r.perkChoices = ['vanguard'];
    const e6 = command(r, { t: 'pickPerk', id: 'vanguard' })!;
    expect(e6.some((e) => e.t === 'allyJoin' && e.ally === 'qiang')).toBe(true);
    expect(r.wall.maxHp).toBe(wallBefore + 50);
    expect(turretBuildCost('mg', r.cls, true)).toBeLessThan(buildBefore);

    // 校验所有剧情、数据表、UI 与模拟文本完全契合「暮夜酒馆：守夜人」暗黑奇幻风格，无现代科幻/末日废土/出戏词汇
    const forbidden = /十五波|短波|电台|直升机|运输机|螺旋桨|废土|加特林|磁轨|特斯拉|左轮炮|步枪|霰弹|手雷|防弹|电网|机枪塔|冰霜塔|电弧塔|重炮塔|避难所|米其林|异变|变异|主厨|工程师|枪手|护士|天线|狙击枪|高蛋白|发报箱|收音机|话筒|废机油|白大褂|试剂|人体实验|盖革|锡箔|辐射|网红|打卡|探店|老铁|绝绝子|家人们|避雷|摆pose|补光灯|仿生胃|电子合成音|疯批|摄像头|策划偷懒|DLC|Bug|数值曲线|电子宠物|格子衬衫|高维生物|洗脑电波|消防栓|期末考试|地雷|微波炉|酸液史莱姆|Wastegram|废品改造狂|卖的废铁|卖废铁|热搜|末世|感染者/;
    const storyBlob = JSON.stringify({
      CINEMATIC_INTRO, CHAPTER_CARDS, STORY_SCENES, WAVE_STORY_LINES, COMPANION_JOIN_STORIES,
      BOSS_INTROS, BOSS_VICTORY, REST_STORY, VIP_CUSTOMERS, VIP_TIERS, FANS_RANKS, REP_TIERS, DAILY_TRENDS,
      WEAPONS, TURRETS, WALL_LEVELS, FORT_LEVELS, CLASSES, MEALS, DRINKS, TAVERN_UPGRADES, DINER_GUESTS, PERKS,
    });
    expect(storyBlob).not.toMatch(forbidden);
    expect(storyBlob).not.toMatch(/莫老板|莫掌柜/);
    expect(storyBlob).toMatch(/小胡|胡掌柜/);
    for (const rel of ['src/ui/App.tsx', 'src/ui/controls.tsx', 'src/sim/sim.ts', 'src/sim/diner.ts', 'src/app/game.ts']) {
      const txt = readFileSync(join(__dirname, '..', rel), 'utf8');
      expect(txt, rel).not.toMatch(forbidden);
      expect(txt, rel).not.toMatch(/莫老板|莫掌柜/);
    }

    // 验证声望里程碑触发 rep10 剧情事件
    r.diner.rep = 9; r.meats = { tender: 5, thick: 2, essence: 1 };
    rollSafeServe(r);
    function rollSafeServe(st: RunState) {
      const g = st.guests.find((o) => !o.served);
      if (!g) return;
      const se = command(st, { t: 'serveGuest', guestId: g.id, quality: 'legendary' })!;
      expect(se.some((e) => e.t === 'dinerStory' && e.eventKey === 'rep10')).toBe(true);
    }
  });

  test('全金币建造 4 个炮塔位（寒霜/雷鸣/黑铁重炮）与拆塔退金币，以及 3 级路障/堡垒升级', () => {
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

    // 触发路障 Lv2 反伤 + 雷鸣/寒霜炮塔协同
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

  test('堡垒 3 级夜间自动修墙 20%', () => {
    const r = quiet(); r.phase = 'camp'; r.coins = 600;
    command(r, { t: 'upgradeFort' });
    command(r, { t: 'upgradeFort' });
    expect(r.fort.level).toBe(3);
    r.wall.hp = 10;
    command(r, { t: 'nextDay' });
    expect(r.wall.hp).toBe(10 + Math.round(r.wall.maxHp * 0.2));
  });

  test('四位战友真实参战并巡逻走位（银枪穿透/绯火缓速回血/近战重劈修墙/苍蓝气劲对空）与炮塔索敌模式切换（near → boss → air）', () => {
    // 1. 战友真实参战与动态移动
    const r = quiet();
    r.story.allies = ['zhang', 'lin', 'qiang', 'zhao'];
    r.player.hp = 70;
    r.wall.hp = 180;
    const startX = { zhang: r.allies.zhang.x, qiang: r.allies.qiang.x };
    const moved = { zhang: false, qiang: false };
    const zNear = zombie(r, WALL_X + 6, 400, 'roamer');
    const zBat = zombie(r, 460, 120, 'bat', -90);
    const allyShots = new Set<string>();
    for (let i = 0; i < 310; i++) {
      for (const e of step(r, NO_INPUT)) {
        if (e.t === 'shot' && e.from === 'ally' && e.ally) allyShots.add(e.ally);
      }
      if (Math.abs(r.allies.zhang.x - startX.zhang) > 2) moved.zhang = true;
      if (Math.abs(r.allies.qiang.x - startX.qiang) > 2) moved.qiang = true;
    }
    expect(allyShots.has('zhang')).toBe(true);
    expect(allyShots.has('lin')).toBe(true);
    expect(allyShots.has('qiang')).toBe(true);
    expect(allyShots.has('zhao')).toBe(true);
    expect(moved.zhang).toBe(true);
    expect(moved.qiang).toBe(true);
    expect(r.player.hp).toBeGreaterThan(70); // 小林战斗慢回血
    expect(r.wall.hp).toBeGreaterThan(180);  // 阿强前院修墙
    expect(zNear.hp).toBeLessThan(400);
    expect(zBat.hp).toBeLessThan(120);

    // 2. 炮塔索敌模式切换：boss 模式越过前排先轰首领；air 模式越过地面腐尸先射空中魔蝠
    const tBoss = quiet();
    tBoss.phase = 'camp'; tBoss.coins = 500;
    command(tBoss, { t: 'buildTurret', slot: 0, kind: 'mg' });
    expect(tBoss.turrets[0].mode).toBe('near');
    command(tBoss, { t: 'cycleTurretMode', slot: 0 });
    expect(tBoss.turrets[0].mode).toBe('boss');
    command(tBoss, { t: 'nextDay' });
    tBoss.spawn.left = 0; tBoss.spawn.timer = 1e9;
    const frontGround = zombie(tBoss, 280, 500, 'roamer');
    const boss = zombie(tBoss, 360, 2000, 'boss_beast');
    for (let i = 0; i < 30; i++) step(tBoss, NO_INPUT);
    expect(boss.hp).toBeLessThan(2000);
    expect(frontGround.hp).toBe(500);

    command(tBoss, { t: 'cycleTurretMode', slot: 0 });
    expect(tBoss.turrets[0].mode).toBe('air');
    tBoss.zombies = [frontGround];
    const flyer = zombie(tBoss, 355, 200, 'bat', -88);
    for (let i = 0; i < 60; i++) step(tBoss, NO_INPUT);
    expect(flyer.hp).toBeLessThan(200);
    expect(frontGround.hp).toBe(500);
  });

  test('深夜食堂屋内核验玩法：自动出菜耗辣酱 → 辣酱归零停摆 → 石臼磨酱恢复 → 传菜台取菜上桌', () => {
    const r = quiet(); r.phase = 'perk'; r.perkChoices = ['rooftop'];
    command(r, { t: 'pickPerk', id: 'rooftop' });
    r.meats = { tender: 8, thick: 2, essence: 0 };
    r.story.allies = ['zhang'];

    // 备菜并开启营业
    expect(command(r, { t: 'prepDish', id: 'spicy_skewer', batches: 3 })).not.toBeNull();
    expect(r.diner.menuStock.spicy_skewer).toBe(3);
    expect(command(r, { t: 'startShift' })).not.toBeNull();
    expect(r.dinerShift.mode).toBe('open');
    expect(r.dinerShift.kitchenOrders.length).toBeGreaterThan(0);

    // 若辛香辣酱耗尽，后厨自动卡单停摆，走近石臼研磨后继续出菜
    r.dinerShift.sauce = 0;
    const stallEvs = step(r, NO_INPUT);
    expect(r.dinerShift.sauceStalled).toBe(true);
    expect(stallEvs.some((e) => e.t === 'sauceEmpty')).toBe(true);

    r.player.x = IN_STATIONS.mortar;
    expect(nearbyCampTarget(r)?.kind).toBe('grindMortar');
    const grindEvs = command(r, { t: 'grindMortar' })!;
    expect(grindEvs.some((e) => e.t === 'grindSauce')).toBe(true);
    expect(r.dinerShift.sauceStalled).toBe(false);
    expect(r.dinerShift.sauce).toBeGreaterThanOrEqual(60);

    // 推步等待后厨自动出菜至传菜台
    for (let i = 0; i < 140 && r.dinerShift.counterDishes.length === 0; i++) step(r, NO_INPUT);
    expect(r.dinerShift.counterDishes.length).toBeGreaterThan(0);

    // 走近传菜台取菜并送到对应客人桌前
    r.player.x = IN_STATIONS.pass;
    expect(nearbyCampTarget(r)?.kind).toBe('pickCounter');
    expect(command(r, { t: 'pickCounterDish' })).not.toBeNull();
    expect(r.carryingDish).not.toBeNull();

    const dest = r.guests.find((g) => g.id === r.carryingDish!.guestId) ?? r.guests.find((g) => !g.served && g.orderKind === 'dish')!;
    r.player.x = dest.x;
    expect(nearbyCampTarget(r)?.kind).toBe('serveCarried');
    const serveEvs = command(r, { t: 'serveCarried' })!;
    expect(serveEvs.some((e) => e.t === 'serve' && e.guestId === dest.id)).toBe(true);
    expect(r.carryingDish).toBeNull();
    expect(nearbyCampTarget(r)?.kind).toBe('guestTalk');

    // 走近屋里战友与商店可触发对应交互
    r.player.x = ALLY_POS.zhang.intX;
    expect(nearbyCampTarget(r)?.kind).toBe('allyTalk');
    r.player.x = IN_STATIONS.shop;
    expect(nearbyCampTarget(r)?.kind).toBe('shop');
  });

  test('战友 AI 零太空步倒走且出招与动画序列号严格同步（idle 停顿 + 单次出手）', () => {
    // 1. 静止巡逻期间允许停顿 (idle)，且移动时 facing 永远等于 Math.sign(vx)
    const idleRun = quiet();
    idleRun.story.allies = ['zhang', 'lin', 'qiang', 'zhao'];
    zombie(idleRun, 1200, 99999, 'roamer'); // 射程外保持昼夜交战状态不提前清场
    let sawPause = false;
    for (let i = 0; i < 240; i++) {
      step(idleRun, NO_INPUT);
      for (const id of ['zhang', 'lin', 'qiang', 'zhao'] as const) {
        const rt = idleRun.allies[id];
        if (rt.state === 'move' && Math.abs(rt.vx) > 0.01) {
          expect(rt.facing, `${id} tick ${i}`).toBe(Math.sign(rt.vx));
        }
        if (rt.state === 'idle' && (rt.pauseT ?? 0) > 0) sawPause = true;
      }
    }
    expect(sawPause).toBe(true);

    // 2. 有敌交战：每次 atkSeq 递增恰好对应精确判定帧触发 1 次出手，绝不提前/连发
    const r = quiet();
    r.story.allies = ['zhang', 'lin', 'qiang', 'zhao'];
    const z1 = zombie(r, 340, 2000, 'roamer');
    const zBat = zombie(r, 420, 800, 'bat', -88);
    z1.atkCd = 9999; zBat.atkCd = 9999;
    const prevSeq: Record<string, number> = { zhang: 0, lin: 0, qiang: 0, zhao: 0 };
    const shotsInSwing: Record<string, number> = { zhang: 0, lin: 0, qiang: 0, zhao: 0 };
    const totalShots: Record<string, number> = { zhang: 0, lin: 0, qiang: 0, zhao: 0 };
    for (let i = 0; i < 200; i++) {
      const evs = step(r, NO_INPUT);
      for (const id of ['zhang', 'lin', 'qiang', 'zhao'] as const) {
        const rt = r.allies[id];
        if (rt.state === 'move' && Math.abs(rt.vx) > 0.01) {
          expect(rt.facing, `${id} combat tick ${i}`).toBe(Math.sign(rt.vx));
        }
        if ((rt.atkSeq ?? 0) > prevSeq[id]) {
          prevSeq[id] = rt.atkSeq ?? 0;
          shotsInSwing[id] = 0;
        }
      }
      for (const e of evs) {
        if (e.t === 'shot' && e.from === 'ally' && e.ally) {
          expect(r.allies[e.ally].state).toBe('atk');
          shotsInSwing[e.ally]++;
          totalShots[e.ally]++;
          expect(shotsInSwing[e.ally], `${e.ally} multi-shot in one swing`).toBe(1);
        }
      }
    }
    expect(totalShots.zhang).toBeGreaterThanOrEqual(2);
    expect(totalShots.zhao).toBeGreaterThanOrEqual(2);
  });

  test('暮夜酒馆经营闭环：炉火研发/美味度强化/自动补货/断货黑麦饼 → 饮品斟酒 → 收脏盘 → 日报净利', () => {
    const r = quiet(); r.phase = 'perk'; r.perkChoices = ['rooftop'];
    command(r, { t: 'pickPerk', id: 'rooftop' });
    r.day = 3; r.coins = 500; r.meats = { tender: 10, thick: 4, essence: 0 };
    r.diner.flame = 12; r.diner.bestTaste = 100;

    // 炉火灵感研发新菜「蒜香冷切熏肉」+ 购买香料
    expect(command(r, { t: 'buySpice', count: 2 })).not.toBeNull();
    expect(r.coins).toBe(500 - 2 * SPICE_BUY_COST);
    expect(command(r, { t: 'researchDish', id: 'garlic_cold_cut' })?.some((e) => e.t === 'research')).toBe(true);
    expect(r.diner.researched).toContain('garlic_cold_cut');
    expect(r.diner.bestTaste).toBeGreaterThanOrEqual(125);

    // 强化菜品消耗主料+金币，同步提升美味度与多份数
    const baseTaste = dishTaste(r, 'hearty_stew');
    const upCoin = dishUpgradeCost('hearty_stew', 1);
    const upMeat = dishEnhanceMeatCost('hearty_stew', 1);
    const tenderBefore = r.meats.tender;
    expect(command(r, { t: 'upgradeDish', id: 'hearty_stew' })).not.toBeNull();
    expect(dishLevel(r, 'hearty_stew')).toBe(2);
    expect(dishTaste(r, 'hearty_stew')).toBeGreaterThan(baseTaste);
    expect(r.meats.tender).toBe(tenderBefore - upMeat.tender);
    expect(r.coins).toBeLessThan(500 - 2 * SPICE_BUY_COST - upCoin + 1);
    expect(dishServings(r, 'hearty_stew')).toBeGreaterThanOrEqual(2);

    // 上架数量上限保护 & 自动补货开关 & 断货兜底干硬黑麦饼
    r.diner.menu = ['spicy_skewer', 'hearty_stew'];
    expect(command(r, { t: 'toggleAutoSupply', id: 'spicy_skewer' })).not.toBeNull();
    expect(r.diner.autoSupply.spicy_skewer).toBe(true);

    // 无库存、关闭自动补货且零嫩肉时，营业入单会降级为干硬黑麦饼（1金、0粉、口碑惩罚）
    r.diner.autoSupply.spicy_skewer = false;
    r.diner.menuStock = {};
    r.meats = { tender: 0, thick: 0, essence: 0 };
    expect(command(r, { t: 'startShift' })).not.toBeNull();
    expect(r.dinerShift.ryeCount).toBeGreaterThan(0);
    const ryeGuest = r.guests.find((g) => g.isRye)!;
    expect(ryeGuest.pay).toBe(RYE_FALLBACK.pay);

    // 测饮品零耗肉接酒 -> 上饮 -> 吃喝留脏盘 -> 收桌
    const drinkGuest = r.guests[0];
    drinkGuest.orderKind = 'drink';
    drinkGuest.drink = 'beer';
    drinkGuest.dishName = DRINKS.beer.name;
    drinkGuest.isRye = false;
    drinkGuest.served = false;
    drinkGuest.walkState = 'seated';
    drinkGuest.x = DINER_SEAT_X[drinkGuest.seatIdx];
    const meatBeforePour = totalMeat(r.meats);
    r.player.x = IN_STATIONS.drink;
    expect(command(r, { t: 'buyTavernUpgrade', id: 'fast_tap' })).not.toBeNull();
    expect(command(r, { t: 'startPour', drink: 'beer', guestId: drinkGuest.id })).not.toBeNull();
    while (r.pourMinigame && r.pourMinigame.fill < 0.805) step(r, NO_INPUT);
    expect(command(r, { t: 'stopPour' })?.some((e) => e.t === 'pourDone' && e.quality === 'legendary')).toBe(true);
    expect(totalMeat(r.meats)).toBe(meatBeforePour);

    r.player.x = drinkGuest.x;
    expect(command(r, { t: 'serveDrink', guestId: drinkGuest.id })?.some((e) => e.t === 'serve')).toBe(true);
    expect(r.dinerShift.drinkCount).toBe(1);
    for (let i = 0; i < 185; i++) step(r, NO_INPUT);
    expect(r.dinerShift.dirtyTables.some((d) => d.x === DINER_PLATE_X[drinkGuest.seatIdx])).toBe(true);
    const dirty = r.dinerShift.dirtyTables[0];
    r.player.x = dirty.x;
    expect(command(r, { t: 'cleanTable', plateId: dirty.id })?.some((e) => e.t === 'tableClean')).toBe(true);

    // 测打烊日报：星级、炉火灵感产出、进货支出与净利归帐
    const flamePre = r.diner.flame;
    const closeEvs = command(r, { t: 'closeShift' })!;
    expect(closeEvs.some((e) => e.t === 'shiftEnd')).toBe(true);
    expect(r.dinerShift.mode).toBe('summary');
    expect(r.dinerShift.report).not.toBeNull();
    expect(r.dinerShift.report!.spiceExpense).toBe(2 * SPICE_BUY_COST);
    expect(r.dinerShift.report!.rating).toBeGreaterThanOrEqual(1);
    expect(r.diner.flame).toBe(flamePre + r.dinerShift.report!.flameEarned);
    expect(command(r, { t: 'finishSummary' })).not.toBeNull();
    expect(r.dinerShift.mode).toBe('prep');
  });

  test('昼夜原料保鲜机制：3 种肉类分级掉落，屋顶/控制/暴击击杀稳定触发保鲜 ×2', () => {
    const r = quiet();
    r.player.x = 180; r.player.y = ROOF_Y; // 站在屋顶触发保鲜 ×2
    const b = zombie(r, 280, 10, 'bruiser');
    b.freezeT = 60;
    let sawPreserve = false;
    for (let i = 0; i < 30 && b.hp > 0; i++) {
      for (const e of step(r, { ...NO_INPUT, fire: true })) {
        if (e.t === 'kill' && e.meatKind === 'thick' && e.preserved) sawPreserve = true;
      }
    }
    expect(sawPreserve).toBe(true);
    expect(r.meats.thick).toBeGreaterThanOrEqual(4);

    // 提灯怨灵固定掉落魔髓，首领稳定产出魔髓
    const r2 = quiet(); r2.day = 6; r2.player.x = 180; r2.player.y = ROOF_Y;
    const g = zombie(r2, 260, 5, 'ghoul');
    g.stunT = 30;
    for (let i = 0; i < 30 && g.hp > 0; i++) step(r2, { ...NO_INPUT, fire: true });
    expect(r2.meats.essence).toBeGreaterThanOrEqual(2);
  });

  test('口碑榜 E→S 三重卡口、招工培训自动技、夜间派遣寻香、后院贮肉架与日薪扣除', () => {
    const r = quiet(); r.phase = 'perk'; r.perkChoices = ['rooftop'];
    command(r, { t: 'pickPerk', id: 'rooftop' });

    // 1. 三重卡口校验：仅有粉丝不足 3 菜/115味 无法升 D 级；三项达标后立刻升 D 级且解锁 2 伙计编
    r.diner.fans = 100;
    expect(dinerRank(r).cur.grade).toBe('E');
    r.diner.flame = 10;
    expect(command(r, { t: 'researchDish', id: 'garlic_cold_cut' })).not.toBeNull();
    expect(dinerRank(r).cur.grade).toBe('D');
    expect(maxStaffSlots(r)).toBe(2);

    // 2. 发招工传单 -> 招募梅姐 -> 培训至 Lv.3 解锁自动收碗 -> 开店时自动清理脏盘赚钱
    r.coins = 500;
    expect(command(r, { t: 'postRecruitment', tier: 'flyer' })).not.toBeNull();
    expect(r.diner.applicants.length).toBeGreaterThanOrEqual(1);
    const appId = r.diner.applicants.find((a) => a.id === 'staff_meimei')?.id ?? r.diner.applicants[0].id;
    expect(command(r, { t: 'hireStaff', id: appId })).not.toBeNull();
    expect(r.diner.hiredStaff.length).toBe(1);

    const hired = r.diner.hiredStaff[0];
    if (hired.id === 'staff_meimei') {
      expect(command(r, { t: 'trainStaff', id: 'staff_meimei' })).not.toBeNull();
      expect(command(r, { t: 'trainStaff', id: 'staff_meimei' })).not.toBeNull();
      expect(hired.level).toBe(3);
      expect(staffHasSkill(hired, 'auto_clean')).toBe(true);
    }

    r.meats = { tender: 8, thick: 2, essence: 0 };
    expect(command(r, { t: 'prepDish', id: 'spicy_skewer', batches: 3 })).not.toBeNull();
    expect(command(r, { t: 'startShift' })).not.toBeNull();
    if (hired.id === 'staff_meimei') {
      r.dinerShift.dirtyTables.push({ id: 999, seatIdx: 2, x: DINER_PLATE_X[2], createdTick: r.tick });
      for (let i = 0; i < 190 && r.dinerShift.dirtyTables.length > 0; i++) step(r, NO_INPUT);
      expect(r.dinerShift.dirtyTables.length).toBe(0);
    }

    // 3. 打烊日报真实扣除在岗伙计日薪与店面维护
    const coinsBeforeClose = r.coins;
    command(r, { t: 'closeShift' });
    const rep = r.dinerShift.report!;
    expect(rep.staffWages).toBe(STAFF_POOL.find((s) => s.id === hired.id)!.dailyWage);
    expect(r.coins).toBe(coinsBeforeClose - Math.min(coinsBeforeClose, rep.staffWages + rep.upkeepCost));
    command(r, { t: 'finishSummary' });

    // 4. 派去外出派遣 + 第 4 日主题狂欢夜预警 + 后院贮肉架产肉 + 战后派遣带回秘酿香料
    expect(partyForDay(2).upcoming?.id).toBe('stew_fest');
    expect(partyForDay(4).active?.id).toBe('stew_fest');
    expect(command(r, { t: 'setStaffRole', id: hired.id, role: 'dispatch' })).not.toBeNull();
    r.day = 3; // 推进到第 4 天（贮肉架 & 暖锅炖肉祭）
    expect(command(r, { t: 'upgradeRack' })).toBeNull(); // 第 3 天尚未解锁
    r.day = 4;
    expect(command(r, { t: 'upgradeRack' })).not.toBeNull();

    const spiceBefore = r.spice;
    const tenderBefore = r.meats.tender;
    r.phase = 'perk'; r.perkChoices = ['rooftop'];
    const perkEvs = command(r, { t: 'pickPerk', id: 'rooftop' })!;
    expect(perkEvs.some((e) => e.t === 'dispatchReturn')).toBe(true);
    expect(perkEvs.some((e) => e.t === 'rackHarvest')).toBe(true);
    expect(perkEvs.some((e) => e.t === 'partyStart')).toBe(true);
    expect(r.spice).toBeGreaterThanOrEqual(spiceBefore + 2);
    expect(r.meats.tender).toBeGreaterThanOrEqual(tenderBefore + RACK_LEVELS[0].tender);

    // 5. VIP 特邀点名委托：在耐心过半前上桌额外奖励 +2 炉火灵感
    const reqGuest = r.guests[0];
    reqGuest.isVipRequest = true;
    reqGuest.requestBonusCoins = 18;
    const flameBefore = r.diner.flame;
    const serveEvs = command(r, { t: 'serveGuest', guestId: reqGuest.id, quality: 'good' })!;
    expect(serveEvs.some((e) => e.t === 'serve' && e.vipRequestClear)).toBe(true);
    expect(r.diner.flame).toBe(flameBefore + 2);
  });
});

describe('职业与天赋', () => {
  test('猎手「鹰眼」：全穿透 + 必暴；无贯穿对比', () => {
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
    expect(damageMul(r)).toBeCloseTo(1.65);
    command(r, { t: 'nextDay' });
    expect(damageMul(r)).toBeCloseTo(1.65 * 1.2); // 出门上屋顶叠乘 +20% 高地伤害

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

describe('15 天完整流程与首领', () => {
  test('第 5 / 10 / 15 天会刷出首领，机器人 3 个职业均可通关 15 天', () => {
    for (const cls of ['gunner', 'engineer', 'chef'] as const) {
      const r = newRun(11, ['revolver', 'smg', 'shotgun', 'assault', 'rifle', 'tesla', 'rocket'], cls);
      const rep = runBot(r);
      expect(rep.won, cls).toBe(true);
      expect(rep.days.length).toBe(LAST_DAY);
      const bosses = rep.events.filter((e) => e.t === 'bossAppear');
      expect(bosses.length).toBe(3);
    }
  });

  test('第 1 天无免费白送炮塔，零操作/不开火活不过前几天；消极站屋顶或平地不建造购买也无法打通 15 天', () => {
    const r = newRun(3);
    expect(r.turrets.every((t) => t.type === null)).toBe(true);
    r.autoFire = false;
    for (let i = 0; i < 60 * 60 * 6 && r.phase === 'fight'; i++) step(r, NO_INPUT);
    expect(r.phase).toBe('dead');

    for (const ground of [false, true]) {
      const passive = newRun(2, ['revolver', 'smg'], 'gunner');
      for (let i = 0; i < 60 * 60 * 15; i++) {
        if (passive.phase === 'perk') { command(passive, { t: 'pickPerk', id: passive.perkChoices[0] }); continue; }
        if (passive.phase === 'camp') { command(passive, { t: 'nextDay' }); continue; }
        if (passive.phase === 'dead' || passive.phase === 'won') break;
        const move = ground && passive.player.x < 300 ? 1 : 0;
        step(passive, { ...NO_INPUT, move, fire: passive.targetId !== null });
      }
      expect(passive.phase, ground ? 'ground' : 'roof').toBe('dead');
      expect(passive.day, ground ? 'ground' : 'roof').toBeLessThan(LAST_DAY);
    }
  });

  test('三档难度（普通/困难/噩梦）正确拉升敌群强度、夜间续航惩罚与星星收益倍率', () => {
    expect(zombieHp('roamer', 5, 'nightmare')).toBeGreaterThan(zombieHp('roamer', 5, 'hard'));
    expect(zombieHp('roamer', 5, 'hard')).toBeGreaterThan(zombieHp('roamer', 5, 'normal'));
    expect(dayZombieCount(5, 'nightmare')).toBeGreaterThan(dayZombieCount(5, 'normal'));

    const nRun = newRun(7, ['revolver', 'smg'], 'gunner', 'normal');
    const nmRun = newRun(7, ['revolver', 'smg'], 'gunner', 'nightmare');
    nRun.phase = 'camp'; nRun.player.hp = 60;
    nmRun.phase = 'camp'; nmRun.player.hp = 60;
    command(nRun, { t: 'nextDay' });
    command(nmRun, { t: 'nextDay' });
    expect(nRun.player.hp).toBeGreaterThan(60);
    expect(nmRun.player.hp).toBe(60); // 噩梦难度无夜间自动回血

    const scoredNormal = newRun(1, ['revolver'], 'gunner', 'normal');
    const scoredHard = newRun(1, ['revolver'], 'gunner', 'hard');
    const scoredNm = newRun(1, ['revolver'], 'gunner', 'nightmare');
    for (const st of [scoredNormal, scoredHard, scoredNm]) { st.day = 6; st.phase = 'won'; }
    expect(starsEarned(scoredHard)).toBeGreaterThan(starsEarned(scoredNormal));
    expect(starsEarned(scoredNm)).toBeGreaterThan(starsEarned(scoredHard));
    expect(DIFFICULTIES.nightmare.starMul).toBe(2);
  });

  test('多个随机种子下基础解锁池（仅重锤左轮+连珠火铳）机器人也能稳定打通 15 天', () => {
    for (const seed of [1, 2, 3]) {
      const r = newRun(seed, ['revolver', 'smg']);
      const rep = runBot(r);
      expect(rep.won, `种子 ${seed}`).toBe(true);
      expect(rep.days.length).toBe(LAST_DAY);
    }
  });

  test('M3 堂食扩座（4→6→8座）严格按前置解锁且可同时招待最多 8 位食客', () => {
    expect(SEAT_UPGRADE_ORDER).toEqual(['tables_6', 'tables_8']);
    expect(DINER_SEAT_X.length).toBe(8);
    expect(DINER_PLATE_X.length).toBe(8);

    const r = quiet();
    r.phase = 'perk';
    r.perkChoices = ['rooftop'];
    command(r, { t: 'pickPerk', id: 'rooftop' });
    r.coins = 5000;
    expect(maxSeats(r)).toBe(4);

    // 未解锁 6 座前无法直购 8 座
    command(r, { t: 'buyTavernUpgrade', id: 'tables_8' });
    expect(r.diner.upgrades).not.toContain('tables_8');
    expect(maxSeats(r)).toBe(4);

    // 依次扩建到 6 座、8 座
    command(r, { t: 'buyTavernUpgrade', id: 'tables_6' });
    expect(r.diner.upgrades).toContain('tables_6');
    expect(maxSeats(r)).toBe(6);

    command(r, { t: 'buyTavernUpgrade', id: 'tables_8' });
    expect(r.diner.upgrades).toContain('tables_8');
    expect(maxSeats(r)).toBe(8);

    // 高口碑 + 备菜开张可同时落座超过 4 席且席位全部在 0..7 合法范围内
    r.meats = { tender: 16, thick: 8, essence: 4 };
    command(r, { t: 'prepDish', id: 'spicy_skewer', batches: 6 });
    r.diner.fans = 320;
    command(r, { t: 'startShift' });
    expect(r.dinerShift.mode).toBe('open');

    let peakSeats = 0;
    const seenSeats = new Set<number>();
    for (let i = 0; i < 1500 && r.dinerShift.mode === 'open'; i++) {
      step(r, NO_INPUT);
      const seated = r.guests.filter((g) => g.seatIdx >= 0 && g.seatIdx < 8 && g.walkState !== 'leaving');
      peakSeats = Math.max(peakSeats, seated.length);
      for (const g of seated) seenSeats.add(g.seatIdx);
    }
    expect(peakSeats).toBeGreaterThan(4);
    expect(seenSeats.size).toBeGreaterThan(4);
  });

  test('M3 跨局传承（手札菜谱+装潢图纸）在新局生效研究减费与硬件八折', () => {
    const baseMeta = loadMeta();
    const r1 = newRun(17, ['revolver', 'smg']);
    r1.phase = 'camp';
    r1.coins = 5000;
    command(r1, { t: 'buyTavernUpgrade', id: 'warm_lantern' });
    expect(r1.diner.upgrades).toContain('warm_lantern');

    const testDish = MEAL_ORDER.find((id) => !r1.diner.researched.includes(id))!;
    r1.diner.researched.push(testDish);
    r1.diner.dishLevels[testDish] = 5;

    const updatedMeta = recordRunToMeta(baseMeta, r1, true);
    expect(updatedMeta.unlockedDecor).toContain('warm_lantern');
    expect(updatedMeta.recipeMastery[testDish]).toBe(3);

    const r2 = newRun(18, ['revolver', 'smg'], 'gunner', 'normal', {
      metVips: updatedMeta.metVips,
      mastery: updatedMeta.recipeMastery,
      decor: updatedMeta.unlockedDecor,
    });
    // 已解锁装潢享 8 折重建价
    expect(tavernUpgradeCost(r2, 'warm_lantern')).toBe(Math.round(TAVERN_UPGRADES.warm_lantern.cost * 0.8));
    expect(tavernUpgradeCost(r2, 'warm_lantern')).toBeLessThan(TAVERN_UPGRADES.warm_lantern.cost);
    // 已精研菜品享研发灵感折扣（最低 1 点）
    expect(dishResearchCost(r2, testDish)).toBe(Math.max(1, MEALS[testDish].researchCost - 1));
  });

  test('M3 第 15 天通关后可进入破晓无尽酒馆，既可连续佛系营业也可外出迎战', () => {
    const r = newRun(23, ['revolver', 'smg']);
    r.day = LAST_DAY;
    r.phase = 'won';
    r.inside = false;

    command(r, { t: 'enterEndless' });
    expect(r.endless).toBe(true);
    expect<string>(r.phase).toBe('camp');
    expect(r.inside).toBe(true);
    expect(r.day).toBe(LAST_DAY);

    // 佛系过夜：留在酒馆直接进入第 16 夜营业准备
    command(r, { t: 'nextEndlessNight' });
    expect(r.day).toBe(LAST_DAY + 1);
    expect<string>(r.phase).toBe('camp');
    expect(r.inside).toBe(true);
    expect(r.endless).toBe(true);

    // 可选外出作战：第 16 夜清怪后经整备回到 camp，绝不再次触发 won
    r.coins = 5000;
    r.inside = false;
    command(r, { t: 'buildTurret', slot: 0, kind: 'mg' });
    command(r, { t: 'nextDay' });
    expect<string>(r.phase).toBe('fight');
    r.spawn.left = 0;
    r.zombies = [];
    const last = zombie(r, 320, 1, 'roamer');
    last.atkCd = 999;

    for (let i = 0; i < 600 && ((r.phase as string) === 'fight' || (r.phase as string) === 'clear'); i++) {
      step(r, { ...NO_INPUT, fire: true });
    }
    if ((r.phase as string) === 'perk') {
      command(r, { t: 'pickPerk', id: r.perkChoices[0] });
    }
    expect<string>(r.phase).toBe('camp');
    expect(r.endless).toBe(true);
  });
});
