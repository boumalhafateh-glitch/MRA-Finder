// Mapping marque -> logo réel
// Priorité : Simple Icons CDN (SVG clair) pour marques tech connues, sinon Clearbit (PNG)
// Fallback : initiales si échec

export const BRAND_DOMAINS: Record<string, string> = {
  'AGM': 'agm-mobile.com',
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
  'POCO': 'po.co',
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

// Slugs Simple Icons (https://simpleicons.org) — seulement ceux confirmés présents
export const SIMPLE_ICONS_SLUGS: Record<string, string> = {
  'Apple': 'apple',
  'ASUS': 'asus',
  'Blackview': 'blackview', // fallback clearbit si 404
  'CAT': 'caterpillar', // CAT -> caterpillar icon (proche)
  'Google': 'google',
  'Honor': 'honor',
  'HTC': 'htc',
  'Huawei': 'huawei',
  'Infinix': 'infinix',
  'Lenovo': 'lenovo',
  'LG': 'lg',
  'Motorola': 'motorola',
  'Nokia': 'nokia',
  'OnePlus': 'oneplus',
  'OPPO': 'oppo',
  'Realme': 'realme',
  'Samsung': 'samsung',
  'Sharp': 'sharp',
  'Sony': 'sony',
  'TCL': 'tcl',
  'Vivo': 'vivo',
  'Xiaomi': 'xiaomi',
  'ZTE': 'zte',
  // Marques avec logo approx via simple icons alternatifs
  'POCO': 'poco',
  'Nothing': 'nothing',
}

export function getBrandLogoUrl(brandName: string, prefer: 'auto' | 'simple' | 'clearbit' = 'auto'): string | null {
  const name = brandName.trim()
  if (!name) return null

  // 1) Si on a un slug Simple Icons, on tente CDN simpleicons
  if (prefer === 'simple' || (prefer === 'auto' && SIMPLE_ICONS_SLUGS[name])) {
    const slug = SIMPLE_ICONS_SLUGS[name]
    if (slug) return `https://cdn.simpleicons.org/${slug}/00D9FF` // cyan color for dark theme
  }

  // 2) Clearbit fallback (PNG, fonctionne pour toutes les marques avec domaine)
  const domain = BRAND_DOMAINS[name] || BRAND_DOMAINS[name.toLowerCase()] || BRAND_DOMAINS[name.toUpperCase()]
  if (domain) {
    return `https://logo.clearbit.com/${domain}?size=80`
  }

  // 3) Essai générique : logo.clearbit avec domaine deviné (marque + .com)
  const guessed = name.toLowerCase().replace(/\s+/g, '') + '.com'
  return `https://logo.clearbit.com/${guessed}?size=80`
}

export function getBrandFallbackIcon(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + (words[1]?.[0] || '')).toUpperCase()
}
