import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Aperçu local du module MRA FINDER.
 *
 * Port fixe (5175) : MRA-ERP occupe 5173/5174/8420, la copie ne doit jamais
 * servir l'application d'origine (ni l'inverse) — les deux serveurs peuvent
 * coexister sans ambiguïté.
 * Le rechargement à chaud (HMR) est celui de Vite : toute modification de
 * `src/**` recompile et rafraîchit la fenêtre sans redémarrage.
 */
export default defineConfig({
  publicDir: 'public',
  plugins: [react()],
  base: './',
  server: {
    port: 5175,
    strictPort: true,
    host: '127.0.0.1',
    open: false,
    hmr: { port: 5175 },
  },
  preview: {
    port: 5175,
    strictPort: true,
    host: '127.0.0.1',
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    cssCodeSplit: false,
    modulePreload: false,
  },
})
