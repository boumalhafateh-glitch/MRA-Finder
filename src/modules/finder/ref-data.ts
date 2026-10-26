// ─────────────────────────────────────────────────────────────────────────────
// MRA FINDER — données de la maquette de référence (copie d'écran MRA-ERP v4.0.8)
// Contenu figé : compteurs, répartition, modèles récents, raccourcis, recherches.
// Aucune valeur n'est inventée à l'exécution : tout ce qui s'affiche est déclaré ici.
// ─────────────────────────────────────────────────────────────────────────────

export interface RefStat {
  value: number
  label: string
  delta: string
  icon: 'phone' | 'shield' | 'database' | 'chip'
}

export const REF_STATS: RefStat[] = [
  { value: 306, label: 'MODÈLES', delta: '+12 ce mois', icon: 'phone' },
  { value: 7, label: 'MARQUES', delta: '+1 ce mois', icon: 'shield' },
  { value: 85, label: 'SCHÉMAS', delta: '+8 ce mois', icon: 'database' },
  { value: 40, label: 'CONNECTEURS', delta: '+5 ce mois', icon: 'chip' },
]

export interface RefBrandSlice {
  name: string
  count: number
  percent: number
  color: string
}

// Ordre de la légende (tel qu'affiché à droite du donut dans la référence)
export const REF_BRAND_SLICES: RefBrandSlice[] = [
  { name: 'Samsung', count: 82, percent: 26.8, color: '#2570EE' },
  { name: 'Xiaomi', count: 68, percent: 22.2, color: '#F2640B' },
  { name: 'iPhone', count: 52, percent: 17.0, color: '#F5B91E' },
  { name: 'Oppo', count: 34, percent: 11.1, color: '#46B357' },
  { name: 'Realme', count: 28, percent: 9.2, color: '#6C5CE7' },
  { name: 'Infinix', count: 18, percent: 5.9, color: '#29C2F6' },
  { name: 'Itel', count: 12, percent: 3.9, color: '#C9B7A8' },
  { name: 'Autres', count: 12, percent: 3.9, color: '#7E97C4' },
]

// Ordre horaire des segments sur le donut (démarre en haut, sens des aiguilles)
export const REF_DONUT_ORDER = [
  'Samsung', 'Xiaomi', 'iPhone', 'Oppo', 'Infinix', 'Realme', 'Itel', 'Autres',
]

export const REF_DONUT_TOTAL = 306

export interface RefRecentModel {
  brand: string
  model: string
  date: string
}

export const REF_RECENT_MODELS: RefRecentModel[] = [
  { brand: 'Samsung', model: 'Samsung Galaxy A53', date: '2026-10-24 15:42' },
  { brand: 'Xiaomi', model: 'Xiaomi Redmi Note 10S', date: '2026-10-24 14:17' },
  { brand: 'Realme', model: 'Realme C11 2021', date: '2026-10-24 13:05' },
  { brand: 'Oppo', model: 'Oppo A16s', date: '2026-10-24 11:32' },
  { brand: 'Infinix', model: 'Infinix Hot 12', date: '2026-10-24 10:18' },
  { brand: 'Apple', model: 'iPhone 11', date: '2026-10-24 09:43' },
]

export interface RefQuickBrand {
  key: string
  title: string
  label?: string
}

export const REF_QUICK_BRANDS: RefQuickBrand[] = [
  { key: 'samsung', title: 'Samsung', label: 'Samsung' },
  { key: 'xiaomi', title: 'Xiaomi', label: 'Xiaomi' },
  { key: 'iphone', title: 'iPhone', label: 'iPhone' },
  { key: 'oppo', title: 'Oppo', label: 'Oppo' },
  { key: 'realme', title: 'Realme' },
  { key: 'infinix', title: 'Infinix' },
  { key: 'itel', title: 'Itel' },
  { key: 'autres', title: 'Autres', label: 'Autres' },
]

export interface RefQuickAction {
  key: string
  label: string
  icon: 'plus' | 'doc' | 'pmic' | 'connector'
}

export const REF_QUICK_ACTIONS: RefQuickAction[] = [
  { key: 'add-model', label: 'Ajouter un modèle', icon: 'plus' },
  { key: 'schematics', label: 'Voir les schémas', icon: 'doc' },
  { key: 'pmic', label: 'Accéder au PMIC', icon: 'pmic' },
  { key: 'connector', label: 'Rechercher un connecteur', icon: 'connector' },
]

export interface RefRecentSearch {
  term: string
  when: string
}

export const REF_RECENT_SEARCHES: RefRecentSearch[] = [
  { term: 'Redmi Note 10S PMIC', when: "Aujourd'hui 14:32" },
  { term: 'Samsung A53 schéma', when: "Aujourd'hui 11:26" },
  { term: 'Oppo A16s connecteur', when: "Aujourd'hui 09:17" },
  { term: 'iPhone 11 board view', when: 'Hier 18:45' },
  { term: 'Realme C11 2021', when: 'Hier 16:03' },
]

export interface RefTopSearch {
  rank: number
  term: string
  count: number
}

export const REF_TOP_SEARCHES: RefTopSearch[] = [
  { rank: 1, term: 'Redmi Note 10S', count: 42 },
  { rank: 2, term: 'Samsung A53', count: 37 },
  { rank: 3, term: 'Redmi 9A', count: 31 },
  { rank: 4, term: 'iPhone 11', count: 28 },
  { rank: 5, term: 'Oppo A16s', count: 24 },
]

export const REF_COVERAGE = 94

export interface RefMiniStat {
  label: string
  value: number
}

export const REF_MINI_STATS: RefMiniStat[] = [
  { label: 'BRANDS', value: 7 },
  { label: 'MODELS', value: 306 },
  { label: 'SCHEMATICS', value: 85 },
  { label: 'CONNECTORS', value: 40 },
]

export const REF_TABS = ['APERÇU GÉNÉRAL', 'RÉPARTITION', 'TENDANCES', 'STATISTIQUES'] as const

export interface RefNavEntry {
  key: string
  title: string
  sub: string
  icon: 'home' | 'shop' | 'shield' | 'search' | 'flask' | 'gear' | 'brain'
  active?: boolean
  chevron?: boolean
}

export const REF_NAV: RefNavEntry[] = [
  { key: 'dashboard', title: 'DASHBOARD', sub: '', icon: 'home', chevron: true },
  { key: 'magasin', title: 'MAGASIN', sub: 'POS • Stock • Clients • Achats', icon: 'shop' },
  { key: 'sav', title: 'SAV', sub: 'Réception • Kanban • WhatsApp', icon: 'shield' },
  { key: 'finder', title: 'FINDER', sub: 'Recherche • Catalogue • Schémas', icon: 'search', active: true },
  { key: 'lab', title: 'LAB', sub: 'Diagnostic • Mesures • Guides', icon: 'flask' },
  { key: 'parametres', title: 'PARAMÈTRES', sub: 'Général • Magasins • Utilisateurs', icon: 'gear' },
  { key: 'zawali', title: 'ZAWALI AI', sub: 'Assistant Intelligent', icon: 'brain' },
]
