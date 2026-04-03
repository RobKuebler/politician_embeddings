// TypeScript interfaces matching the JSON schemas in the spec.
// All field names match the CSV column names exactly (as documented in the spec).

export interface Period {
  wahlperiode: number;
  label: string;
  has_data: boolean;
}

export interface Politician {
  politician_id: number;
  name: string;
  party: string; // raw, may contain soft-hyphen — strip with stripSoftHyphen()
  sex: string | null;
  year_of_birth: number | null;
  occupation: string | null;
  education: string | null;
  field_title: string | null;
}

export interface EmbeddingPoint {
  politician_id: number;
  x: number;
  y: number;
}

export interface EmbeddingsFile {
  dimensions: 2;
  data: EmbeddingPoint[];
}

export interface VoteRecord {
  politician_id: number;
  poll_id: number;
  answer: "yes" | "no" | "abstain" | "no_show";
}

export interface Poll {
  poll_id: number;
  topic: string;
}

export interface CohesionRecord {
  party: string;
  label: string; // party with soft-hyphen stripped
  streuung: number;
}

export interface SidejobRecord {
  politician_id: number;
  party: string;
  category_label: string;
  income_level: number | null;
  prorated_income: number;
  topics: string[];
  has_amount: boolean;
}

export interface SidejobsFile {
  jobs: SidejobRecord[];
  coverage: { total: number; with_amount: number };
}

export interface DeviationPivot {
  categories: string[];
  parties: string[];
  pct: (number | null)[][]; // [category][party]
  dev: (number | null)[][]; // [category][party], deviation from Bundestag avg
  count: number[][]; // [category][party], absolute counts
  party_totals: number[]; // total members per party
}

export interface PartyProfileFile {
  parties: string[];
  age: { name: string; party: string; age: number }[];
  sex: {
    party_label: string;
    geschlecht: string;
    count: number;
    pct: number;
  }[];
  titles: { party_label: string; titel: string; count: number; pct: number }[];
  occupation: DeviationPivot;
  education_field: DeviationPivot;
  education_degree: DeviationPivot;
}

export interface WordFreqEntry {
  wort: string;
  tfidf: number;
  rang: number;
}

/** party_word_freq.json (under /data/{period}/) — keys are raw fraktion names (may contain soft-hyphen) */
export type WordFreqFile = Record<string, WordFreqEntry[]>;

export interface SpeakerRecord {
  fraktion: string;
  redner_id: number;
  vorname: string;
  nachname: string;
  anzahl_reden: number;
  wortanzahl_gesamt: number;
}

/** party_speech_stats.json (under /data/{period}/) — flat array sorted by fraktion then wortanzahl_gesamt desc */
export type SpeechStatsFile = SpeakerRecord[];

// ── Data loading utilities ──────────────────────────────────────────────────

/** Normalize a raw party name from the API: strip soft-hyphens and apply short display names. */
export function stripSoftHyphen(s: string): string {
  const stripped = s.replace(/\u00ad/g, "");
  if (stripped === "BÜNDNIS 90/DIE GRÜNEN") return "Grüne";
  return stripped;
}

/**
 * Fetch a JSON file from /data/ and return parsed data.
 * Throws on non-200 response so callers can handle errors uniformly.
 */
export async function fetchData<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

/** Build the URL for a period-specific JSON file under /data/{periodId}/. */
export function dataUrl(filename: string, periodId: number): string {
  return `/data/${periodId}/${filename}`;
}
