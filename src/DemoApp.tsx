import { LanguageProvider, useTranslation, type Lang } from './contexts/LanguageContext'
import FinderModule from './modules/finder/FinderModule'

const LANGS: Array<{ id: Lang; label: string }> = [
  { id: 'fr', label: 'FR' },
  { id: 'en', label: 'EN' },
  { id: 'ar', label: 'AR' },
]

function Banner() {
  const { lang, setLang } = useTranslation()
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 20px',
        borderBottom: '1px solid rgba(0,217,255,0.12)',
        background: 'rgba(5,11,20,0.85)',
        backdropFilter: 'blur(16px)',
        color: 'var(--text-dim)',
        fontFamily: 'var(--font-mono)',
        fontSize: 11.5,
        lineHeight: 1.5,
        position: 'sticky',
        top: 0,
        zIndex: 20,
      }}
    >
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'linear-gradient(135deg,#00d9ff,#00aeeF)', color: '#020a14',
          fontWeight: 800, letterSpacing: 0.5, fontSize: 11, padding: '4px 10px', borderRadius: 999,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: 50, background: '#020a14', display: 'inline-block' }} />
          MRA FINDER v2
        </span>
        <span style={{ opacity: 0.85 }}>moteur réel · base locale · 306 modèles · recherche fuzzy + autocomplete · export &amp; santé</span>
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {LANGS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setLang(item.id)}
            aria-pressed={lang === item.id}
            style={{
              background: lang === item.id ? 'var(--cyan)' : 'transparent',
              color: lang === item.id ? 'var(--bg-primary)' : 'var(--text-dim)',
              border: '1px solid var(--cyan)',
              borderRadius: 6,
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              fontWeight: 700,
              padding: '4px 10px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function DemoApp() {
  return (
    <LanguageProvider>
      <Banner />
      <FinderModule />
    </LanguageProvider>
  )
}
