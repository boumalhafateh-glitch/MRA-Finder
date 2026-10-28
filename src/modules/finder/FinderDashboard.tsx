import { useLayoutEffect, useMemo, useState, type ReactNode } from 'react'
import {
  REF_STATS, REF_BRAND_SLICES, REF_DONUT_ORDER, REF_DONUT_TOTAL, REF_RECENT_MODELS,
  REF_QUICK_BRANDS, REF_QUICK_ACTIONS, REF_RECENT_SEARCHES, REF_TOP_SEARCHES,
  REF_COVERAGE, REF_MINI_STATS, REF_TABS,
} from './ref-data'
import {
  IconShield, IconSearch, IconGear,
  IconChevronRight, IconChevronDown, IconClose, IconPlus, IconDoc, IconChip,
  IconConnector, IconPhone, IconDatabase, IconGrid, IconArrowUp, IconSignal,
  IconUser, IconStore, IconCamera, IconTag, IconChart, IconPin,
} from './ref-icons'
import './FinderDashboard.css'

const STAT_ICONS = { phone: IconPhone, shield: IconShield, database: IconDatabase, chip: IconChip }
const ACTION_ICONS = { plus: IconPlus, doc: IconDoc, pmic: IconChip, connector: IconConnector }

interface DashboardProps {
  onSearch: (term: string) => void
  onOpenBrand: (name: string) => void
  onOpenImport: () => void
}

/* Carte à coins coupés, liseré cyan — calque extérieur (liseré) + calque intérieur (fond) */
function Panel({ children, className = '', style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`ex-panel ${className}`} style={style}>
      <div className="ex-panel-in">{children}</div>
    </div>
  )
}

/* Marque de tuile (rail droit) — mots-symbles et logos transparents, fidèles à la maquette */
function TileMark({ bKey }: { bKey: string }) {
  switch (bKey) {
    case 'samsung':
      return <span className="ex-wordmark ex-wordmark-samsung">SAMSUNG</span>
    case 'xiaomi':
      return <img className="ex-brand-img" src="/brand-logos/xiaomi.svg" alt="" loading="lazy" />
    case 'iphone':
      return <img className="ex-brand-img ex-apple-white" src="/brand-logos/apple.svg" alt="" loading="lazy" />
    case 'oppo':
      return <span className="ex-wordmark ex-wordmark-oppo">oppo</span>
    case 'realme':
      return <span className="ex-wordmark ex-wordmark-realme">realme</span>
    case 'infinix':
      return <span className="ex-wordmark ex-wordmark-infinix">Infinix</span>
    case 'itel':
      return <img className="ex-brand-img ex-itel" src="./images/ref/itel.svg" alt="" loading="lazy" />
    default:
      return <IconGrid size={30} className="ex-autres-icon" />
  }
}

/* Pastille de marque de la liste « Modèles récemment ajoutés » */
function BadgeMark({ brand }: { brand: string }) {
  switch (brand) {
    case 'Samsung':
      return <span className="ex-badge ex-badge-samsung">SAMSUNG</span>
    case 'Xiaomi':
      return <img className="ex-badge-img" src="/brand-logos/xiaomi.svg" alt="" loading="lazy" />
    case 'Realme':
      return <span className="ex-badge ex-badge-realme">R</span>
    case 'Oppo':
      return <span className="ex-badge ex-badge-oppo">oppo</span>
    case 'Infinix':
      return <span className="ex-badge ex-badge-infinix">infinix</span>
    case 'Apple':
      return (
        <span className="ex-badge ex-badge-apple">
          <img src="/brand-logos/apple.svg" alt="" loading="lazy" />
        </span>
      )
    default:
      return <span className="ex-badge ex-badge-apple">{brand.slice(0, 1)}</span>
  }
}

/* Dimensions de la maquette de référence : la scène est figée dans ce cadre,
   puis réduite/agrandie uniformément pour tenir entièrement dans la fenêtre,
   sans jamais rogner un élément ni afficher de barre de défilement. */
const DESIGN_W = 1536
const DESIGN_H = 1024

export default function FinderDashboard({ onSearch, onOpenBrand, onOpenImport }: DashboardProps) {
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    const compute = () => {
      setScale(Math.min(window.innerWidth / DESIGN_W, window.innerHeight / DESIGN_H))
    }
    compute()
    window.addEventListener('resize', compute)
    return () => window.removeEventListener('resize', compute)
  }, [])

  const [quickTab, setQuickTab] = useState<'brand' | 'model' | 'photo'>('brand')
  const [brandQuery, setBrandQuery] = useState('')
  const [topQuery, setTopQuery] = useState('')
  const [bottomTab, setBottomTab] = useState<number>(0)

  const filteredBrands = useMemo(() => {
    const q = brandQuery.trim().toLowerCase()
    if (!q) return REF_QUICK_BRANDS
    return REF_QUICK_BRANDS.filter(b => b.title.toLowerCase().includes(q))
  }, [brandQuery])

  const donutGradient = useMemo(() => {
    const byName = new Map(REF_BRAND_SLICES.map(s => [s.name, s]))
    // Fins interstices sombres entre chaque portion, comme la maquette
    const GAP = 0.9
    const usable = 100 - REF_DONUT_ORDER.length * GAP
    let acc = 0
    const stops: string[] = []
    REF_DONUT_ORDER.forEach(name => {
      const s = byName.get(name)!
      const span = (s.percent * usable) / 100
      stops.push(`${s.color} ${acc.toFixed(2)}% ${(acc + span).toFixed(2)}%`)
      acc += span
      stops.push(`#04101f ${acc.toFixed(2)}% ${(acc + GAP).toFixed(2)}%`)
      acc += GAP
    })
    return `conic-gradient(from -90deg, ${stops.join(', ')})`
  }, [])

  const maxTop = REF_TOP_SEARCHES[0].count
  const coverageCirc = 2 * Math.PI * 52

  return (
    <div className="mra-fit-wrap">
    <div className="mra-app" style={{ transform: `scale(${scale})` }}>
      {/* ───────────────────────── TOPBAR ───────────────────────── */}
      <header className="mra-topbar">
        <form
          className="mra-topsearch"
          onSubmit={(e) => { e.preventDefault(); if (topQuery.trim()) onSearch(topQuery.trim()) }}
        >
          <IconSearch size={19} className="mra-topsearch-icon" />
          <input
            value={topQuery}
            onChange={e => setTopQuery(e.target.value)}
            placeholder="Rechercher un modèle, une marque, un code..."
            aria-label="Recherche globale"
            spellCheck={false}
          />
          <kbd className="mra-kbd">Ctrl + K</kbd>
        </form>

        <div className="mra-topbar-right">
          <button type="button" className="mra-pill">
            <IconStore size={17} />
            <span>Magasin Principal</span>
            <IconChevronDown size={14} />
          </button>
          <button type="button" className="mra-pill mra-pill-lang">
            <span className="mra-flag" aria-hidden="true"><i /><i /><i /></span>
            <span>FR</span>
            <IconChevronDown size={14} />
          </button>
          <button type="button" className="mra-user">
            <span className="mra-user-avatar"><IconUser size={26} /></span>
            <span className="mra-user-text">
              <b>FATEH</b>
              <small>Administrateur</small>
            </span>
            <span className="mra-user-caret"><IconChevronDown size={14} /></span>
          </button>
          <button type="button" className="mra-gear" aria-label="Paramètres"><IconGear size={21} /></button>
        </div>
      </header>

      <div className="mra-body">
        {/* ───────────────────────── ESPACE DE TRAVAIL (pleine largeur, sidebar retirée) ───────────────────────── */}
        <div className="mra-workspace">
          {/* Bannière pleine largeur (au-dessus du rail, comme la maquette) */}
          <section className="mra-banner">
            <div className="mra-banner-text">
              <h1 className="mra-banner-title">FINDER</h1>
              <p className="mra-banner-sub">BASE DE DONNÉES • SCHÉMAS • PMIC • CONNECTEURS • RÉFÉRENCES</p>
            </div>
            <div className="mra-banner-slogan">
              <span>LE BON MODÈLE...</span>
              <span>AU BON ENDROIT.</span>
            </div>
            <img src="./images/ref/banner-scene.png" alt="" className="mra-banner-scene" aria-hidden="true" />
          </section>

          <div className="mra-columns">
            <main className="mra-main mra-center">
              {/* Cartes statistiques */}
              <section className="mra-stats" aria-label="Statistiques">
                {REF_STATS.map(s => {
                  const Icon = STAT_ICONS[s.icon]
                  return (
                    <Panel key={s.label} className="mra-stat-card">
                      <span className="mra-stat-hex"><Icon size={34} /></span>
                      <span className="mra-stat-body">
                        <span className="mra-stat-value">{s.value}</span>
                        <span className="mra-stat-label">{s.label}</span>
                        <span className="mra-stat-delta"><IconArrowUp size={13} />{s.delta}</span>
                      </span>
                    </Panel>
                  )
                })}
              </section>

              {/* Ligne milieu : donut + modèles récents */}
              <section className="mra-middle">
                <Panel className="mra-donut-panel">
                  <h2 className="ex-panel-title">RÉPARTITION PAR MARQUE</h2>
                  <div className="mra-donut-wrap">
                    <div className="mra-donut" style={{ background: donutGradient }}>
                      <div className="mra-donut-hole">
                        <b>{REF_DONUT_TOTAL}</b>
                        <span>MODÈLES</span>
                      </div>
                    </div>
                    <ul className="mra-legend">
                      {REF_BRAND_SLICES.map(s => (
                        <li key={s.name}>
                          <button
                            type="button"
                            className="mra-legend-row"
                            onClick={() => s.name !== 'Autres' && onOpenBrand(s.name)}
                          >
                            <span className="mra-legend-swatch" style={{ background: s.color }}>
                              {s.name === 'Xiaomi' && (
                                <img src="/brand-logos/xiaomi.svg" alt="" className="mra-legend-mi" aria-hidden="true" />
                              )}
                            </span>
                            <span className="mra-legend-name">{s.name}</span>
                            <span className="mra-legend-nums">
                              <b>{s.count}</b>
                              <em>({s.percent.toFixed(1)}%)</em>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </Panel>

                <Panel className="mra-recent-panel">
                  <div className="ex-panel-head">
                    <h2 className="ex-panel-title">MODÈLES RÉCEMMENT AJOUTÉS</h2>
                    <button type="button" className="ex-link" onClick={() => onSearch('')}>Voir tout</button>
                  </div>
                  <ul className="mra-recent-list">
                    {REF_RECENT_MODELS.map(m => (
                      <li key={m.model}>
                        <button type="button" className="mra-recent-row" onClick={() => onSearch(m.model)}>
                          <span className="mra-recent-logo">
                            <BadgeMark brand={m.brand} />
                          </span>
                          <span className="mra-recent-name">{m.model}</span>
                          <span className="mra-recent-date">{m.date}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </Panel>
              </section>

              {/* Panneau bas */}
              <Panel className="mra-bottom">
                <div className="mra-tabs" role="tablist">
                  {REF_TABS.map((tab, i) => (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={bottomTab === i}
                      key={tab}
                      className={`mra-tab${bottomTab === i ? ' is-active' : ''}`}
                      onClick={() => setBottomTab(i)}
                    >
                      {tab}
                    </button>
                  ))}
                  <IconChart size={22} className="mra-tabs-chart" />
                </div>

                <div className="mra-bottom-body">
                  <div className="mra-coverage">
                    <h3 className="ex-subtitle">COUVERTURE</h3>
                    <div className="mra-coverage-main">
                      <div className="mra-ring">
                        <svg viewBox="0 0 120 120">
                          <defs>
                            <linearGradient id="mraRingGradient" x1="0" y1="0" x2="1" y2="1">
                              <stop offset="0%" stopColor="#29c2f6" />
                              <stop offset="100%" stopColor="#2f6bff" />
                            </linearGradient>
                          </defs>
                          <circle className="mra-ring-track" cx="60" cy="60" r="52" />
                          <circle
                            className="mra-ring-fill"
                            cx="60" cy="60" r="52"
                            strokeDasharray={`${(coverageCirc * REF_COVERAGE) / 100} ${coverageCirc}`}
                          />
                        </svg>
                        <div className="mra-ring-center"><b>{REF_COVERAGE}%</b></div>
                      </div>
                      <p className="mra-coverage-text">Des modèles du<br />marché <b>({REF_DONUT_TOTAL})</b></p>
                      <img src="./images/ref/world-map-skyline.png" alt="" className="mra-worldmap" aria-hidden="true" />
                    </div>
                    <div className="mra-mini-stats">
                      {REF_MINI_STATS.map(ms => (
                        <div className="mra-mini" key={ms.label}>
                          <span>{ms.label}</span>
                          <b>{ms.value}</b>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mra-topsearch-panel">
                    <h3 className="ex-subtitle">TOP RECHERCHES</h3>
                    <ul className="mra-top-list">
                      {REF_TOP_SEARCHES.map(t => (
                        <li key={t.rank}>
                          <button type="button" className="mra-top-row" onClick={() => onSearch(t.term)}>
                            <span className="mra-top-rank"><span>{t.rank}</span></span>
                            <span className="mra-top-content">
                              <span className="mra-top-head">
                                <span className="mra-top-term">{t.term}</span>
                                <span className="mra-top-count">{t.count}</span>
                              </span>
                              <span className="mra-top-bar">
                                <span className="mra-top-bar-fill" style={{ width: `${(t.count / maxTop) * 100}%` }} />
                              </span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Panel>
            </main>

            {/* ───────────────────────── RAIL DROIT ───────────────────────── */}
            <aside className="mra-rail">
              <Panel className="mra-rail-block">
                <h2 className="ex-panel-title">RECHERCHE RAPIDE</h2>
                <div className="mra-qtabs" role="tablist">
                  <button type="button" role="tab" aria-selected={quickTab === 'brand'} className={`mra-qtab${quickTab === 'brand' ? ' is-gold' : ''}`} onClick={() => setQuickTab('brand')}>
                    <IconTag size={14} /> Par Marque
                  </button>
                  <button type="button" role="tab" aria-selected={quickTab === 'model'} className={`mra-qtab${quickTab === 'model' ? ' is-gold' : ''}`} onClick={() => setQuickTab('model')}>
                    <IconSearch size={14} /> Par Modèle
                  </button>
                  <button type="button" role="tab" aria-selected={quickTab === 'photo'} className={`mra-qtab${quickTab === 'photo' ? ' is-gold' : ''}`} onClick={() => setQuickTab('photo')}>
                    <IconPin size={14} /> Par Photo
                  </button>
                </div>

                {quickTab === 'photo' ? (
                  <div className="mra-photo-note">
                    <IconCamera size={26} />
                    <p>Recherche par photo indisponible sur ce poste.</p>
                  </div>
                ) : (
                  <>
                    <div className="mra-qinput">
                      <IconSearch size={18} />
                      <input
                        value={brandQuery}
                        onChange={e => setBrandQuery(e.target.value)}
                        placeholder={quickTab === 'brand' ? 'Entrez une marque...' : 'Entrez un modèle...'}
                        aria-label="Recherche rapide"
                        spellCheck={false}
                      />
                      {brandQuery && (
                        <button type="button" className="mra-qinput-clear" onClick={() => setBrandQuery('')} aria-label="Effacer">
                          <IconClose size={15} />
                        </button>
                      )}
                    </div>
                    <div className="mra-brand-tiles">
                      {filteredBrands.map(b => (
                        <button
                          type="button"
                          key={b.key}
                          className={`mra-brand-tile${b.label ? '' : ' is-centered'}`}
                          onClick={() => (b.key === 'autres' ? onSearch('') : onOpenBrand(b.title === 'iPhone' ? 'Apple' : b.title))}
                        >
                          <TileMark bKey={b.key} />
                          {b.label && <span className="mra-brand-tile-label">{b.label}</span>}
                        </button>
                      ))}
                      {filteredBrands.length === 0 && <p className="mra-tile-empty">Aucune marque trouvée.</p>}
                    </div>
                  </>
                )}
              </Panel>

              <Panel className="mra-rail-block">
                <h2 className="ex-panel-title">ACTIONS RAPIDES</h2>
                <div className="mra-actions">
                  {REF_QUICK_ACTIONS.map(a => {
                    const Icon = ACTION_ICONS[a.icon]
                    return (
                      <button
                        type="button"
                        key={a.key}
                        className={`mra-action mra-action--${a.icon}`}
                        onClick={() => (a.key === 'add-model' ? onOpenImport() : undefined)}
                      >
                        <Icon size={21} />
                        <span>{a.label}</span>
                      </button>
                    )
                  })}
                </div>
              </Panel>

              <Panel className="mra-rail-block mra-rail-last">
                <div className="ex-panel-head">
                  <h2 className="ex-panel-title">DERNIÈRES RECHERCHES</h2>
                  <button type="button" className="ex-link" onClick={() => onSearch('')}>Voir tout</button>
                </div>
                <ul className="mra-history">
                  {REF_RECENT_SEARCHES.map(h => (
                    <li key={h.term}>
                      <button type="button" className="mra-history-row" onClick={() => onSearch(h.term)}>
                        <IconSearch size={18} className="mra-history-icon" />
                        <span className="mra-history-term">{h.term}</span>
                        <span className="mra-history-when">{h.when}</span>
                        <IconChevronRight size={16} className="mra-history-chevron" />
                      </button>
                    </li>
                  ))}
                </ul>
              </Panel>
            </aside>
          </div>
        </div>
      </div>

      {/* ───────────────────────── BARRE D'ÉTAT ───────────────────────── */}
      <footer className="mra-statusbar">
        <div className="mra-status-left">
          <span>MRA-ERP v4.0.8</span>
          <i className="mra-sep" />
          <span>Finder Module</span>
          <i className="mra-sep" />
          <span>DB: mra-erp.db</span>
        </div>
        <div className="mra-status-center">UNIVERS DES APPAREILS&nbsp;&nbsp;•&nbsp;&nbsp;UNE SEULE PLATEFORME</div>
        <div className="mra-status-right">
          <span className="mra-status-dot" />
          <span>Système local</span>
          <i className="mra-sep" />
          <IconSignal size={18} />
        </div>
      </footer>
    </div>
    </div>
  )
}
