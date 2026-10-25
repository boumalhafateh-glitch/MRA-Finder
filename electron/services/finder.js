// MRA FINDER — moteur de recherche v2 (lecture + récupération avancée)
// Ajouts V2: suggestions, fuzzy, cache, export, historique — sans casser l'API v1.

const { normalizeText, tokenize } = require('../database/finder-schema')

const SEARCH_KINDS = new Set(['device', 'brand', 'part', 'ic'])

function clampInt(value, min, max, fallback) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(n)))
}

function tokensOf(query) {
  return tokenize(query)
}

function likePrefix(token) {
  return token.replace(/[%_]/g, '') + '%'
}

// ── Levenshtein distance (pour fuzzy / typo tolérance) ──
function levenshtein(a, b) {
  const al = a.length, bl = b.length
  if (al === 0) return bl
  if (bl === 0) return al
  const prev = new Array(bl + 1)
  const curr = new Array(bl + 1)
  for (let j = 0; j <= bl; j++) prev[j] = j
  for (let i = 1; i <= al; i++) {
    curr[0] = i
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
    }
    for (let j = 0; j <= bl; j++) prev[j] = curr[j]
  }
  return prev[bl]
}

function fuzzyMatch(token, candidates) {
  // Retourne les tokens proches (distance <= 1 pour <=4 chars, <=2 sinon)
  const maxDist = token.length <= 4 ? 1 : 2
  const matches = []
  for (const c of candidates) {
    if (c === token) { matches.push({ token: c, dist: 0 }); continue }
    const d = levenshtein(token, c)
    if (d <= maxDist) matches.push({ token: c, dist: d })
  }
  return matches.sort((a, b) => a.dist - b.dist)
}

/**
 * Recherche par préfixe + fuzzy fallback sur les jetons indexés.
 * Plusieurs mots = intersection (tous les mots doivent correspondre).
 */
function search(db, params = {}) {
  const query = String(params.q || '').trim()
  const page = clampInt(params.page, 1, 10000, 1)
  const pageSize = clampInt(params.pageSize, 1, 100, 20)
  const kindFilter = SEARCH_KINDS.has(params.kind) ? params.kind : ''
  const sortBy = params.sort || 'relevance' // relevance | name | brand

  if (!query) {
    return { total: 0, page, pageSize, items: [], mode: 'empty' }
  }

  const tokens = tokensOf(query)
  if (tokens.length === 0) {
    return { total: 0, page, pageSize, items: [], mode: 'empty' }
  }

  const scores = new Map()
  // Cache de tous les tokens distincts pour fuzzy (une seule requête)
  let allTokensCache = null
  function getAllTokens() {
    if (allTokensCache) return allTokensCache
    const rows = db.prepare('SELECT DISTINCT token FROM finder_search_tokens').all()
    allTokensCache = rows.map(r => r.token)
    return allTokensCache
  }

  for (const token of tokens) {
    const like = likePrefix(token)
    let rows = db
      .prepare(
        `SELECT kind, ref_id, MAX(weight) AS weight
           FROM finder_search_tokens
          WHERE token LIKE ?
            ${kindFilter ? 'AND kind = ?' : ''}
          GROUP BY kind, ref_id`,
      )
      .all(...(kindFilter ? [like, kindFilter] : [like]))

    // Fallback fuzzy si aucun résultat exact pour ce token
    if (rows.length === 0 && token.length >= 3) {
      const candidates = getAllTokens()
      const fuzzyTokens = fuzzyMatch(token, candidates)
      for (const f of fuzzyTokens.slice(0, 5)) {
        const fRows = db
          .prepare(
            `SELECT kind, ref_id, MAX(weight) AS weight
               FROM finder_search_tokens WHERE token = ?
               ${kindFilter ? 'AND kind = ?' : ''}
             GROUP BY kind, ref_id`
          )
          .all(...(kindFilter ? [f.token, kindFilter] : [f.token]))
        for (const r of fRows) {
          // Pénalité fuzzy : poids réduit selon distance
          r.weight = Math.max(1, r.weight - f.dist)
          rows.push(r)
        }
      }
    }

    for (const row of rows) {
      const key = row.kind + ':' + row.ref_id
      const entry = scores.get(key) || { kind: row.kind, refId: row.ref_id, score: 0, hits: 0 }
      entry.score += row.weight
      entry.hits += 1
      scores.set(key, entry)
    }
  }

  // Seules les entités qui contiennent TOUS les mots restent
  let matched = Array.from(scores.values()).filter((entry) => entry.hits === tokens.length)

  // Si aucun match exact multi-mots, fallback OR : au moins un mot
  if (matched.length === 0 && tokens.length > 1) {
    matched = Array.from(scores.values()).sort((a, b) => b.hits - a.hits || b.score - a.score).slice(0, 100)
  }

  const exact = normalizeText(query)
  const enriched = matched.map((entry) => {
    const row = db
      .prepare('SELECT title, subtitle FROM finder_search WHERE kind = ? AND ref_id = ?')
      .get(entry.kind, entry.refId)
    const title = row ? row.title : ''
    const titleNorm = normalizeText(title)
    let bonus = 0
    if (titleNorm === exact) bonus = 8
    else if (titleNorm.startsWith(exact)) bonus = 4
    else if (titleNorm.includes(exact)) bonus = 2
    // Bonus mots complets dans le titre
    for (const tok of tokens) {
      if (titleNorm.split(' ').includes(tok)) bonus += 0.5
    }
    return { ...entry, title, subtitle: row ? row.subtitle : '', score: entry.score + bonus }
  })

  if (sortBy === 'name') {
    enriched.sort((a, b) => a.title.localeCompare(b.title))
  } else if (sortBy === 'brand') {
    enriched.sort((a, b) => (a.subtitle || '').localeCompare(b.subtitle || '') || a.title.localeCompare(b.title))
  } else {
    enriched.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
  }

  const total = enriched.length
  const start = (page - 1) * pageSize
  const pageEntries = enriched.slice(start, start + pageSize)

  return {
    total,
    page,
    pageSize,
    mode: 'tokens',
    items: pageEntries.map((entry) => hydrate(db, entry)),
  }
}

// ── Suggestions / autocomplete ──
function suggest(db, params = {}) {
  const q = String(params.q || '').trim()
  const limit = clampInt(params.limit, 1, 20, 8)
  if (!q || q.length < 1) return { items: [] }
  const norm = normalizeText(q)
  const like = '%' + norm.replace(/[%_]/g, '') + '%'

  // Recherche directe dans finder_search (title + norm)
  const rows = db
    .prepare(
      `SELECT kind, ref_id, title, subtitle FROM finder_search
       WHERE norm LIKE ? OR title LIKE ?
       ORDER BY title COLLATE NOCASE LIMIT ?`
    )
    .all(like, '%' + q + '%', limit)

  // Déduplication + enrichissement léger
  const seen = new Set()
  const items = []
  for (const r of rows) {
    const key = r.kind + ':' + r.ref_id
    if (seen.has(key)) continue
    seen.add(key)
    items.push({ kind: r.kind, id: r.ref_id, title: r.title, subtitle: r.subtitle || '' })
  }
  return { items }
}

function hydrate(db, entry) {
  if (entry.kind === 'brand') {
    const brand = db
      .prepare(
        `SELECT b.id, b.name, b.slug, b.logo_path,
                (SELECT COUNT(*) FROM finder_devices d WHERE d.brand_id = b.id) AS device_count
           FROM finder_brands b WHERE b.id = ?`,
      )
      .get(entry.refId)
    return { kind: 'brand', id: entry.refId, title: entry.title, brand }
  }
  if (entry.kind === 'device') {
    const device = db
      .prepare(
        `SELECT d.id, d.commercial_name, d.model_ref, d.release_year, d.image_path,
                b.name AS brand_name, b.id AS brand_id
           FROM finder_devices d JOIN finder_brands b ON b.id = d.brand_id
          WHERE d.id = ?`,
      )
      .get(entry.refId)
    return { kind: 'device', id: entry.refId, title: entry.title, device }
  }
  if (entry.kind === 'part') {
    const part = db
      .prepare(
        `SELECT p.id, p.name, p.oem_ref, p.part_type, p.confidence,
                c.name AS category_name, c.slug AS category_slug
           FROM finder_parts p LEFT JOIN finder_categories c ON c.id = p.category_id
          WHERE p.id = ?`,
      )
      .get(entry.refId)
    return { kind: 'part', id: entry.refId, title: entry.title, part }
  }
  const ic = db
    .prepare(
      `SELECT id, ref, marking, manufacturer, function, family, package
         FROM finder_ics WHERE id = ?`,
    )
    .get(entry.refId)
  return { kind: 'ic', id: entry.refId, title: entry.title, ic }
}

/** Compteurs réels — avec cache mémoire 2s pour éviter surcharge */
let _statsCache = null
let _statsCacheAt = 0
function stats(db) {
  const now = Date.now()
  if (_statsCache && now - _statsCacheAt < 2000) return _statsCache

  const one = (sql) => {
    const row = db.prepare(sql).get()
    return row ? row.c : 0
  }
  const compatByStatus = {}
  for (const row of db
    .prepare('SELECT status, COUNT(*) AS c FROM finder_compatibilities GROUP BY status')
    .all()) {
    compatByStatus[row.status] = row.c
  }
  const result = {
    brands: one('SELECT COUNT(*) AS c FROM finder_brands'),
    devices: one('SELECT COUNT(*) AS c FROM finder_devices'),
    device_aliases: one('SELECT COUNT(*) AS c FROM finder_device_aliases'),
    categories: one('SELECT COUNT(*) AS c FROM finder_categories'),
    parts: one('SELECT COUNT(*) AS c FROM finder_parts'),
    part_refs: one('SELECT COUNT(*) AS c FROM finder_part_refs'),
    compatibilities: one('SELECT COUNT(*) AS c FROM finder_compatibilities'),
    compatibilities_by_status: compatByStatus,
    ics: one('SELECT COUNT(*) AS c FROM finder_ics'),
    ic_equivalences: one('SELECT COUNT(*) AS c FROM finder_ic_equivalences'),
    ic_devices: one('SELECT COUNT(*) AS c FROM finder_ic_devices'),
    media: one('SELECT COUNT(*) AS c FROM finder_media'),
    import_batches: one('SELECT COUNT(*) AS c FROM finder_import_batches'),
    last_import: db
      .prepare(
        `SELECT connector, status, inserted, updated, skipped, errors, finished_at
           FROM finder_import_batches ORDER BY id DESC LIMIT 1`,
      )
      .get() || null,
    devices_without_model_ref: one(
      "SELECT COUNT(*) AS c FROM finder_devices WHERE model_ref IS NULL OR model_ref = ''",
    ),
    devices_without_year: one('SELECT COUNT(*) AS c FROM finder_devices WHERE release_year IS NULL'),
    devices_without_image: one(
      "SELECT COUNT(*) AS c FROM finder_devices WHERE image_path IS NULL OR image_path = ''",
    ),
  }
  _statsCache = result
  _statsCacheAt = now
  return result
}
function invalidateStatsCache() { _statsCache = null; _statsCacheAt = 0 }

function listBrands(db, params = {}) {
  const q = String(params.q || '').trim()
  const page = clampInt(params.page, 1, 10000, 1)
  const pageSize = clampInt(params.pageSize, 1, 500, 60)
  const sort = params.sort || 'name' // name | devices
  const where = q ? 'WHERE b.name LIKE ?' : ''
  const args = q ? [likePrefix(normalizeText(q))] : []

  const total = db
    .prepare(`SELECT COUNT(*) AS c FROM finder_brands b ${where}`)
    .get(...args).c
  const orderBy = sort === 'devices'
    ? 'device_count DESC, b.name COLLATE NOCASE'
    : 'b.name COLLATE NOCASE'
  const items = db
    .prepare(
      `SELECT b.id, b.name, b.slug, b.logo_path,
              (SELECT COUNT(*) FROM finder_devices d WHERE d.brand_id = b.id) AS device_count
         FROM finder_brands b ${where}
        ORDER BY ${orderBy}
        LIMIT ? OFFSET ?`,
    )
    .all(...args, pageSize, (page - 1) * pageSize)

  return { total, page, pageSize, items }
}

function getBrand(db, { id, slug } = {}) {
  const brand = id
    ? db.prepare('SELECT id, name, slug, logo_path FROM finder_brands WHERE id = ?').get(id)
    : db.prepare('SELECT id, name, slug, logo_path FROM finder_brands WHERE slug = ?').get(slug)
  if (!brand) return null
  const deviceCount = db
    .prepare('SELECT COUNT(*) AS c FROM finder_devices WHERE brand_id = ?')
    .get(brand.id).c
  return { ...brand, device_count: deviceCount }
}

function listDevices(db, params = {}) {
  const brandId = params.brandId ? Number(params.brandId) : null
  const q = String(params.q || '').trim()
  const page = clampInt(params.page, 1, 10000, 1)
  const pageSize = clampInt(params.pageSize, 1, 200, 40)
  const sort = params.sort || 'name' // name | year | brand

  const clauses = []
  const args = []
  if (brandId) {
    clauses.push('d.brand_id = ?')
    args.push(brandId)
  }
  if (q) {
    clauses.push('(d.commercial_name LIKE ? OR d.model_ref LIKE ?)')
    args.push(likePrefix(q), likePrefix(q))
  }
  const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : ''

  const total = db
    .prepare(`SELECT COUNT(*) AS c FROM finder_devices d ${where}`)
    .get(...args).c

  let orderBy = 'b.name COLLATE NOCASE, d.commercial_name COLLATE NOCASE'
  if (sort === 'year') orderBy = 'd.release_year DESC, d.commercial_name COLLATE NOCASE'
  if (sort === 'name') orderBy = 'd.commercial_name COLLATE NOCASE'

  const items = db
    .prepare(
      `SELECT d.id, d.commercial_name, d.model_ref, d.release_year, d.image_path,
              b.name AS brand_name
         FROM finder_devices d JOIN finder_brands b ON b.id = d.brand_id
         ${where}
        ORDER BY ${orderBy}
        LIMIT ? OFFSET ?`,
    )
    .all(...args, pageSize, (page - 1) * pageSize)

  return { total, page, pageSize, items }
}

function getDevice(db, id) {
  const device = db
    .prepare(
      `SELECT d.*, b.name AS brand_name, b.slug AS brand_slug
         FROM finder_devices d JOIN finder_brands b ON b.id = d.brand_id
        WHERE d.id = ?`,
    )
    .get(Number(id))
  if (!device) return null

  const aliases = db
    .prepare('SELECT alias, lang FROM finder_device_aliases WHERE device_id = ? ORDER BY alias')
    .all(device.id)

  const parts = db
    .prepare(
      `SELECT p.id, p.name, p.oem_ref, p.confidence, pd.role, c.name AS category_name
         FROM finder_part_devices pd
         JOIN finder_parts p ON p.id = pd.part_id
         LEFT JOIN finder_categories c ON c.id = p.category_id
        WHERE pd.device_id = ?
        ORDER BY c.name, p.name`,
    )
    .all(device.id)

  const compatibilities = db
    .prepare(
      `SELECT id, status, part_id, device_from_id, device_to_id, differences, conditions, evidence
         FROM finder_compatibilities
        WHERE device_to_id = ? OR device_from_id = ?
        ORDER BY status, id`,
    )
    .all(device.id, device.id)

  const ics = db
    .prepare(
      `SELECT i.id, i.ref, i.marking, i.function, i.manufacturer, i.family, i.package, idv.board_area
         FROM finder_ic_devices idv JOIN finder_ics i ON i.id = idv.ic_id
        WHERE idv.device_id = ?
        ORDER BY i.function, i.ref`,
    )
    .all(device.id)

  const media = db
    .prepare(
      `SELECT path, kind, license, credit FROM finder_media
        WHERE entity_type = 'device' AND entity_id = ? ORDER BY kind, id`,
    )
    .all(device.id)

  const missing = []
  if (!device.model_ref) missing.push('model_ref')
  if (!device.release_year) missing.push('release_year')
  if (!device.image_path && !media.length) missing.push('image')
  if (!parts.length) missing.push('parts')

  return { ...device, aliases, parts, compatibilities, ics, media, missing }
}

function getIc(db, id) {
  const ic = db
    .prepare(
      `SELECT id, ref, marking, manufacturer, family, function, package, pins,
              dimensions, voltage_min, voltage_max, current_ma, datasheet_url, notes
         FROM finder_ics WHERE id = ?`,
    )
    .get(Number(id))
  if (!ic) return null

  const devices = db
    .prepare(
      `SELECT d.id, d.commercial_name, d.model_ref, d.release_year, b.name AS brand_name, idv.board_area
         FROM finder_ic_devices idv
         JOIN finder_devices d ON d.id = idv.device_id
         JOIN finder_brands b ON b.id = d.brand_id
        WHERE idv.ic_id = ?
        ORDER BY b.name COLLATE NOCASE, d.commercial_name COLLATE NOCASE`,
    )
    .all(ic.id)

  const equivalences = db
    .prepare(
      `SELECT id, ic_a_id, ic_b_id, kind, restrictions, evidence, verified_by, verified_at
         FROM finder_ic_equivalences
        WHERE ic_a_id = ? OR ic_b_id = ?
        ORDER BY kind, id`,
    )
    .all(ic.id, ic.id)

  const media = db
    .prepare(
      `SELECT path, kind, license, credit FROM finder_media
        WHERE entity_type = 'ic' AND entity_id = ? ORDER BY id`,
    )
    .all(ic.id)

  return { ...ic, devices, equivalences, media }
}

function getPart(db, id) {
  const part = db
    .prepare(
      `SELECT p.*, c.name AS category_name, c.slug AS category_slug
         FROM finder_parts p LEFT JOIN finder_categories c ON c.id = p.category_id
        WHERE p.id = ?`,
    )
    .get(Number(id))
  if (!part) return null

  const refs = db
    .prepare('SELECT kind, value, is_primary FROM finder_part_refs WHERE part_id = ? ORDER BY is_primary DESC, kind, value')
    .all(part.id)

  const devices = db
    .prepare(
      `SELECT d.id, d.commercial_name, d.model_ref, d.release_year, b.name AS brand_name, pd.role
         FROM finder_part_devices pd
         JOIN finder_devices d ON d.id = pd.device_id
         JOIN finder_brands b ON b.id = d.brand_id
        WHERE pd.part_id = ?
        ORDER BY b.name COLLATE NOCASE, d.commercial_name COLLATE NOCASE`,
    )
    .all(part.id)

  const compatibilities = db
    .prepare(
      `SELECT id, status, device_from_id, device_to_id, differences, conditions, evidence, verified_at
         FROM finder_compatibilities WHERE part_id = ? ORDER BY status, id`,
    )
    .all(part.id)

  const media = db
    .prepare(
      `SELECT path, kind, license, credit FROM finder_media
        WHERE entity_type = 'part' AND entity_id = ? ORDER BY id`,
    )
    .all(part.id)

  return { ...part, refs, devices, compatibilities, media }
}

// ── Export / Récupération des données ──
function exportData(db, params = {}) {
  const kind = params.kind || 'all' // all | devices | parts | ics | brands
  const format = params.format || 'json'
  let data = {}
  if (kind === 'all' || kind === 'devices') {
    data.devices = db.prepare(
      `SELECT d.*, b.name as brand_name FROM finder_devices d JOIN finder_brands b ON b.id=d.brand_id ORDER BY d.id`
    ).all()
  }
  if (kind === 'all' || kind === 'brands') {
    data.brands = db.prepare('SELECT * FROM finder_brands ORDER BY name').all()
  }
  if (kind === 'all' || kind === 'parts') {
    data.parts = db.prepare('SELECT p.*, c.name as category_name FROM finder_parts p LEFT JOIN finder_categories c ON c.id=p.category_id ORDER BY p.id').all()
  }
  if (kind === 'all' || kind === 'ics') {
    data.ics = db.prepare('SELECT * FROM finder_ics ORDER BY ref').all()
  }
  data.exportedAt = new Date().toISOString()
  data.counts = {
    brands: data.brands ? data.brands.length : undefined,
    devices: data.devices ? data.devices.length : undefined,
    parts: data.parts ? data.parts.length : undefined,
    ics: data.ics ? data.ics.length : undefined,
  }
  if (format === 'csv' && kind !== 'all') {
    // Simple CSV for single kind
    return { ok: true, kind, format, data }
  }
  return { ok: true, kind, format, data }
}

function importHistory(db, params = {}) {
  const limit = clampInt(params.limit, 1, 100, 20)
  const rows = db.prepare(
    `SELECT id, connector, kind, file_name, status, inserted, updated, skipped, errors, started_at, finished_at, report
     FROM finder_import_batches ORDER BY id DESC LIMIT ?`
  ).all(limit)
  return { ok: true, items: rows, total: db.prepare('SELECT COUNT(*) as c FROM finder_import_batches').get().c }
}

function healthCheck(db) {
  const checks = []
  try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'finder_%'").all()
    checks.push({ name: 'tables', ok: tables.length >= 17, detail: tables.length + ' tables finder_*' })
    const indexed = db.prepare('SELECT COUNT(*) as c FROM finder_search').get().c
    const devices = db.prepare('SELECT COUNT(*) as c FROM finder_devices').get().c
    checks.push({ name: 'index', ok: indexed >= devices || devices === 0, detail: indexed + ' indexed / ' + devices + ' devices' })
    const batches = db.prepare('SELECT COUNT(*) as c FROM finder_import_batches').get().c
    checks.push({ name: 'imports', ok: true, detail: batches + ' lots importés' })
    const broken = db.prepare("SELECT COUNT(*) as c FROM finder_devices WHERE brand_id NOT IN (SELECT id FROM finder_brands)").get().c
    checks.push({ name: 'integrity', ok: broken === 0, detail: broken === 0 ? 'intégrité OK' : broken + ' appareils orphelins' })
  } catch (e) {
    checks.push({ name: 'error', ok: false, detail: e.message })
  }
  return { ok: checks.every(c => c.ok), checks, at: new Date().toISOString() }
}

function recentParts(db, params = {}) {
  const limit = clampInt(params.limit, 1, 50, 10)
  const items = db.prepare(
    `SELECT p.id, p.name, p.oem_ref, p.confidence, p.created_at, c.name as category_name
     FROM finder_parts p LEFT JOIN finder_categories c ON c.id=p.category_id
     ORDER BY p.id DESC LIMIT ?`
  ).all(limit)
  return { ok: true, items }
}

module.exports = {
  search,
  suggest,
  stats,
  invalidateStatsCache,
  listBrands,
  getBrand,
  listDevices,
  getDevice,
  getPart,
  getIc,
  exportData,
  importHistory,
  healthCheck,
  recentParts,
  levenshtein,
}
