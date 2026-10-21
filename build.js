// 构建脚本：把 src/ 拼成单个 HTML。纯拼接（不使用 String.replace，避免 `$` 特殊替换），
// 保持全局作用域语义不变（所有 JS 仍在同一个 <script> 里）。
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');

function fill(tpl, marker, content) {
  const i = tpl.indexOf(marker);
  if (i < 0) throw new Error('marker not found: ' + marker);
  return tpl.slice(0, i) + content + tpl.slice(i + marker.length);
}

function build(outFile) {
  const order = JSON.parse(fs.readFileSync(path.join(SRC, 'js', '_order.json'), 'utf8'));
  const js = order.map(f => fs.readFileSync(path.join(SRC, 'js', f), 'utf8')).join('');
  let html = fs.readFileSync(path.join(SRC, 'index.template.html'), 'utf8');
  html = fill(html, '/*@@STYLE1@@*/', fs.readFileSync(path.join(SRC, 'style1.css'), 'utf8'));
  html = fill(html, '/*@@STYLE2@@*/', fs.readFileSync(path.join(SRC, 'style2.css'), 'utf8') + '\n' + fs.readFileSync(path.join(SRC, 'style_phone.css'), 'utf8'));
  html = fill(html, '/*@@SCRIPT@@*/', js);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, html);
  return html;
}

if (require.main === module) {
  const out = process.argv[2] || path.join(ROOT, 'dist', 'zombie-game-v56.html');
  const html = build(out);
  console.log('built', path.relative(ROOT, out), html.length, 'chars');
}
module.exports = { build };
