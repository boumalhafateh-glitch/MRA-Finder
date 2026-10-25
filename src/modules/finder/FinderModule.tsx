import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useTranslation } from '../../contexts/LanguageContext'
import './FinderModule.css'

/**
 * MRA FINDER — recherche universelle de pièces et de circuits.
 *
 * Ce que l'écran refuse de faire :
 * - afficher un compteur qui ne vient pas de la base ;
 * - présenter une image générique comme la photo de l'appareil cherché ;
 * - annoncer une compatibilité sans preuve (les cinq statuts viennent de la
 *   base, jamais du navigateur) ;
 * - faire croire que la recherche par photo fonctionne : elle est annoncée
 *   indisponible tant que le moteur d'analyse d'image n'est pas livré ;
 * - afficher une erreur comme une absence de donnée, ou une réponse ancienne
 *   comme le résultat de l'action la plus récente.
 *
 * Toutes les données passent par `window.api.finder` (lecture seule).
 */

type Mode = 'part' | 'device' | 'photo'

// Un flux = une file d'attente d'appels. Le token rend toute réponse plus
// ancienne que la dernière demande sans effet : elle n'écrit jamais d'état.
type Flow = 'search' | 'device' | 'part' | 'ic' | 'brand'

const MODES: Mode[] = ['part', 'device', 'photo']
const PAGE_SIZE = 20

// Modèle de fichier fourni au technicien : les colonnes attendues, rien de plus.
const CSV_TEMPLATE = [
  'category;brand;model;model_ref;part_name;oem_ref;status;alt_refs;notes',
  'battery;Samsung;Galaxy A18 4G;;Batterie;EB-BA185ABY;declared;;Capacité d’origine',
].join('\n')

function finderApi() {
  if (typeof window === 'undefined') return undefined
  return window.api?.finder
}

export default function FinderModule() {
  const { t } = useTranslation()

  const [mode, setMode] = useState<Mode>('part')
  const [query, setQuery] = useState('')
  const [submitted, setSubmitted] = useState<{ q: string; mode: Mode } | null>(null)
  const [result, setResult] = useState<FinderSearchResult | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')

  const [stats, setStats] = useState<FinderStats | null>(null)
  const [statsError, setStatsError] = useState(false)
  const [brands, setBrands] = useState<FinderBrand[]>([])
  const [brandQuery, setBrandQuery] = useState('')

  const [activeBrand, setActiveBrand] = useState<FinderBrand | null>(null)
  const [brandDevices, setBrandDevices] = useState<FinderDeviceSummary[]>([])
  const [brandTotal, setBrandTotal] = useState(0)
  const [brandLoading, setBrandLoading] = useState(false)
  const [brandError, setBrandError] = useState('')

  const [device, setDevice] = useState<FinderDevice | null>(null)
  const [deviceLoading, setDeviceLoading] = useState(false)
  const [deviceError, setDeviceError] = useState('')

  const [part, setPart] = useState<FinderPart | null>(null)
  const [partLoading, setPartLoading] = useState(false)
  const [partError, setPartError] = useState('')
  const [ic, setIc] = useState<FinderIc | null>(null)
  const [icLoading, setIcLoading] = useState(false)
  const [icError, setIcError] = useState('')

  const [importOpen, setImportOpen] = useState(false)
  const [importFormat, setImportFormat] = useState<'csv' | 'json'>('csv')
  const [importText, setImportText] = useState('')
  const [importReport, setImportReport] = useState<FinderImportReport | null>(null)
  const [importing, setImporting] = useState(false)

  // Séquence par flux : la demande la plus récente gagne, les autres sont ignorées.
  const sequence = useRef<Record<Flow, number>>({ search: 0, device: 0, part: 0, ic: 0, brand: 0 })
  // Dernier identifiant demandé par flux : permet de réessayer même quand la
  // fiche n'a jamais été remplie (le cas d'une erreur au premier chargement).
  const lastId = useRef<Record<Flow, number | null>>({ search: null, device: null, part: null, ic: null, brand: null })
  // Élément déclencheur (ligne, carte) : rendu au clavier à la fermeture.
  const trigger = useRef<HTMLElement | null>(null)
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const sheetRef = useRef<HTMLHeadingElement | null>(null)

  const beginFlow = (flow: Flow) => {
    sequence.current[flow] += 1
    return sequence.current[flow]
  }
  const isCurrent = (flow: Flow, token: number) => sequence.current[flow] === token
  const cancelFlow = (flow: Flow) => {
    sequence.current[flow] += 1
  }

  const rememberTrigger = (enabled: boolean) => {
    if (!enabled) return
    const active = document.activeElement
    trigger.current = active instanceof HTMLElement && active !== document.body ? active : null
  }

  const restoreFocus = useCallback(() => {
    const target = trigger.current
    trigger.current = null
    if (target && document.contains(target)) target.focus()
  }, [])

  // Une seule source de vérité pour « fermer tout ce qui n'est pas ce flux ».
  const clearPanels = useCallback((keep: Flow | null = null) => {
    if (keep !== 'brand') {
      cancelFlow('brand')
      setActiveBrand(null)
      setBrandDevices([])
      setBrandTotal(0)
      setBrandError('')
      setBrandLoading(false)
    }
    if (keep !== 'device') {
      cancelFlow('device')
      setDevice(null)
      setDeviceError('')
      setDeviceLoading(false)
    }
    if (keep !== 'part') {
      cancelFlow('part')
      setPart(null)
      setPartError('')
      setPartLoading(false)
    }
    if (keep !== 'ic') {
      cancelFlow('ic')
      setIc(null)
      setIcError('')
      setIcLoading(false)
    }
  }, [])

  const clearSearch = useCallback(() => {
    cancelFlow('search')
    setSubmitted(null)
    setResult(null)
    setSearchError('')
    setSearching(false)
  }, [])

  const loadDashboard = useCallback(async () => {
    const api = finderApi()
    setStatsError(false)
    if (!api) {
      setStatsError(true)
      return
    }
    try {
      const [statsAnswer, brandAnswer] = await Promise.all([api.stats(), api.brands({ pageSize: 200 })])
      if (statsAnswer.ok && statsAnswer.stats) setStats(statsAnswer.stats)
      else setStatsError(true)
      if (brandAnswer.ok && brandAnswer.result) setBrands(brandAnswer.result.items)
      else setStatsError(true)
    } catch {
      setStatsError(true)
    }
  }, [])

  const goHome = useCallback(() => {
    clearSearch()
    clearPanels(null)
  }, [clearSearch, clearPanels])

  // Fermer la fiche ouverte revient à la marque d'origine quand il y en a une.
  const closeSheet = useCallback(() => {
    clearPanels('brand')
    restoreFocus()
  }, [clearPanels, restoreFocus])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (submitted || activeBrand) {
        goHome()
        restoreFocus()
      } else if (device || part || ic) {
        closeSheet()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [submitted, activeBrand, device, part, ic, goHome, closeSheet, restoreFocus])

  // Ouvrir une fiche y déplace le focus : le clavier suit ce que l'œil regarde.
  useEffect(() => {
    if (device || part || ic) sheetRef.current?.focus()
  }, [device, part, ic])

  const openDevice = async (id: number, remember = true) => {
    const api = finderApi()
    rememberTrigger(remember)
    clearPanels('device')
    if (!api) {
      setDeviceError(t('finder.error.unavailable'))
      return
    }
    lastId.current.device = id
    const token = beginFlow('device')
    setDeviceLoading(true)
    setDeviceError('')
    try {
      const answer = await api.device(id)
      if (!isCurrent('device', token)) return
      if (answer.ok && answer.device) setDevice(answer.device)
      else setDeviceError(t('finder.error.search'))
    } catch {
      if (isCurrent('device', token)) setDeviceError(t('finder.error.search'))
    } finally {
      if (isCurrent('device', token)) setDeviceLoading(false)
    }
  }

  const openPart = async (id: number, remember = true) => {
    const api = finderApi()
    rememberTrigger(remember)
    clearPanels('part')
    if (!api) {
      setPartError(t('finder.error.unavailable'))
      return
    }
    lastId.current.part = id
    const token = beginFlow('part')
    setPartLoading(true)
    setPartError('')
    try {
      const answer = await api.part(id)
      if (!isCurrent('part', token)) return
      if (answer.ok && answer.part) setPart(answer.part)
      else setPartError(t('finder.error.search'))
    } catch {
      if (isCurrent('part', token)) setPartError(t('finder.error.search'))
    } finally {
      if (isCurrent('part', token)) setPartLoading(false)
    }
  }

  const openIc = async (id: number, remember = true) => {
    const api = finderApi()
    rememberTrigger(remember)
    clearPanels('ic')
    if (!api) {
      setIcError(t('finder.error.unavailable'))
      return
    }
    lastId.current.ic = id
    const token = beginFlow('ic')
    setIcLoading(true)
    setIcError('')
    try {
      const answer = await api.ic(id)
      if (!isCurrent('ic', token)) return
      if (answer.ok && answer.ic) setIc(answer.ic)
      else setIcError(t('finder.error.search'))
    } catch {
      if (isCurrent('ic', token)) setIcError(t('finder.error.search'))
    } finally {
      if (isCurrent('ic', token)) setIcLoading(false)
    }
  }

  const retryDevice = () => {
    const id = lastId.current.device
    if (id != null) void openDevice(id, false)
  }
  const retryPart = () => {
    const id = lastId.current.part
    if (id != null) void openPart(id, false)
  }
  const retryIc = () => {
    const id = lastId.current.ic
    if (id != null) void openIc(id, false)
  }

  const cancelDevice = () => {
    cancelFlow('device')
    setDeviceLoading(false)
    setDeviceError('')
  }
  const cancelPart = () => {
    cancelFlow('part')
    setPartLoading(false)
    setPartError('')
  }
  const cancelIc = () => {
    cancelFlow('ic')
    setIcLoading(false)
    setIcError('')
  }
  const cancelSearch = () => {
    clearSearch()
  }

  const runSearch = async (next?: { q: string; mode: Mode }) => {
    const target = next || { q: query, mode }
    clearPanels(null)
    clearSearch()
    if (target.mode === 'photo') {
      setSubmitted(target)
      return
    }
    const term = target.q.trim()
    if (!term) {
      setSearchError(t('finder.search.empty_query'))
      return
    }
    const api = finderApi()
    if (!api) {
      setSearchError(t('finder.error.unavailable'))
      return
    }
    const token = beginFlow('search')
    setSearching(true)
    setSubmitted(target)
    try {
      const answer = await api.search({
        q: term,
        kind: target.mode === 'part' ? 'part' : 'device',
        page: 1,
        pageSize: PAGE_SIZE,
      })
      if (!isCurrent('search', token)) return
      if (answer.ok && answer.result) setResult(answer.result)
      else setSearchError(t('finder.error.search'))
    } catch {
      if (isCurrent('search', token)) setSearchError(t('finder.error.search'))
    } finally {
      if (isCurrent('search', token)) setSearching(false)
    }
  }

  const retrySearch = () => {
    if (submitted) void runSearch(submitted)
  }

  const openBrand = async (brand: FinderBrand) => {
    const api = finderApi()
    rememberTrigger(true)
    clearSearch()
    clearPanels('brand')
    if (!api) {
      setBrandError(t('finder.error.unavailable'))
      return
    }
    lastId.current.brand = brand.id
    const token = beginFlow('brand')
    setActiveBrand(brand)
    setBrandLoading(true)
    setBrandError('')
    setBrandDevices([])
    setBrandTotal(0)
    try {
      const answer = await api.devices({ brandId: brand.id, pageSize: 200 })
      if (!isCurrent('brand', token)) return
      if (answer.ok && answer.result) {
        setBrandDevices(answer.result.items)
        setBrandTotal(answer.result.total)
      } else {
        setBrandError(t('finder.error.search'))
      }
    } catch {
      if (isCurrent('brand', token)) setBrandError(t('finder.error.search'))
    } finally {
      if (isCurrent('brand', token)) setBrandLoading(false)
    }
  }

  const retryBrand = () => {
    const id = lastId.current.brand
    const target = brands.find((brand) => brand.id === id) || activeBrand
    if (target) void openBrand(target)
  }

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'finder-modele-pieces.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const runImport = async () => {
    const api = finderApi()
    if (!api) {
      setImportReport({ ok: false, error: 'NO_BRIDGE' })
      return
    }
    if (!importText.trim()) {
      setImportReport({ ok: false, error: 'CONTENT_EMPTY' })
      return
    }
    setImporting(true)
    try {
      const report = await api.importParts({
        format: importFormat,
        content: importText,
        fileName: importFormat === 'csv' ? 'collé.csv' : 'collé.json',
        sourceLabel: 'import manuel',
      })
      setImportReport(report)
      if (report.ok) {
        // Les compteurs et la recherche doivent refléter l'import réel.
        void loadDashboard()
        clearSearch()
      }
    } catch {
      setImportReport({ ok: false, error: 'IMPORT_FAILED' })
    } finally {
      setImporting(false)
    }
  }

  const onTabKeyDown = (event: ReactKeyboardEvent, index: number) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const direction = event.key === 'ArrowRight' ? 1 : -1
    const next = (index + direction + MODES.length) % MODES.length
    setMode(MODES[next])
    goHome()
    tabRefs.current[next]?.focus()
  }

  const filteredBrands = brandQuery.trim()
    ? brands.filter((brand) => brand.name.toLowerCase().includes(brandQuery.trim().toLowerCase()))
    : brands

  const showHome = !submitted && !activeBrand

  return (
    <div className="finder-root">
      <header className="finder-head">
        <div>
          <div className="finder-kicker">{t('finder.kicker')}</div>
          <h1 className="finder-title">{t('finder.title')}</h1>
          <p className="finder-sub">{t('finder.subtitle')}</p>
        </div>
        <div className="finder-head-right">
          <span className="finder-chip">{t('finder.status.local')}</span>
          <span className="finder-chip finder-chip-dim">{t('finder.status.offline')}</span>
          <button
            type="button"
            className="finder-link"
            onClick={() => setImportOpen((open) => !open)}
            aria-expanded={importOpen}
          >
            {t('finder.import.open')}
          </button>
        </div>
      </header>

      {importOpen && (
        <section className="finder-import">
          <div className="finder-block-title">{t('finder.import.title')}</div>
          <p className="finder-import-note">{t('finder.import.note')}</p>
          <div className="finder-import-row">
            <select
              className="finder-select"
              value={importFormat}
              onChange={(event) => setImportFormat(event.target.value === 'json' ? 'json' : 'csv')}
              aria-label={t('finder.import.format')}
            >
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
            </select>
            <button type="button" className="finder-btn finder-btn-ghost" onClick={downloadTemplate}>
              {t('finder.import.template')}
            </button>
          </div>
          <textarea
            className="finder-textarea"
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            placeholder={t('finder.import.placeholder')}
            spellCheck={false}
            aria-label={t('finder.import.placeholder')}
          />
          <div className="finder-import-row">
            <button type="button" className="finder-btn" onClick={() => void runImport()} disabled={importing}>
              {importing ? t('finder.import.running') : t('finder.import.action')}
            </button>
            <span className="finder-import-hint">{t('finder.import.columns')}</span>
          </div>

          {importReport && (
            <div className={'finder-import-report' + (importReport.ok ? '' : ' is-error')}>
              {importReport.ok ? (
                <>
                  <div className="finder-import-report-title">
                    {t('finder.import.done', {
                      inserted: importReport.inserted || 0,
                      updated: importReport.updated || 0,
                      skipped: importReport.skipped || 0,
                      rejected: importReport.rejected || 0,
                    })}
                  </div>
                  {!!importReport.devicesEnriched && (
                    <div className="finder-import-report-line">
                      {t('finder.import.enriched', { count: importReport.devicesEnriched })}
                    </div>
                  )}
                  {importReport.rejectedRows && importReport.rejectedRows.length > 0 && (
                    <ul className="finder-reject-list">
                      {importReport.rejectedRows.map((row) => (
                        <li key={row.line + ':' + row.reason}>
                          <span>{t('finder.import.line', { line: row.line })}</span>
                          {' — '}
                          <span>{t('finder.import.reason.' + row.reason)}</span>
                          {row.detail ? <span>{' : ' + row.detail}</span> : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <div className="finder-import-report-title">
                  {t('finder.import.failed')}{importReport.message ? ' : ' + importReport.message : importReport.error ? ' (' + importReport.error + ')' : ''}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      <section className="finder-modes" role="tablist" aria-label={t('finder.mode.label')}>
        {MODES.map((item, index) => (
          <button
            key={item}
            id={`finder-tab-${item}`}
            ref={(element) => {
              tabRefs.current[index] = element
            }}
            type="button"
            role="tab"
            aria-selected={mode === item}
            aria-controls="finder-search-panel"
            tabIndex={mode === item ? 0 : -1}
            className={'finder-mode' + (mode === item ? ' is-active' : '')}
            onClick={() => {
              setMode(item)
              goHome()
            }}
            onKeyDown={(event) => onTabKeyDown(event, index)}
          >
            <span className="finder-mode-label">{t('finder.mode.' + item)}</span>
            <span className="finder-mode-hint">{t('finder.mode.' + item + '_hint')}</span>
          </button>
        ))}
      </section>

      {mode === 'photo' ? (
        <section
          className="finder-photo"
          id="finder-search-panel"
          role="tabpanel"
          aria-labelledby="finder-tab-photo"
          tabIndex={0}
        >
          <div className="finder-photo-title">{t('finder.photo.unavailable')}</div>
          <p className="finder-photo-text">{t('finder.photo.unavailable_hint')}</p>
          <p className="finder-photo-text finder-photo-small">{t('finder.photo.requirement')}</p>
        </section>
      ) : (
        <form
          className="finder-search"
          id="finder-search-panel"
          role="tabpanel"
          aria-labelledby={`finder-tab-${mode}`}
          onSubmit={(event) => {
            event.preventDefault()
            void runSearch()
          }}
        >
          <input
            className="finder-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t(mode === 'part' ? 'finder.search.placeholder_part' : 'finder.search.placeholder_device')}
            aria-label={t('finder.search.placeholder')}
            spellCheck={false}
            autoComplete="off"
          />
          <button type="submit" className="finder-btn" disabled={searching}>
            {searching ? t('finder.search.running') : t('finder.search.action')}
          </button>
        </form>
      )}

      {searching && (
        <div className="finder-notice finder-notice-loading" role="status">
          <p>{t('finder.search.running')}</p>
          <span className="finder-notice-actions">
            <button type="button" className="finder-btn finder-btn-ghost" onClick={cancelSearch}>
              {t('finder.action.cancel')}
            </button>
          </span>
        </div>
      )}

      {searchError && (
        <div className="finder-notice finder-notice-error" role="status">
          <p>{searchError}</p>
          {submitted && (
            <span className="finder-notice-actions">
              <button type="button" className="finder-btn finder-btn-ghost" onClick={retrySearch}>
                {t('finder.action.retry')}
              </button>
            </span>
          )}
        </div>
      )}

      {submitted && submitted.mode !== 'photo' && result && (
        <section className="finder-results">
          <div className="finder-results-head">
            <span>
              {t('finder.search.results_count', { count: result.total })} · « {submitted.q} »
            </span>
            <button type="button" className="finder-link" onClick={goHome}>
              {t('finder.action.home')}
            </button>
          </div>

          {result.total === 0 && (
            <div className="finder-empty">
              <div className="finder-empty-title">
                {submitted.mode === 'part' ? t('finder.search.no_part_yet') : t('finder.search.no_result')}
              </div>
              {submitted.mode === 'part' && (
                <p className="finder-empty-note">{t('finder.search.not_indexed')}</p>
              )}
              <p>{submitted.mode === 'part' ? t('finder.search.no_part_yet_hint') : t('finder.search.no_result_hint')}</p>
              {submitted.mode === 'part' && (
                <button
                  type="button"
                  className="finder-btn finder-btn-ghost"
                  onClick={() => {
                    const term = submitted.q
                    setMode('device')
                    setQuery(term)
                    void runSearch({ q: term, mode: 'device' })
                  }}
                >
                  {t('finder.search.try_device')}
                </button>
              )}
            </div>
          )}

          <ul className="finder-list">
            {result.items.map((item) => (
              <li key={item.kind + ':' + item.id}>
                {item.kind === 'device' && item.device && (
                  <button type="button" className="finder-row" onClick={() => void openDevice(item.id)}>
                    <span className="finder-row-main">{item.device.commercial_name}</span>
                    <span className="finder-row-sub">
                      {item.device.brand_name}
                      {item.device.model_ref ? ' · ' + item.device.model_ref : ''}
                      {item.device.release_year ? ' · ' + item.device.release_year : ''}
                    </span>
                  </button>
                )}
                {item.kind === 'brand' && item.brand && (
                  <button type="button" className="finder-row" onClick={() => item.brand && void openBrand(item.brand)}>
                    <span className="finder-row-main">{item.brand.name}</span>
                    <span className="finder-row-sub">
                      {t('finder.brands.devices', { count: item.brand.device_count })}
                    </span>
                  </button>
                )}
                {item.kind === 'part' && item.part && (
                  <button type="button" className="finder-row" onClick={() => void openPart(item.id)}>
                    <span className="finder-row-main">{item.part.name}</span>
                    <span className="finder-row-sub">
                      {[item.part.category_name, item.part.oem_ref, t('finder.confidence.' + item.part.confidence)]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </button>
                )}
                {item.kind === 'ic' && item.ic && (
                  <button type="button" className="finder-row" onClick={() => void openIc(item.id)}>
                    <span className="finder-row-main">{item.ic.ref}</span>
                    <span className="finder-row-sub">
                      {[item.ic.manufacturer, item.ic.function, item.ic.family, item.ic.package].filter(Boolean).join(' · ')}
                    </span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {activeBrand && !device && (
        <section className="finder-brand-view">
          <div className="finder-results-head">
            <span>
              {activeBrand.name} · {t('finder.brands.devices', { count: brandTotal })}
            </span>
            <button type="button" className="finder-link" onClick={goHome}>
              {t('finder.action.home')}
            </button>
          </div>
          {brandLoading && (
            <div className="finder-notice finder-notice-loading" role="status">
              <p>{t('finder.device.loading')}</p>
            </div>
          )}
          {brandError && (
            <div className="finder-notice finder-notice-error" role="status">
              <p>{brandError}</p>
              <span className="finder-notice-actions">
                <button type="button" className="finder-btn finder-btn-ghost" onClick={retryBrand}>
                  {t('finder.action.retry')}
                </button>
              </span>
            </div>
          )}
          {!brandLoading && !brandError && brandDevices.length === 0 && (
            <div className="finder-empty">{t('finder.brands.empty')}</div>
          )}
          <ul className="finder-list">
            {brandDevices.map((item) => (
              <li key={item.id}>
                <button type="button" className="finder-row" onClick={() => void openDevice(item.id)}>
                  <span className="finder-row-main">{item.commercial_name}</span>
                  <span className="finder-row-sub">
                    {item.model_ref || t('finder.device.no_model_ref')}
                    {item.release_year ? ' · ' + item.release_year : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {deviceLoading && (
        <div className="finder-notice finder-notice-loading" role="status">
          <p>{t('finder.device.loading')}</p>
          <span className="finder-notice-actions">
            <button type="button" className="finder-btn finder-btn-ghost" onClick={cancelDevice}>
              {t('finder.action.cancel')}
            </button>
          </span>
        </div>
      )}
      {deviceError && (
        <div className="finder-notice finder-notice-error" role="status">
          <p>{deviceError}</p>
          <span className="finder-notice-actions">
            <button type="button" className="finder-btn finder-btn-ghost" onClick={retryDevice}>
              {t('finder.action.retry')}
            </button>
          </span>
        </div>
      )}
      {device && (
        <section className="finder-sheet">
          <div className="finder-sheet-head">
            <div>
              <div className="finder-kicker">{device.brand_name}</div>
              <h2 className="finder-sheet-title" tabIndex={-1} ref={sheetRef}>
                {device.commercial_name}
              </h2>
            </div>
            <button type="button" className="finder-link" onClick={closeSheet}>
              {t('finder.action.close')}
            </button>
          </div>

          <dl className="finder-facts">
            <div>
              <dt>{t('finder.device.brand')}</dt>
              <dd>{device.brand_name}</dd>
            </div>
            <div>
              <dt>{t('finder.device.model_ref')}</dt>
              <dd>{device.model_ref || t('finder.device.not_available')}</dd>
            </div>
            <div>
              <dt>{t('finder.device.year')}</dt>
              <dd>{device.release_year || t('finder.device.not_available')}</dd>
            </div>
            <div>
              <dt>{t('finder.device.aliases')}</dt>
              <dd>{device.aliases.length ? device.aliases.map((alias) => alias.alias).join(', ') : t('finder.device.not_available')}</dd>
            </div>
          </dl>

          {device.missing.length > 0 && (
            <div className="finder-missing">
              <div className="finder-missing-title">{t('finder.device.missing')}</div>
              <ul>
                {device.missing.map((field) => (
                  <li key={field}>{t('finder.device.missing_' + field)}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="finder-block">
            <div className="finder-block-title">{t('finder.device.parts')}</div>
            {device.parts.length === 0 ? (
              <p className="finder-block-empty">{t('finder.device.parts_empty')}</p>
            ) : (
              <ul className="finder-list">
                {device.parts.map((part) => (
                  <li key={part.id}>
                    <button type="button" className="finder-row" onClick={() => void openPart(part.id)}>
                      <span className="finder-row-main">{part.name}</span>
                      <span className="finder-row-sub">
                        {[part.category_name, part.oem_ref, t('finder.confidence.' + part.confidence)]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="finder-block">
            <div className="finder-block-title">{t('finder.device.compat')}</div>
            {device.compatibilities.length === 0 ? (
              <p className="finder-block-empty">{t('finder.device.compat_empty')}</p>
            ) : (
              <ul className="finder-list">
                {device.compatibilities.map((row) => (
                  <li key={row.id}>
                    <div className="finder-row finder-row-static">
                      <span className="finder-row-main">{t('finder.confidence.' + row.status)}</span>
                      <span className="finder-row-sub">
                        {[row.differences, row.conditions, row.evidence].filter(Boolean).join(' · ') ||
                          t('finder.device.no_evidence')}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <details className="finder-compat-legend">
              <summary>{t('finder.compat_levels.title')}</summary>
              <ul>
                <li>{t('finder.compat_levels.identical')}</li>
                <li>{t('finder.compat_levels.documented')}</li>
                <li>{t('finder.compat_levels.conditional')}</li>
                <li>{t('finder.compat_levels.probable')}</li>
                <li>{t('finder.compat_levels.similar')}</li>
                <li>{t('finder.compat_levels.incompatible')}</li>
              </ul>
            </details>
          </div>

          <div className="finder-block">
            <div className="finder-block-title">{t('finder.device.ics')}</div>
            {device.ics.length === 0 ? (
              <p className="finder-block-empty">{t('finder.device.ics_empty')}</p>
            ) : (
              <ul className="finder-list">
                {device.ics.map((row) => (
                  <li key={row.id}>
                    <button type="button" className="finder-row" onClick={() => void openIc(row.id)}>
                      <span className="finder-row-main">{row.ref}</span>
                      <span className="finder-row-sub">
                        {[row.function, row.family, row.manufacturer, row.board_area].filter(Boolean).join(' · ')}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {partLoading && (
        <div className="finder-notice finder-notice-loading" role="status">
          <p>{t('finder.device.loading')}</p>
          <span className="finder-notice-actions">
            <button type="button" className="finder-btn finder-btn-ghost" onClick={cancelPart}>
              {t('finder.action.cancel')}
            </button>
          </span>
        </div>
      )}
      {partError && (
        <div className="finder-notice finder-notice-error" role="status">
          <p>{partError}</p>
          <span className="finder-notice-actions">
            <button type="button" className="finder-btn finder-btn-ghost" onClick={retryPart}>
              {t('finder.action.retry')}
            </button>
          </span>
        </div>
      )}
      {part && (
        <section className="finder-sheet">
          <div className="finder-sheet-head">
            <div>
              <div className="finder-kicker">{part.category_name || t('finder.device.not_available')}</div>
              <h2 className="finder-sheet-title" tabIndex={-1} ref={sheetRef}>
                {part.name}
              </h2>
            </div>
            <button type="button" className="finder-link" onClick={closeSheet}>
              {t('finder.action.close')}
            </button>
          </div>

          <dl className="finder-facts">
            <div>
              <dt>{t('finder.part.oem_ref')}</dt>
              <dd>{part.oem_ref || t('finder.device.not_available')}</dd>
            </div>
            <div>
              <dt>{t('finder.part.status')}</dt>
              <dd>{t('finder.confidence.' + part.confidence)}</dd>
            </div>
            <div>
              <dt>{t('finder.part.refs')}</dt>
              <dd>{part.refs.length ? part.refs.map((ref) => ref.value).join(', ') : t('finder.device.not_available')}</dd>
            </div>
          </dl>

          {part.notes && <p className="finder-part-notes">{part.notes}</p>}

          <div className="finder-block">
            <div className="finder-block-title">{t('finder.part.devices')}</div>
            {part.devices.length === 0 ? (
              <p className="finder-block-empty">{t('finder.part.devices_empty')}</p>
            ) : (
              <ul className="finder-list">
                {part.devices.map((row) => (
                  <li key={row.id}>
                    <button type="button" className="finder-row" onClick={() => void openDevice(row.id)}>
                      <span className="finder-row-main">{row.commercial_name}</span>
                      <span className="finder-row-sub">
                        {[row.brand_name, row.model_ref, row.release_year].filter(Boolean).join(' · ')}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="finder-block">
            <div className="finder-block-title">{t('finder.part.compat')}</div>
            {part.compatibilities.length === 0 ? (
              <p className="finder-block-empty">{t('finder.part.compat_empty')}</p>
            ) : (
              <ul className="finder-list">
                {part.compatibilities.map((row) => (
                  <li key={row.id}>
                    <div className="finder-row finder-row-static">
                      <span className="finder-row-main">{t('finder.confidence.' + row.status)}</span>
                      <span className="finder-row-sub">
                        {[row.differences, row.conditions, row.evidence].filter(Boolean).join(' · ') ||
                          t('finder.device.no_evidence')}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {icLoading && (
        <div className="finder-notice finder-notice-loading" role="status">
          <p>{t('finder.device.loading')}</p>
          <span className="finder-notice-actions">
            <button type="button" className="finder-btn finder-btn-ghost" onClick={cancelIc}>
              {t('finder.action.cancel')}
            </button>
          </span>
        </div>
      )}
      {icError && (
        <div className="finder-notice finder-notice-error" role="status">
          <p>{icError}</p>
          <span className="finder-notice-actions">
            <button type="button" className="finder-btn finder-btn-ghost" onClick={retryIc}>
              {t('finder.action.retry')}
            </button>
          </span>
        </div>
      )}
      {ic && (
        <section className="finder-sheet">
          <div className="finder-sheet-head">
            <div>
              <div className="finder-kicker">{ic.manufacturer || t('finder.device.not_available')}</div>
              <h2 className="finder-sheet-title" tabIndex={-1} ref={sheetRef}>
                {ic.ref}
              </h2>
            </div>
            <button type="button" className="finder-link" onClick={closeSheet}>
              {t('finder.action.close')}
            </button>
          </div>

          <dl className="finder-facts">
            <div>
              <dt>{t('finder.ic.marking')}</dt>
              <dd>{ic.marking || t('finder.device.not_available')}</dd>
            </div>
            <div>
              <dt>{t('finder.ic.family')}</dt>
              <dd>{ic.family || t('finder.device.not_available')}</dd>
            </div>
            <div>
              <dt>{t('finder.ic.function')}</dt>
              <dd>{ic.function || t('finder.device.not_available')}</dd>
            </div>
            <div>
              <dt>{t('finder.ic.package')}</dt>
              <dd>{ic.package || t('finder.device.not_available')}</dd>
            </div>
            <div>
              <dt>{t('finder.ic.pins')}</dt>
              <dd>{ic.pins ?? t('finder.device.not_available')}</dd>
            </div>
            <div>
              <dt>{t('finder.ic.voltage')}</dt>
              <dd>
                {ic.voltage_min != null || ic.voltage_max != null
                  ? `${ic.voltage_min ?? '?'} – ${ic.voltage_max ?? '?'} V`
                  : t('finder.device.not_available')}
              </dd>
            </div>
          </dl>

          {ic.notes && <p className="finder-part-notes">{ic.notes}</p>}

          <div className="finder-block">
            <div className="finder-block-title">{t('finder.device.ics')}</div>
            {ic.devices.length === 0 ? (
              <p className="finder-block-empty">{t('finder.device.ics_empty')}</p>
            ) : (
              <ul className="finder-list">
                {ic.devices.map((row) => (
                  <li key={row.id}>
                    <button type="button" className="finder-row" onClick={() => void openDevice(row.id)}>
                      <span className="finder-row-main">{row.commercial_name}</span>
                      <span className="finder-row-sub">
                        {[row.brand_name, row.model_ref, row.board_area].filter(Boolean).join(' · ')}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="finder-block">
            <div className="finder-block-title">{t('finder.ic.equivalences')}</div>
            {ic.equivalences.length === 0 ? (
              <p className="finder-block-empty">{t('finder.ic.equivalences_empty')}</p>
            ) : (
              <ul className="finder-list">
                {ic.equivalences.map((row) => (
                  <li key={row.id}>
                    <div className="finder-row finder-row-static">
                      <span className="finder-row-main">{t('finder.ic.kind.' + row.kind)}</span>
                      <span className="finder-row-sub">
                        {[row.restrictions, row.evidence].filter(Boolean).join(' · ') || t('finder.device.no_evidence')}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {showHome && (
        <>
          <section className="finder-stats">
            <div className="finder-block-title">{t('finder.stats.title')}</div>
            {statsError && (
              <div className="finder-notice finder-notice-error" role="status">
                <p>{t('finder.error.unavailable')}</p>
                <span className="finder-notice-actions">
                  <button type="button" className="finder-btn finder-btn-ghost" onClick={() => void loadDashboard()}>
                    {t('finder.action.retry')}
                  </button>
                </span>
              </div>
            )}
            {stats && (
              <>
                <div className="finder-grid">
                  <Stat label={t('finder.stats.brands')} value={stats.brands} />
                  <Stat label={t('finder.stats.devices')} value={stats.devices} />
                  <Stat label={t('finder.stats.parts')} value={stats.parts} />
                  <Stat label={t('finder.stats.ics')} value={stats.ics} />
                  <Stat label={t('finder.stats.compat')} value={stats.compatibilities} />
                  <Stat label={t('finder.stats.media')} value={stats.media} />
                </div>
                <div className="finder-coverage">
                  <span>
                    {t('finder.stats.missing_model_ref', { count: stats.devices_without_model_ref })}
                  </span>
                  <span>{t('finder.stats.missing_image', { count: stats.devices_without_image })}</span>
                </div>
              </>
            )}
          </section>

          <section className="finder-brands">
            <div className="finder-block-title">
              {t('finder.brands.title')} · {filteredBrands.length}
            </div>
            {mode !== 'photo' && (
              <input
                className="finder-input finder-brand-search"
                value={brandQuery}
                onChange={(event) => setBrandQuery(event.target.value)}
                placeholder={t('finder.brands.search')}
                aria-label={t('finder.brands.search')}
                spellCheck={false}
                autoComplete="off"
              />
            )}
            <div className="finder-brand-grid">
              {filteredBrands.map((brand) => (
                <button key={brand.id} type="button" className="finder-brand-card" onClick={() => void openBrand(brand)}>
                  <span className="finder-brand-mark finder-brand-mark-neutral" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <rect x="6" y="2" width="12" height="20" rx="2" />
                      <circle cx="12" cy="18" r="1" />
                    </svg>
                  </span>
                  <span className="finder-brand-name">{brand.name}</span>
                  <span className="finder-brand-count">{t('finder.brands.devices', { count: brand.device_count })}</span>
                </button>
              ))}
            </div>
          </section>

          <p className="finder-footnote">{t('finder.footnote')}</p>
        </>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="finder-stat">
      <span className="finder-stat-value">{value}</span>
      <span className="finder-stat-label">{label}</span>
    </div>
  )
}
