// 阶段 1a 验证门槛：由 src/ 构建的产物必须与 archive/zombie-game-v55.html 逐字节一致
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { build } = require('../build.js');
const ROOT = path.join(__dirname, '..');
const tmp = path.join(ROOT, 'dist', '_verify_tmp.html');
const built = build(tmp);
const orig = fs.readFileSync(path.join(ROOT, 'archive', 'zombie-game-v55.html'), 'utf8');
const h = s => crypto.createHash('sha256').update(s).digest('hex');
fs.unlinkSync(tmp);
if (built === orig) { console.log('[PASS] 构建产物与 v55 逐字节一致', h(built).slice(0, 16)); process.exit(0); }
let i = 0; while (i < built.length && built[i] === orig[i]) i++;
console.error('[FAIL] 首个差异位置 char', i, '\nbuilt:', JSON.stringify(built.slice(i, i + 60)), '\norig :', JSON.stringify(orig.slice(i, i + 60)));
process.exit(1);
