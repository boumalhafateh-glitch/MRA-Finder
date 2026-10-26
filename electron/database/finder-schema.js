// MRA FINDER â€” schÃ©ma additif du module de recherche de piÃ¨ces et d'IC.
//
// RÃ¨gles tenues par ce fichier :
// - STRICTEMENT ADDITIF : uniquement des CREATE TABLE/INDEX IF NOT EXISTS sur le
//   prÃ©fixe `finder_`. Aucune table existante n'est modifiÃ©e ni supprimÃ©e.
// - IDEMPOTENT : rejouable sans doublon ni perte (INSERT OR IGNORE + clÃ©s uniques).
// - AUCUNE DONNÃ‰E INVENTÃ‰E : le seed n'injecte que ce qui est dÃ©jÃ  dans le dÃ©pÃ´t
//   (les 306 modÃ¨les de `src/modules/sav/deviceCatalog.ts`) et la taxonomie des
//   familles de piÃ¨ces.
// - PROVENANCE INTERNE : `finder_sources` n'est jamais exposÃ©e par l'IPC. Elle
//   sert Ã  l'audit et Ã  corriger un lot entier.
//
// Note technique : le sql.js embarquÃ© n'est pas compilÃ© avec FTS5. La recherche
// s'appuie donc sur une table de jetons normalisÃ©s indexÃ©e par prÃ©fixe, ce qui
// reste rapide et fonctionne Ã  l'identique en dÃ©veloppement, en test et sur un
// poste installÃ©.

const fs = require('fs')
const path = require('path')

// Taxonomie de dÃ©part (spÃ©cification MRA FINDER Â§ 8) : structure seule.
// Une famille sans piÃ¨ce reste vide et visible â€” c'est la vÃ©ritÃ©, pas un dÃ©faut.
const TAXONOMY = [
  {
    slug: 'display',
    name: 'Affichage',
    children: [
      ['display-lcd', 'Ã‰crans LCD'],
      ['display-oled', 'Ã‰crans OLED / AMOLED'],
      ['display-assembly', 'Ensembles Ã©cran complets'],
      ['display-glass', 'Vitres'],
      ['display-digitizer', 'Digitizers'],
      ['display-frame', 'ChÃ¢ssis et cadres dâ€™Ã©cran'],
      ['display-flex', 'Nappes dâ€™Ã©cran'],
      ['display-connector', 'Connecteurs et circuits dâ€™Ã©cran'],
    ],
  },
  {
    slug: 'power',
    name: 'Alimentation et batteries',
    children: [
      ['battery', 'Batteries'],
      ['battery-ref', 'RÃ©fÃ©rences de batteries'],
      ['battery-connector', 'Connecteurs de batterie'],
      ['charge-ic', 'Circuits de charge'],
      ['power-management', 'Circuits de gestion dâ€™alimentation'],
      ['pmic', 'PMIC'],
      ['usb-controller', 'ContrÃ´leurs USB et protection'],
    ],
  },
  {
    slug: 'charging',
    name: 'Charge et connectique',
    children: [
      ['usb-c', 'Connecteurs USB-C'],
      ['lightning', 'Connecteurs Lightning'],
      ['charging-port', 'Ports de charge'],
      ['charging-board', 'Cartes de charge'],
      ['charging-flex', 'Nappes de charge'],
      ['fpc', 'Connecteurs FPC'],
      ['coaxial', 'Connecteurs coaxiaux'],
      ['board-connector', 'Connecteurs de carte mÃ¨re'],
    ],
  },
  {
    slug: 'camera',
    name: 'CamÃ©ras et capteurs',
    children: [
      ['camera-front', 'CamÃ©ras avant'],
      ['camera-rear', 'CamÃ©ras arriÃ¨re'],
      ['camera-macro', 'Modules macro et ultra grand-angle'],
      ['depth-sensor', 'Capteurs de profondeur'],
      ['proximity', 'Capteurs de proximitÃ©'],
      ['als', 'Capteurs de luminositÃ©'],
      ['biometric', 'Capteurs biomÃ©triques'],
      ['face-id', 'Reconnaissance faciale'],
      ['sensor-flex', 'Capteurs et nappes associÃ©s'],
    ],
  },
  {
    slug: 'flex',
    name: 'Nappes et interconnexions',
    children: [
      ['interboard-flex', 'Nappes intercartes'],
      ['button-flex', 'Nappes de boutons'],
      ['power-flex', 'Nappes de volume et dâ€™alimentation'],
      ['antenna-flex', 'Nappes dâ€™antenne'],
      ['sensor-flex-cable', 'Nappes de capteurs'],
      ['adapter', 'Connecteurs et adaptateurs'],
    ],
  },
  {
    slug: 'audio',
    name: 'Audio, vibration et radio',
    children: [
      ['speaker', 'Haut-parleurs'],
      ['earpiece', 'Ã‰couteurs internes'],
      ['microphone', 'Microphones'],
      ['vibrator', 'Moteurs vibrants'],
      ['antenna', 'Antennes cellulaires'],
      ['wifi-antenna', 'Antennes Wi-Fi et Bluetooth'],
      ['rf-module', 'Modules radio'],
    ],
  },
  {
    slug: 'mechanical',
    name: 'ChÃ¢ssis et piÃ¨ces mÃ©caniques',
    children: [
      ['back-cover', 'Coques arriÃ¨re'],
      ['housing', 'ChÃ¢ssis'],
      ['frame', 'Cadres'],
      ['buttons', 'Boutons'],
      ['sim-tray', 'Tiroirs SIM'],
      ['bracket', 'Supports et caches'],
      ['gasket', 'Joints'],
      ['adhesive', 'AdhÃ©sifs'],
      ['fastener', 'Fixations et petites piÃ¨ces'],
    ],
  },
  {
    slug: 'ic',
    name: 'Composants de carte mÃ¨re',
    children: [
      ['ic-pmic', 'PMIC'],
      ['ic-charger', 'ContrÃ´leurs de charge'],
      ['ic-usb', 'ContrÃ´leurs USB'],
      ['ic-audio', 'Circuits audio'],
      ['ic-amplifier', 'Amplificateurs'],
      ['ic-rf', 'Circuits RF et modems'],
      ['ic-rf-filter', 'Filtres RF'],
      ['ic-pa', 'Commutateurs et amplificateurs de puissance'],
      ['ic-wifi', 'Circuits Wi-Fi et Bluetooth'],
      ['ic-memory', 'MÃ©moire'],
      ['ic-storage', 'Stockage'],
      ['ic-soc', 'Processeurs et SoC'],
      ['ic-touch', 'ContrÃ´leurs tactiles'],
      ['ic-display-driver', 'Drivers dâ€™affichage'],
      ['ic-special', 'IC spÃ©cialisÃ©s'],
      ['passive-resistor', 'RÃ©sistances'],
      ['passive-capacitor', 'Condensateurs'],
      ['passive-inductor', 'Bobines et inductances'],
      ['passive-diode', 'Diodes'],
      ['passive-mosfet', 'MOSFET'],
      ['passive-transistor', 'Transistors'],
      ['passive-fuse', 'Fusibles'],
      ['passive-filter', 'Filtres'],
      ['passive-array', 'RÃ©seaux de composants'],
    ],
  },
]

function createFinderTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS finder_brands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      name_alt TEXT DEFAULT '',
      logo_path TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS finder_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      url TEXT DEFAULT '',
      license TEXT DEFAULT '',
      terms_note TEXT DEFAULT '',
      robots_checked_at TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS finder_devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      brand_id INTEGER NOT NULL REFERENCES finder_brands(id) ON DELETE RESTRICT,
      commercial_name TEXT NOT NULL,
      model_ref TEXT DEFAULT '',
      family TEXT DEFAULT '',
      generation TEXT DEFAULT '',
      release_year INTEGER,
      variant_region TEXT DEFAULT '',
      product_code TEXT DEFAULT '',
      image_path TEXT DEFAULT '',
      source_id INTEGER REFERENCES finder_sources(id) ON DELETE SET NULL,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      UNIQUE (brand_id, commercial_name, model_ref)
    );
    CREATE INDEX IF NOT EXISTS idx_finder_devices_brand ON finder_devices(brand_id);
    CREATE INDEX IF NOT EXISTS idx_finder_devices_model_ref ON finder_devices(model_ref);
    CREATE INDEX IF NOT EXISTS idx_finder_devices_name ON finder_devices(commercial_name);

    CREATE TABLE IF NOT EXISTS finder_device_aliases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id INTEGER NOT NULL REFERENCES finder_devices(id) ON DELETE CASCADE,
      alias TEXT NOT NULL,
      lang TEXT DEFAULT '',
      UNIQUE (device_id, alias)
    );
    CREATE INDEX IF NOT EXISTS idx_finder_aliases_alias ON finder_device_aliases(alias);

    CREATE TABLE IF NOT EXISTS finder_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_id INTEGER DEFAULT 0,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_finder_categories_parent ON finder_categories(parent_id);

    CREATE TABLE IF NOT EXISTS finder_parts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER REFERENCES finder_categories(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      part_type TEXT DEFAULT '',
      oem_ref TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      confidence TEXT NOT NULL DEFAULT 'unverified'
        CHECK (confidence IN ('confirmed','declared','probable','unverified','incompatible')),
      source_id INTEGER REFERENCES finder_sources(id) ON DELETE SET NULL,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      UNIQUE (name, oem_ref)
    );
    CREATE INDEX IF NOT EXISTS idx_finder_parts_category ON finder_parts(category_id);
    CREATE INDEX IF NOT EXISTS idx_finder_parts_oem ON finder_parts(oem_ref);

    CREATE TABLE IF NOT EXISTS finder_part_refs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      part_id INTEGER NOT NULL REFERENCES finder_parts(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK (kind IN ('oem','aftermarket','supplier','internal')),
      value TEXT NOT NULL,
      is_primary INTEGER DEFAULT 0,
      source_id INTEGER REFERENCES finder_sources(id) ON DELETE SET NULL,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      UNIQUE (part_id, kind, value)
    );
    CREATE INDEX IF NOT EXISTS idx_finder_part_refs_value ON finder_part_refs(value);

    CREATE TABLE IF NOT EXISTS finder_part_devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      part_id INTEGER NOT NULL REFERENCES finder_parts(id) ON DELETE CASCADE,
      device_id INTEGER NOT NULL REFERENCES finder_devices(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'oem' CHECK (role IN ('oem','compatible')),
      source_id INTEGER REFERENCES finder_sources(id) ON DELETE SET NULL,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      UNIQUE (part_id, device_id, role)
    );
    CREATE INDEX IF NOT EXISTS idx_finder_part_devices_device ON finder_part_devices(device_id);

    CREATE TABLE IF NOT EXISTS finder_compatibilities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      part_id INTEGER REFERENCES finder_parts(id) ON DELETE CASCADE,
      device_from_id INTEGER REFERENCES finder_devices(id) ON DELETE CASCADE,
      device_to_id INTEGER REFERENCES finder_devices(id) ON DELETE CASCADE,
      status TEXT NOT NULL
        CHECK (status IN ('confirmed','declared','probable','unverified','incompatible')),
      differences TEXT DEFAULT '',
      conditions TEXT DEFAULT '',
      evidence TEXT DEFAULT '',
      source_id INTEGER REFERENCES finder_sources(id) ON DELETE SET NULL,
      verified_by TEXT DEFAULT '',
      verified_at TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      CHECK (part_id IS NOT NULL OR (device_from_id IS NOT NULL AND device_to_id IS NOT NULL)),
      CHECK (device_from_id IS NULL OR device_to_id IS NULL OR device_from_id <> device_to_id)
    );
    CREATE INDEX IF NOT EXISTS idx_finder_compat_part ON finder_compatibilities(part_id, status);
    CREATE INDEX IF NOT EXISTS idx_finder_compat_to ON finder_compatibilities(device_to_id, status);

    CREATE TABLE IF NOT EXISTS finder_ics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ref TEXT NOT NULL UNIQUE,
      marking TEXT DEFAULT '',
      manufacturer TEXT DEFAULT '',
      family TEXT DEFAULT '',
      function TEXT DEFAULT '',
      package TEXT DEFAULT '',
      pins INTEGER,
      dimensions TEXT DEFAULT '',
      voltage_min REAL,
      voltage_max REAL,
      current_ma REAL,
      datasheet_url TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      source_id INTEGER REFERENCES finder_sources(id) ON DELETE SET NULL,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_finder_ics_marking ON finder_ics(marking);
    CREATE INDEX IF NOT EXISTS idx_finder_ics_function ON finder_ics(function);

    CREATE TABLE IF NOT EXISTS finder_ic_devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ic_id INTEGER NOT NULL REFERENCES finder_ics(id) ON DELETE CASCADE,
      device_id INTEGER NOT NULL REFERENCES finder_devices(id) ON DELETE CASCADE,
      board_area TEXT DEFAULT '',
      source_id INTEGER REFERENCES finder_sources(id) ON DELETE SET NULL,
      UNIQUE (ic_id, device_id, board_area)
    );

    CREATE TABLE IF NOT EXISTS finder_ic_equivalences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ic_a_id INTEGER NOT NULL REFERENCES finder_ics(id) ON DELETE CASCADE,
      ic_b_id INTEGER NOT NULL REFERENCES finder_ics(id) ON DELETE CASCADE,
      kind TEXT NOT NULL
        CHECK (kind IN ('identical','pin_to_pin','functional','similar','unknown')),
      restrictions TEXT DEFAULT '',
      evidence TEXT DEFAULT '',
      source_id INTEGER REFERENCES finder_sources(id) ON DELETE SET NULL,
      verified_by TEXT DEFAULT '',
      verified_at TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      CHECK (ic_a_id <> ic_b_id),
      UNIQUE (ic_a_id, ic_b_id)
    );

    CREATE TABLE IF NOT EXISTS finder_media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL CHECK (entity_type IN ('device','part','ic')),
      entity_id INTEGER NOT NULL,
      kind TEXT NOT NULL DEFAULT 'photo' CHECK (kind IN ('photo','logo','datasheet_preview')),
      path TEXT NOT NULL,
      sha256 TEXT DEFAULT '',
      width INTEGER,
      height INTEGER,
      license TEXT DEFAULT '',
      credit TEXT DEFAULT '',
      source_id INTEGER REFERENCES finder_sources(id) ON DELETE SET NULL,
      cached_at TEXT DEFAULT (datetime('now','localtime')),
      UNIQUE (entity_type, entity_id, path)
    );

    CREATE TABLE IF NOT EXISTS finder_sync_state (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id INTEGER NOT NULL REFERENCES finder_sources(id) ON DELETE CASCADE,
      connector TEXT NOT NULL,
      cursor TEXT DEFAULT '',
      last_run_at TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle','running','ok','failed')),
      last_error TEXT DEFAULT '',
      items_last_run INTEGER DEFAULT 0,
      items_total INTEGER DEFAULT 0,
      UNIQUE (source_id, connector)
    );

    CREATE TABLE IF NOT EXISTS finder_import_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id INTEGER REFERENCES finder_sources(id) ON DELETE SET NULL,
      connector TEXT DEFAULT '',
      kind TEXT DEFAULT '',
      file_name TEXT DEFAULT '',
      started_at TEXT DEFAULT (datetime('now','localtime')),
      finished_at TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','ok','partial','failed')),
      inserted INTEGER DEFAULT 0,
      updated INTEGER DEFAULT 0,
      skipped INTEGER DEFAULT 0,
      errors INTEGER DEFAULT 0,
      report TEXT DEFAULT ''
    );

    -- Index de recherche : une ligne par entitÃ© indexÃ©e (texte normalisÃ©) et une
    -- ligne par jeton, pour une recherche par prÃ©fixe sans FTS5.
    CREATE TABLE IF NOT EXISTS finder_search (
      kind TEXT NOT NULL,
      ref_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT DEFAULT '',
      body TEXT DEFAULT '',
      norm TEXT NOT NULL,
      PRIMARY KEY (kind, ref_id)
    );

    CREATE TABLE IF NOT EXISTS finder_search_tokens (
      token TEXT NOT NULL,
      kind TEXT NOT NULL,
      ref_id INTEGER NOT NULL,
      weight INTEGER DEFAULT 1,
      PRIMARY KEY (token, kind, ref_id)
    );
    CREATE INDEX IF NOT EXISTS idx_finder_search_tokens_lookup ON finder_search_tokens(token, kind);
  `)
}

/**
 * Seed de la taxonomie : structure seule, aucun contenu mÃ©tier.
 * Idempotent par `slug` unique.
 */
function seedFinderTaxonomy(db) {
  const insert = db.prepare(
    'INSERT OR IGNORE INTO finder_categories (parent_id, slug, name, sort_order) VALUES (?,?,?,?)',
  )
  const find = db.prepare('SELECT id FROM finder_categories WHERE slug = ?')
  let order = 0
  for (const family of TAXONOMY) {
    insert.run(0, family.slug, family.name, order++)
    const row = find.get(family.slug)
    if (!row) continue
    let childOrder = 0
    for (const [slug, name] of family.children) {
      insert.run(row.id, slug, name, childOrder++)
    }
  }
}

function slugify(value) {  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function loadCatalogSeed() {
  const file = path.join(__dirname, 'finder-catalog-seed.json')
  if (!fs.existsSync(file)) return []
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
    return Array.isArray(parsed.devices) ? parsed.devices : []
  } catch (e) {
    return []
  }
}

/**
 * Migration des 306 modÃ¨les dÃ©jÃ  prÃ©sents dans le dÃ©pÃ´t vers le catalogue Finder.
 * Aucun champ n'est inventÃ© : seuls marque / modÃ¨le / annÃ©e / alias existent, et
 * les motifs d'alias deviennent des alias recherchables.
 * Idempotent : UNIQUE(brand_id, commercial_name, model_ref) + INSERT OR IGNORE.
 */
/**
 * ExÃ©cute une sÃ©rie d'Ã©critures en une transaction quand le pilote l'expose.
 * Le wrapper sql.js du produit et better-sqlite3 l'exposent ; certains
 * environnements d'exÃ©cution minimalistes ne l'exposent pas â€” dans ce cas on
 * exÃ©cute la sÃ©rie telle quelle, sans jamais prÃ©tendre qu'elle a Ã©tÃ© atomique.
 */
function runInTransaction(db, fn) {
  if (typeof db.transaction === 'function') {
    db.transaction(fn)()
    return
  }
  fn()
}

function seedFinderCatalog(db, seedDevices) {
  // `seedDevices` ne sert qu'aux tests : en production, la source est toujours
  // le fichier du dépôt. Un tableau vide passé explicitement reste vide.
  const devices = Array.isArray(seedDevices) ? seedDevices : loadCatalogSeed()
  if (!devices.length) return { inserted: 0, skipped: 0 }

  const sourceSlug = 'internal-catalog'
  db.prepare(
    'INSERT OR IGNORE INTO finder_sources (slug, label, url, license, terms_note) VALUES (?,?,?,?,?)',
  ).run(
    sourceSlug,
    'Catalogue interne MRA',
    '',
    'interne',
    'IdentitÃ©s de modÃ¨les dÃ©jÃ  prÃ©sentes dans le dÃ©pÃ´t avant MRA FINDER.',
  )
  const source = db.prepare('SELECT id FROM finder_sources WHERE slug = ?').get(sourceSlug)

  const insertBrand = db.prepare('INSERT OR IGNORE INTO finder_brands (slug, name) VALUES (?,?)')
  const getBrand = db.prepare('SELECT id FROM finder_brands WHERE slug = ?')
  const insertDevice = db.prepare(
    `INSERT OR IGNORE INTO finder_devices
       (brand_id, commercial_name, model_ref, release_year, source_id)
     VALUES (?,?,?,?,?)`,
  )
  const getDevice = db.prepare(
    'SELECT id FROM finder_devices WHERE brand_id = ? AND commercial_name = ? AND model_ref = ?',
  )
  const findByName = db.prepare(
    'SELECT id FROM finder_devices WHERE brand_id = ? AND commercial_name = ?',
  )
  const insertAlias = db.prepare(
    'INSERT OR IGNORE INTO finder_device_aliases (device_id, alias, lang) VALUES (?,?,?)',
  )
  // Trace de ce que le seed a réellement ajouté : un démarrage qui n'ajoute
  // rien n'écrit pas de lot — le journal ne ment pas sur l'origine des lignes.
  const insertBatch = db.prepare(
    `INSERT INTO finder_import_batches
       (source_id, connector, kind, file_name, finished_at, status, inserted, updated, skipped, errors, report)
     VALUES (?,?,?,?, datetime('now','localtime'), 'ok', ?, 0, ?, 0, ?)`,
  )

  let inserted = 0
  let skipped = 0
  const run = () => runInTransaction(db, () => {
    for (const entry of devices) {
      if (!entry || !entry.brand || !entry.model) {
        skipped++
        continue
      }
      insertBrand.run(slugify(entry.brand), entry.brand)
      const brand = getBrand.get(slugify(entry.brand))
      if (!brand) {
        skipped++
        continue
      }
      const modelRef = entry.modelRef || ''
      // Une fiche porte déjà ce nom : le seed ne la touche pas et n'en crée pas
      // une seconde, même si sa référence ou son année ont été corrigées à
      // l'atelier. Jamais d'UPDATE, jamais de doublon.
      if (findByName.get(brand.id, entry.model)) {
        skipped++
        continue
      }
      const result = insertDevice.run(
        brand.id,
        entry.model,
        modelRef,
        Number.isFinite(entry.year) ? entry.year : null,
        source ? source.id : null,
      )
      const device = getDevice.get(brand.id, entry.model, modelRef)
      if (!device || result.changes === 0) {
        skipped++
        continue
      }
      inserted++
      // Les alias n'entrent qu'au moment de la création : un alias retiré à
      // la main sur un appareil déjà en base n'est jamais recréé, et le
      // contrôle du seed reste strictement additif.
      for (const alias of entry.patterns || []) {
        if (alias && alias !== String(entry.model).toLowerCase()) {
          insertAlias.run(device.id, alias, '')
        }
      }
    }
  })
  run()
  if (inserted > 0 && source) {
    insertBatch.run(
      source.id,
      'seed',
      'device',
      'finder-catalog-seed.json',
      inserted,
      skipped,
      JSON.stringify({ addedBySeed: inserted }),
    )
  }
  return { inserted, skipped }
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function compactToken(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim()
}

function tokenize(value) {
  const norm = normalizeText(value)
  if (!norm) return []
  const out = new Set()
  for (const token of norm.split(' ')) {
    if (token.length > 1 || /^\d$/.test(token)) out.add(token)
  }
  const compact = compactToken(value)
  if (compact && compact.length > 1) out.add(compact)
  const digits = compact.replace(/[^0-9]/g, '')
  if (digits.length >= 3) out.add(digits)
  return Array.from(out)
}

/**
 * Reconstruit l'index de recherche. L'index ne contient que des donnÃ©es
 * dÃ©rivÃ©es des tables Finder : aucune valeur propre, aucun compteur figÃ©.
 */
function rebuildFinderSearch(db) {
  db.exec('DELETE FROM finder_search')
  db.exec('DELETE FROM finder_search_tokens')
  const insertEntry = db.prepare(
    'INSERT INTO finder_search (kind, ref_id, title, subtitle, body, norm) VALUES (?,?,?,?,?,?)',
  )
  const insertToken = db.prepare(
    'INSERT OR IGNORE INTO finder_search_tokens (token, kind, ref_id, weight) VALUES (?,?,?,?)',
  )

  const indexEntity = (kind, refId, title, subtitle, body, weight) => {
    const fields = [title, subtitle, body].filter(Boolean)
    const norm = normalizeText(fields.join(' '))
    insertEntry.run(kind, refId, title, subtitle || '', body || '', norm)
    // Tokeniser chaque champ séparément pour que les références alphanumériques
    // (EB-IMPORT-001, BQ25601…) génèrent leur propre token compact, au lieu
    // d'un token compact de la concaténation entière qui ne matcherait jamais.
    const tokenSet = new Set()
    for (const field of [title, title, subtitle, body]) {
      if (!field) continue
      for (const token of tokenize(field)) tokenSet.add(token)
    }
    for (const token of tokenSet) {
      insertToken.run(token, kind, refId, weight)
    }
  }

  const run = () => runInTransaction(db, () => {
    for (const brand of db.prepare('SELECT id, name, slug FROM finder_brands').all()) {
      indexEntity('brand', brand.id, brand.name, brand.slug, brand.name_alt || '', 3)
    }
    const devices = db
      .prepare(
        `SELECT d.id, d.commercial_name, d.model_ref, d.release_year, d.product_code, d.family, d.generation, d.variant_region, b.name AS brand_name
           FROM finder_devices d JOIN finder_brands b ON b.id = d.brand_id`,
      )
      .all()
    for (const device of devices) {
      const aliases = db
        .prepare('SELECT alias FROM finder_device_aliases WHERE device_id = ?')
        .all(device.id)
        .map((row) => row.alias)
      indexEntity(
        'device',
        device.id,
        device.commercial_name,
        [device.brand_name, device.model_ref, device.product_code].filter(Boolean).join(' Â· '),
        [device.release_year ? String(device.release_year) : '', device.family, device.generation, device.variant_region, ...aliases].filter(Boolean).join(' '),
        2,
      )
    }
    for (const part of db.prepare('SELECT id, name, oem_ref, part_type FROM finder_parts').all()) {
      const refs = db
        .prepare('SELECT value FROM finder_part_refs WHERE part_id = ?')
        .all(part.id)
        .map((row) => row.value)
      const deviceNames = db
        .prepare(
          `SELECT d.commercial_name, d.model_ref, b.name AS brand_name
             FROM finder_part_devices pd
             JOIN finder_devices d ON d.id = pd.device_id
             JOIN finder_brands b ON b.id = d.brand_id
            WHERE pd.part_id = ?`,
        )
        .all(part.id)
        .map((row) => [row.brand_name, row.commercial_name, row.model_ref].filter(Boolean).join(' '))
        .join(' ')
      indexEntity(
        'part',
        part.id,
        part.name,
        [part.oem_ref, part.part_type].filter(Boolean).join(' Â· '),
        [refs.join(' '), deviceNames].filter(Boolean).join(' '),
        2,
      )
    }
    for (const ic of db
      .prepare('SELECT id, ref, marking, manufacturer, function, family, package FROM finder_ics')
      .all()) {
      indexEntity(
        'ic',
        ic.id,
        ic.ref,
        [ic.manufacturer, ic.function, ic.family, ic.package].filter(Boolean).join(' Â· '),
        [ic.marking, ic.family].filter(Boolean).join(' ') || '',
        2,
      )
    }
  })
  run()
}

/**
 * Point d'entrÃ©e idempotent appelÃ© par createTables() et par la migration v14 :
 * crÃ©e les tables si absentes, complete le seed (marques ET modÃ¨les) et
 * reconstruit l'index de recherche quand il ne couvre plus les tables.
 * Aucune Ã©criture destructive : le seed n'insÃ¨re que ce qui manque.
 */
// Liste extensible de fabricants de téléphones (faits réels, sans plafond artificiel).
// Ajouter une marque ici suffit : le seed est idempotent (INSERT OR IGNORE) et ne
// supprime jamais une marque déjà présente. Aucun logo n'est inventé : logo_path
// reste vide tant qu'un fichier officiel et utilisable n'est pas fourni.
const FINDER_BRAND_SEED = [
  'AGM', 'Alcatel', 'Apple', 'ASUS', 'Blackview', 'CAT', 'Doogee', 'Fairphone',
  'Google', 'Honor', 'HTC', 'Huawei', 'Infinix', 'itel', 'iQOO', 'Lenovo',
  'LG', 'Meizu', 'Motorola', 'Nokia', 'Nothing', 'nubia', 'OnePlus', 'OPPO',
  'Oukitel', 'POCO', 'Realme', 'Redmi', 'Samsung', 'Sharp', 'Sony', 'TCL',
  'Tecno', 'Ulefone', 'Vivo', 'Wiko', 'Xiaomi', 'ZTE',
  // Ajout Badilk / WeFix : le plus possible (25 marques supplementaires)
  'BlackBerry', 'Crosscall', 'LeEco', 'Microsoft', 'Umidigi', 'Black Shark', 'Cubot', 'Gionee', 'Hisense', 'Lava',
  'Micromax', 'Neffos', 'Philips', 'Razer', 'Sonim', 'Vertu', 'Vodafone', 'Coolpad', 'Energizer', 'Essential',
  'Gigaset', 'HMD', 'Inoi', 'QMobile', 'ZUK',
]

function seedFinderBrands(db) {
  const sourceSlug = 'internal-brand-list'
  db.prepare(
    'INSERT OR IGNORE INTO finder_sources (slug, label, url, license, terms_note) VALUES (?,?,?,?,?)',
  ).run(sourceSlug, 'Liste interne de fabricants', '', 'interne', 'Noms de fabricants réels, sans modèle inventé.')
  const source = db.prepare('SELECT id FROM finder_sources WHERE slug = ?').get(sourceSlug)
  const insertBrand = db.prepare('INSERT OR IGNORE INTO finder_brands (slug, name, source_id) VALUES (?,?,?)')
  // source_id n'existe pas dans finder_brands : on l'ignore côté écriture.
  const insertBrandSafe = db.prepare('INSERT OR IGNORE INTO finder_brands (slug, name) VALUES (?,?)')
  for (const name of FINDER_BRAND_SEED) {
    insertBrandSafe.run(slugify(name), name)
  }
  return { added: FINDER_BRAND_SEED.length }
}

function ensureFinderCatalog(db) {
  createFinderTables(db)

  const count = (table) => {
    const row = db.prepare('SELECT COUNT(*) AS c FROM ' + table).get()
    return row && typeof row.c === 'number' ? row.c : 0
  }

  if (count('finder_categories') === 0) seedFinderTaxonomy(db)
  // Les marques sont toujours complétées (idempotent) : une nouvelle marque
  // ajoutée à la liste réelle entre dans le catalogue sans écraser l'existant.
  seedFinderBrands(db)
  // Les appareils aussi, et pas seulement sur une base vide : une base déjà
  // installée doit recevoir les modèles ajoutés au catalogue. Le seed est
  // additif (INSERT OR IGNORE sur l'unicité marque + modèle + référence) :
  // jamais d'UPDATE, donc une fiche retouchée à l'atelier n'est pas écrasée.
  const seeded = seedFinderCatalog(db)

  // L'index n'est reconstruit que s'il ne couvre plus les tables : un modèle
  // ajouté après coup, une marque nouvelle et une ligne supprimée doivent tous
  // être vus par la recherche, sinon le catalogue ment sur son contenu.
  const indexed = { brand: 0, device: 0, part: 0, ic: 0 }
  for (const row of db.prepare('SELECT kind, COUNT(*) AS c FROM finder_search GROUP BY kind').all()) {
    if (Object.prototype.hasOwnProperty.call(indexed, row.kind)) indexed[row.kind] = row.c
  }
  const stale =
    indexed.brand !== count('finder_brands') ||
    indexed.device !== count('finder_devices') ||
    indexed.part !== count('finder_parts') ||
    indexed.ic !== count('finder_ics')
  if (stale) rebuildFinderSearch(db)

  return seeded
}

module.exports = {
  TAXONOMY,
  FINDER_BRAND_SEED,
  createFinderTables,
  seedFinderTaxonomy,
  seedFinderBrands,
  seedFinderCatalog,
  ensureFinderCatalog,
  rebuildFinderSearch,
  normalizeText,
  slugify,
  tokenize,
}
