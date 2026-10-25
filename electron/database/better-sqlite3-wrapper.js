const path = require('path')
const fs = require('fs')

// Singleton SQL.js module — initialised once synchronously by precompiling WASM
let SQL = null

// F-19 : une écriture disque qui échoue ne doit plus passer en silence. Un verrou
// transitoire (antivirus, indexation Windows, .tmp non relâché) est retenté un
// nombre BORNÉ de fois avant d'être signalé. Chaque nouvel essai réécrit le fichier
// temporaire puis retente le rename atomique.
const SAVE_MAX_ATTEMPTS = 3
const SAVE_RETRY_DELAY_MS = 25

// Attente synchrone courte (le wrapper est synchrone par conception). Atomics.wait
// bloque le thread courant sans brûler le CPU ; repli sur une boucle si indisponible.
function sleepSync(ms) {
  if (!(ms > 0)) return
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
  } catch {
    const end = Date.now() + ms
    while (Date.now() < end) { /* attente courte bornée */ }
  }
}

function initSync() {
  if (SQL) return
  const initSqlJs = require('sql.js')
  const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm')
  const wasmBinary = fs.readFileSync(wasmPath)
  const wasmModule = new WebAssembly.Module(wasmBinary)
  const wasmMemory = new WebAssembly.Memory({ initial: 256, maximum: 512 })
  const importObj = {
    env: {
      memory: wasmMemory,
      emscripten_GetProcAddress: () => 0,
      emscripten_memcpy: (dest, src, num) => { new Uint8Array(wasmMemory.buffer).set(new Uint8Array(wasmMemory.buffer, src, num), dest); return dest },
      emscripten_memset: (ptr, val, num) => { new Uint8Array(wasmMemory.buffer).fill(val, ptr, ptr + num); return ptr },
      emscripten_log: () => {},
      _emscripten_throw_longjmp: () => { throw new Error('longjmp') }
    },
    wasi_snapshot_preview1: {
      fd_write: () => 0,
      fd_close: () => 0,
      fd_seek: () => 0,
      fd_read: () => 0,
      proc_exit: () => {}
    }
  }
  try {
    const instance = new WebAssembly.Instance(wasmModule, importObj)
    const sql = instance.exports
    // sql.js must be loaded from file; fallback to async init
    throw new Error('Direct WASM not supported for full sql.js')
  } catch (e) {
    // Fallback: async init at warm-up
  }
}

function normalizeParams(args) {
  if (!args || args.length === 0) return undefined
  if (args.length === 1) {
    const v = args[0]
    if (v === null || v === undefined) return undefined
    if (Array.isArray(v) || (typeof v === 'object' && !(v instanceof Date))) return v
    return [v]
  }
  return args
}

class Statement {
  constructor(db, sql) {
    this.db = db
    this.sql = sql
  }
  run(...args) {
    if (!this.db._sqlJs) throw new Error('better-sqlite3-wrapper: Database not initialised')
    try {
      const params = normalizeParams(args)
      const head = this.sql.trim().toUpperCase().match(/^(BEGIN|COMMIT|ROLLBACK|END|SAVEPOINT|RELEASE)\b/)?.[1]
      // COMMIT/ROLLBACK : décrémenter _txDepth AVANT d'exécuter — sinon un COMMIT qui
      // échoue laisserait _txDepth bloqué >0 et désactiverait silencieusement toutes
      // les sauvegardes suivantes (pertes de données). Même ordre que exec().
      if (head === 'COMMIT' || head === 'ROLLBACK' || head === 'END' || head === 'RELEASE') {
        this.db._txDepth = Math.max(0, this.db._txDepth - 1)
      }
      if (params === undefined) {
        this.db._sqlJs.run(this.sql)
      } else if (Array.isArray(params)) {
        this.db._sqlJs.run(this.sql, params)
      } else {
        const stmt = this.db._sqlJs.prepare(this.sql)
        stmt.bind(params)
        while (stmt.step()) {}
        stmt.free()
      }
      const r = this.db._sqlJs.exec("SELECT last_insert_rowid() as id, changes() as changes")
      const row = r?.[0]?.values?.[0] || [0, 0]
      // Track transaction state so _save() (export) is skipped inside a transaction
      if (head === 'BEGIN' || head === 'SAVEPOINT') this.db._txDepth++
      if (head && head !== 'BEGIN' && head !== 'SAVEPOINT') {
        this.db._dirty = true
        this.db._save()
      } else if (!head) {
        this.db._dirty = true
        this.db._save()
      }
      return { changes: row[1] ?? 0, lastInsertRowid: row[0] ?? 0 }
    } catch (e) { throw new Error(e ? (e.message || e.toString()) : 'SQLite error') }
  }
  get(...args) {
    if (!this.db._sqlJs) throw new Error('better-sqlite3-wrapper: Database not initialised')
    try {
      const stmt = this.db._sqlJs.prepare(this.sql)
      const p = normalizeParams(args)
      if (p !== undefined) stmt.bind(p)
      if (stmt.step()) {
        const cols = stmt.getColumnNames()
        const vals = stmt.get()
        stmt.free()
        const row = {}
        for (let i = 0; i < cols.length; i++) row[cols[i]] = vals[i]
        return row
      }
      stmt.free()
      return undefined
    } catch (e) { throw new Error(e ? (e.message || e.toString()) : 'SQLite error') }
  }
  all(...args) {
    if (!this.db._sqlJs) throw new Error('better-sqlite3-wrapper: Database not initialised')
    try {
      const stmt = this.db._sqlJs.prepare(this.sql)
      const p = normalizeParams(args)
      if (p !== undefined) stmt.bind(p)
      const cols = stmt.getColumnNames()
      const rows = []
      while (stmt.step()) {
        const vals = stmt.get()
        const row = {}
        for (let i = 0; i < cols.length; i++) row[cols[i]] = vals[i]
        rows.push(row)
      }
      stmt.free()
      return rows
    } catch (e) { throw new Error(e ? (e.message || e.toString()) : 'SQLite error') }
  }
}

class Database {
  constructor(dbPath, options = {}) {
    this.dbPath = dbPath
    this._sqlJs = null
    this._ready = false
    this._dirty = false
    this._txDepth = 0
    this.memory = options.memory || false
    // F-19 : traçabilité + alerte des échecs d'écriture (jamais silencieux).
    this._lastSaveError = null
    this._lastSaveAttempts = 0
    this._consecutiveSaveFailures = 0
    this._closedWithUnsavedChanges = false
    this.onSaveError = null // callback(message) branché par la couche supérieure
  }
  // Called after constructor — synchronous once sql.js is ready
  _open() {
    if (this._ready && this._sqlJs) return
    if (!SQL) throw new Error('better-sqlite3-wrapper: sql.js not initialised. Call databaseInit.ready() first.')
    if (this.dbPath && fs.existsSync(this.dbPath)) {
      const buf = fs.readFileSync(this.dbPath)
      this._sqlJs = new SQL.Database(buf)
    } else {
      this._sqlJs = new SQL.Database()
    }
    // Fresh open = clean state. A stale _txDepth carried over from a previous
    // session (close during a transaction) would silently block every future
    // save -> data loss on disk while the app keeps running on memory.
    this._txDepth = 0
    this._dirty = false
    this._lastSaveError = null
    this._lastSaveAttempts = 0
    this._consecutiveSaveFailures = 0
    this._closedWithUnsavedChanges = false
    this._ready = true
  }
  // Signale un échec d'écriture sans jamais laisser le callback casser le flux.
  _notifySaveError(message) {
    if (typeof this.onSaveError !== 'function') return
    try { this.onSaveError(message) } catch { /* une alerte défaillante ne doit jamais bloquer */ }
  }
  _save() {
    if (!this._dirty || !this.dbPath || this.dbPath === ':memory:' || this.memory) return true
    // Don't persist an open transaction (sql.js export() breaks BEGIN/COMMIT)
    if (this._txDepth > 0) return true
    let attempt = 0
    let lastError = null
    while (attempt < SAVE_MAX_ATTEMPTS) {
      attempt++
      try {
        const data = this._sqlJs.export()
        const dir = path.dirname(this.dbPath)
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
        const tmpPath = this.dbPath + '.tmp'
        fs.writeFileSync(tmpPath, Buffer.from(data))
        fs.renameSync(tmpPath, this.dbPath)
        this._dirty = false
        this._lastSaveError = null
        this._lastSaveAttempts = attempt
        this._consecutiveSaveFailures = 0
        return true
      } catch (e) {
        lastError = e
        if (attempt < SAVE_MAX_ATTEMPTS) sleepSync(SAVE_RETRY_DELAY_MS)
      }
    }
    // Échec persistant : la donnée reste en mémoire (_dirty) et l'échec devient VISIBLE.
    this._lastSaveError = lastError ? (lastError.message || String(lastError)) : 'échec inconnu'
    this._lastSaveAttempts = attempt
    this._dirty = true
    this._consecutiveSaveFailures++
    console.error('[DB][CRITICAL] _save failed after ' + attempt + ' attempts — data lives in memory only:', this._lastSaveError)
    // Une seule alerte par épisode d'échec (pas de spam à chaque écriture).
    if (this._consecutiveSaveFailures === 1) this._notifySaveError(this._lastSaveError)
    return false
  }
  prepare(sql) {
    this._open()
    return new Statement(this, sql)
  }
  exec(sql) {
    this._open()
    const stmt = String(sql).trim()
    const head = stmt.toUpperCase().match(/^(BEGIN|COMMIT|ROLLBACK|END|SAVEPOINT|RELEASE)\b/)?.[1]
    if (head === 'BEGIN' || head === 'SAVEPOINT') {
      this._txDepth++
      this._sqlJs.exec(sql)
      return
    }
    if (head === 'COMMIT' || head === 'END') {
      this._txDepth = Math.max(0, this._txDepth - 1)
      this._sqlJs.exec(sql)
      this._save()
      return
    }
    if (head === 'ROLLBACK' || head === 'RELEASE') {
      this._txDepth = Math.max(0, this._txDepth - 1)
      this._sqlJs.exec(sql)
      this._save()
      return
    }
    this._sqlJs.exec(sql)
    if (!/^\s*(CREATE|ALTER|DROP)\b/i.test(String(sql))) {
      this._dirty = true
      this._save()
    }
  }
  // API better-sqlite3 : db.transaction(fn) renvoie une fonction qui exécute fn
  // sous BEGIN/COMMIT et annule tout si fn lève une exception.
  //
  // Le connecteur réel possède cette méthode, notre connecteur de remplacement
  // ne l'avait pas : les quatre gestes qui l'appellent (émission de points,
  // carte cadeau, mouvement de stock, inventaire) levaient donc
  // « db.transaction is not a function » et l'écriture n'avait JAMAIS lieu.
  transaction(fn) {
    const db = this
    return (...args) => {
      // Déjà dans une transaction : le gestionnaire englobant décide du
      // COMMIT/ROLLBACK. Un BEGIN imbriqué est refusé par SQLite.
      if (db._txDepth > 0) return fn(...args)
      db.exec('BEGIN')
      try {
        const r = fn(...args)
        db.exec('COMMIT')
        return r
      } catch (e) {
        try { db.exec('ROLLBACK') } catch (_) { /* déjà annulé */ }
        throw e
      }
    }
  }
  pragma(key, options) {
    this._open()
    const simple = options?.simple === true
    const row = this._sqlJs.exec(`PRAGMA ${key}`)
    const val = row?.[0]?.values?.[0]?.[0]
    return simple ? val : { [key]: val }
  }
  close() {
    if (this._sqlJs) {
      // Dernière chance d'écrire l'état mémoire avant de fermer.
      this._save()
      if (this._dirty) {
        // Fermeture avec des modifications non écrites : jamais en silence.
        this._closedWithUnsavedChanges = true
        this._notifySaveError('Fermeture avec modifications non sauvegardées : ' + (this._lastSaveError || 'transaction active ou disque verrouillé'))
      }
      this._sqlJs.close()
      this._sqlJs = null
    }
    this._ready = false
  }
  backup(destPath) {
    this._open()
    if (this._txDepth > 0) throw new Error('Backup impossible pendant une transaction active')
    const dir = path.dirname(destPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    const data = this._sqlJs.export()
    fs.writeFileSync(destPath, Buffer.from(data))
  }
  run(_sql, _params) {
    this._open()
    const r = this.prepare(_sql).run(_params)
    this._save()
    return r
  }
  get(_sql, _params) {
    this._open()
    return this.prepare(_sql).get(_params)
  }
  all(_sql, _params) {
    this._open()
    return this.prepare(_sql).all(_params)
  }
}

// Shared init module — starts sql.js eagerly, exposes ready() as a sync barrier
const databaseInit = (() => {
  let ready = false
  const sqlPromise = require('sql.js')().then(sql => {
    SQL = sql
    ready = true
  })
  return {
    isReady: () => ready,
    ready: () => {
      if (ready) return
      throw new Error('sql.js not ready yet — call await databaseInit.wait() before initDatabase()')
    },
    wait: () => sqlPromise
  }
})()

Database._init = databaseInit
module.exports = Database
