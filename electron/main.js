// Hôte Electron de la copie MRA-Finder.
//
// Rôle : donner au renderer le MÊME pont que dans MRA-ERP, avec le MÊME moteur.
//   - `electron/services/finder.js`       (copié verbatim depuis MRA-ERP)
//   - `electron/services/finder-import.js` (copié verbatim)
//   - `electron/database/finder-schema.js` (copié verbatim : tables + seed + index)
//   - `electron/database/better-sqlite3-wrapper.js` (copié verbatim : sql.js WASM)
//   - les 9 handlers `finder:*` de `MRA-ERP/electron/main.js:1706-1779` (verbatim)
//
// Base de développement DISTINCTE : `<repertoire>/data/finder-dev.db`.
// La base de production de MRA-ERP (`%APPDATA%\mra-erp\mra-erp.db`) n'est jamais
// ouverte, ni lue, ni référencée ici.
const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')

const Database = require('./database/better-sqlite3-wrapper')
const { ensureFinderCatalog } = require('./database/finder-schema')

const VITE_URL = process.env.MRA_FINDER_URL || 'http://localhost:5175'
const DATA_DIR = path.join(__dirname, '..', 'data')
const DB_PATH = path.join(DATA_DIR, 'finder-dev.db')
const AUDIT_PATH = path.join(DATA_DIR, 'finder-audit.jsonl')

// Copié verbatim de MRA-ERP/electron/main.js:853.
const safeError = (e) => ({ error: 'Une erreur est survenue' })

let db = null

// La copie n'a ni table `activity_log` ni service `audit-log` de MRA-ERP :
// l'écriture d'audit de l'import part dans un journal JSONL local, dans `data/`.
const auditLog = {
  logActivity(entry) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true })
      fs.appendFileSync(
        AUDIT_PATH,
        JSON.stringify({ at: new Date().toISOString(), ...entry }) + '\n',
        'utf8',
      )
    } catch (e) {
      console.error('[FINDER][AUDIT]', e && e.message ? e.message : e)
    }
  },
}

// --- Handlers IPC — copiés verbatim de MRA-ERP/electron/main.js:1702-1779 ----
// Aucun de ces canaux n'écrit : la première tranche est consultative. Les
// valeurs absentes ne sont pas remplacées, elles sont renvoyées telles quelles
// (NULL) pour que l'interface dise ce qui manque.
function registerFinderIpc() {
  ipcMain.handle('finder:stats', () => {
    try {
      return { ok: true, stats: require('./services/finder').stats(db) }
    } catch (e) { return safeError(e) }
  })

  ipcMain.handle('finder:search', (_, params) => {
    try {
      return { ok: true, result: require('./services/finder').search(db, params || {}) }
    } catch (e) { return safeError(e) }
  })

  ipcMain.handle('finder:brands', (_, params) => {
    try {
      return { ok: true, result: require('./services/finder').listBrands(db, params || {}) }
    } catch (e) { return safeError(e) }
  })

  ipcMain.handle('finder:brand', (_, params) => {
    try {
      return { ok: true, brand: require('./services/finder').getBrand(db, params || {}) }
    } catch (e) { return safeError(e) }
  })

  ipcMain.handle('finder:devices', (_, params) => {
    try {
      return { ok: true, result: require('./services/finder').listDevices(db, params || {}) }
    } catch (e) { return safeError(e) }
  })

  ipcMain.handle('finder:device', (_, id) => {
    try {
      const device = require('./services/finder').getDevice(db, id)
      if (!device) return { ok: false, error: 'NOT_FOUND' }
      return { ok: true, device }
    } catch (e) { return safeError(e) }
  })

  ipcMain.handle('finder:part', (_, id) => {
    try {
      const part = require('./services/finder').getPart(db, id)
      if (!part) return { ok: false, error: 'NOT_FOUND' }
      return { ok: true, part }
    } catch (e) { return safeError(e) }
  })

  ipcMain.handle('finder:ic', (_, id) => {
    try {
      const ic = require('./services/finder').getIc(db, id)
      if (!ic) return { ok: false, error: 'NOT_FOUND' }
      return { ok: true, ic }
    } catch (e) { return safeError(e) }
  })

  // Import de références : SEUL canal Finder qui écrit. Il n'accepte que des
  // statuts « declared » ou « unverified » — une compatibilité confirmée ne
  // peut pas entrer par un fichier.
  ipcMain.handle('finder:import', (_, params) => {
    try {
      const report = require('./services/finder-import').importParts(db, params || {})
      if (report.ok) {
        auditLog.logActivity({
          action: 'finder_import',
          entityType: 'finder',
          entityId: report.batchId,
          details:
            'Import ' + String((params && params.format) || '?') +
            ' : ' + report.inserted + ' ajoutée(s), ' + report.updated + ' mise(s) à jour, ' +
            report.skipped + ' ignorée(s), ' + report.rejected + ' rejetée(s)',
        })
      }
      return report
    } catch (e) { return safeError(e) }
  })
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 960,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  const distIndex = path.join(__dirname, '..', 'dist', 'index.html')
  const load = async () => {
    // Dev : le serveur Vite peut démarrer après Electron — on attend qu'il réponde.
    for (let attempt = 0; attempt < 60; attempt++) {
      try {
        await win.loadURL(VITE_URL)
        return
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    }
    // Repli : le build statique, s'il existe (npm run build puis npm run app).
    if (fs.existsSync(distIndex)) {
      await win.loadFile(distIndex)
      return
    }
    throw new Error('Serveur Vite introuvable sur ' + VITE_URL + ' et aucun build dans dist/')
  }

  void load().catch((error) => {
    console.error('[FINDER]', error && error.message ? error.message : error)
  })
  return win
}

app.whenReady().then(async () => {
  // sql.js (WASM) doit être chargé avant la première ouverture de la base.
  await Database._init.wait()
  fs.mkdirSync(DATA_DIR, { recursive: true })
  db = new Database(DB_PATH)
  db._open()
  // Crée les 17 tables `finder_*`, graine la taxonomie, les marques et le
  // catalogue de départ (seed du dépôt), puis reconstruit l'index de recherche
  // s'il est périmé. Idempotent : une base existante n'est jamais écrasée.
  ensureFinderCatalog(db)

  registerFinderIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
