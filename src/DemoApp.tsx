import { LanguageProvider } from './contexts/LanguageContext'
import FinderModule from './modules/finder/FinderModule'

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mra-shell">
      <aside className="mra-sidebar" aria-label="Navigation">
        <div className="mra-sidebar-brand">
          <div className="mra-sidebar-logo">MRA</div>
          <div className="mra-sidebar-brand-text">
            <span className="mra-sidebar-brand-title">MRA-ERP</span>
            <span className="mra-sidebar-brand-sub">Master Repair Academy</span>
          </div>
        </div>
        <nav className="mra-sidebar-nav">
          {[
            { k: 'dashboard', l: 'DASHBOARD' },
            { k: 'magasin', l: 'MAGASIN' },
            { k: 'sav', l: 'SAV' },
            { k: 'finder', l: 'FINDER', active: true },
            { k: 'lab', l: 'LAB' },
            { k: 'parametres', l: 'PARAMETRES' },
            { k: 'zawali', l: 'ZAWALI AI' },
          ].map((it) => (
            <button key={it.k} className={'mra-nav-item' + (it.active ? ' is-active' : '')} onClick={() => {}}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <path d="M8 12h8M12 8v8" />
              </svg>
              {it.l}
            </button>
          ))}
        </nav>
        <div className="mra-sidebar-mascot">
          <div className="mra-mascot-box" aria-hidden>
            <svg viewBox="0 0 84 64" width="84" height="64" xmlns="http://www.w3.org/2000/svg">
              <rect width="84" height="64" rx="10" fill="url(#mg2)" />
              <defs>
                <linearGradient id="mg2" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#ffcc00" />
                  <stop offset="100%" stopColor="#ff8c00" />
                </linearGradient>
              </defs>
              <text x="42" y="36" textAnchor="middle" fontFamily="Orbitron" fontWeight="900" fontSize="11" fill="#1a0a00">
                MRA
              </text>
              <text x="42" y="46" textAnchor="middle" fontSize="5" fill="#1a0a00" fontWeight="700">
                FINDER
              </text>
            </svg>
          </div>
          <span className="mra-mascot-label">MRA FINDER • v4.0</span>
          <span className="mra-mascot-version">Systeme operationnel</span>
        </div>
      </aside>
      <div className="mra-main">
        <header className="mra-topbar">
          <div className="mra-topbar-left">
            <button className="mra-topbar-menu" aria-label="Menu">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
            <div className="mra-topbar-logo">
              <div className="mra-topbar-diamond">M</div>
              <div className="mra-topbar-title">
                <b>MRA-ERP</b>
                <span>Master Repair Academy</span>
              </div>
            </div>
          </div>
          <div className="mra-topbar-center">
            <label className="mra-topbar-search">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input placeholder="Rechercher un produit, client..." aria-label="Recherche globale" />
              <kbd>Ctrl K</kbd>
            </label>
          </div>
          <div className="mra-topbar-right">
            <div className="mra-topbar-shop">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 7h12l-1 10H7z" />
                <path d="M9 7V5a3 3 0 0 1 6 0v2" />
              </svg>
              Magasin Principal
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>
            <div className="mra-topbar-divider" />
            <div className="mra-topbar-lang">
              FR{' '}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>
            <div className="mra-topbar-divider" />
            <div className="mra-topbar-user">
              <div className="mra-topbar-avatar">F</div>
              <div className="mra-topbar-user-text">
                <b>FATEH</b>
                <span>Administrateur</span>
              </div>
            </div>
            <button className="mra-topbar-gear" aria-label="Parametres">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
              </svg>
            </button>
          </div>
        </header>
        <div className="mra-content">{children}</div>
        <footer className="mra-footer">
          <div className="mra-footer-left">
            <span className="mra-footer-dot" /> MRA FINDER v4.0.8 <span style={{ opacity: 0.5 }}>•</span> Synchronise{' '}
            <span style={{ color: '#00ff99' }}>Connecte</span> <span style={{ opacity: 0.5 }}>•</span> 306 modeles <span style={{ opacity: 0.5 }}>•</span> 7
            marques · 85 schemas
          </div>
          <div className="mra-footer-right">
            Serveur actif <span className="mra-footer-dot" /> <span style={{ opacity: 0.6 }}>●</span> <span style={{ opacity: 0.6 }}>◐</span>
          </div>
        </footer>
      </div>
    </div>
  )
}

export default function DemoApp() {
  return (
    <LanguageProvider>
      <Shell>
        <FinderModule />
      </Shell>
    </LanguageProvider>
  )
}
