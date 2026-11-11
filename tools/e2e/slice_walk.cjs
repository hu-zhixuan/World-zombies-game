// 像真玩家一样用真实触摸走完一轮：开始 → 打完第 1 天 → 捡箱子 → 三选一 → 工坊 → 出发 → 第 2 天能动能打。
// 任何一步卡住、点不到、页面报错，退出码为 1。截图在 tools/e2e/shots/。
// 用法：npm run e2e
const L = require('./lib.cjs');

(async () => {
  const g = await L.open();
  const fails = [];
  const check = (ok, what) => { console.log((ok ? '  ok   ' : '  FAIL ') + what); if (!ok) fails.push(what); };
  const wait = (ms) => g.page.waitForTimeout(ms);
  const until = async (fn, ms, label) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn(await g.state())) return true; await wait(200); } console.log('  超时：' + label, JSON.stringify(await g.state())); return false; };

  // 面板必须整个在屏幕里：超出去的按钮玩家点不到
  const fits = async (sel) => { const r = await g.page.evaluate((s) => { const b = document.querySelector(s).getBoundingClientRect(); return b.top >= 0 && b.left >= 0 && b.bottom <= innerHeight && b.right <= innerWidth && document.querySelector(s).scrollHeight <= document.querySelector(s).clientHeight + 1; }, sel); check(r, sel + ' 整个面板都在屏幕里'); };
  await g.shot('01-title');
  await fits('#panel-title');
  check(await g.page.evaluate(() => /星星/.test(document.querySelector('#meta-progress').innerText)), '标题页显示星星和下一个解锁');
  check((await g.state()).panel === 'title', '打开是标题页');
  const fill = await g.page.evaluate(() => { const r = document.querySelector('#stage canvas').getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), vw: innerWidth, vh: innerHeight }; });
  check(fill.w === fill.vw && fill.h === fill.vh, `画面铺满屏幕，没有黑边 (${fill.w}x${fill.h} / ${fill.vw}x${fill.vh})`);

  await g.tap('#btn-start');
  check((await g.state()).panel === 'class', '点「开始」先选职业');
  await g.shot('01b-class'); await fits('#panel-class');
  check(await g.page.evaluate(() => document.querySelector('#panel-class [data-class=engineer]').disabled && document.querySelector('#panel-class [data-class=chef]').disabled), '没解锁的职业点不了');
  await g.tap('#panel-class [data-class=gunner]');
  check((await g.state()).panel === null, '选了职业进入战斗');

  // 摇杆：往右推，角色要往右走
  const pad = await g.center('#pad');
  const x0 = (await g.state()).x;
  await g.touch('touchStart', pad.x + 40, pad.y); await wait(600); await g.touch('touchEnd');
  check((await g.state()).x > x0 + 20, '推摇杆角色会走');

  // 按住开火：自动锁定并击杀
  const fire = await g.center('#key-fire');
  await g.touch('touchStart', fire.x, fire.y);
  check(await until((s) => s.zombies >= 3 && s.target !== null, 30000, '等僵尸进射程'), '按住开火后自动锁定目标');
  await g.shot('02-fight');
  check(await until((s) => s.kills >= 3, 30000, '等击杀'), '按住开火能打死僵尸');
  // 主动技能：松开开火，点一下技能键，再按回开火
  await g.touch('touchEnd');
  await g.tap('#key-skill');
  check(await g.page.evaluate(() => window.__game.run.skill.cd > 0), '技能键能放技能');
  await g.shot('02b-skill');
  await g.touch('touchStart', fire.x, fire.y);
  check(await until((s) => s.phase !== 'fight', 120000, '等第 1 天清场'), '第 1 天能清场');
  await g.touch('touchEnd');
  await g.shot('03-clear');

  // 清场后去捡箱子（往右走），然后等三选一
  await g.touch('touchStart', pad.x + 40, pad.y);
  check(await until((s) => s.panel === 'perk' || s.weapons.includes('smg'), 12000, '等捡到箱子'), '清场后能走过去捡武器箱');
  await g.touch('touchEnd');
  check(await until((s) => s.panel === 'perk', 12000, '等三选一'), '清场后弹出三选一');
  await wait(300); await g.shot('04-perk');
  await fits('#panel-perk');
  await g.tap('#panel-perk .card');
  check((await g.state()).panel === 'camp', '点天赋卡后到营地');
  await g.shot('05-camp');
  await fits('#panel-camp');

  await g.tap('#btn-workshop');
  check((await g.state()).panel === 'workshop', '营地能打开工坊');
  await g.shot('06-workshop');
  await fits('#panel-workshop');
  await g.page.evaluate(() => { window.__game.run.coins = 200; window.__game.notify(); }); // 直接给够金币，只为验证升星按钮能点
  const before = (await g.state()).weapons;
  await g.tap('#btn-star-pistol');
  check((await g.state()).weapons !== before, '工坊能花金币升星 (' + before + ' → ' + (await g.state()).weapons + ')');
  await g.shot('07-workshop-star');
  await g.tap('#btn-close');
  check((await g.state()).panel === 'camp', '关掉工坊回到营地');
  await g.tap('#btn-next');
  let s = await g.state();
  check(s.panel === null && s.day === 2 && s.phase === 'fight', '点「出发」开始第 2 天');
  const t0 = s.tick; await wait(500);
  check((await g.state()).tick > t0 + 10, '第 2 天游戏在跑，没有卡住');
  await g.touch('touchStart', fire.x, fire.y);
  check(await until((st) => st.kills > s.kills, 30000, '第 2 天击杀'), '第 2 天能继续打');
  await g.shot('08-day2');
  await g.touch('touchEnd');

  // 暂停面板能开能关
  await g.tap('#btn-pause');
  check((await g.state()).panel === 'pause', '能暂停');
  const tp = (await g.state()).tick;
  await fits('#panel-pause'); await wait(400);
  check((await g.state()).tick === tp, '暂停时游戏不走');
  await g.tap('#btn-resume');
  check((await g.state()).panel === null, '能继续');

  // 死亡和重开（直接把血量改成 0 来触发，只为验证面板流程）
  await g.page.evaluate(() => { window.__game.run.player.hp = 0; });
  check(await until((st) => st.panel === 'dead', 3000, '等死亡面板'), '血量归零弹出结算');
  await g.shot('09-dead'); await fits('#panel-dead');
  await g.tap('#btn-again');
  check((await g.state()).panel === 'class', '再来一局先选职业');
  await g.tap('#panel-class [data-class=gunner]');
  s = await g.state();
  check(s.panel === null && s.day === 1 && s.hp === 100 && s.kills === 0, '再来一局是全新的一局');
  check(await g.page.evaluate(() => window.__game.meta.stars >= 1 && JSON.parse(localStorage.getItem('wz57.meta')).stars === window.__game.meta.stars), '死了也有收获：星星已经存下来');

  const text = await g.page.evaluate(() => document.body.innerText);
  check(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(text.replace(/★/g, '')), '界面里没有 emoji');
  check(g.errors.length === 0, '页面没有报错 ' + g.errors.slice(0, 2).join(' | '));
  await g.browser.close();
  console.log(fails.length ? `\n${fails.length} 项没过` : '\n全部通过');
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
