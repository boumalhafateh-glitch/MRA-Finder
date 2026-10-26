import { LanguageProvider } from './contexts/LanguageContext'
import FinderModule from './modules/finder/FinderModule'

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mra-shell">
      <aside className="mra-sidebar" aria-label="Navigation">
        <div className="mra-sidebar-brand">
          <div className="mra-sidebar-logo">M</div>
          <div className="mra-sidebar-brand-text">
            <span className="mra-sidebar-brand-title">MRA-ERP</span>
            <span className="mra-sidebar-brand-sub">MASTER REPAIR ACADEMY</span>
          </div>
        </div>
        <nav className="mra-sidebar-nav">
          <button className="mra-nav-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-5H9v5H4a1 1 0 0 1-1-1z"/></svg>
            <span>DASHBOARD<small style={{display:'none'}}>Accueil</small></span>
          </button>
          <button className="mra-nav-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 7h16v10H4z"/><path d="M8 7V5a4 4 0 0 1 8 0v2"/><path d="M9 12h6"/></svg>
            <span>MAGASIN<small>POS · Stock · Clients · Achats</small></span>
          </button>
          <button className="mra-nav-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 3l7 4v5c0 4-3.2 7.2-7 8-3.8-.8-7-4-7-8V7z"/><path d="M9 12l2 2 4-4"/></svg>
            <span>SAV<small>Réception · Kanban · WhatsApp</small></span>
          </button>
          <button className="mra-nav-item is-active">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="11" cy="11" r="6"/><path d="M20 20l-3-3"/></svg>
            <span>FINDER<small>Recherche · Catalogue · Schémas</small></span>
          </button>
          <button className="mra-nav-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M9 3h6l2 6-5 8-5-8z"/><path d="M9 14h6"/><circle cx="12" cy="7" r="1.2"/></svg>
            <span>LAB<small>Diagnostic · Mesures · Guides</small></span>
          </button>
          <button className="mra-nav-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>
            <span>PARAMÈTRES<small>Général · Magasins · Utilisateurs</small></span>
          </button>
          <button className="mra-nav-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M9.5 2a7.5 7.5 0 0 0-7 9.5c0 2 1 3.8 2.5 5L12 22l7-5.5A7.5 7.5 0 0 0 9.5 2z"/><circle cx="12" cy="10" r="2.5"/><path d="M9 16c1 1.2 4 1.2 6 0"/></svg>
            <span>ZAWALI AI<small>Assistant Intelligent</small></span>
          </button>
        </nav>
        <div className="mra-sidebar-mascot">
          <div className="mra-mascot-box">
            <img src="/images/panther-mra.png" alt="" style={{width:'100%',height:'100%',objectFit:'cover',objectPosition:'center top'}} />
            <div style={{position:'absolute',bottom:0,left:0,right:0,height:40,background:'linear-gradient(transparent, rgba(0,0,0,0.85))'}} />
            <span className="mra-mascot-label">MRA FINDER</span>
            <span className="mra-mascot-sub">TROUVE. ANALYSE. RÉPARE.</span>
          </div>
        </div>
      </aside>
      <div className="mra-main">
        <div className="mra-content">{children}</div>
        <footer className="mra-footer">
          <div className="mra-footer-left">
            MRA-ERP v4.0.8 <span style={{opacity:0.3, margin:'0 6px'}}>|</span> Finder Module <span style={{opacity:0.3, margin:'0 6px'}}>|</span> DB: mra-erp.db
          </div>
          <div className="mra-footer-right" style={{gap:12}}>
            <span>UNIVERS DES APPAREILS &nbsp;•&nbsp; UNE SEULE PLATEFORME</span>
            <span style={{display:'flex',alignItems:'center',gap:5}}><span className="mra-footer-dot" /> Système local <span style={{opacity:0.5}}>📶</span></span>
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
