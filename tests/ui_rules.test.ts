// 界面规矩靠机器守：不许行内样式，颜色只能取自 tokens.css，不许 emoji。
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { PALETTE } from '../src/ui/palette';

const read = (...p: string[]) => readFileSync(join(__dirname, '..', 'src', ...p), 'utf8');
const files = (dir: string, ext: RegExp) => readdirSync(join(__dirname, '..', 'src', dir)).filter((f) => ext.test(f)).map((f) => [dir + '/' + f, read(dir, f)] as const);
const tokens = read('ui', 'tokens.css');
const tokenColor = (name: string) => parseInt(tokens.match(new RegExp(`--${name}: #([0-9a-f]{6})`))![1], 16);

test('界面代码里没有行内样式', () => {
  for (const [name, src] of files('ui', /\.tsx$/)) expect(src, name).not.toMatch(/\bstyle=/);
});
test('颜色只在 tokens.css 里定义', () => {
  for (const [name, src] of [...files('ui', /\.(tsx|css)$/), ...files('view', /\.ts$/), ...files('app', /\.tsx?$/)]) {
    if (name.endsWith('tokens.css')) continue;
    expect(src, name).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|0x[0-9a-fA-F]{6}\b/);
  }
});
test('画面层的调色板和 tokens.css 一致', () => {
  for (const [key, value] of Object.entries(PALETTE)) expect(value, key).toBe(tokenColor(key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())));
});
test('界面和内容表里没有 emoji（图标一律用图标素材）', () => {
  const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u;
  for (const [name, src] of [...files('ui', /\.tsx$/), ...files('content', /\.ts$/)]) expect(src.replace(/★/g, ''), name).not.toMatch(emoji);
});
