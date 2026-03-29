# Speeches Page Design

## Goal

New page `/speeches` showing TF-IDF word clouds and speaker statistics per party — all parties visible simultaneously as a card grid.

## Data Sources

Two JSON files exported by `src/export_json.py` (functions already exist for CSV, export missing):

**`party_word_freq_{period_id}.json`**
```json
{
  "SPD": [
    { "wort": "arbeit", "tfidf": 0.000612, "rang": 1 },
    ...
  ],
  ...
}
```

**`party_speech_stats_{period_id}.json`**
```json
[
  { "fraktion": "SPD", "redner_id": 123, "vorname": "Olaf", "nachname": "Scholz",
    "anzahl_reden": 84, "wortanzahl_gesamt": 94320 },
  ...
]
```

TypeScript interfaces added to `frontend/lib/data.ts`:
```ts
export interface WordFreqEntry { wort: string; tfidf: number; rang: number; }
export interface WordFreqFile { [fraktion: string]: WordFreqEntry[]; }

export interface SpeakerRecord {
  fraktion: string; redner_id: number;
  vorname: string; nachname: string;
  anzahl_reden: number; wortanzahl_gesamt: number;
}
export type SpeechStatsFile = SpeakerRecord[];
```

## Page Layout

**Route:** `frontend/app/speeches/page.tsx`

**Header:** matches existing page style — colored left border, tag label, title "Speeches", subtitle "Wörter und Themen pro Fraktion".

**Grid:** responsive CSS grid — 3 columns ≥1280px, 2 columns ≥768px, 1 column mobile. Gap: 24px (lg token). Parties ordered by `PARTY_ORDER` from `constants.ts`. `fraktionslos` shown last or omitted (few speeches, no meaningful TF-IDF).

## Party Card

Fixed card structure (no expand/collapse interaction):

```
┌─────────────────────────────────┐
│ ▌ SPD          1.243.560 Wörter │  ← colored left border, party name, total words
│ ┌─────────────────────────────┐ │
│ │        WORD CLOUD           │ │  ← 200px height, top 30 words
│ └─────────────────────────────┘ │
│ Redner nach Wortanzahl          │  ← section label
│ ┌─────────────────────────────┐ │
│ │ 1. Olaf Scholz  ████░  94K  │ │  ← scrollable, fixed height 220px
│ │ 2. R. Mützenich ███░   71K  │ │
│ │ ...                         │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

Card background: `bg-white`, border: `border border-gray-100`, radius: 20px (lg token), padding: 16px (md token).

## WordCloud Component

**File:** `frontend/components/charts/WordCloud.tsx`

- Uses `d3-cloud` npm package (new dependency) — purpose-built word placement engine
- Input: top 30 words from `WordFreqEntry[]`, sized by `tfidf` score
- Font size: linear scale, TF-IDF → 11px–36px
- Color: single party color at varying opacity (0.45–1.0), mapped by rank
- Canvas height: 200px, width: fills card
- No interaction (no hover, no click)
- Loading state: gray placeholder rectangle via `ChartSkeleton`

## SpeakerBars Component

**File:** `frontend/components/charts/SpeakerBars.tsx`

- Input: `SpeakerRecord[]` for one party, already sorted by `wortanzahl_gesamt` desc
- Fixed-height container (220px), `overflow-y: auto`
- Each row: rank number (gray, monospace) + full name + inline horizontal bar + formatted word count (`94K`, `1.2M`)
- Bar: filled rect, color = party color, width proportional to top speaker of that party (100% = max within party)
- Bar height: 6px, border-radius: full (pill)
- Row height: 32px, font: `text-sm`

## Python Export

**File:** `src/export_json.py` — add two functions:

```python
def export_party_word_freq(period_id: int) -> None:
    # reads data/{period_id}/party_word_freq.csv
    # groups by fraktion, exports list of {wort, tfidf, rang} per party
    # writes frontend/public/data/party_word_freq_{period_id}.json

def export_party_speech_stats(period_id: int) -> None:
    # reads data/{period_id}/party_speech_stats.csv
    # exports as JSON array
    # writes frontend/public/data/party_speech_stats_{period_id}.json
```

Both functions called from the existing `__main__` block alongside other exports.

## Navigation

`frontend/app/page.tsx` — add a new feature card for `/speeches` in the `FEATURES` array, matching existing card style (icon, title, description, tag).

## File Summary

| File | Action |
|------|--------|
| `src/export_json.py` | Add `export_party_word_freq` + `export_party_speech_stats` |
| `frontend/lib/data.ts` | Add `WordFreqEntry`, `WordFreqFile`, `SpeakerRecord`, `SpeechStatsFile` |
| `frontend/components/charts/WordCloud.tsx` | Create — d3-cloud word cloud |
| `frontend/components/charts/SpeakerBars.tsx` | Create — inline bar chart list |
| `frontend/app/speeches/page.tsx` | Create — grid page |
| `frontend/app/page.tsx` | Add feature card for `/speeches` |
| `frontend/package.json` | Add `d3-cloud` dependency |
