// Mapping marque -> logo réel
// Clearbit a fermé en dec 2025 (logo.clearbit.com HS) → on utilise Google S2 favicons + Simple Icons CDN
// Simple Icons renvoie le SVG officiel en couleur réelle sur fond blanc (carte .finder-brand-logo blanche)

export const BRAND_DOMAINS: Record<string, string> = {
  'AGM': 'agmmobile.com',
  'Alcatel': 'alcatelmobile.com',
  'Apple': 'apple.com',
  'ASUS': 'asus.com',
  'Blackview': 'blackview.hk',
  'CAT': 'catphones.com',
  'Doogee': 'doogee.cc',
  'Fairphone': 'fairphone.com',
  'Google': 'google.com',
  'Honor': 'hihonor.com',
  'HTC': 'htc.com',
  'Huawei': 'huawei.com',
  'Infinix': 'infinixmobility.com',
  'itel': 'itel-mobile.com',
  'iQOO': 'iqoo.com',
  'Lenovo': 'lenovo.com',
  'LG': 'lg.com',
  'Meizu': 'meizu.com',
  'Motorola': 'motorola.com',
  'Nokia': 'nokia.com',
  'Nothing': 'nothing.tech',
  'nubia': 'nubia.com',
  'OnePlus': 'oneplus.com',
  'OPPO': 'oppo.com',
  'Oukitel': 'oukitel.com',
  'POCO': 'poco.in',
  'Realme': 'realme.com',
  'Redmi': 'mi.com',
  'Samsung': 'samsung.com',
  'Sharp': 'sharp.co.jp',
  'Sony': 'sony.com',
  'TCL': 'tcl.com',
  'Tecno': 'tecno-mobile.com',
  'Ulefone': 'ulefone.com',
  'Vivo': 'vivo.com',
  'Wiko': 'wikomobile.com',
  'Xiaomi': 'xiaomi.com',
  'ZTE': 'zte.com.cn',
}

// Slugs Simple Icons confirmés existants (https://simpleicons.org + cdn.simpleicons.org)
// On ne met QUE les marques où l'icône existe et correspond bien (pas de "caterpillar" pour CAT)
export const SIMPLE_ICONS_SLUGS: Record<string, string> = {
  'Apple': 'apple',
  'ASUS': 'asus',
  'Google': 'google',
  'Honor': 'honor',
  'HTC': 'htc',
  'Huawei': 'huawei',
  'Lenovo': 'lenovo',
  'LG': 'lg',
  'Motorola': 'motorola',
  'Nokia': 'nokia',
  'Nothing': 'nothing',
  'OnePlus': 'oneplus',
  'OPPO': 'oppo',
  'POCO': 'poco',
  'Realme': 'realme',
  'Samsung': 'samsung',
  'Sharp': 'sharp',
  'Sony': 'sony',
  'TCL': 'tcl',
  'Vivo': 'vivo',
  'Xiaomi': 'xiaomi',
  'ZTE': 'zte',
}

function findDomain(brandName: string): string | undefined {
  if (BRAND_DOMAINS[brandName]) return BRAND_DOMAINS[brandName]
  const lower = brandName.toLowerCase()
  for (const [k, v] of Object.entries(BRAND_DOMAINS)) {
    if (k.toLowerCase() === lower) return v
  }
  return undefined
}

export function getBrandLogoUrl(brandName: string, prefer: 'auto' | 'simple' | 'google' = 'auto'): string | null {
  const name = brandName.trim()
  if (!name) return null

  // 1) Simple Icons en priorité si slug connu — couleur officielle (pas de override 00D9FF)
  const slug = SIMPLE_ICONS_SLUGS[name] || SIMPLE_ICONS_SLUGS[name.toLowerCase()] || SIMPLE_ICONS_SLUGS[name.toUpperCase()]
  if (slug && (prefer === 'simple' || prefer === 'auto')) {
    // cdn.simpleicons.org/<slug> renvoie le SVG en couleur officielle du brand
    return `https://cdn.simpleicons.org/${slug}`
  }

  // 2) Google S2 favicons — remplace Clearbit (HS depuis dec 2025)
  //    Gratuit, sans clé, fonctionne pour toutes les marques avec domaine
  const domain = findDomain(name)
  if (domain) {
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
  }

  // 3) Fallback générique : domaine deviné
  const guessed = name.toLowerCase().replace(/\s+/g, '') + '.com'
  return `https://www.google.com/s2/favicons?domain=${guessed}&sz=128`
}

export function getBrandFallbackIcon(name: string): string {
  const words = name.trim().split(/\s+/g)
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + (words[1]?.[0] || '')).toUpperCase()
}
