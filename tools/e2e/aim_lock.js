// 手机瞄准回归：自动锁定 → 按住开火 → 往左拖手动瞄准 → 松手回到自动。截图在 tools/e2e/shots/。
// 用法：npm run build && node tools/e2e/aim_lock.js
const path = require('path');
const L = require('./lib.js');
(async () => {
  const browser = await L.launch(); const page = await L.phone(browser);
  page.on('pageerror', e => console.log('pageerror: ' + e.message));
  await L.intoCombat(page);
  await page.evaluate(() => { try { clearWaveDlg(); } catch (e) {} });
  // 等僵尸走进屏幕
  for (let i = 0; i < 30; i++) { if (await page.evaluate(() => !!aimLock)) break; await page.waitForTimeout(500); }
  const st = (l) => page.evaluate((l) => l + ' lock=' + (aimLock ? Math.round(aimLock.x) : '-') + ' lastMX=' + Math.round(lastMX) + ' facingR=' + player.facingRight + ' touchAim=' + JSON.stringify(touchAim) + ' kills=' + killCount, l);
  console.log(await st('idle'));
  await page.screenshot({ path: path.join(L.SHOTS, 'lock-idle.png') });
  const cdp = await page.context().newCDPSession(page);
  const r = await page.evaluate(() => { const b = document.getElementById('btn-fire').getBoundingClientRect(); return { x: b.left + b.width/2, y: b.top + b.height/2, w: b.width }; });
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  await touch('touchStart', r.x, r.y);
  await page.waitForTimeout(2500); console.log(await st('hold 2.5s'));
  await page.screenshot({ path: path.join(L.SHOTS, 'lock-fire.png') });
  await touch('touchMove', r.x - r.w * 0.45, r.y + 2);
  await page.waitForTimeout(500); console.log(await st('drag left'));
  await page.screenshot({ path: path.join(L.SHOTS, 'lock-left.png') });
  await touch('touchEnd'); await page.waitForTimeout(300); console.log(await st('released'));
  await browser.close();
})();
