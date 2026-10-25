// EXTRAIT VERBATIM de MRA-ERP — src/types/global.d.ts
//   lignes 290..457  : interfaces Finder*
//   lignes 1077..1085 : contrat `window.api.finder`
// Ne pas éditer à la main : régénérer depuis MRA-ERP/src/types/global.d.ts si l'original change.
// Ajouts propres à cette copie : uniquement le bloc Window, à la fin.

interface FinderBrand {
  id: number
  name: string
  slug: string
  logo_path: string | null
  device_count: number
}

interface FinderDeviceSummary {
  id: number
  commercial_name: string
  model_ref: string
  release_year: number | null
  image_path: string | null
  brand_name: string
}

interface FinderAlias {
  alias: string
  lang: string
}

interface FinderPartRow {
  id: number
  name: string
  oem_ref: string
  confidence: string
  role?: string
  category_name: string | null
}

interface FinderCompatibilityRow {
  id: number
  status: string
  part_id: number | null
  device_from_id: number | null
  device_to_id: number | null
  differences: string
  conditions: string
  evidence: string
}

interface FinderIcRow {
  id: number
  ref: string
  marking?: string
  function?: string
  manufacturer?: string
  family?: string
  package?: string
  board_area?: string
}

interface FinderMediaRow {
  path: string
  kind: string
  license: string
  credit: string
}

interface FinderDevice extends FinderDeviceSummary {
  brand_id: number
  family: string
  generation: string
  variant_region: string
  product_code: string
  created_at: string
  updated_at: string
  aliases: FinderAlias[]
  parts: FinderPartRow[]
  compatibilities: FinderCompatibilityRow[]
  ics: FinderIcRow[]
  media: FinderMediaRow[]
  missing: string[]
}

interface FinderPart {
  id: number
  category_id: number | null
  category_name: string | null
  category_slug: string | null
  name: string
  part_type: string
  oem_ref: string
  notes: string
  confidence: string
  created_at: string
  updated_at: string
  refs: Array<{ kind: string; value: string; is_primary: number }>
  devices: Array<{ id: number; commercial_name: string; model_ref: string; release_year: number | null; brand_name: string; role: string }>
  compatibilities: FinderCompatibilityRow[]
  media: FinderMediaRow[]
}

interface FinderIc {
  id: number
  ref: string
  marking: string
  manufacturer: string
  family: string
  function: string
  package: string
  pins: number | null
  dimensions: string
  voltage_min: number | null
  voltage_max: number | null
  current_ma: number | null
  datasheet_url: string
  notes: string
  devices: Array<{ id: number; commercial_name: string; model_ref: string; release_year: number | null; brand_name: string; board_area: string }>
  equivalences: Array<{ id: number; ic_a_id: number; ic_b_id: number; kind: string; restrictions: string; evidence: string; verified_by: string; verified_at: string }>
  media: FinderMediaRow[]
}

interface FinderImportReport {
  ok: boolean
  error?: string
  message?: string
  batchId?: number
  status?: 'ok' | 'partial' | 'failed'
  inserted?: number
  updated?: number
  skipped?: number
  rejected?: number
  devicesEnriched?: number
  rejectedRows?: Array<{ line: number; reason: string; detail: string }>
}

interface FinderSearchItem {
  kind: 'brand' | 'device' | 'part' | 'ic'
  id: number
  title: string
  brand?: FinderBrand
  device?: FinderDeviceSummary & { brand_id: number }
  part?: { id: number; name: string; oem_ref: string; part_type: string; confidence: string; category_name: string | null; category_slug: string | null }
  ic?: { id: number; ref: string; marking: string; manufacturer: string; function: string; family: string; package: string }
}

interface FinderListResult<T> {
  total: number
  page: number
  pageSize: number
  items: T[]
}

interface FinderSearchResult extends FinderListResult<FinderSearchItem> {
  mode: 'empty' | 'tokens'
}

interface FinderStats {
  brands: number
  devices: number
  device_aliases: number
  categories: number
  parts: number
  part_refs: number
  compatibilities: number
  compatibilities_by_status: Record<string, number>
  ics: number
  ic_equivalences: number
  ic_devices: number
  media: number
  import_batches: number
  last_import: { connector: string; status: string; inserted: number; updated: number; skipped: number; errors: number; finished_at: string } | null
  devices_without_model_ref: number
  devices_without_year: number
  devices_without_image: number
}

interface FinderApi {
      stats: () => Promise<{ ok: boolean; stats?: FinderStats; error?: string }>
      search: (params?: { q?: string; kind?: string; page?: number; pageSize?: number }) => Promise<{ ok: boolean; result?: FinderSearchResult; error?: string }>
      brands: (params?: { q?: string; page?: number; pageSize?: number }) => Promise<{ ok: boolean; result?: FinderListResult<FinderBrand>; error?: string }>
      brand: (params: { id?: number; slug?: string }) => Promise<{ ok: boolean; brand?: FinderBrand | null; error?: string }>
      devices: (params?: { brandId?: number; q?: string; page?: number; pageSize?: number }) => Promise<{ ok: boolean; result?: FinderListResult<FinderDeviceSummary>; error?: string }>
      device: (id: number) => Promise<{ ok: boolean; device?: FinderDevice | null; error?: string; code?: string }>
      part: (id: number) => Promise<{ ok: boolean; part?: FinderPart | null; error?: string; code?: string }>
      ic: (id: number) => Promise<{ ok: boolean; ic?: FinderIc | null; error?: string; code?: string }>
      importParts: (params: { format: 'csv' | 'json'; content: string; fileName?: string; sourceLabel?: string; actor?: string }) => Promise<FinderImportReport>
}

interface Window {
  api: {
    finder: FinderApi
  }
}
