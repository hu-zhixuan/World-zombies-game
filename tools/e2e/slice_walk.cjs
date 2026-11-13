// 像真玩家一样用真实触摸走完完整流程：标题 → 选职业 → 房顶纯自动战斗 & 手雷技能 → 下房上梯 → 清场三选一 → 酒馆屋内走动 → 小厨房 / 商店 / 工坊建塔升墙升堡垒 → 第 2 天 / 第 5 天 Boss → 暂停 → 死亡重开。
const L = require('./lib.cjs');

(async () => {
  const g = await L.open();
  const fails = [];
  const check = (ok, what) => { console.log((ok ? '  ok   ' : '  FAIL ') + what); if (!ok) fails.push(what); };
  const wait = (ms) => g.page.waitForTimeout(ms);
  const until = async (fn, ms, label) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { if (fn(await g.state())) return true; await wait(200); }
    console.log('  超时：' + label, JSON.stringify(await g.state()));
    return false;
  };

  // 面板必须整个在 844x390 屏幕里，不能滚动溢出
  const fits = async (sel) => {
    const r = await g.page.evaluate((s) => {
      const el = document.querySelector(s);
      if (!el) return false;
      const b = el.getBoundingClientRect();
      return b.top >= 0 && b.left >= 0 && b.bottom <= innerHeight && b.right <= innerWidth && el.scrollHeight <= el.clientHeight + 2;
    }, sel);
    check(r, sel + ' 整个面板都在屏幕里');
  };

  // 1. 标题与全屏检查
  await g.shot('01-title');
  await fits('#panel-title');
  check(await g.page.evaluate(() => /星星/.test(document.querySelector('#meta-progress').innerText)), '标题页显示星星和下一个解锁');
  check((await g.state()).panel === 'title', '打开是标题页');
  const fill = await g.page.evaluate(() => { const r = document.querySelector('#stage canvas').getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), vw: innerWidth, vh: innerHeight }; });
  check(fill.w === fill.vw && fill.h === fill.vh, `画面铺满屏幕，没有黑边 (${fill.w}x${fill.h} / ${fill.vw}x${fill.vh})`);

  // 2. 选职业 & 确认主开火键 (#key-fire) 及右侧扇形键互不重叠
  await g.tap('#btn-start');
  check((await g.state()).panel === 'class', '点「开始」先选职业');
  await g.shot('01b-class'); await fits('#panel-class');
  check(await g.page.evaluate(() => document.querySelector('#panel-class [data-class=engineer]').disabled && document.querySelector('#panel-class [data-class=chef]').disabled), '0星时工程师/主厨正确锁定');
  await g.tap('#panel-class [data-class=gunner]');
  let s = await g.state();
  check(s.panel === null && s.y <= -90, `进入第 1 天且主角站在二楼房顶防御 (y=${s.y})`);
  check(await g.page.evaluate(() => !!document.querySelector('#key-fire')), '右下角主开火键 #key-fire 已就位');
  const noOverlap = await g.page.evaluate(() => {
    const ids = ['#key-fire', '#key-jump', '#key-dodge', '#key-grenade', '#key-skill', '#weapon-chip', '#key-reload'];
    const rects = ids.map((id) => ({ id, r: document.querySelector(id).getBoundingClientRect() }));
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i].r, b = rects[j].r;
        const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (ox > 2 && oy > 2) return `${rects[i].id} 与 ${rects[j].id} 重叠`;
      }
    }
    return 'ok';
  });
  check(noOverlap === 'ok', '右下角按钮与武器条互不重叠 (' + noOverlap + ')');

  // 3. 元气骑士式手感：不按攻击键绝不乱开枪；按住攻击键才自动锁敌射杀 + 可拖拽控抛物线手雷
  check(await until((st) => st.zombies >= 2 && st.target !== null, 30000, '等僵尸进射程出现锁定框'), '僵尸进入射程出现锁定准星');
  const idleAmmo = await g.page.evaluate(() => ({ auto: window.__game.run.autoFire, ammo: window.__game.run.player.weapons[0].ammo }));
  check(!idleAmmo.auto && idleAmmo.ammo === 12, `默认不自动开枪 (autoFire=${idleAmmo.auto}, ammo=${idleAmmo.ammo})`);

  const fireBtn = await g.center('#key-fire');
  await g.touch('touchStart', fireBtn.x, fireBtn.y);
  await wait(240);
  await g.shot('02-rooftop-fight');
  check(await until((st) => st.kills >= 2, 30000, '按住攻击键自动锁敌击杀僵尸'), '按住攻击键能稳定自动锁敌杀敌');
  await g.touch('touchEnd');
  await wait(120);

  await g.tap('#key-skill');
  check(await g.page.evaluate(() => window.__game.run.skill.cd > 0), '扇形技能键正常释放');

  // 拖拽手雷轮盘向右上拉出高抛抛物线预览并投出
  const nadeBtn = await g.center('#key-grenade');
  await g.touch('touchStart', nadeBtn.x, nadeBtn.y);
  await wait(60);
  await g.touch('touchMove', nadeBtn.x + 36, nadeBtn.y - 34);
  await wait(200);
  check(await g.page.evaluate(() => !!window.__game.grenadeAim && window.__game.grenadeAim.dx > 0.5 && window.__game.grenadeAim.dy < -0.4), '按住手雷拖拽能实时调出抛物线方向与高低弧度');
  await g.shot('02c-grenade-aim');
  await g.touch('touchEnd');
  await wait(260);
  check((await g.state()).grenades === 1, '拖拽手雷松手后精准按设定抛物线投出');
  await g.shot('02b-skill-grenade');

  // 4. 在左下半屏热区外围用浮动摇杆向右走下房顶，测一楼砖墙碰撞，再二段跳跳回二楼房顶
  const pad = await g.center('#pad');
  await g.touch('touchStart', pad.x + 88, pad.y - 26);
  await wait(40);
  await g.touch('touchMove', pad.x + 128, pad.y - 26);
  check(await until((st) => st.y === 0, 6000, '浮动摇杆向右走下房顶'), '浮动摇杆抓边也能向右走下房顶到庭院');
  await g.touch('touchEnd');
  await g.touch('touchStart', pad.x - 36, pad.y);
  await wait(950);
  await g.touch('touchEnd');
  s = await g.state();
  check(s.x === 246 && s.y === 0, `一楼实体砖墙阻挡主角不穿模 (x=${s.x})`);
  await g.tap('#key-jump'); // 第一跳：跳上门廊中层挑台 (PORCH_Y = -48)
  await wait(650);
  check((await g.state()).y === -48, '第一跳跳上门廊中层木挑台');
  await g.tap('#key-jump'); // 第二跳：起跳后向左空中移动落上二楼屋顶平台 (ROOF_Y = -92)
  await g.touch('touchStart', pad.x - 36, pad.y);
  await wait(700);
  await g.touch('touchEnd');
  check((await g.state()).y <= -90, '第二跳亲自跳回二楼屋顶平台');

  // 5. 等待第 1 天清场与三选一（手动按住攻击键帮忙收尾）
  await g.touch('touchStart', fireBtn.x, fireBtn.y);
  check(await until((st) => st.phase !== 'fight', 120000, '第 1 天清场'), '第 1 天能清场');
  await g.touch('touchEnd');
  await wait(120);
  await g.shot('03-clear');
  check(await until((st) => st.panel === 'perk', 15000, '清场自动进入天赋三选一'), '清场后弹出三选一');
  await wait(250); await g.shot('04-perk');
  await fits('#panel-perk');
  await g.tap('#panel-perk .card');

  // 6. 自动进酒馆室内（能自由在屋内走动，且有 3 位幸存者堂食食客）
  s = await g.state();
  check(s.panel === null && s.phase === 'camp' && s.inside === true, '选天赋后自动回到酒馆小屋内且可自由走动');
  await g.shot('05-tavern-camp');
  const inX0 = s.x;
  await g.touch('touchStart', pad.x - 36, pad.y); await wait(700); await g.touch('touchEnd');
  check((await g.state()).x < inX0 - 20, '推摇杆能在酒馆屋内向左走到小厨房');

  // 7. 深夜小食堂（招待食客 + 特餐 + 炒肉）、商店（买枪 + 买补给）、工坊（4塔位 + 升墙 + 升堡垒）
  await g.page.evaluate(() => { window.__game.run.meat = Math.max(8, window.__game.run.meat); window.__game.run.coins = 360; window.__game.run.scrap = 32; window.__game.notify(); });
  await g.tap('#btn-kitchen');
  check((await g.state()).panel === 'kitchen', '能打开深夜小食堂');
  await g.shot('06-kitchen'); await fits('#panel-kitchen');
  await g.tap('#btn-serve-0');
  await g.tap('#btn-meal-spicy_skewer');
  await g.tap('#btn-cook-all');
  check((await g.state()).meat === 0 && (await g.state()).coins > 380, '深夜小食堂能招待熟客、留特餐和炒肉卖钱');
  await g.tap('#btn-close');

  await g.tap('#btn-shop');
  check((await g.state()).panel === 'shop', '能打开酒馆军火商店');
  await g.shot('07-shop'); await fits('#panel-shop');
  await g.tap('#btn-shop-revolver');
  await g.tap('#btn-buy-armor');
  s = await g.state();
  check(s.weapons.includes('revolver') && s.armor >= 40, '商店能购入左轮手枪并购买护甲');
  await g.tap('#btn-close');

  await g.tap('#btn-build');
  check((await g.state()).panel === 'build', '能打开防线工坊');
  await g.tap('#btn-build-0-frost');
  await g.tap('#btn-build-2-tesla');
  await g.tap('#btn-wall-up');
  await g.tap('#btn-fort-up');
  await g.shot('08-build'); await fits('#panel-build');
  s = await g.state();
  check(s.turrets >= 3 && s.wallLv === 2 && s.fortLv === 2, `能加建冰霜/电弧塔并升级壁垒与堡垒 (turrets=${s.turrets}, wall=${s.wallLv}, fort=${s.fortLv})`);
  await g.tap('#btn-close');

  // 8. 出门查看升级后的哥特石堡与炮塔防线，随后迎战第 2 天
  await g.tap('#btn-inout');
  check((await g.state()).inside === false, '营地可出门查看外部防线与石堡大屋');
  await wait(250);
  await g.shot('08b-outside-upgraded');
  await g.tap('#btn-next');
  s = await g.state();
  check(s.panel === null && s.day === 2 && s.phase === 'fight' && s.y <= -90, '迎战第 2 天正常出发站回房顶');
  check(await until((st) => st.kills > s.kills, 30000, '第 2 天自动击杀'), '第 2 天房顶塔防联合击杀正常');
  await g.shot('09-day2');

  // 9. 验证静音键 & 第 5 天 Boss 视觉呈现
  await g.tap('#btn-mute');
  check(await g.page.evaluate(() => document.querySelector('#btn-mute').innerText === '静音'), '音效静音开关可点且状态同步');
  await g.page.evaluate(() => {
    const r = window.__game.run;
    r.day = 5; r.spawn.total = 40; r.spawn.left = 20; r.spawn.bossKind = 'boss_beast'; r.spawn.bossSpawned = false;
    r.spawn.timer = 1;
  });
  check(await until((st) => st.boss, 6000, '触发第 5 天 Boss'), 'Boss 登场');
  check(await g.page.evaluate(() => document.querySelector('.chip.boss') !== null), '顶部 HUD 正确出现 Boss 血条');
  await g.page.evaluate(() => { const b = window.__game.run.zombies.find((z) => z.kind.startsWith('boss_')); if (b) b.x = 580; });
  await wait(350);
  await g.shot('10-boss5');

  // 10. 暂停、死亡与重开
  await g.tap('#btn-pause');
  check((await g.state()).panel === 'pause', '能暂停');
  const tp = (await g.state()).tick;
  await fits('#panel-pause'); await wait(400);
  check((await g.state()).tick === tp, '暂停时游戏不走');
  await g.tap('#btn-resume');

  await g.page.evaluate(() => { window.__game.run.player.hp = 0; });
  check(await until((st) => st.panel === 'dead', 3000, '等死亡面板'), '血量归零弹出结算');
  await g.shot('11-dead'); await fits('#panel-dead');
  await g.tap('#btn-again');
  check((await g.state()).panel === 'class', '再来一局先选职业');
  await g.tap('#panel-class [data-class=gunner]');
  s = await g.state();
  check(s.panel === null && s.day === 1 && s.hp === 100 && s.kills === 0, '重开是全新的一局');

  const text = await g.page.evaluate(() => document.body.innerText);
  check(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(text.replace(/★/g, '')), '界面里没有 emoji');
  check(g.errors.length === 0, '页面没有报错 ' + g.errors.slice(0, 2).join(' | '));
  await g.browser.close();
  console.log(fails.length ? `\n${fails.length} 项没过` : '\n全部通过');
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
