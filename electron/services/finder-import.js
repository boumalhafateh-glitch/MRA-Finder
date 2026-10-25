// MRA FINDER — import de références de pièces (CSV / JSON).
//
// Règles non négociables :
// - l'import ne crée JAMAIS de compatibilité « confirmée » : seuls `declared`
//   et `unverified` sont acceptés, tout le reste est refusé ligne par ligne.
//   Une compatibilité confirmée exige une preuve d'atelier (mesure, carte
//   saine), pas un fichier.
// - une ligne incomplète ou inconnue est REJETÉE avec sa raison : jamais
//   complétée par une valeur plausible, jamais rattachée au hasard.
// - un rejet ne fait pas tomber le lot : les lignes valides entrent, le
//   rapport dit exactement ce qui est entré et ce qui est resté dehors.
// - tout est idempotent : réimporter le même fichier n'ajoute pas de doublon.

const { rebuildFinderSearch } = require('../database/finder-schema')

const MAX_CONTENT_BYTES = 4 * 1024 * 1024
const MAX_ROWS = 5000
const MAX_REPORTED_REJECTS = 100

const IMPORTABLE_STATUSES = new Set(['declared', 'unverified'])
const REFUSED_STATUSES = new Set(['confirmed', 'probable', 'incompatible'])

const REQUIRED_FIELDS = ['brand', 'model', 'part_name', 'category']

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
}

function clean(value) {
  return String(value === undefined || value === null ? '' : value).trim()
}

/** Découpe un CSV en tenant compte des guillemets et des retours à la ligne. */
function splitCsv(text, delimiter) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          quoted = false
        }
      } else {
        field += char
      }
      continue
    }
    if (char === '"') {
      quoted = true
    } else if (char === delimiter) {
      row.push(field)
      field = ''
    } else if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (char === '\r') {
      // ignoré : CRLF et LF donnent le même découpage
    } else {
      field += char
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((cells) => cells.some((cell) => clean(cell) !== ''))
}

function parseCsv(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] || ''
  const delimiter = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ','
  const cells = splitCsv(text, delimiter)
  if (cells.length < 2) {
    return { rows: [], error: 'CSV_EMPTY', detail: 'En-tête et au moins une ligne sont nécessaires.' }
  }
  const header = cells[0].map(normalizeKey)
  const missing = REQUIRED_FIELDS.filter((field) => !header.includes(field))
  if (missing.length) {
    return { rows: [], error: 'CSV_HEADER_MISSING', detail: 'Colonnes manquantes : ' + missing.join(', ') }
  }
  const rows = []
  for (let index = 1; index < cells.length; index++) {
    const values = cells[index]
    const row = { __line: index + 1 }
    header.forEach((key, position) => {
      if (key) row[key] = clean(values[position])
    })
    rows.push(row)
  }
  return { rows }
}

function parseJson(text) {
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    return { rows: [], error: 'JSON_INVALID', detail: error.message }
  }
  const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.parts) ? parsed.parts : null
  if (!list) {
    return { rows: [], error: 'JSON_SHAPE', detail: 'Un tableau, ou un objet avec une clé parts, est attendu.' }
  }
  const rows = list.map((entry, index) => {
    const row = { __line: index + 1 }
    for (const [key, value] of Object.entries(entry || {})) {
      row[normalizeKey(key)] = Array.isArray(value) ? value.map(clean).filter(Boolean).join('|') : clean(value)
    }
    return row
  })
  return { rows }
}

function parseRows(format, content) {
  if (format === 'csv') return parseCsv(content)
  if (format === 'json') return parseJson(content)
  return { rows: [], error: 'FORMAT_UNKNOWN', detail: 'Formats acceptés : csv, json.' }
}

function findCategory(db, value) {
  if (!value) return null
  return (
    db.prepare('SELECT id, slug, name FROM finder_categories WHERE slug = ? COLLATE NOCASE').get(value) ||
    db.prepare('SELECT id, slug, name FROM finder_categories WHERE name = ? COLLATE NOCASE').get(value) ||
    null
  )
}

function findDevice(db, brand, model) {
  return (
    db
      .prepare(
        `SELECT d.id, d.model_ref, d.commercial_name
           FROM finder_devices d JOIN finder_brands b ON b.id = d.brand_id
          WHERE b.name = ? COLLATE NOCASE AND d.commercial_name = ? COLLATE NOCASE
          ORDER BY d.id LIMIT 1`,
      )
      .get(brand, model) || null
  )
}

function upsertSource(db, slug, label, note) {
  db.prepare(
    'INSERT OR IGNORE INTO finder_sources (slug, label, url, license, terms_note) VALUES (?,?,?,?,?)',
  ).run(slug, label, '', '', note || '')
  return db.prepare('SELECT id FROM finder_sources WHERE slug = ?').get(slug)
}

/**
 * Importe un lot. Retourne un rapport lisible : ce qui est entré, ce qui a été
 * mis à jour, ce qui a été ignoré et pourquoi.
 */
function importParts(db, params = {}) {
  const format = clean(params.format).toLowerCase()
  const content = String(params.content === undefined || params.content === null ? '' : params.content)
  const fileName = clean(params.fileName).slice(0, 200)
  const sourceLabel = clean(params.sourceLabel).slice(0, 120) || 'import manuel'
  const actor = clean(params.actor).slice(0, 120)

  if (!content.trim()) {
    return { ok: false, error: 'CONTENT_EMPTY', message: 'Aucun contenu à importer.' }
  }
  if (Buffer.byteLength(content, 'utf8') > MAX_CONTENT_BYTES) {
    return { ok: false, error: 'CONTENT_TOO_LARGE', message: 'Contenu au-delà de 4 Mo.' }
  }

  const parsed = parseRows(format, content.replace(/^\uFEFF/, ''))
  if (parsed.error) return { ok: false, error: parsed.error, message: parsed.detail || '' }
  if (parsed.rows.length === 0) {
    return { ok: false, error: 'NO_ROWS', message: 'Aucune ligne de données.' }
  }
  if (parsed.rows.length > MAX_ROWS) {
    return { ok: false, error: 'TOO_MANY_ROWS', message: 'Maximum ' + MAX_ROWS + ' lignes par lot.' }
  }

  const source = upsertSource(db, 'import-manuel', 'Import manuel', 'Fichier importé par le technicien.')
  const batch = db
    .prepare(
      `INSERT INTO finder_import_batches (source_id, connector, kind, file_name, status)
       VALUES (?,?,?,?, 'running')`,
    )
    .run(source ? source.id : null, 'manual', format, fileName)
  const batchId = Number(batch.lastInsertRowid)

  const report = {
    inserted: 0,
    updated: 0,
    skipped: 0,
    rejected: 0,
    devicesEnriched: 0,
    rejectedRows: [],
  }

  const reject = (line, reason, detail) => {
    report.rejected++
    if (report.rejectedRows.length < MAX_REPORTED_REJECTS) {
      report.rejectedRows.push({ line, reason, detail: detail || '' })
    }
  }

  const insertPart = db.prepare(
    `INSERT OR IGNORE INTO finder_parts (category_id, name, oem_ref, part_type, notes, confidence, source_id)
     VALUES (?,?,?,?,?,?,?)`,
  )
  const findPart = db.prepare('SELECT id, confidence FROM finder_parts WHERE name = ? AND oem_ref = ?')
  const insertRef = db.prepare(
    'INSERT OR IGNORE INTO finder_part_refs (part_id, kind, value, is_primary, source_id) VALUES (?,?,?,?,?)',
  )
  const insertLink = db.prepare(
    'INSERT OR IGNORE INTO finder_part_devices (part_id, device_id, role, source_id) VALUES (?,?,?,?)',
  )
  const linkExists = db.prepare(
    'SELECT id FROM finder_part_devices WHERE part_id = ? AND device_id = ? AND role = ?',
  )
  const deviceModelRef = db.prepare('SELECT model_ref FROM finder_devices WHERE id = ?')
  const setDeviceModelRef = db.prepare('UPDATE finder_devices SET model_ref = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?')

  const seen = new Set()

  for (const row of parsed.rows) {
    const line = row.__line
    const brand = clean(row.brand)
    const model = clean(row.model)
    const partName = clean(row.part_name)
    const categoryValue = clean(row.category)
    const oemRef = clean(row.oem_ref)
    const status = clean(row.status).toLowerCase() || 'declared'
    const notes = clean(row.notes).slice(0, 800)
    const altRefs = clean(row.alt_refs)

    if (!brand || !model) {
      reject(line, 'MISSING_DEVICE', 'Marque et modèle sont obligatoires.')
      continue
    }
    if (!partName) {
      reject(line, 'MISSING_PART_NAME', 'Le nom de la pièce est obligatoire.')
      continue
    }
    if (status === 'confirmed' || REFUSED_STATUSES.has(status)) {
      reject(
        line,
        'STATUS_REQUIRES_EVIDENCE',
        'Seuls « declared » et « unverified » sont acceptés à l\'import ; une compatibilité confirmée exige une preuve d\'atelier.',
      )
      continue
    }
    if (!IMPORTABLE_STATUSES.has(status)) {
      reject(line, 'STATUS_UNKNOWN', 'Statut inconnu : ' + status)
      continue
    }

    const category = findCategory(db, categoryValue)
    if (!category) {
      reject(line, 'UNKNOWN_CATEGORY', 'Catégorie inconnue : ' + (categoryValue || '(vide)'))
      continue
    }

    const device = findDevice(db, brand, model)
    if (!device) {
      reject(line, 'UNKNOWN_DEVICE', brand + ' ' + model + ' absent du catalogue.')
      continue
    }

    const modelRef = clean(row.model_ref)
    if (modelRef) {
      const current = clean(deviceModelRef.get(device.id)?.model_ref)
      if (current && current.toLowerCase() !== modelRef.toLowerCase()) {
        reject(line, 'MODEL_REF_MISMATCH', 'Référence « ' + modelRef + ' » différente de « ' + current + ' ».')
        continue
      }
      if (!current) {
        setDeviceModelRef.run(modelRef, device.id)
        report.devicesEnriched++
      }
    }

    const dedupeKey = [brand.toLowerCase(), model.toLowerCase(), partName.toLowerCase(), oemRef.toLowerCase()].join('\u0000')
    if (seen.has(dedupeKey)) {
      report.skipped++
      continue
    }
    seen.add(dedupeKey)

    const created = insertPart.run(
      category.id,
      partName,
      oemRef,
      category.slug,
      notes,
      status,
      source ? source.id : null,
    )
    const part = findPart.get(partName, oemRef)
    if (!part) {
      reject(line, 'PART_WRITE_FAILED', 'La pièce n\'a pas pu être enregistrée.')
      continue
    }

    if (Number(created.changes) > 0) report.inserted++
    else report.updated++

    if (oemRef) insertRef.run(part.id, 'oem', oemRef, 1, source ? source.id : null)
    if (altRefs) {
      for (const value of altRefs.split('|').map(clean).filter(Boolean)) {
        insertRef.run(part.id, 'supplier', value, 0, source ? source.id : null)
      }
    }

    if (!linkExists.get(part.id, device.id, 'oem')) {
      insertLink.run(part.id, device.id, 'oem', source ? source.id : null)
    }
  }

  const status = report.rejected === 0 ? 'ok' : report.inserted + report.updated > 0 ? 'partial' : 'failed'
  db.prepare(
    `UPDATE finder_import_batches
        SET finished_at = datetime('now','localtime'), status = ?, inserted = ?, updated = ?,
            skipped = ?, errors = ?, report = ?
      WHERE id = ?`,
  ).run(
    status,
    report.inserted,
    report.updated,
    report.skipped,
    report.rejected,
    JSON.stringify({ rejectedRows: report.rejectedRows, devicesEnriched: report.devicesEnriched, actor, sourceLabel }),
    batchId,
  )

  try {
    rebuildFinderSearch(db)
  } catch (error) {
    // L'index est reconstruit au démarrage s'il est vide : ne pas perdre le lot.
    console.error('[finder-import] reconstruction de l\'index impossible : ' + error.message)
  }

  return {
    ok: true,
    batchId,
    status,
    inserted: report.inserted,
    updated: report.updated,
    skipped: report.skipped,
    rejected: report.rejected,
    devicesEnriched: report.devicesEnriched,
    rejectedRows: report.rejectedRows,
  }
}

module.exports = {
  importParts,
  // exportés pour les tests et pour un éventuel écran de prévisualisation
  parseRows,
  splitCsv,
  MAX_ROWS,
  IMPORTABLE_STATUSES,
}
