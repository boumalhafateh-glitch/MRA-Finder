import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  publicDir: 'public',
  plugins: [react()],
  base: './',
  server: {
    port: 5175,
    strictPort: true,
    host: '0.0.0.0',
    open: false,
    hmr: { port: 5175 },
  },
  preview: {
    port: 5175,
    strictPort: true,
    host: '0.0.0.0',
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    cssCodeSplit: false,
    modulePreload: false,
  },
})
