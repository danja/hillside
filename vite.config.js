import { defineConfig } from 'vite'

export default defineConfig({
  base: '/hillside/dist/',
  root: './src',
  publicDir: '../public',
  build: {
    outDir: '../dist',
    emptyOutDir: true
  },
  test: {
    globals: true,
    environment: 'jsdom'
  }
})