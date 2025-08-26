import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ command, mode }) => {
  // Load env file based on `mode` in the current directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    base: command === 'build' ? '/hillside/' : '/',
    root: './src',
    publicDir: '../public',
    build: {
      outDir: '../dist',
      emptyOutDir: true
    },
    server: {
      port: 3000
    },
    preview: {
      port: 3000
    },
    test: {
      globals: true,
      environment: 'jsdom'
    }
  }
})