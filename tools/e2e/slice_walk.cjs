// 像真玩家一样用真实触摸走完完整流程：标题与档案 → 选职业 → 序幕过场 → 房顶手控锁敌与拖曳手雷（跳跃上/闪避下） → 泰拉瑞亚↓穿层下跳/一楼墙撞停/二段跳回屋顶 → 清场三选一 → 夜宿酒馆极简营地(靠近红砖炉QTE/端菜上桌/食客对话/行商/空间工坊炮塔模式切换/出门看墙) → 第 2 天 / 飞行夜翼魔蝠 / 第 5 天 Boss → 暂停 → 死亡重开 → 780x360 窄屏检查。
const L = require('./lib.cjs');

(async () => {
  const g = await L.open();
  const fails = [];
  const check = (ok, what) => { console.log((ok ? '  ok   ' : '  FAIL ') + what); if (!ok) fails.push(what); };
  const wait = (ms) => g.page.waitForTimeout(ms);
  const until = async (fn, ms, label) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { if (fn(await g.state())) return true; await wait(160); }
    console.log('  超时：' + label, JSON.stringify(await g.state()));
    return false;
  };
  const walkUntil = async (dx, dy, fn, ms, label) => {
    const pad = await g.center('#pad');
    await g.touch('touchStart', pad.x, pad.y);
    await wait(30);
    await g.touch('touchMove', pad.x + dx, pad.y + dy);
    const ok = await until(fn, ms, label);
    await g.touch('touchEnd');
    await wait(120);
    return ok;
  };

  // 面板必须整个在 844x390 屏幕里，不能横向或纵向溢出
  const fits = async (sel) => {
    const r = await g.page.evaluate((s) => {
      const el = document.querySelector(s);
      if (!el) return false;
      const b = el.getBoundingClientRect();
      return b.top >= 0 && b.left >= 0 && b.bottom <= innerHeight && b.right <= innerWidth && el.scrollHeight <= el.clientHeight + 2 && el.scrollWidth <= el.clientWidth + 2;
    }, sel);
    check(r, sel + ' 整个面板都在屏幕里');
  };

  // 1. 标题与全屏检查 + 酒馆传闻录（3页签）
  await g.shot('01-title');
  await fits('#panel-title');
  check(await g.page.evaluate(() => /暮夜酒馆：守夜人/.test(document.querySelector('#panel-title h1').innerText)), '标题页展示「暮夜酒馆：守夜人」');
  check(await g.page.evaluate(() => /星星/.test(document.querySelector('#meta-progress').innerText)), '标题页显示星星和下一个解锁');
  check((await g.state()).panel === 'title', '打开是标题页');
  check(await g.page.evaluate(() => !document.querySelector('#hud-scrap')), '顶部 HUD 已彻底移除废铁显示');
  const fill = await g.page.evaluate(() => { const r = document.querySelector('#stage canvas').getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), vw: innerWidth, vh: innerHeight }; });
  check(fill.w === fill.vw && fill.h === fill.vh, `画面铺满屏幕，没有黑边 (${fill.w}x${fill.h} / ${fill.vw}x${fill.vh})`);

  await g.tap('#btn-lore');
  check((await g.state()).panel === 'lore', '从标题可打开酒馆传闻录');
  check(await g.page.evaluate(() => !!document.querySelector('#panel-lore .lore-storyboard .scene-art')), '序章前情展示图文分镜场景');
  const sceneBefore = await g.page.evaluate(() => document.querySelector('#panel-lore .lore-storyboard .scene-art')?.getAttribute('data-scene'));
  await g.tap('#btn-scene-next');
  const sceneAfter = await g.page.evaluate(() => document.querySelector('#panel-lore .lore-storyboard .scene-art')?.getAttribute('data-scene'));
  check(sceneBefore !== sceneAfter, `分镜可切换上一幕/下一幕 (${sceneBefore} -> ${sceneAfter})`);
  await fits('#panel-lore');
  await g.shot('01c-lore-intro');
  await g.tap('#tab-lore-chapters');
  await fits('#panel-lore');
  await g.shot('01c-lore');
  await g.tap('#tab-lore-allies');
  await fits('#panel-lore');
  await g.tap('#btn-close');

  // 2. 选难度与职业 -> 播放序幕剧情 -> 跳过或推进入第 1 天房顶
  await g.tap('#btn-start');
  check((await g.state()).panel === 'class', '点「开始守夜」先选难度与职业');
  check(await g.page.evaluate(() => document.querySelectorAll('#diff-picker .diff-btn').length === 3), '备战面板展示三档难度按钮');
  await g.tap('#btn-diff-hard');
  check(await g.page.evaluate(() => document.querySelector('#btn-diff-hard')?.classList.contains('on')), '可点选「困难」难度');
  await g.tap('#btn-diff-normal');
  await g.shot('01b-class'); await fits('#panel-class');
  check(await g.page.evaluate(() => document.querySelector('#panel-class [data-class=engineer]').disabled && document.querySelector('#panel-class [data-class=chef]').disabled), '0星时铸匠/厨师正确锁定');
  await g.tap('#panel-class [data-class=gunner]');

  let s = await g.state();
  check(s.panel === 'story' && s.storyLen >= 3, `选职业后自动进入序幕剧情动画 (${s.storyLen}段)`);
  check(await g.page.evaluate(() => !!document.querySelector('#panel-story .story-visual .scene-art')), '序幕对白上方展示像素分镜配图');
  check(await g.page.evaluate(() => {
    const txt = document.querySelector('#panel-story')?.innerText || '';
    return /小胡|胡掌柜/.test(txt) && !/莫老板|莫掌柜/.test(txt);
  }), '序幕剧情主角名称为「小胡」且无旧名');
  await fits('#panel-story');
  await g.shot('01d-story-intro');
  const n0 = s.storyLen;
  await g.tap('#btn-story-next');
  check((await g.state()).storyLen === n0 - 1, '点按「下一句」正常推进序幕对白');
  await g.tap('#btn-story-skip');

  s = await g.state();
  check(s.panel === null && s.y <= -90, `跳过序幕进入第 1 天且主角站在二楼房顶防御 (y=${s.y})`);
  await wait(240);
  check(await g.page.evaluate(() => !document.querySelector('#wave-dlg-bar')), '第 1 天开场战斗顶部不弹出无线电对白条');
  const houseRoofOk = await g.page.evaluate(() => {
    const hb = document.querySelector('#hud-house');
    const hud = document.querySelector('.hud');
    if (!hb || !hud) return false;
    const hr = hb.getBoundingClientRect(), tr = hud.getBoundingClientRect();
    return hb.getAttribute('data-zone') === 'roof' && /屋顶/.test(hb.textContent || '') && hr.top >= tr.bottom + 1;
  });
  check(houseRoofOk, '顶部下方屋顶增益徽章 #hud-house(roof) 清晰不压 HUD');
  const swapOrderOk = await g.page.evaluate(() => {
    const j = document.querySelector('#key-jump').getBoundingClientRect();
    const d = document.querySelector('#key-dodge').getBoundingClientRect();
    return d.top >= j.bottom - 4 && Math.abs(d.left - j.left) < 25;
  });
  check(swapOrderOk, '战斗右下按键「跳跃在上、闪避在下」位置互换完成');
  await g.shot('01e-wave1-clean');

  check(await g.page.evaluate(() => !!document.querySelector('#key-fire')), '右下角主开火键 #key-fire 已就位');
  const noOverlap = await g.page.evaluate(() => {
    const ids = ['#key-fire', '#key-jump', '#key-dodge', '#key-grenade', '#key-skill', '#weapon-chip', '#key-reload', '#hud-house'];
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
  check(noOverlap === 'ok', '右下角按钮、武器条与屋顶增益条互不重叠 (' + noOverlap + ')');

  // 3. 元气骑士式手感：不按攻击键绝不乱开枪；按住攻击键才自动锁敌射杀 + 可拖拽控抛物线爆炎弹
  check(await until((st) => st.zombies >= 2 && st.target !== null, 30000, '等魔物进射程出现锁定框'), '魔物进入射程出现锁定准星');
  const idleAmmo = await g.page.evaluate(() => ({ auto: window.__game.run.autoFire, ammo: window.__game.run.player.weapons[0].ammo }));
  check(!idleAmmo.auto && idleAmmo.ammo === 10, `默认不自动开枪 (autoFire=${idleAmmo.auto}, ammo=${idleAmmo.ammo})`);

  const fireBtn = await g.center('#key-fire');
  await g.touch('touchStart', fireBtn.x, fireBtn.y);
  await wait(240);
  await g.shot('02-rooftop-fight');
  check(await until((st) => st.kills >= 2, 30000, '按住攻击键自动锁敌击杀魔物'), '按住攻击键能稳定自动锁敌杀敌');
  await g.touch('touchEnd');
  await wait(120);

  await g.tap('#key-skill');
  check(await g.page.evaluate(() => window.__game.run.skill.cd > 0), '扇形技能键正常释放');

  // 拖拽爆炎弹轮盘向右上拉出高抛抛物线预览并投出
  const nadeBtn = await g.center('#key-grenade');
  await g.touch('touchStart', nadeBtn.x, nadeBtn.y);
  await wait(60);
  await g.touch('touchMove', nadeBtn.x + 20, nadeBtn.y - 26);
  await wait(200);
  check(await g.page.evaluate(() => !!window.__game.grenadeAim && window.__game.grenadeAim.dx > 0.3 && window.__game.grenadeAim.dy < -0.35), '按住爆炎弹拖拽能实时调出抛物线方向与高低弧度');
  await g.shot('02c-grenade-aim');
  await g.touch('touchEnd');
  await wait(260);
  check((await g.state()).grenades === 1, '拖拽爆炎弹松手后精准按设定抛物线投出');
  await g.shot('02b-skill-grenade');

  // 4. 泰拉瑞亚式 ↓ 穿层下跳（屋顶 -> 门廊 -> 地面），测一楼砖墙碰撞，再二段跳跳回二楼屋顶
  const pad = await g.center('#pad');
  await g.touch('touchStart', pad.x, pad.y);
  await wait(30);
  await g.touch('touchMove', pad.x, pad.y + 40);
  await wait(110);
  await g.touch('touchEnd');
  check(await until((st) => st.y === -48, 2500, '摇杆轻下拉穿屋顶落门廊'), '摇杆下拉轻按可穿过屋顶落到中层门廊');
  check(await g.page.evaluate(() => document.querySelector('#hud-house')?.getAttribute('data-zone') === 'porch'), '跳/落到门廊时增益徽章切换为门廊状态 (porch)');

  await g.touch('touchStart', pad.x, pad.y);
  await wait(30);
  await g.touch('touchMove', pad.x, pad.y + 40);
  check(await until((st) => st.y === 0, 2500, '摇杆下拉从门廊落到地面'), '摇杆下拉穿过门廊直落前院地面');
  await g.touch('touchEnd');
  await wait(80);
  check(await g.page.evaluate(() => document.querySelector('#hud-house')?.getAttribute('data-zone') === 'ground'), '落到地面时增益徽章实时切换为地面状态 (ground)');

  await walkUntil(-36, 0, (st) => st.x === 246 && st.tick > 0, 2000, '向左走撞到一楼砖墙');
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
  check(await g.page.evaluate(() => document.querySelector('#hud-house')?.getAttribute('data-zone') === 'roof'), '跃回房顶立即恢复屋顶高地增益 (roof)');

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

  // 6. 第 1 夜触发深夜食堂开张剧情 -> 跳过后进入极简营地（仅「食堂」「迎战」+ 右下「互动/跳跃」键）
  s = await g.state();
  check(s.panel === 'story' && s.phase === 'camp', '首夜触发深夜食堂开张小剧场');
  await fits('#panel-story');
  await g.shot('04b-diner-story');
  await g.tap('#btn-story-skip');

  s = await g.state();
  check(s.panel === null && s.phase === 'camp' && s.inside === true, '剧场结束后进入酒馆小屋内自由走动');
  const campUiOk = await g.page.evaluate(() => {
    const barBtns = [...document.querySelectorAll('#camp-bar button')].map((b) => b.id);
    return barBtns.length === 2 && barBtns.includes('btn-kitchen') && barBtns.includes('btn-next')
      && !document.querySelector('#btn-shop') && !document.querySelector('#btn-build') && !document.querySelector('#btn-inout')
      && !!document.querySelector('#key-act') && !!document.querySelector('#key-dodge') && !document.querySelector('#key-jump');
  });
  check(campUiOk, '营地酒馆内极简化（底栏仅酒馆+迎战，右下仅互动+冲刺，隐藏无用跳跃键）');
  await g.shot('05-tavern-camp');

  // 7. 深夜食堂屋内核验玩法（备菜 -> 自动出菜传菜台 -> 传菜台取菜送到客桌 -> 对话 -> 酒桶斟酒 -> 小结）
  await g.page.evaluate(() => {
    window.__game.run.meats = { tender: 8, thick: 2, essence: 0 };
    window.__game.run.coins = 1600;
    window.__game.run.diner.flame = 10;
    window.__game.notify();
  });

  // 7a. 打开暮夜酒馆检查「备菜招待 / 酒馆升级 / 熟客录」三页极简布局与 780/844 适配
  const forbiddenReSrc = '十五波|短波|电台|直升机|运输机|螺旋桨|废土|加特林|磁轨|特斯拉|左轮炮|步枪|霰弹|手雷|防弹|电网|机枪塔|冰霜塔|电弧塔|重炮塔|避难所|米其林|异变|变异|主厨|工程师|枪手|护士|废品改造狂|卖的废铁|卖废铁|热搜|末世|感染者';
  await g.tap('#btn-kitchen');
  check((await g.state()).panel === 'kitchen', '点酒馆按钮可打开极简三页暮夜酒馆');
  check(await g.page.evaluate((src) => !new RegExp(src).test(document.querySelector('#panel-kitchen').innerText), forbiddenReSrc), '暮夜酒馆界面无出戏或过时设定文案');
  check(await g.page.evaluate(() => !!document.querySelector('#tavern-battle-buffs') && !document.querySelector('#btn-tavern-seats')), '备菜招待页专注食客与料理，不混杂餐厅升级与卖肉按钮');

  await g.tap('#btn-meal-spicy_skewer');
  check(await g.page.evaluate(() => window.__game.run.meal === 'spicy_skewer' && (window.__game.run.diner.feastDishes ?? []).includes('spicy_skewer') && (window.__game.run.diner.dishXp?.spicy_skewer ?? 0) >= 1), '烹制战备料理立即激活明日主战场火力增益并积累火候熟练度');
  await g.tap('#btn-serve-0');
  check(await g.page.evaluate(() => window.__game.run.guests[0].served && /枪伤|攻速|炮塔|暴击|造塔|空投|战友/.test(document.querySelector('#tavern-battle-buffs')?.textContent || '')), '一屏直接招待到访食客同时收获金币、战场支援与明日料理增益');
  check(await g.page.evaluate(() => {
    const r = window.__game.run;
    const xp = r.diner.dishXp?.spicy_skewer ?? 0;
    return xp < 2 || (r.diner.dishLevels.spicy_skewer ?? 1) >= 2;
  }), '做满 2 盘料理自动练成 Lv.2 熟手招牌（告别工坊式花钱点升级）');
  await g.shot('06-kitchen'); await fits('#panel-kitchen');

  await g.tap('#tab-kitchen-upg');
  check(await g.page.evaluate(() => !!document.querySelector('#tavern-contract') && document.querySelectorAll('.upg-card').length === 4), '酒馆升级独立页展示 2x2 清晰升级卡片与悬赏');
  await g.shot('06b-kitchen-upg'); await fits('#panel-kitchen');

  const wallMaxBeforeSeats = await g.page.evaluate(() => window.__game.run.wall.maxHp);
  await g.tap('#btn-tavern-seats');
  await g.tap('#btn-tavern-warm_lantern');
  await g.tap('#btn-tavern-fast_tap');
  await g.tap('#btn-tavern-wide_pass');
  check(await g.page.evaluate((prevMax) => {
    const r = window.__game.run;
    const upgs = r.diner.upgrades;
    return upgs.includes('fast_tap') && upgs.includes('tables_6') && upgs.includes('warm_lantern') && upgs.includes('wide_pass') && r.wall.maxHp === prevMax + 120;
  }, wallMaxBeforeSeats), '酒馆 4 项工事升级一键建成且扩座同步永久提升主战场防线耐久上限 (+120)');

  await g.page.setViewportSize({ width: 780, height: 360 });
  await wait(120);
  await fits('#panel-kitchen');
  await g.page.setViewportSize({ width: 844, height: 390 });
  await wait(120);

  await g.tap('#tab-kitchen-vip');
  await g.shot('06c-kitchen-vip'); await fits('#panel-kitchen');
  check(await g.page.evaluate(() => document.querySelectorAll('.vip-cell').length === 15), '熟客录展示 15 位熟客与战场支援身份');

  await g.tap('#tab-kitchen-dine');
  await g.tap('#btn-close');

  // 7b. 开张营业 -> 隐藏底栏与冗余按钮 -> 等后厨自动出锅到传菜台 -> 端菜上桌 -> 搭话 -> 酒桶斟酒 -> 小结
  await g.tap('#btn-shift-start');
  check(await g.page.evaluate(() => window.__game.run.dinerShift.mode === 'open' && !!document.querySelector('#shift-hud.open') && !document.querySelector('#camp-bar') && !document.querySelector('#btn-shift-menu')), '开张营业后隐藏底栏与重复战备台按钮，上菜视野完全干净');
  await wait(2200);
  await g.shot('05c-tavern-rush');

  // 等待传菜台有出锅菜品并走近端菜上桌
  const hasPass = await (async () => {
    const t0 = Date.now();
    while (Date.now() - t0 < 5000) {
      if (await g.page.evaluate(() => window.__game.run.dinerShift.counterDishes.length > 0)) return true;
      await wait(160);
    }
    return false;
  })();
  check(hasPass, '后厨自动完成订单并出菜到传菜台');

  const passDir = (await g.state()).x > 192 ? -38 : 38;
  await walkUntil(passDir, 0, (st) => Math.abs(st.x - 192) <= 18, 4000, '走到橡木传菜台旁');
  check(await g.page.evaluate(() => /端走热菜/.test(document.querySelector('#key-act')?.textContent || '')), '走近有菜的传菜台提示「端走热菜」');
  await g.tap('#key-act');
  s = await g.state();
  const destGuestId = s.carryingDish;
  check(!!destGuestId, `从传菜台取菜端在手 (guestId=${destGuestId})`);
  const destGuestX = await g.page.evaluate((gid) => window.__game.run.guests.find((o) => o.id === gid)?.x ?? 300, destGuestId);
  await walkUntil(destGuestX > s.x ? 38 : -38, 0, (st) => Math.abs(st.x - destGuestX) <= 18, 4000, '端菜走到对应食客桌前');
  await g.tap('#key-act');
  s = await g.state();
  check(s.carryingDish === null && s.fans > 0 && s.rep > 0, `靠近食客按下互动键直接上菜获支援与口碑 (fans=${s.fans}, rep=${s.rep})`);

  // 再按一次互动键与食客搭话（测试「好的」按钮不写“进入战局”）
  await g.tap('#key-act');
  check((await g.state()).panel === 'story' && await g.page.evaluate(() => /好的|下一句/.test(document.querySelector('#btn-story-next').innerText)), '靠近食客按互动键进入对话，且结尾按钮为「好的」');
  await g.tap('#btn-story-skip');

  // 原木酒桶斟酒小游戏 + 提前打烊 + 极简打烊小结
  const barDir = (await g.state()).x > 236 ? -38 : 38;
  await walkUntil(barDir, 0, (st) => Math.abs(st.x - 236) <= 18, 4000, '走到原木酒桶旁');
  await g.tap('#key-act');
  check(await g.page.evaluate(() => !!window.__game.run.pourMinigame && !!document.querySelector('#pour-hud')), '走到酒桶旁按互动键弹出斟酒浮条 #pour-hud');
  await wait(240);
  await g.tap('#btn-pour-hit');
  check(await g.page.evaluate(() => !window.__game.run.pourMinigame && !!window.__game.run.carryingDrink), '点击止沫停杯成功装杯在手');
  await g.tap('#btn-shift-stop');
  check(await g.page.evaluate(() => window.__game.run.dinerShift.mode === 'summary' && !!document.querySelector('#panel-shift-summary')), '点击打烊弹出精简打烊小结');
  await fits('#panel-shift-summary');
  await g.shot('05d-shift-summary');
  await g.tap('#btn-shift-summary-ok');
  check(await g.page.evaluate(() => window.__game.run.dinerShift.mode === 'prep'), '点击收工迎战回到筹备态');

  await g.tap('#btn-kitchen');
  await g.tap('#tab-kitchen-upg');
  await g.tap('#btn-cook-all');
  check((await g.state()).meat === 0 && (await g.state()).coins > 650, '富余三种肉料一键全部变现换金币');
  await g.tap('#btn-close');

  // 走近行商货架 -> #key-act 打开商店 (x=700)
  const shopDir = (await g.state()).x < 700 ? 38 : -38;
  await walkUntil(shopDir, 0, (st) => Math.abs(st.x - 700) <= 18, 5500, '走到军械行商货架旁');
  await g.tap('#key-act');
  check((await g.state()).panel === 'shop', '走近行商按互动键打开军械行商');
  check(await g.page.evaluate((src) => !new RegExp(src).test(document.querySelector('#panel-shop').innerText), forbiddenReSrc), '军械行商界面无科幻或现代出戏词汇');
  await g.shot('07-shop'); await fits('#panel-shop');
  await g.tap('#btn-shop-revolver');
  await g.tap('#btn-buy-armor');
  s = await g.state();
  check(s.weapons.includes('revolver') && s.armor >= 40, '军械行商能购入重锤左轮并购买铁甲');
  await g.tap('#btn-close');

  // 走近铁匠工坊 -> #key-act 打开空间要塞沙盘工坊（x=736）
  const wsDir = (await g.state()).x < 736 ? 38 : -38;
  await walkUntil(wsDir, 0, (st) => Math.abs(st.x - 736) <= 18, 5500, '走到防线工坊旁');
  await g.tap('#key-act');
  check((await g.state()).panel === 'build', '走近铁砧按互动键打开要塞沙盘工坊');
  check(await g.page.evaluate((src) => !/废铁/.test(document.querySelector('#panel-build').innerText) && !new RegExp(src).test(document.querySelector('#panel-build').innerText), forbiddenReSrc), '工坊文案不再提及废铁或现代兵器名');
  await fits('#panel-build');
  const buildEmptyOk = await g.page.evaluate(() => {
    const empties = [...document.querySelectorAll('#panel-build .build-empty')];
    if (empties.length === 0) return 'no-empty-slots';
    for (const row of empties) {
      const rr = row.getBoundingClientRect();
      const btns = [...row.querySelectorAll('.mini-btns .btn')];
      if (btns.length !== 4) return 'btn-count-' + btns.length;
      const rects = btns.map((b) => b.getBoundingClientRect());
      for (let i = 0; i < rects.length; i++) {
        const a = rects[i];
        if (a.width < 32 || a.height < 18) return 'squashed-' + Math.round(a.width) + 'x' + Math.round(a.height);
        if (a.left < rr.left - 1 || a.right > rr.right + 1 || a.top < rr.top - 1 || a.bottom > rr.bottom + 1) return 'btn-out-of-row';
        for (let j = i + 1; j < rects.length; j++) {
          const b = rects[j];
          if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1) return 'btn-overlap';
        }
      }
    }
    return 'ok';
  });
  check(buildEmptyOk === 'ok', '防线工坊空炮塔槽位 2x2 按钮宽高充足且不重叠不溢出 (' + buildEmptyOk + ')');
  await g.tap('#btn-build-0-frost');
  await g.tap('#btn-build-2-tesla');
  await g.tap('#btn-wall-up');
  await g.tap('#btn-fort-up');
  await g.tap('#btn-turret-mode-0');
  await g.shot('08-build'); await fits('#panel-build');
  s = await g.state();
  check(s.turrets >= 2 && s.wallLv === 2 && s.fortLv === 2 && s.turretModes.startsWith('boss,') && s.weapons.split(',').length <= 2, `要塞沙盘可建造炮塔、升级壁垒堡垒并切换索敌重心 (${s.turretModes}, weapons=${s.weapons})`);
  await g.tap('#btn-close');

  // 8. 走到大门用互动键出门查看升级后的哥特石堡与炮塔防线，并验证室外实地直建浮条 #field-build-hud
  await walkUntil(38, 0, (st) => st.x >= 765, 5500, '走到酒馆大门');
  await g.tap('#key-act');
  check((await g.state()).inside === false, '靠近酒馆大门按互动键走出门外巡查防线');
  await walkUntil(38, 0, (st) => st.x >= 335, 4000, '走到前院炮塔基座旁');
  check(await g.page.evaluate(() => !!document.querySelector('#field-build-hud')), '室外走近工事基座自动弹出极简实地改造浮条 #field-build-hud（不遮挡画面）');
  await wait(200);
  await g.shot('08b-outside-upgraded');
  await g.tap('#btn-next');
  s = await g.state();
  check(s.panel === null && s.day === 2 && s.phase === 'fight' && s.y <= -90, '迎战第 2 天正常出发站回房顶');
  check(await until((st) => st.kills > s.kills, 30000, '第 2 天自动击杀'), '第 2 天房顶塔防联合击杀正常');

  // 验证中途战友（小张/阿强）在场上会实际移动走位、攻击且零太空步倒走
  await g.page.evaluate(() => {
    const r = window.__game.run;
    if (!r.story.allies.includes('zhang')) r.story.allies.push('zhang');
    if (!r.story.allies.includes('qiang')) r.story.allies.push('qiang');
  });
  const allySample = await g.page.evaluate(() => new Promise((res) => {
    const x0 = { z: window.__game.run.allies.zhang.x, q: window.__game.run.allies.qiang.x };
    let moonwalk = false;
    let frames = 0;
    const probe = () => {
      for (const id of ['zhang', 'qiang']) {
        const rt = window.__game.run.allies[id];
        if (rt.state === 'move' && Math.abs(rt.vx) > 0.05 && rt.facing !== Math.sign(rt.vx)) moonwalk = true;
      }
      if (++frames >= 48) {
        res({
          moonwalk,
          zMoved: Math.abs(window.__game.run.allies.zhang.x - x0.z),
          qMoved: Math.abs(window.__game.run.allies.qiang.x - x0.q),
        });
      } else {
        requestAnimationFrame(probe);
      }
    };
    requestAnimationFrame(probe);
  }));
  check(!allySample.moonwalk && (allySample.zMoved > 1 || allySample.qMoved > 1), `战友战斗中真实走位且零太空步倒走 (z:${allySample.zMoved.toFixed(0)}, q:${allySample.qMoved.toFixed(0)})`);
  await g.shot('09-day2');

  // 9. 验证静音键 & 飞行夜翼魔蝠(bat) + 第 5 天 Boss 视觉呈现
  await g.tap('#btn-mute');
  check(await g.page.evaluate(() => document.querySelector('#btn-mute').innerText === '静音'), '音效静音开关可点且状态同步');
  await g.page.evaluate(() => {
    const r = window.__game.run;
    r.day = 5; r.spawn.total = 40; r.spawn.left = 20; r.spawn.bossKind = 'boss_beast'; r.spawn.bossSpawned = false;
    r.zombies.push({ id: r.nextId++, kind: 'bat', x: 500, y: -90, hp: 90, maxHp: 90, atkCd: 30, kb: 0, burnT: 0, slowT: 0, stunT: 0, freezeT: 0, carriesCrate: false });
    r.spawn.timer = 1;
  });
  check(await until((st) => st.boss && st.flyers >= 1, 6000, '触发第 5 天 Boss 与飞行夜翼魔蝠'), 'Boss 与飞行夜翼魔蝠同屏现身');
  check(await g.page.evaluate(() => document.querySelector('.chip.boss') !== null), '顶部 HUD 正确出现 Boss 血条');
  check(await g.page.evaluate(() => !document.querySelector('#wave-dlg-bar')), 'Boss 现身战斗顶部不弹出无线电对白条');
  await g.page.evaluate(() => { const b = window.__game.run.zombies.find((z) => z.kind.startsWith('boss_')); if (b) b.x = 580; });
  await wait(350);
  await g.shot('10-boss5');

  // 9b. 第 15 天通关进入「破晓无尽酒馆」，验证佛系过夜、780x360 无尽底栏适配与外出迎战
  await g.page.evaluate(() => {
    const r = window.__game.run;
    r.day = 15; r.phase = 'won';
    window.__game.notify();
  });
  check(await until((st) => st.panel === 'won', 3000, '触发第 15 天通关胜利面板'), '通关第 15 天弹出胜利面板');
  await fits('#panel-won');
  await g.tap('#btn-enter-endless');
  check(await until((st) => st.panel === null && st.inside === true, 3000, '点击留在酒馆进入无尽经营'), '通关后可留在酒馆开启无尽经营');
  check(await g.page.evaluate(() => {
    const r = window.__game.run;
    return r.endless === true && r.inside === true && !!document.querySelector('#btn-endless-night');
  }), '无尽酒馆底栏显示「佛系过夜」与经营按钮');
  await g.tap('#btn-endless-night');
  check(await g.page.evaluate(() => window.__game.run.day === 16 && window.__game.run.inside === true && window.__game.run.phase === 'camp'), '点击佛系过夜直接进入第 16 夜营业准备');
  await g.page.setViewportSize({ width: 780, height: 360 });
  await wait(140);
  const endlessBarOk = await g.page.evaluate(() => {
    const ids = ['#btn-kitchen', '#btn-endless-night', '#btn-next', '#key-act'];
    const rects = ids.map((id) => ({ id, r: document.querySelector(id)?.getBoundingClientRect() }));
    if (rects.some((x) => !x.r || x.r.right > innerWidth || x.r.bottom > innerHeight || x.r.left < 0 || x.r.top < 0)) return 'out-of-bounds';
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i].r, b = rects[j].r;
        if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2) {
          return `${rects[i].id} 与 ${rects[j].id} 重叠`;
        }
      }
    }
    return 'ok';
  });
  check(endlessBarOk === 'ok', '780x360 无尽酒馆底栏按钮无裁剪重叠 (' + endlessBarOk + ')');
  await g.page.setViewportSize({ width: 844, height: 390 });
  await wait(140);
  await g.shot('08c-endless-tavern');
  await g.tap('#btn-next');
  check(await until((st) => st.inside === false && st.phase === 'fight', 3000, '从无尽酒馆点击迎战出门战斗'), '无尽模式仍可随时出门采集迎战第 16 夜');

  // 10. 暂停（含战局剧情入口）、死亡与重开
  await g.tap('#btn-pause');
  check((await g.state()).panel === 'pause', '能暂停');
  const tp = (await g.state()).tick;
  await fits('#panel-pause'); await wait(400);
  check((await g.state()).tick === tp, '暂停时游戏不走');
  await g.tap('#btn-resume');

  await g.page.evaluate(() => { window.__game.run.player.hp = 0; });
  check(await until((st) => st.panel === 'dead', 3000, '等死亡面板'), '血量归零弹出结算');
  await g.shot('11-dead'); await fits('#panel-dead');
  check(await g.page.evaluate((src) => !new RegExp(src).test(document.querySelector('#panel-dead').innerText), forbiddenReSrc), '死亡结算文案无现代出戏词');
  await g.tap('#btn-again');
  check((await g.state()).panel === 'class', '再来一局先选职业');
  await g.tap('#panel-class [data-class=gunner]');
  await g.tap('#btn-story-skip');
  s = await g.state();
  check(s.panel === null && s.day === 1 && s.hp === 100 && s.kills === 0, '重开是全新的一局');

  // 11. 窄横屏 780x360 适配检查（#hud-house、#weapon-chip、.keys-fan、#pad 互不重叠或溢出）
  await g.page.setViewportSize({ width: 780, height: 360 });
  await wait(160);
  const narrowOk = await g.page.evaluate(() => {
    const ids = ['#hud-house', '#weapon-chip', '#key-reload', '#key-fire', '#key-jump', '#key-dodge', '#key-grenade', '#key-skill'];
    const rects = ids.map((id) => ({ id, r: document.querySelector(id)?.getBoundingClientRect() }));
    if (rects.some((x) => !x.r || x.r.right > innerWidth || x.r.bottom > innerHeight || x.r.left < 0 || x.r.top < 0)) return 'out-of-bounds';
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
  check(narrowOk === 'ok', '780x360 窄横屏布局无溢出无遮挡 (' + narrowOk + ')');

  const text = await g.page.evaluate(() => document.body.innerText);
  check(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(text.replace(/★/g, '')), '界面里没有 emoji');
  check(g.errors.length === 0, '页面没有报错 ' + g.errors.slice(0, 2).join(' | '));
  await g.browser.close();
  console.log(fails.length ? `\n${fails.length} 项没过` : '\n全部通过');
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
