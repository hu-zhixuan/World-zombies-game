import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// 产物是 dist/index.html 一个文件：引擎、素材、样式全部内嵌，安卓壳用 file:// 直接加载。
export default defineConfig({
  plugins: [preact(), viteSingleFile()],
  build: { target: 'es2020', assetsInlineLimit: 100_000_000, chunkSizeWarningLimit: 4000 },
  test: { include: ['tests/**/*.test.ts'] },
});
