// 真实触摸测试的公共部分：手机横屏 + 安卓 WebView 标识 + CDP 真实触摸。
// 用 JS 的 .click() 会绕过遮挡，测不出「按钮被盖住点不到」，所以这里一律用真实触摸。
const path = require('path');
const fs = require('fs');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }
const CHROME = process.env.CHROME_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
exports.GAME_URL = 'file://' + path.resolve(__dirname, '..', '..', 'dist', 'index.html');
exports.SHOTS = path.join(__dirname, 'shots');
fs.mkdirSync(exports.SHOTS, { recursive: true });

exports.open = async (opts = {}) => {
  const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
  const ctx = await browser.newContext({
    viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: opts.scale || 2,
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0 Mobile Safari/537.36 wv',
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(opts.url || exports.GAME_URL);
  await page.waitForFunction(() => window.__game && document.querySelector('#stage canvas'), null, { timeout: 15000 });
  await page.waitForTimeout(600);
  const cdp = await ctx.newCDPSession(page);
  const center = async (sel) => {
    const r = await page.evaluate((s) => { const el = document.querySelector(s); if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, w: b.width }; }, sel);
    if (!r || !r.w) throw new Error('看不到元素 ' + sel);
    return r;
  };
  const touch = (type, x, y, id = 1) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id }] });
  return {
    browser, page, errors, center, touch,
    /** 真实触摸点一下 */
    tap: async (sel) => { const c = await center(sel); await touch('touchStart', c.x, c.y); await page.waitForTimeout(60); await touch('touchEnd'); await page.waitForTimeout(250); },
    state: () => page.evaluate(() => { const g = window.__game, r = g.run; return { panel: g.panel(), phase: r.phase, day: r.day, tick: r.tick, hp: r.player.hp, x: Math.round(r.player.x), zombies: r.zombies.length, kills: r.kills, coins: r.coins, weapons: r.player.weapons.map((w) => w.id + w.star).join(','), target: r.targetId }; }),
    shot: (name) => page.screenshot({ path: path.join(exports.SHOTS, name + '.png') }),
  };
};
