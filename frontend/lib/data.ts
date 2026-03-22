// TypeScript interfaces matching the JSON schemas in the spec.
// All field names match the CSV column names exactly (as documented in the spec).

export interface Period {
  period_id: number
  label: string
  has_data: boolean
}

export interface Politician {
  politician_id: number
  name: string
  party: string         // raw, may contain soft-hyphen — strip with stripSoftHyphen()
  sex: string | null
  year_of_birth: number | null
  occupation: string | null
  education: string | null
  field_title: string | null
}

export interface EmbeddingPoint {
  politician_id: number
  x: number
  y: number
}

export interface EmbeddingsFile {
  dimensions: 2
  data: EmbeddingPoint[]
}

export interface VoteRecord {
  politician_id: number
  poll_id: number
  answer: 'yes' | 'no' | 'abstain' | 'no_show'
}

export interface Poll {
  poll_id: number
  topic: string
}

export interface CohesionRecord {
  party: string
  label: string    // party with soft-hyphen stripped
  streuung: number
}

export interface SidejobRecord {
  politician_id: number
  party: string
  category_label: string
  income_level: number | null
  prorated_income: number
  topics: string[]
  has_amount: boolean
}

export interface SidejobsFile {
  jobs: SidejobRecord[]
  coverage: { total: number; with_amount: number }
}

export interface DeviationPivot {
  categories: string[]
  parties: string[]
  pct: (number | null)[][]   // [category][party]
  dev: (number | null)[][]   // [category][party], deviation from Bundestag avg
}

export interface PartyProfileFile {
  parties: string[]
  age: { name: string; party: string; age: number }[]
  sex: { party_label: string; geschlecht: string; count: number; pct: number }[]
  titles: { party_label: string; titel: string; count: number; pct: number }[]
  occupation: DeviationPivot
  education_field: DeviationPivot
  education_degree: DeviationPivot
}

// ── Data loading utilities ──────────────────────────────────────────────────

/** Strip the soft-hyphen character used in party names from the API. */
export function stripSoftHyphen(s: string): string {
  return s.replace(/\u00ad/g, '')
}

/**
 * Fetch a JSON file from /data/ and return parsed data.
 * Throws on non-200 response so callers can handle errors uniformly.
 */
export async function fetchData<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`)
  return res.json() as Promise<T>
}

/** Build the URL for a period-specific JSON file. */
export function dataUrl(filename: string, periodId: number): string {
  const base = filename.replace('{period}', String(periodId))
  return `/data/${base}`
}
