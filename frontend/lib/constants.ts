// Party colors and order — mirrors pages/constants.py.
// Soft-hyphen (\xad) is stripped; raw party names from the API use it.

export const PARTY_COLORS: Record<string, string> = {
  'CDU/CSU': '#2a2a2a',
  'SPD': '#E3000F',
  'AfD': '#009EE0',
  'BÜNDNIS 90/DIE GRÜNEN': '#46962B',
  'Die Linke': '#FF69B4',
  'Die Linke.': '#FF69B4',
  'BSW': '#722EA5',
  'FDP': '#FFED00',
  'fraktionslos': '#888888',
}

export const FALLBACK_COLOR = '#888888'

// Preferred display order (most seats first).
export const PARTY_ORDER = [
  'CDU/CSU', 'SPD', 'AfD', 'BÜNDNIS 90/DIE GRÜNEN',
  'Die Linke', 'Die Linke.', 'BSW', 'FDP', 'fraktionslos',
]

// Party whose fill is so dark it needs a white outline on the scatter plot.
export const DARK_FILL_PARTY = 'CDU/CSU'

export const NO_FACTION_LABEL = 'fraktionslos'

/**
 * Sort a list of party names by PARTY_ORDER (most seats first).
 * Unknown parties come before fraktionslos, sorted alphabetically.
 */
export function sortParties(parties: string[]): string[] {
  return [...parties].sort((a, b) => {
    const ai = PARTY_ORDER.indexOf(a)
    const bi = PARTY_ORDER.indexOf(b)
    // Both known → use PARTY_ORDER index
    if (ai !== -1 && bi !== -1) return ai - bi
    // Only one known → known comes first, unless it's fraktionslos
    if (ai !== -1) return a === NO_FACTION_LABEL ? 1 : -1
    if (bi !== -1) return b === NO_FACTION_LABEL ? -1 : 1
    // Both unknown → alphabetical
    return a.localeCompare(b)
  })
}

// Design tokens
export const COLOR_SECONDARY = '#999'
export const COLOR_BODY = '#666'
export const MARKER_OUTLINE = 'rgba(255,255,255,0.4)'

// Vote answer → label + color (for heatmap legend)
export const VOTE_META = {
  yes:     { label: 'Ja',        color: '#46962B' },
  no:      { label: 'Nein',      color: '#E3000F' },
  abstain: { label: 'Enthalten', color: '#F5A623' },
  no_show: { label: '–',         color: '#E0E0E0' },
} as const

// Discrete 4-step ECharts colorscale for heatmap: no_show=0, no=1, abstain=2, yes=3
export const VOTE_COLORSCALE = [
  { gte: 0, lt:  1, color: '#E0E0E0' },  // no_show / absent
  { gte: 1, lt:  2, color: '#E3000F' },  // no
  { gte: 2, lt:  3, color: '#F5A623' },  // abstain
  { gte: 3, lte: 3, color: '#46962B' },  // yes
]

export const VOTE_NUMERIC: Record<string, number> = {
  yes: 3, abstain: 2, no: 1, no_show: 0,
}
