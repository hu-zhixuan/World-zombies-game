// 真机式回归脚本的公共部分：手机横屏 + 安卓 WebView UA + 真实触摸（CDP）。
// 单元测试（test_suite.js）用的是假 DOM，看不出「层盖住了操作」这类问题，所以另外留这套脚本。
const path = require('path');
const fs = require('fs');
let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }
const CHROME = process.env.CHROME_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
exports.GAME_URL = 'file://' + path.resolve(__dirname, '..', '..', 'dist', 'zombie-game-v56.html');
exports.SHOTS = path.join(__dirname, 'shots');
fs.mkdirSync(exports.SHOTS, { recursive: true });
exports.phone = async (browser) => {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0 Mobile Safari/537.36 wv' });
  return ctx.newPage();
};
exports.launch = () => chromium.launch(CHROME ? { executablePath: CHROME } : {});
// 开新局 → 跳过剧情 → 选第 1 个流派 → 跳过教程 → 等到刷怪
exports.intoCombat = async (page, url = exports.GAME_URL) => {
  await page.goto(url); await page.waitForTimeout(800);
  await page.evaluate(() => startGame());
  for (let i = 0; i < 40; i++) { if (!(await page.evaluate(()=>cinActive))) break; await page.evaluate(()=>{ try{skipCinematic()}catch(e){ document.getElementById('cinematic-scr').click() } }); await page.waitForTimeout(400); }
  await page.waitForTimeout(400);
  await page.evaluate(() => { const c = document.querySelector('#perk-choice-list [data-class]'); if (c) c.click(); });
  await page.waitForTimeout(400);
  await page.evaluate(() => { const b = document.getElementById('tut-skip-btn'); if (b) b.click(); });
  for (let i = 0; i < 30; i++) { const s = await page.evaluate(()=>wavePhase); if (s === 'spawning') break; await page.evaluate(()=>{ try{ if(cinActive) skipCinematic(); if(window._waveDlgActive) clearWaveDlg(); }catch(e){} }); await page.waitForTimeout(500); }
  await page.waitForTimeout(1500);
};
