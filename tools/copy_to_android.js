// 把电脑版构建产物拷成安卓工程的页面：dist/zombie-game-v56.html -> android/app/src/main/assets/index.html
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const src = path.join(ROOT, 'dist', 'zombie-game-v56.html');
const dst = path.join(ROOT, 'android', 'app', 'src', 'main', 'assets', 'index.html');
if (!fs.existsSync(src)) throw new Error('先运行 npm run build 生成 ' + src);
fs.mkdirSync(path.dirname(dst), { recursive: true });
fs.copyFileSync(src, dst);
console.log('copied ->', path.relative(ROOT, dst));
