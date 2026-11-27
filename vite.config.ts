import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// 操作画面（control.html）と表示画面（display.html）の2エントリ。GitHub Pages 配下でも動くよう相対パス。
export default defineConfig({
  base: './',
  build: {
    assetsInlineLimit: 0, // フォントを必ず同梱ファイルとして出力（オフライン動作）
    rollupOptions: {
      input: {
        control: resolve(__dirname, 'control.html'),
        display: resolve(__dirname, 'display.html'),
      },
    },
  },
});
