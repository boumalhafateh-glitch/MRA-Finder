import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'
import fr from '../locales/fr.json'
import en from '../locales/en.json'
import ar from '../locales/ar.json'

export type Lang = 'fr' | 'en' | 'ar'

const translations: Record<Lang, Record<string, any>> = { fr, en, ar }

// Une seule alerte par couple cle/langue : un même manquement se répète à chaque
// rendu, le bruit serait autrement intenable en dev.
const warnedMissing = new Set<string>()
function warnMissing(key: string, lang: Lang) {
  const id = lang + ':' + key
  if (warnedMissing.has(id)) return
  warnedMissing.add(id)
  console.warn(`[i18n] clé manquante : ${key} (${lang})`)
}

interface LangContextType {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: string, params?: Record<string, string | number>) => string
  dir: 'ltr' | 'rtl'
}

const LangContext = createContext<LangContextType>(null!)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('fr')

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    localStorage.setItem('mra-lang', l)
    document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.lang = l
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem('mra-lang') as Lang | null
    if (saved && translations[saved]) setLang(saved)
    else setLang('fr')
  }, [setLang])

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    const keys = key.split('.')
    let val: any = translations[lang]
    for (const k of keys) {
      if (!val || typeof val !== 'object') { warnMissing(key, lang); return key }
      val = val[k]
    }
    let result = typeof val === 'string' ? val : key
    if (typeof val !== 'string') warnMissing(key, lang)
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        result = result.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
      })
    }
    return result
  }, [lang])

  const dir = lang === 'ar' ? 'rtl' : 'ltr'

  return (
    <LangContext.Provider value={{ lang, setLang, t, dir }}>
      {children}
    </LangContext.Provider>
  )
}

export function useTranslation() {
  const ctx = useContext(LangContext)
  if (!ctx) throw new Error('useTranslation must be used within LanguageProvider')
  return ctx
}
