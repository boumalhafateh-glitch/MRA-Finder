// Logos officiels — mix PNG/WEBP/JPG locaux (vrais logos) + SVG fallback
// Tous les fichiers sont dans public/brand-logos/ (servis par Vite à /brand-logos/...)

const BRAND_FILE: Record<string, string> = {
  'AGM': 'agm.svg',
  'Alcatel': 'alcatel.png',
  'Apple': 'apple.png',
  'ASUS': 'asus.svg', // PNG etait blanc sur blanc invisible, SVG noir lisible
  'Blackview': 'blackview.svg',
  'CAT': 'cat.svg',
  'Doogee': 'doogee.svg',
  'Fairphone': 'fairphone.png',
  'Google': 'google.svg', // G multicolore officiel - SVG icon plus propre que Dota 2 PNG
  'Honor': 'honor.svg', // PNG blanc invisible, SVG noir HONOR lisible
  'HTC': 'htc.png',
  'Huawei': 'huawei.png',
  'Infinix': 'infinix.png',
  'itel': 'itel.png',
  'iQOO': 'iqoo.svg',
  'Lenovo': 'lenovo.svg', // WEBP etait fond sombre, SVG rouge officiel mieux sur tuile blanche
  'LG': 'lg.png',
  'Meizu': 'meizu.svg',
  'Motorola': 'motorola.png',
  'Nokia': 'nokia.png',
  'Nothing': 'nothing.png',
  'nubia': 'nubia.svg',
  'OnePlus': 'oneplus.png',
  'OPPO': 'oppo.png',
  'Oukitel': 'oukitel.svg',
  'POCO': 'poco.webp',
  'Realme': 'realme.png',
  'Redmi': 'redmi.png',
  'Samsung': 'samsung.png',
  'Sharp': 'sharp.jpg',
  'Sony': 'sony.svg', // PNG etait Samsung mal labelle, SVG noir SONY propre
  'TCL': 'tcl.png',
  'Tecno': 'tecno.jpg',
  'Ulefone': 'ulefone.jpg',
  'Vivo': 'vivo.png',
  'Wiko': 'wiko.jpg',
  'Xiaomi': 'xiaomi.png',
  'ZTE': 'zte.png',
}

function normalizeBrand(name: string): string {
  return name.trim()
}

export function getBrandLogoUrl(brandName: string): string | null {
  const name = normalizeBrand(brandName)
  if (!name) return null
  if (BRAND_FILE[name]) return `/brand-logos/${BRAND_FILE[name]}`
  const lower = name.toLowerCase()
  for (const [k, v] of Object.entries(BRAND_FILE)) {
    if (k.toLowerCase() === lower) return `/brand-logos/${v}`
  }
  const slug = lower.replace(/[^a-z0-9]/g, '')
  if (slug) return `/brand-logos/${slug}.svg`
  return null
}

export function getBrandFallbackIcon(name: string): string {
  const words = name.trim().split(/\s+/g)
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + (words[1]?.[0] || '')).toUpperCase()
}

export const ALL_BRAND_SLUGS = Object.values(BRAND_FILE)
