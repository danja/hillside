import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  root: './src',
  publicDir: '../public',
  build: {
    outDir: '../dist-render',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        render: resolve(__dirname, 'src/render.html')
      }
    }
  }
});
