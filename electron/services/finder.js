// MRA FINDER — lecture seule du catalogue.
//
// Ce service ne modifie rien : la première tranche est consultative pour que la
// migration et l'index puissent être vérifiés avant toute écriture de données.
// Toutes les valeurs renvoyées viennent de la base ; aucun compteur n'est écrit
// en dur et aucune caractéristique absente n'est inventée.

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

/**
 * Recherche par préfixe sur les jetons indexés. Plusieurs mots = intersection
 * (tous les mots doivent correspondre), ce qui évite les résultats farfelus sur
 * les requêtes longues.
 */
function search(db, params = {}) {
  const query = String(params.q || '').trim()
  const page = clampInt(params.page, 1, 10000, 1)
  const pageSize = clampInt(params.pageSize, 1, 100, 20)
  const kindFilter = SEARCH_KINDS.has(params.kind) ? params.kind : ''

  if (!query) {
    return { total: 0, page, pageSize, items: [], mode: 'empty' }
  }

  const tokens = tokensOf(query)
  const scores = new Map()

  for (const token of tokens) {
    const rows = db
      .prepare(
        `SELECT kind, ref_id, MAX(weight) AS weight
           FROM finder_search_tokens
          WHERE token LIKE ?
            ${kindFilter ? 'AND kind = ?' : ''}
          GROUP BY kind, ref_id`,
      )
      .all(...(kindFilter ? [likePrefix(token), kindFilter] : [likePrefix(token)]))

    for (const row of rows) {
      const key = row.kind + ':' + row.ref_id
      const entry = scores.get(key) || { kind: row.kind, refId: row.ref_id, score: 0, hits: 0 }
      entry.score += row.weight
      entry.hits += 1
      scores.set(key, entry)
    }
  }

  // Seules les entités qui contiennent TOUS les mots restent.
  const matched = Array.from(scores.values()).filter((entry) => entry.hits === tokens.length)

  // Bonus de correspondance exacte sur le titre, puis tri stable alphabétique.
  const exact = normalizeText(query)
  const enriched = matched.map((entry) => {
    const row = db
      .prepare('SELECT title, subtitle FROM finder_search WHERE kind = ? AND ref_id = ?')
      .get(entry.kind, entry.refId)
    const title = row ? row.title : ''
    const bonus = normalizeText(title) === exact ? 5 : normalizeText(title).startsWith(exact) ? 2 : 0
    return { ...entry, title, subtitle: row ? row.subtitle : '', score: entry.score + bonus }
  })

  enriched.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))

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

/** Compteurs réels du tableau de bord — chaque valeur est une requête. */
function stats(db) {
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
  return {
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
    // Champs encore absents du catalogue : dit la vérité plutôt que de la masquer.
    devices_without_model_ref: one(
      "SELECT COUNT(*) AS c FROM finder_devices WHERE model_ref IS NULL OR model_ref = ''",
    ),
    devices_without_year: one('SELECT COUNT(*) AS c FROM finder_devices WHERE release_year IS NULL'),
    devices_without_image: one(
      "SELECT COUNT(*) AS c FROM finder_devices WHERE image_path IS NULL OR image_path = ''",
    ),
  }
}

function listBrands(db, params = {}) {
  const q = String(params.q || '').trim()
  const page = clampInt(params.page, 1, 10000, 1)
  const pageSize = clampInt(params.pageSize, 1, 500, 60)
  const where = q ? 'WHERE b.name LIKE ?' : ''
  const args = q ? [likePrefix(normalizeText(q))] : []

  const total = db
    .prepare(`SELECT COUNT(*) AS c FROM finder_brands b ${where}`)
    .get(...args).c
  const items = db
    .prepare(
      `SELECT b.id, b.name, b.slug, b.logo_path,
              (SELECT COUNT(*) FROM finder_devices d WHERE d.brand_id = b.id) AS device_count
         FROM finder_brands b ${where}
        ORDER BY b.name COLLATE NOCASE
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
  const items = db
    .prepare(
      `SELECT d.id, d.commercial_name, d.model_ref, d.release_year, d.image_path,
              b.name AS brand_name
         FROM finder_devices d JOIN finder_brands b ON b.id = d.brand_id
         ${where}
        ORDER BY b.name COLLATE NOCASE, d.commercial_name COLLATE NOCASE
        LIMIT ? OFFSET ?`,
    )
    .all(...args, pageSize, (page - 1) * pageSize)

  return { total, page, pageSize, items }
}

/**
 * Fiche appareil. Les champs absents sont renvoyés à `null` — jamais remplacés
 * par une valeur plausible. `missing` liste ce qui manque pour que l'écran le
 * dise au technicien au lieu de laisser croire que la fiche est complète.
 */
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

  return {
    ...device,
    aliases,
    parts,
    compatibilities,
    ics,
    media,
    missing,
  }
}

/**
 * Fiche pièce : ses références, les appareils où elle est déclarée, et ses
 * compatibilités. Les statuts sont rendus tels quels — l'écran ne les promeut
 * jamais, seule une preuve d'atelier le fait.
 */
/**
 * Fiche IC : ses caractéristiques, les appareils où il est déclaré, et ses
 * équivalences. Les statuts d'équivalence sont rendus tels quels — une
 * équivalence confirmée exige une preuve d'atelier.
 */
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

module.exports = {
  search,
  stats,
  listBrands,
  getBrand,
  listDevices,
  getDevice,
  getPart,
  getIc,
}
