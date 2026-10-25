// Logos locaux — plus de CDN externe (Clearbit HS, cdn.simpleicons bloqué)
// Tous les SVG sont dans public/brand-logos/ (19 issus de simple-icons + 19 générés)
// Servi par Vite : /brand-logos/<slug>.svg

// Slug local pour chaque marque (38)
const BRAND_SLUG: Record<string, string> = {
  'AGM': 'agm',
  'Alcatel': 'alcatel',
  'Apple': 'apple',
  'ASUS': 'asus',
  'Blackview': 'blackview',
  'CAT': 'cat',
  'Doogee': 'doogee',
  'Fairphone': 'fairphone',
  'Google': 'google',
  'Honor': 'honor',
  'HTC': 'htc',
  'Huawei': 'huawei',
  'Infinix': 'infinix',
  'itel': 'itel',
  'iQOO': 'iqoo',
  'Lenovo': 'lenovo',
  'LG': 'lg',
  'Meizu': 'meizu',
  'Motorola': 'motorola',
  'Nokia': 'nokia',
  'Nothing': 'nothing',
  'nubia': 'nubia',
  'OnePlus': 'oneplus',
  'OPPO': 'oppo',
  'Oukitel': 'oukitel',
  'POCO': 'poco',
  'Realme': 'realme',
  'Redmi': 'redmi',
  'Samsung': 'samsung',
  'Sharp': 'sharp',
  'Sony': 'sony',
  'TCL': 'tcl',
  'Tecno': 'tecno',
  'Ulefone': 'ulefone',
  'Vivo': 'vivo',
  'Wiko': 'wiko',
  'Xiaomi': 'xiaomi',
  'ZTE': 'zte',
}

function normalizeBrand(name: string): string {
  return name.trim()
}

export function getBrandLogoUrl(brandName: string): string | null {
  const name = normalizeBrand(brandName)
  if (!name) return null
  // Recherche directe (casse sensible)
  if (BRAND_SLUG[name]) return `/brand-logos/${BRAND_SLUG[name]}.svg`
  // Recherche insensible à la casse
  const lower = name.toLowerCase()
  for (const [k, v] of Object.entries(BRAND_SLUG)) {
    if (k.toLowerCase() === lower) return `/brand-logos/${v}.svg`
  }
  // Fallback générique : slug dérivé (ex: "OnePlus" -> "oneplus")
  const slug = lower.replace(/[^a-z0-9]/g, '')
  if (slug) return `/brand-logos/${slug}.svg`
  return null
}

export function getBrandFallbackIcon(name: string): string {
  const words = name.trim().split(/\s+/g)
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + (words[1]?.[0] || '')).toUpperCase()
}

// Pour debug : liste tous les slugs disponibles
export const ALL_BRAND_SLUGS = Object.values(BRAND_SLUG)
