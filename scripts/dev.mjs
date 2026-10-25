// Démarre l'aperçu local en une commande : serveur Vite (renderer) puis
// application Electron (moteur Finder + base de développement).
//   npm start        -> http://localhost:5174 + fenêtre Electron
//   MRA_FINDER_URL=… -> cible une autre URL de renderer
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const url = process.env.MRA_FINDER_URL || 'http://localhost:5175'

const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js')
const vite = spawn(process.execPath, [viteBin], { cwd: root, stdio: 'inherit' })

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function waitForRenderer(attempts = 80) {
  for (let i = 0; i < attempts; i++) {
    try {
      const response = await fetch(url)
      if (response.ok) return true
    } catch {
      // serveur pas encore prêt
    }
    await wait(500)
  }
  return false
}

const ready = await waitForRenderer()
if (!ready) {
  console.error('[MRA-FINDER] Serveur Vite introuvable sur ' + url)
  vite.kill()
  process.exit(1)
}

// require('electron') renvoie le chemin du binaire — pas de npx, pas de shell.
const electronBin = require('electron')
const electron = spawn(electronBin, ['.'], { cwd: root, stdio: 'inherit', env: process.env })

const stop = () => {
  if (!electron.killed) electron.kill()
  if (!vite.killed) vite.kill()
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
electron.on('exit', () => {
  if (!vite.killed) vite.kill()
  process.exit(0)
})
vite.on('exit', (code) => {
  if (!electron.killed) electron.kill()
  process.exit(code || 0)
})
