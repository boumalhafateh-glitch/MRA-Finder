import { LanguageProvider, useTranslation, type Lang } from './contexts/LanguageContext'
import FinderModule from './modules/finder/FinderModule'

/**
 * Enveloppe de l'aperçu local.
 *
 * Elle n'ajoute aucune fonctionnalité à Finder : seulement un bandeau qui dit
 * d'où viennent les données affichées et un sélecteur de langue (FR/EN/AR) pour
 * vérifier la trilinguie hors de MRA-ERP. Le module ci-dessous est la copie
 * intégrale de `MRA-ERP/src/modules/finder/FinderModule.tsx`, inchangée.
 *
 * Le pont `window.api.finder` vient du preload Electron (voir electron/main.js) :
 * le moteur de recherche est celui de MRA-ERP, sur une base de développement
 * locale, jamais sur la base de production.
 */
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
        padding: '10px 16px',
        borderBottom: '1px solid var(--cyan)',
        background: 'var(--bg-primary)',
        color: 'var(--text-dim)',
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        lineHeight: 1.5,
        position: 'sticky',
        top: 0,
        zIndex: 20,
      }}
    >
      <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <strong style={{ color: 'var(--cyan)', letterSpacing: 1 }}>APERÇU LOCAL — MRA FINDER</strong>
        <span>
          moteur réel (electron/services/finder.js) · base de développement data/finder-dev.db ·
          catalogue de départ : seed du dépôt MRA-ERP (306 modèles, 7 marques)
        </span>
      </div>
      <div style={{ marginTop: 4, maxWidth: '78ch' }}>
        Aucune donnée de production : la base est créée localement à partir du seed public du
        dépôt. Pièces, IC et compatibilités ne s’affichent que s’ils existent réellement dans
        cette base (0 = rien n’a été importé, rien n’est simulé).
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
              borderRadius: 4,
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              padding: '3px 8px',
              cursor: 'pointer',
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
