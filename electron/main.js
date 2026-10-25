// Hôte Electron MRA-Finder v2 — moteur + handlers étendus

const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')

const Database = require('./database/better-sqlite3-wrapper')
const { ensureFinderCatalog } = require('./database/finder-schema')

const VITE_URL = process.env.MRA_FINDER_URL || 'http://localhost:5175'
const DATA_DIR = path.join(__dirname, '..', 'data')
const DB_PATH = path.join(DATA_DIR, 'finder-dev.db')
const AUDIT_PATH = path.join(DATA_DIR, 'finder-audit.jsonl')

const safeError = (e) => ({ ok: false, error: 'Une erreur est survenue', detail: e?.message || '' })

let db = null

const auditLog = {
  logActivity(entry) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true })
      fs.appendFileSync(AUDIT_PATH, JSON.stringify({ at: new Date().toISOString(), ...entry }) + '\n', 'utf8')
    } catch (e) { console.error('[FINDER][AUDIT]', e?.message || e) }
  },
}

function registerFinderIpc() {
  const finder = () => require('./services/finder')
  const finderImport = () => require('./services/finder-import')

  ipcMain.handle('finder:stats', () => {
    try { return { ok: true, stats: finder().stats(db) } } catch (e) { return safeError(e) }
  })
  ipcMain.handle('finder:search', (_, params) => {
    try { return { ok: true, result: finder().search(db, params || {}) } } catch (e) { return safeError(e) }
  })
  ipcMain.handle('finder:suggest', (_, params) => {
    try { return { ok: true, ...finder().suggest(db, params || {}) } } catch (e) { return safeError(e) }
  })
  ipcMain.handle('finder:brands', (_, params) => {
    try { return { ok: true, result: finder().listBrands(db, params || {}) } } catch (e) { return safeError(e) }
  })
  ipcMain.handle('finder:brand', (_, params) => {
    try { return { ok: true, brand: finder().getBrand(db, params || {}) } } catch (e) { return safeError(e) }
  })
  ipcMain.handle('finder:devices', (_, params) => {
    try { return { ok: true, result: finder().listDevices(db, params || {}) } } catch (e) { return safeError(e) }
  })
  ipcMain.handle('finder:device', (_, id) => {
    try {
      const device = finder().getDevice(db, id)
      if (!device) return { ok: false, error: 'NOT_FOUND' }
      return { ok: true, device }
    } catch (e) { return safeError(e) }
  })
  ipcMain.handle('finder:part', (_, id) => {
    try {
      const part = finder().getPart(db, id)
      if (!part) return { ok: false, error: 'NOT_FOUND' }
      return { ok: true, part }
    } catch (e) { return safeError(e) }
  })
  ipcMain.handle('finder:ic', (_, id) => {
    try {
      const ic = finder().getIc(db, id)
      if (!ic) return { ok: false, error: 'NOT_FOUND' }
      return { ok: true, ic }
    } catch (e) { return safeError(e) }
  })
  ipcMain.handle('finder:import', (_, params) => {
    try {
      const report = finderImport().importParts(db, params || {})
      if (report.ok) {
        auditLog.logActivity({
          action: 'finder_import', entityType: 'finder', entityId: report.batchId,
          details: `Import ${String((params && params.format) || '?')} : ${report.inserted} ajoutée(s), ${report.updated} màj, ${report.skipped} ignorée(s), ${report.rejected} rejetée(s)`,
        })
      }
      return report
    } catch (e) { return safeError(e) }
  })
  // V2 — récupération & santé
  ipcMain.handle('finder:export', (_, params) => {
    try { return finder().exportData(db, params || {}) } catch (e) { return safeError(e) }
  })
  ipcMain.handle('finder:importHistory', (_, params) => {
    try { return finder().importHistory(db, params || {}) } catch (e) { return safeError(e) }
  })
  ipcMain.handle('finder:health', () => {
    try { return finder().healthCheck(db) } catch (e) { return safeError(e) }
  })
  ipcMain.handle('finder:recentParts', (_, params) => {
    try { return finder().recentParts(db, params || {}) } catch (e) { return safeError(e) }
  })
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440, height: 960,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  })
  const distIndex = path.join(__dirname, '..', 'dist', 'index.html')
  const load = async () => {
    for (let attempt = 0; attempt < 60; attempt++) {
      try { await win.loadURL(VITE_URL); return } catch { await new Promise(r => setTimeout(r, 500)) }
    }
    if (fs.existsSync(distIndex)) { await win.loadFile(distIndex); return }
    throw new Error('Serveur Vite introuvable sur ' + VITE_URL + ' et aucun build dans dist/')
  }
  void load().catch((error) => { console.error('[FINDER]', error?.message || error) })
  return win
}

app.whenReady().then(async () => {
  await Database._init.wait()
  fs.mkdirSync(DATA_DIR, { recursive: true })
  db = new Database(DB_PATH)
  db._open()
  ensureFinderCatalog(db)
  registerFinderIpc()
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
