import { stripSoftHyphen } from "@/lib/data";

// Party colors and order — mirrors pages/constants.py.
// Soft-hyphen (\xad) is stripped; raw party names from the API use it.

export const PARTY_COLORS: Record<string, string> = {
  "CDU/CSU": "#2a2a2a",
  SPD: "#E3000F",
  AfD: "#009EE0",
  "BÜNDNIS 90/DIE GRÜNEN": "#46962B",
  "Die Linke": "#FF69B4",
  BSW: "#722EA5",
  FDP: "#FFED00",
  fraktionslos: "#888888",
};

export const FALLBACK_COLOR = "#888888";

// Display-safe accent colors for party pills — used for text and border only.
// Some party colors (e.g. FDP yellow) are unreadable on light backgrounds.
// The small dot in each pill still uses the original PARTY_COLORS for brand recognition.
export const PARTY_PILL_ACCENT_COLORS: Partial<Record<string, string>> = {
  FDP: "#7A5F00", // dark amber (~5.2:1 on white) — legible while staying in FDP's yellow family
};

// Preferred display order (most seats first).
export const PARTY_ORDER = [
  "CDU/CSU",
  "SPD",
  "AfD",
  "BÜNDNIS 90/DIE GRÜNEN",
  "Die Linke",
  "BSW",
  "FDP",
  "fraktionslos",
];

// Party whose fill is so dark it needs a white outline on the scatter plot.
export const DARK_FILL_PARTY = "CDU/CSU";

export const NO_FACTION_LABEL = "fraktionslos";

// Governing coalition parties per wahlperiode.
export const GOVERNING_PARTIES: Record<number, string[]> = {
  20: ["SPD", "BÜNDNIS 90/DIE GRÜNEN", "FDP"], // 20. BT: Ampel
  21: ["CDU/CSU", "SPD"], // 21. BT: GroKo
};

const PARTY_SHORT_LABELS: Record<string, string> = {
  "CDU/CSU": "CDU/CSU",
  SPD: "SPD",
  AfD: "AfD",
  "BÜNDNIS 90/DIE GRÜNEN": "Grüne",
  "Die Linke": "Linke",
  BSW: "BSW",
  FDP: "FDP",
  fraktionslos: "fraktionslos",
};

/** Normalize any raw party label to its canonical name (not a display label — use getPartyShortLabel() for display). */
export function normalizePartyName(party: string): string {
  return stripSoftHyphen(party);
}

/** Resolve a party color from raw or normalized party labels. */
export function getPartyColor(party: string): string {
  return PARTY_COLORS[normalizePartyName(party)] ?? FALLBACK_COLOR;
}

/** Resolve a short display label from raw or normalized party labels. */
export function getPartyShortLabel(party: string): string {
  const normalized = normalizePartyName(party);
  return PARTY_SHORT_LABELS[normalized] ?? normalized;
}

/**
 * Sort a list of party names by PARTY_ORDER (most seats first).
 * Unknown parties come before fraktionslos, sorted alphabetically.
 */
export function sortParties(parties: string[]): string[] {
  return [...parties].sort((a, b) => {
    const ai = PARTY_ORDER.indexOf(a);
    const bi = PARTY_ORDER.indexOf(b);
    // Both known → use PARTY_ORDER index
    if (ai !== -1 && bi !== -1) return ai - bi;
    // Only one known → known comes first, unless it's fraktionslos
    if (ai !== -1) return a === NO_FACTION_LABEL ? 1 : -1;
    if (bi !== -1) return b === NO_FACTION_LABEL ? -1 : 1;
    // Both unknown → alphabetical
    return a.localeCompare(b);
  });
}

/** Sort the unique parties currently present in a dataset. */
export function sortPresentParties(parties: Iterable<string>): string[] {
  return sortParties(Array.from(new Set(parties)));
}

// ── Filter/dropdown styling tokens ──────────────────────────────────────────
// Used by PollFilter and PoliticianSearch for consistent styling.
export const FILTER_ACCENT = "#4B6BFB";
export const FILTER_ACCENT_LIGHT = "#F0F4FF";
export const FILTER_BORDER = "#E2E5EE";
export const FILTER_BG_INPUT = "#FAFBFF";

/** Truncates a string to maxLen characters, appending '...' if truncated. */
export function truncateText(s: string, maxLen: number): string {
  return s.length > maxLen ? s.slice(0, maxLen) + "\u2026" : s;
}

// ── Design tokens ────────────────────────────────────────────────────────────

// Shared card style — use on every main content card for visual consistency
export const CARD_CLASS = "bg-white rounded-xl border border-[#E3E0DA]";
// Standard content-card padding (mobile → desktop)
export const CARD_PADDING = "p-5 md:p-6";
// Standard content-card drop shadow — spread as style={{ boxShadow: CARD_SHADOW }}
export const CARD_SHADOW = "0 1px 4px rgba(0,0,0,0.05)";

// ── Typography scale ─────────────────────────────────────────────────────────
// Always use one of these values; never use ad-hoc pixel sizes.
// label  11px  eyebrows, metadata, axis legends
// small  12px  CTA text, tag labels
// body   13px  card body text, descriptions
// base   14px  standard body, inputs, page subtitles
// title  15px  card titles, section headers
// stat   22px  statistic numbers
// page   28px  page headings (PageHeader h1)

export const COLOR_SECONDARY = "#6B6760";
export const COLOR_BODY = "#171613";

// Chart font — used by all D3 charts for axis labels and legends
export const CHART_FONT_FAMILY = '"Plus Jakarta Sans", sans-serif';
export const MARKER_OUTLINE = "rgba(255,255,255,0.4)";

// Chart axis / label layout constants — shared across all D3 charts
export const CHART_AXIS_FONT_SIZE = "11px";
// Band width (px) below which vertical bar-chart x-labels rotate to avoid overlap
export const CHART_ROTATION_THRESHOLD = 42;
// Bottom margin (px) used when x-labels are rotated
export const CHART_BOTTOM_ROTATED = 100;

// Vote answer → label + color (for heatmap legend)
export const VOTE_META = {
  yes: { label: "Ja", color: "#2563EB" },
  no: { label: "Nein", color: "#EA580C" },
  abstain: { label: "Enthalten", color: "#9CA3AF" },
  no_show: { label: "–", color: "#E0E0E0" },
} as const;

// Discrete 4-step ECharts colorscale for heatmap: no_show=0, no=1, abstain=2, yes=3
export const VOTE_COLORSCALE = [
  { gte: 0, lt: 1, color: "#E0E0E0" }, // no_show / absent
  { gte: 1, lt: 2, color: "#EA580C" }, // no
  { gte: 2, lt: 3, color: "#9CA3AF" }, // abstain
  { gte: 3, lte: 3, color: "#2563EB" }, // yes
];

export const VOTE_NUMERIC: Record<string, number> = {
  yes: 3,
  abstain: 2,
  no: 1,
  no_show: 0,
};
