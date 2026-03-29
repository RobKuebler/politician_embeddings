# Speeches Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/speeches` page showing TF-IDF word clouds and speaker statistics for all parties as a card grid.

**Architecture:** Python exports two new JSON files (party_word_freq, party_speech_stats). A new Next.js page fetches both and renders one card per party. Each card contains a D3-cloud word cloud and a scrollable speaker bar list. All wired via existing patterns (usePeriod, fetchData, dataUrl, PARTY_COLORS).

**Tech Stack:** Python/pandas (export), Next.js 16 + TypeScript, D3.js + d3-cloud, Tailwind CSS, Jest

---

## File Map

| File | Action |
|------|--------|
| `src/export_json.py` | Modify — call `export_party_word_freq` + `export_party_speech_stats` from `main()` |
| `tests/test_export_json.py` | Modify — add tests for the two new export functions |
| `frontend/lib/data.ts` | Modify — add `WordFreqEntry`, `WordFreqFile`, `SpeakerRecord`, `SpeechStatsFile` |
| `frontend/package.json` | Modify — add `d3-cloud` + `@types/d3-cloud` |
| `frontend/components/charts/WordCloud.tsx` | Create |
| `frontend/components/charts/SpeakerBars.tsx` | Create |
| `frontend/app/speeches/page.tsx` | Create |
| `frontend/app/page.tsx` | Modify — add Speeches feature card to `FEATURES` array |

---

## Task 1: Python — wire up JSON exports + tests

**Files:**
- Modify: `src/export_json.py`
- Modify: `tests/test_export_json.py`

The two functions `export_party_word_freq` and `export_party_speech_stats` already exist in `export_json.py` but are never called. This task wires them into `main()` and adds tests.

- [ ] **Step 1: Write failing tests**

Append to `tests/test_export_json.py`:

```python
# ---------------------------------------------------------------------------
# CSV fixtures for speech export tests
# ---------------------------------------------------------------------------

_WORD_FREQ_CSV = textwrap.dedent("""\
    fraktion,wort,tfidf,rang
    SPD,arbeit,0.000612,1
    SPD,sozial,0.000450,2
    SPD,rente,0.000380,3
    AfD,grenze,0.000700,1
    AfD,migration,0.000600,2
    AfD,sicherheit,0.000500,3
""")

_SPEECH_STATS_CSV = textwrap.dedent("""\
    fraktion,redner_id,vorname,nachname,anzahl_reden,wortanzahl_gesamt
    SPD,1001,Olaf,Scholz,84,94320
    SPD,1002,Rolf,Mützenich,60,71100
    AfD,2001,Alice,Weidel,50,55000
""")


@pytest.fixture
def speech_export(tmp_path, monkeypatch):
    """Set up tmp dirs with speech CSV fixtures and run the two export functions."""
    import src.export_json as ej

    period_dir = tmp_path / str(PERIOD_ID)
    period_dir.mkdir(parents=True)
    (period_dir / "party_word_freq.csv").write_text(_WORD_FREQ_CSV)
    (period_dir / "party_speech_stats.csv").write_text(_SPEECH_STATS_CSV)

    out_dir = tmp_path / "out"
    out_dir.mkdir()
    monkeypatch.setattr(ej, "DATA_DIR", tmp_path)
    monkeypatch.setattr(ej, "OUTPUT_DIR", out_dir)

    ej.export_party_word_freq(PERIOD_ID)
    ej.export_party_speech_stats(PERIOD_ID)
    return out_dir


def _load_speech(out_dir, filename):
    return json.loads((out_dir / filename).read_text())


def test_word_freq_structure(speech_export):
    data = _load_speech(speech_export, f"party_word_freq_{PERIOD_ID}.json")
    assert isinstance(data, dict)
    assert set(data.keys()) == {"SPD", "AfD"}
    spd = data["SPD"]
    assert isinstance(spd, list)
    assert len(spd) == 3
    assert {"wort", "tfidf", "rang"}.issubset(spd[0].keys())
    assert spd[0]["wort"] == "arbeit"
    assert spd[0]["rang"] == 1


def test_word_freq_missing_csv_does_not_raise(tmp_path, monkeypatch):
    import src.export_json as ej

    out_dir = tmp_path / "out"
    out_dir.mkdir()
    monkeypatch.setattr(ej, "DATA_DIR", tmp_path)
    monkeypatch.setattr(ej, "OUTPUT_DIR", out_dir)
    # no CSV present — should log warning, not raise
    ej.export_party_word_freq(PERIOD_ID)
    assert not (out_dir / f"party_word_freq_{PERIOD_ID}.json").exists()


def test_speech_stats_structure(speech_export):
    data = _load_speech(speech_export, f"party_speech_stats_{PERIOD_ID}.json")
    assert isinstance(data, list)
    assert len(data) == 3
    required = {"fraktion", "redner_id", "vorname", "nachname", "anzahl_reden", "wortanzahl_gesamt"}
    assert required.issubset(data[0].keys())
    # sorted by wortanzahl_gesamt desc within fraktion (as produced by compute_speech_stats)
    spd_rows = [r for r in data if r["fraktion"] == "SPD"]
    assert spd_rows[0]["nachname"] == "Scholz"


def test_speech_stats_missing_csv_does_not_raise(tmp_path, monkeypatch):
    import src.export_json as ej

    out_dir = tmp_path / "out"
    out_dir.mkdir()
    monkeypatch.setattr(ej, "DATA_DIR", tmp_path)
    monkeypatch.setattr(ej, "OUTPUT_DIR", out_dir)
    ej.export_party_speech_stats(PERIOD_ID)
    assert not (out_dir / f"party_speech_stats_{PERIOD_ID}.json").exists()
```

- [ ] **Step 2: Run tests — must fail**

```bash
uv run pytest tests/test_export_json.py::test_word_freq_structure tests/test_export_json.py::test_speech_stats_structure -v
```

Expected: `FAILED` — fixtures `speech_export` will fail because `export_party_word_freq` and `export_party_speech_stats` are not yet called (they exist but we just need to verify the test infrastructure works). Actually these tests call the functions directly — they should already pass since the functions exist. Run them; if they pass, that's fine.

- [ ] **Step 3: Wire the export functions into `main()`**

In `src/export_json.py`, find the loop in `main()`:

```python
    for _, row in periods_df.iterrows():
        period_id = int(row["period_id"])
        if not (DATA_DIR / str(period_id) / "politicians.csv").exists():
            continue
        p_start = date.fromisoformat(str(row["start_date"]))
        p_end = date.fromisoformat(str(row["end_date"]))
        if export_period(period_id, p_start, p_end):
            available.append(...)
```

Add two lines after `export_period(...)` call (inside the loop, always runs regardless of embeddings):

```python
        if export_period(period_id, p_start, p_end):
            available.append(
                {
                    "period_id": period_id,
                    "label": str(row.get("label", f"Periode {period_id}")),
                    "bundestag_number": int(row["bundestag_number"]),
                    "has_data": True,
                }
            )
        export_party_word_freq(period_id)
        export_party_speech_stats(period_id)
```

- [ ] **Step 4: Run all tests**

```bash
uv run pytest tests/test_export_json.py -v
```

Expected: all pass.

- [ ] **Step 5: Generate JSON files for both periods**

```bash
uv run python -m src.export_json
```

Expected log output:
```
INFO Wrote frontend/public/data/party_word_freq_132.json (...)
INFO Wrote frontend/public/data/party_speech_stats_132.json (...)
INFO Wrote frontend/public/data/party_word_freq_161.json (...)
INFO Wrote frontend/public/data/party_speech_stats_161.json (...)
```

Verify:
```bash
python -c "import json; d=json.load(open('frontend/public/data/party_word_freq_132.json')); print(list(d.keys()))"
```

Expected: list of party names including SPD, AfD, CDU/CSU, etc.

- [ ] **Step 6: Commit**

```bash
git add src/export_json.py tests/test_export_json.py frontend/public/data/party_word_freq_132.json frontend/public/data/party_speech_stats_132.json frontend/public/data/party_word_freq_161.json frontend/public/data/party_speech_stats_161.json
git commit -m "feat: JSON-Export für Wort- und Redestatistiken in main() einbinden"
```

---

## Task 2: TypeScript interfaces + install d3-cloud

**Files:**
- Modify: `frontend/lib/data.ts`
- Modify: `frontend/package.json` + `frontend/package-lock.json`

- [ ] **Step 1: Add TypeScript interfaces to `frontend/lib/data.ts`**

Append after the `PartyProfileFile` interface (before the `// ── Data loading utilities` comment):

```typescript
export interface WordFreqEntry {
  wort: string;
  tfidf: number;
  rang: number;
}

/** party_word_freq_{period}.json — keys are raw fraktion names (may contain soft-hyphen) */
export type WordFreqFile = Record<string, WordFreqEntry[]>;

export interface SpeakerRecord {
  fraktion: string;
  redner_id: number;
  vorname: string;
  nachname: string;
  anzahl_reden: number;
  wortanzahl_gesamt: number;
}

/** party_speech_stats_{period}.json — flat array sorted by fraktion then wortanzahl_gesamt desc */
export type SpeechStatsFile = SpeakerRecord[];
```

- [ ] **Step 2: Write tests for new dataUrl patterns**

In `frontend/__tests__/lib/data.test.ts`, add after the existing `dataUrl` tests:

```typescript
describe("dataUrl for speech files", () => {
  it("builds correct URL for party_word_freq", () => {
    expect(dataUrl("party_word_freq_{period}.json", 132)).toBe(
      "/data/party_word_freq_132.json",
    );
  });
  it("builds correct URL for party_speech_stats", () => {
    expect(dataUrl("party_speech_stats_{period}.json", 161)).toBe(
      "/data/party_speech_stats_161.json",
    );
  });
});
```

- [ ] **Step 3: Run frontend tests**

```bash
cd frontend && npm test -- --testPathPattern=data.test --passWithNoTests
```

Expected: all pass (including new tests — `dataUrl` logic is unchanged, new tests exercise existing function).

- [ ] **Step 4: Install d3-cloud**

```bash
cd frontend && npm install d3-cloud @types/d3-cloud
```

Expected: `package.json` gains `"d3-cloud": "^1.2.7"` and `"@types/d3-cloud": "^1.2.9"` (or current versions).

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/lib/data.ts frontend/__tests__/lib/data.test.ts frontend/package.json frontend/package-lock.json
git commit -m "feat: TypeScript-Interfaces fuer Wortstatistiken, d3-cloud installiert"
```

---

## Task 3: WordCloud component

**Files:**
- Create: `frontend/components/charts/WordCloud.tsx`

This component uses `d3-cloud` to lay out words, then renders them in an SVG. Words are sized by TF-IDF score and colored in the party color at varying opacity.

- [ ] **Step 1: Create `frontend/components/charts/WordCloud.tsx`**

```tsx
"use client";
import { useRef, useEffect } from "react";
import * as d3 from "d3";
import cloud from "d3-cloud";
import { useContainerWidth } from "@/hooks/useContainerWidth";
import { WordFreqEntry } from "@/lib/data";

interface Props {
  words: WordFreqEntry[];
  color: string;
  height?: number;
}

export function WordCloud({ words, color, height = 200 }: Props) {
  const { ref: containerRef, width } = useContainerWidth();
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!width || !svgRef.current || words.length === 0) return;

    const maxTfidf = d3.max(words, (w) => w.tfidf) ?? 1;
    const fontScale = d3.scaleLinear().domain([0, maxTfidf]).range([11, 34]);
    const opacityScale = d3.scaleLinear()
      .domain([1, words.length])
      .range([1.0, 0.4]);

    const baseColor = d3.color(color) ?? d3.color("#888888")!;

    const layout = cloud<WordFreqEntry & cloud.Word>()
      .size([width, height])
      .words(words.map((w) => ({ ...w, text: w.wort, size: fontScale(w.tfidf) })))
      .padding(3)
      .rotate(0)
      .font("Plus Jakarta Sans")
      .fontSize((d) => d.size ?? 11)
      .on("end", draw);

    layout.start();

    function draw(placed: (WordFreqEntry & cloud.Word)[]) {
      if (!svgRef.current) return;
      const svg = d3.select(svgRef.current);
      svg.selectAll("*").remove();
      svg
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", `translate(${width / 2},${height / 2})`)
        .selectAll<SVGTextElement, WordFreqEntry & cloud.Word>("text")
        .data(placed)
        .join("text")
        .style("font-size", (d) => `${d.size}px`)
        .style("font-family", "Plus Jakarta Sans, sans-serif")
        .style("font-weight", (d) => ((d.size ?? 0) > 22 ? "800" : "600"))
        .style("fill", (d) => {
          const c = baseColor.copy();
          c.opacity = opacityScale(d.rang);
          return c.formatRgb();
        })
        .attr("text-anchor", "middle")
        .attr(
          "transform",
          (d) => `translate(${d.x ?? 0},${d.y ?? 0})rotate(${d.rotate ?? 0})`,
        )
        .text((d) => d.text ?? "");
    }
  }, [width, height, words, color]);

  return (
    <div ref={containerRef} className="w-full" style={{ height }}>
      <svg ref={svgRef} style={{ display: "block" }} />
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/charts/WordCloud.tsx
git commit -m "feat: WordCloud-Komponente mit d3-cloud"
```

---

## Task 4: SpeakerBars component

**Files:**
- Create: `frontend/components/charts/SpeakerBars.tsx`

Scrollable list of speakers with inline horizontal bars, ranked by word count.

- [ ] **Step 1: Create `frontend/components/charts/SpeakerBars.tsx`**

```tsx
import { SpeakerRecord } from "@/lib/data";

interface Props {
  speakers: SpeakerRecord[];
  partyColor: string;
}

function formatWords(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

export function SpeakerBars({ speakers, partyColor }: Props) {
  const max = speakers[0]?.wortanzahl_gesamt ?? 1;

  return (
    <div className="overflow-y-auto" style={{ height: 220 }}>
      {speakers.map((s, i) => {
        const pct = (s.wortanzahl_gesamt / max) * 100;
        return (
          <div
            key={s.redner_id}
            className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0"
          >
            {/* Rank */}
            <span
              className="text-[11px] tabular-nums w-5 text-right shrink-0"
              style={{ color: "#9A9790" }}
            >
              {i + 1}
            </span>
            {/* Name */}
            <span
              className="text-[13px] flex-1 truncate"
              style={{ color: "#171613" }}
            >
              {s.vorname} {s.nachname}
            </span>
            {/* Bar + count */}
            <div className="flex items-center gap-1.5 shrink-0">
              <div
                className="w-16 rounded-full"
                style={{ height: 6, background: "#F0EEE9" }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${pct}%`,
                    background: partyColor,
                    minWidth: pct > 0 ? 2 : 0,
                  }}
                />
              </div>
              <span
                className="text-[11px] tabular-nums w-8 text-right"
                style={{ color: "#9A9790" }}
              >
                {formatWords(s.wortanzahl_gesamt)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/charts/SpeakerBars.tsx
git commit -m "feat: SpeakerBars-Komponente mit Inline-Balken"
```

---

## Task 5: Speeches page

**Files:**
- Create: `frontend/app/speeches/page.tsx`

- [ ] **Step 1: Create `frontend/app/speeches/page.tsx`**

```tsx
"use client";
import { useState, useEffect } from "react";
import { usePeriod } from "@/lib/period-context";
import {
  fetchData,
  dataUrl,
  stripSoftHyphen,
  WordFreqFile,
  SpeechStatsFile,
  SpeakerRecord,
} from "@/lib/data";
import { WordCloud } from "@/components/charts/WordCloud";
import { SpeakerBars } from "@/components/charts/SpeakerBars";
import { ChartSkeleton } from "@/components/ui/ChartSkeleton";
import { Footer } from "@/components/ui/Footer";
import { sortParties, PARTY_COLORS, FALLBACK_COLOR } from "@/lib/constants";

export default function SpeechesPage() {
  const { activePeriodId } = usePeriod();
  const [wordFreq, setWordFreq] = useState<WordFreqFile | null>(null);
  const [speechStats, setSpeechStats] = useState<SpeechStatsFile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activePeriodId) return;
    setLoading(true);
    Promise.all([
      fetchData<WordFreqFile>(
        dataUrl("party_word_freq_{period}.json", activePeriodId),
      ),
      fetchData<SpeechStatsFile>(
        dataUrl("party_speech_stats_{period}.json", activePeriodId),
      ),
    ])
      .then(([wf, ss]) => {
        setWordFreq(wf);
        setSpeechStats(ss);
        setLoading(false);
      })
      .catch(console.error);
  }, [activePeriodId]);

  // Normalize word freq keys (strip soft-hyphen, map Grünen short name)
  const normalizedWordFreq: WordFreqFile = {};
  if (wordFreq) {
    for (const [fraktion, words] of Object.entries(wordFreq)) {
      normalizedWordFreq[stripSoftHyphen(fraktion)] = words;
    }
  }

  // Group speakers by normalized party name
  const speakersByParty: Record<string, SpeakerRecord[]> = {};
  if (speechStats) {
    for (const s of speechStats) {
      const party = stripSoftHyphen(s.fraktion);
      if (!speakersByParty[party]) speakersByParty[party] = [];
      speakersByParty[party].push(s);
    }
  }

  // Total words per party (sum of all speakers)
  const totalWords: Record<string, number> = {};
  for (const [party, speakers] of Object.entries(speakersByParty)) {
    totalWords[party] = speakers.reduce(
      (sum, s) => sum + s.wortanzahl_gesamt,
      0,
    );
  }

  // Parties in canonical order, excluding fraktionslos
  const parties = sortParties(
    Object.keys(normalizedWordFreq).filter((p) => p !== "fraktionslos"),
  );

  return (
    <>
      {/* Page header */}
      <div className="mb-8 pl-4 border-l-4" style={{ borderColor: "#9B59B6" }}>
        <p
          className="text-[11px] font-bold tracking-[0.15em] uppercase mb-1"
          style={{ color: "#9B59B6" }}
        >
          Plenardebatten
        </p>
        <h1
          className="text-[28px] font-black tracking-tight leading-tight mb-1"
          style={{ color: "#1E1B5E" }}
        >
          Speeches
        </h1>
        <p className="text-[14px]" style={{ color: "#9A9790" }}>
          Welche Themen prägen jede Fraktion im Plenum? TF-IDF-Wordclouds der
          parteispezifischen Begriffe und die redeaktivsten Abgeordneten.
        </p>
      </div>

      {loading || !wordFreq || !speechStats ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <ChartSkeleton key={i} height={480} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {parties.map((party) => {
            const words = (normalizedWordFreq[party] ?? []).slice(0, 30);
            const speakers = speakersByParty[party] ?? [];
            const color = PARTY_COLORS[party] ?? FALLBACK_COLOR;
            const total = totalWords[party] ?? 0;

            return (
              <div
                key={party}
                className="bg-white border border-gray-100 flex flex-col gap-3 p-4"
                style={{ borderRadius: 20 }}
              >
                {/* Card header */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="shrink-0 rounded-full"
                      style={{ width: 4, height: 20, background: color }}
                    />
                    <span
                      className="font-extrabold text-[15px]"
                      style={{ color: "#1E1B5E" }}
                    >
                      {party}
                    </span>
                  </div>
                  <span
                    className="text-[12px] tabular-nums shrink-0"
                    style={{ color: "#9A9790" }}
                  >
                    {total.toLocaleString("de")} Wörter
                  </span>
                </div>

                {/* Word cloud */}
                <WordCloud words={words} color={color} height={200} />

                {/* Speaker list */}
                <div>
                  <p
                    className="text-[11px] font-bold tracking-[0.08em] uppercase mb-1"
                    style={{ color: "#9A9790" }}
                  >
                    Redner nach Wortanzahl
                  </p>
                  <SpeakerBars speakers={speakers} partyColor={color} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Footer />
    </>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Smoke-test in browser**

```bash
cd frontend && npm run dev
```

Open `http://localhost:3000/speeches`. Expected: grid of party cards, each with a word cloud and speaker list. No console errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/speeches/page.tsx
git commit -m "feat: Speeches-Seite mit Wordcloud- und Rednerkarten"
```

---

## Task 6: Add feature card to homepage

**Files:**
- Modify: `frontend/app/page.tsx`

- [ ] **Step 1: Add Speeches entry to the `FEATURES` array**

In `frontend/app/page.tsx`, add this object to the `FEATURES` array (after the `sidejobs` entry):

```tsx
  {
    href: "/speeches",
    title: "Speeches",
    description:
      "Welche Themen prägen jede Fraktion im Plenum? TF-IDF-Wordclouds der parteispezifischen Begriffe und die redeaktivsten Abgeordneten im direkten Vergleich.",
    tag: "Plenardebatten",
    iconGradient: "linear-gradient(135deg, #9B59B6 0%, #C39BD3 100%)",
    tagColor: "#9B59B6",
    wide: false,
    icon: (
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
```

- [ ] **Step 2: Verify in browser**

```bash
cd frontend && npm run dev
```

Open `http://localhost:3000`. Expected: new "Speeches" card visible in the feature grid. Clicking it navigates to `/speeches`.

- [ ] **Step 3: Run all frontend tests**

```bash
cd frontend && npm test
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/page.tsx
git commit -m "feat: Speeches auf Startseite verlinkt"
```

---

## Verification

| Check | Command | Expected |
|-------|---------|----------|
| Python tests | `uv run pytest tests/test_export_json.py -v` | All pass |
| JSON files exist | `ls frontend/public/data/party_word_freq_*.json` | 2 files |
| TS compiles | `cd frontend && npx tsc --noEmit` | No errors |
| Frontend tests | `cd frontend && npm test` | All pass |
| Speeches page | `http://localhost:3000/speeches` | Card grid, word clouds render |
| Homepage card | `http://localhost:3000` | Speeches card visible |
