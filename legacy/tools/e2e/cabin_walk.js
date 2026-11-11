// 像真玩家一样走完一整轮：清场 → 长按进小屋 → 床/管理/扭蛋/远征/餐厅 → 出击门 → 第 2 波。
// 每一步都检查「画面在动、角色能走」。任何一步卡住或页面报错，退出码为 1。
// 用法：npm run build && node tools/e2e/cabin_walk.js [游戏 html 的 URL]
const path = require('path');
const L = require('./lib.js');
const URL = process.argv[2] || L.GAME_URL;
let stuck = 0;
(async () => {
  const browser = await L.launch(); const page = await L.phone(browser);
  const errs = [];
  page.on('pageerror', e => { errs.push(e.message); console.log('  !! pageerror: ' + e.message); });
  page.on('console', m => { const t = m.text(); if (/WATCHDOG|Error|error/.test(t)) console.log('  >> ' + t.slice(0, 160)); });
  await L.intoCombat(page, URL);
  await page.evaluate(() => {
    window.__health = () => {
      const vis = id => { const e = document.getElementById(id); if (!e) return false; const cs = getComputedStyle(e); return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.05 && e.getClientRects().length > 0; };
      const ov = ['tutorial-scr','dream-modal','cabin-scr','shop-scr','pause-scr','backpack-modal','expedition-modal','duff-workshop-modal','perk-choice-scr','cinematic-scr','transition-overlay','restaurant-scr','rest-end-scr','chapter-scr','over-scr','codex-scr','wave-dlg-bar','header'].filter(vis);
      const dave = document.getElementById('dave-transition');
      return { gs: gameState, wave, wp: wavePhase, paused: gamePaused, cin: cinActive, shop: shopOpen, cabin: cabinUIOpen, dave: !!(dave && dave.classList.contains('active')), ov: ov.join(','), px: Math.round(player.x), prompt: (document.getElementById('act-label')||{}).textContent };
    };
  });
  const H = () => page.evaluate(() => window.__health());
  const log = async (label) => { const h = await H(); console.log(label.padEnd(26), JSON.stringify(h)); return h; };
  // 能不能动：画面在走、角色能往右走
  const canMove = async (label) => {
    const r = await page.evaluate(async () => {
      const f0 = frameT, x0 = player.x; keys.r = true;
      await new Promise(r => setTimeout(r, 500)); keys.r = false;
      return { frames: frameT - f0, dx: Math.round(player.x - x0) };
    });
    const bad = r.frames < 5 || Math.abs(r.dx) < 2;
    console.log(('  move? ' + label).padEnd(26), JSON.stringify(r), bad ? '  <<< STUCK?' : '');
    if (bad) { stuck++; await page.screenshot({ path: path.join(L.SHOTS, `stuck-${label.replace(/\W+/g,'_')}.png`) }); }
    return !bad;
  };
  const cdp = await page.context().newCDPSession(page);
  const holdAct = async (ms) => {
    const r = await page.evaluate(() => { const b = document.getElementById('btn-vehicle').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r.x, y: r.y, id: 8 }] });
    await page.waitForTimeout(ms);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  const tapAct = async () => {
    const r = await page.evaluate(() => { const b = document.getElementById('btn-vehicle').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, vis: b.width > 0 }; });
    if (!r.vis) { console.log('  (interact button hidden)'); return; }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r.x, y: r.y, id: 7 }] });
    await page.waitForTimeout(120);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  const goStation = async (id) => { await page.evaluate((id) => { const s = HUB_STATIONS.find(s => s.id === id); player.x = s.x - CHAR_W / 2; player.vx = 0; }, id); await page.waitForTimeout(250); };
  // 像玩家一样：剧情一句句点过去、教程点「明白了」
  const closeAll = async () => {
    for (let i = 0; i < 60; i++) {
      const busy = await page.evaluate(() => {
        if (cinActive) { document.getElementById('cinematic-scr').click(); return true; }
        if (isTutorialOpen()) { const b = document.getElementById('tutorial-ok-btn'); if (b && b.offsetParent) b.click(); else dismissTutorial(); return true; }
        return false;
      });
      if (!busy) return;
      await page.waitForTimeout(250);
    }
    console.log('  !! closeAll: still busy after 60 taps');
  };

  // ── 清场 → 回小屋 ──
  await page.evaluate(() => { waveSpawnQueue = 0; zombies.forEach(z => z.alive = false); zombies = []; try { clearWaveDlg(); } catch (e) {} });
  await page.waitForTimeout(2500); await log('wave cleared');
  await page.evaluate(() => { const c = document.querySelector('#perk-choice-list .perk-card'); if (c) c.click(); });
  await page.waitForTimeout(500); await log('perk picked');
  await page.evaluate(() => { player.x = 160; });  // 走到小屋门口
  await page.waitForTimeout(300); await log('at cabin door');
  await tapAct(); await page.waitForTimeout(800); await log('TAP act @cabin');
  await holdAct(4000); await page.waitForTimeout(3500); await log('HOLD act @cabin');
  await closeAll(); await page.waitForTimeout(600); await log('in hub');
  await closeAll(); await canMove('hub');

  // ── 床 ──
  await goStation('bed'); await tapAct(); await page.waitForTimeout(1200); await log('bed tapped');
  await page.evaluate(() => { const b = document.querySelector('#dream-cards-container [onclick], #dream-cards-container .dream-card, #dream-cards-container > *'); if (b) b.click(); });
  await page.waitForTimeout(3500); await log('dream picked');
  await closeAll(); await closeAll(); await canMove('after bed');

  // ── 据点管理 ──
  await goStation('manage'); await tapAct(); await page.waitForTimeout(1000); await log('manage open');
  await page.evaluate(() => { try { closeCabinUpgradeUI(); } catch (e) {} });
  await page.waitForTimeout(500); await log('manage closed'); await closeAll(); await canMove('after manage');

  // ── 扭蛋 ──
  await page.evaluate(() => { coins = 500; updateCoinUI(); });
  await goStation('gacha'); await tapAct(); await page.waitForTimeout(2500); await log('gacha');
  await page.evaluate(() => { try { if (typeof unboxActive !== 'undefined' && unboxActive) closeUnboxCard(true); } catch (e) {} });
  await page.waitForTimeout(500); await closeAll(); await canMove('after gacha');

  // ── 远征看板 ──
  await goStation('expedition'); await tapAct(); await page.waitForTimeout(1000); await log('expedition open');
  await page.evaluate(() => { try { closeExpeditionModal(); } catch (e) {} });
  await page.waitForTimeout(500); await closeAll(); await canMove('after expedition');

  // ── 餐厅：进去 → 打烊 → 回据点 ──
  await page.evaluate(() => { meatInventory.normal = 8; });
  await goStation('kitchen'); await tapAct(); await page.waitForTimeout(5000); await log('restaurant');
  await closeAll();
  await page.evaluate(() => { try { endRestaurantNight(); } catch (e) { console.log('endRest err ' + e.message); } });
  await page.waitForTimeout(2500); await log('restaurant end'); console.log('  end buttons: ' + await page.evaluate(() => [...document.querySelectorAll('#rest-end-scr button')].filter(b => b.offsetParent).map(b => b.textContent.trim().slice(0,14)).join(' | ')));
  await page.screenshot({ path: path.join(L.SHOTS, 'hub-rest-end.png') });
  await page.evaluate(() => { const b = [...document.querySelectorAll('#rest-end-scr button')].find(b => b.offsetParent && b.textContent.includes('出击')); if (b) b.click(); });
  await page.waitForTimeout(4000); await log('after rest end click');
  await closeAll(); await closeAll(); await canMove('back from restaurant');
  await page.screenshot({ path: path.join(L.SHOTS, 'hub-after-rest.png') });

  // ── 出击门 ──
  await goStation('gate'); await tapAct(); await page.waitForTimeout(6000); await log('gate → next wave');
  await closeAll(); await canMove('wave 2');
  console.log('page errors:', errs.length, ' stuck steps:', stuck);
  await browser.close();
  process.exit(errs.length || stuck ? 1 : 0);
})();
