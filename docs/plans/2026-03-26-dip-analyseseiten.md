# DIP Analyseseiten Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/aktivitaet` (MdB-Aktivität + Kleine Anfragen, Tab-Layout) and `/themen` (Sachgebiete-Heatmap) pages to parlascanned using the DIP Bundestag API.

**Architecture:** New `src/fetch_dip.py` fetches aktivitaet and vorgang records from the DIP API (cursor pagination), aggregates by party/person, and writes CSVs to `data/{period_id}/`. Two new functions in `src/export_json.py` convert these CSVs to static JSON. Two new Next.js pages consume the JSON; `/themen` reuses the existing `DeviationHeatmap` component; `/aktivitaet` uses a new `GroupedBarChart` component.

**Tech Stack:** Python 3.13, pandas, requests, requests-mock (tests); Next.js 16, React 19, D3 7, TypeScript, Tailwind 4.

---

## File Map

**New files:**
- `src/fetch_dip.py` — DIP API client: pagination, person mapping, aktivitaet + themen CSVs
- `tests/test_fetch_dip.py` — pytest tests for fetch_dip.py
- `frontend/components/charts/GroupedBarChart.tsx` — D3 grouped/horizontal bar chart
- `frontend/app/aktivitaet/page.tsx` — Activity page (tabs: Parteien + MdBs)
- `frontend/app/themen/page.tsx` — Topic heatmap page

**Modified files:**
- `src/export_json.py` — add `export_dip_aktivitaet()` and `export_dip_themen()`
- `frontend/lib/nav-items.tsx` — add Aktivität and Themen nav entries

**Output data files (generated, not committed):**
- `data/{period_id}/dip_aktivitaet.csv`
- `data/{period_id}/dip_themen.csv`
- `frontend/public/data/dip_aktivitaet_{period_id}.json`
- `frontend/public/data/dip_themen_{period_id}.json`

---

## Task 1: DIP API client — cursor pagination (`fetch_dip_all`)

**Files:**
- Create: `src/fetch_dip.py`
- Create: `tests/test_fetch_dip.py`

### DIP API response format

The DIP API returns JSON with this structure:
```json
{
  "numFound": 330743,
  "cursor": "AoE=base64encodedstring",
  "documents": [{...}, ...]
}
```

Pagination stops when `documents` is shorter than the requested limit or `cursor` is absent.

- [ ] **Step 1: Write the failing tests**

Create `tests/test_fetch_dip.py`:

```python
import src.fetch_dip as dip

DIP_BASE = "https://search.dip.bundestag.de/api/v1"


def test_fetch_dip_all_single_page(requests_mock):
    """Single page: stops immediately when documents < DIP_PAGE_SIZE."""
    requests_mock.get(
        f"{DIP_BASE}/person",
        json={"numFound": 2, "documents": [{"id": 1}, {"id": 2}]},
    )
    result = dip.fetch_dip_all("person")
    assert result == [{"id": 1}, {"id": 2}]
    assert requests_mock.call_count == 1
    qs = requests_mock.request_history[0].qs
    assert qs["format"] == ["json"]
    assert qs["apikey"] == [dip.DIP_API_KEY]


def test_fetch_dip_all_paginates(requests_mock, monkeypatch):
    """Two pages: cursor from page 1 is passed to page 2."""
    monkeypatch.setattr(dip, "DIP_PAGE_SIZE", 2)
    requests_mock.get(
        f"{DIP_BASE}/person",
        [
            {"json": {"numFound": 3, "cursor": "abc123", "documents": [{"id": 1}, {"id": 2}]}},
            {"json": {"numFound": 3, "documents": [{"id": 3}]}},
        ],
    )
    result = dip.fetch_dip_all("person")
    assert [r["id"] for r in result] == [1, 2, 3]
    assert requests_mock.call_count == 2
    assert requests_mock.request_history[1].qs["cursor"] == ["abc123"]


def test_fetch_dip_all_passes_extra_params(requests_mock):
    """Extra params are forwarded to every request."""
    requests_mock.get(
        f"{DIP_BASE}/aktivitaet",
        json={"numFound": 1, "documents": [{"id": 99}]},
    )
    dip.fetch_dip_all("aktivitaet", {"wahlperiode": 20})
    assert requests_mock.request_history[0].qs["wahlperiode"] == ["20"]
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
uv run pytest tests/test_fetch_dip.py -v
```
Expected: `ModuleNotFoundError: No module named 'src.fetch_dip'`

- [ ] **Step 3: Create `src/fetch_dip.py` with `fetch_dip_all`**

```python
"""Fetch parliamentary activity and topic data from the DIP Bundestag API.

Run after fetch_data.py. Writes CSVs to data/{period_id}/.
"""
import logging

import pandas as pd
import requests
from requests.adapters import HTTPAdapter
from urllib3.util import Retry

from .storage import DATA_DIR

log = logging.getLogger(__name__)

DIP_BASE_URL = "https://search.dip.bundestag.de/api/v1"
DIP_API_KEY = "OSOegLs.PR2lwJ1dwCeje9vTj7FPOt3hvpYKtwKkhw"
DIP_PAGE_SIZE = 100


def _get_session() -> requests.Session:
    """Create a requests session with retry strategy for the DIP API."""
    session = requests.Session()
    retry = Retry(
        total=5,
        backoff_factor=1,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET"],
    )
    adapter = HTTPAdapter(max_retries=retry)
    session.mount("https://", adapter)
    return session


_SESSION = _get_session()


def fetch_dip_all(endpoint: str, params: dict | None = None) -> list:
    """Fetch all records from a DIP endpoint using cursor pagination.

    Stops when a page returns fewer than DIP_PAGE_SIZE documents or when
    the response omits the cursor field.
    """
    results = []
    cursor = None
    base_params: dict = {"format": "json", "apikey": DIP_API_KEY, "limit": DIP_PAGE_SIZE}
    if params:
        base_params.update(params)

    while True:
        call_params = {**base_params}
        if cursor:
            call_params["cursor"] = cursor
        resp = _SESSION.get(f"{DIP_BASE_URL}/{endpoint}", params=call_params)
        resp.raise_for_status()
        data = resp.json()
        docs = data.get("documents", [])
        results.extend(docs)
        if len(docs) < DIP_PAGE_SIZE:
            break
        cursor = data.get("cursor")
        if not cursor:
            break

    log.info("Fetched %d records from /%s", len(results), endpoint)
    return results
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
uv run pytest tests/test_fetch_dip.py::test_fetch_dip_all_single_page tests/test_fetch_dip.py::test_fetch_dip_all_paginates tests/test_fetch_dip.py::test_fetch_dip_all_passes_extra_params -v
```
Expected: `3 passed`

- [ ] **Step 5: Commit**

```bash
git add src/fetch_dip.py tests/test_fetch_dip.py
git commit -m "feat: DIP API cursor pagination client"
```

---

## Task 2: Person mapping + party normalization

**Files:**
- Modify: `src/fetch_dip.py`
- Modify: `tests/test_fetch_dip.py`

The DIP `/person` endpoint returns records with `id`, `vorname`, `nachname`, and `fraktion` (array of objects with `bezeichnung`). We build a `dip_person_id → {name, party}` dict used to annotate aktivitaet records.

Party names from DIP differ from parlascanned's `PARTY_ORDER`. Normalization maps them to match.

- [ ] **Step 1: Write the failing tests**

Append to `tests/test_fetch_dip.py`:

```python
def test_fetch_dip_persons(requests_mock):
    """Maps DIP person records to {name, party} dicts keyed by id."""
    requests_mock.get(
        f"{DIP_BASE}/person",
        json={
            "numFound": 2,
            "documents": [
                {"id": 1, "vorname": "Anna", "nachname": "Müller", "fraktion": [{"bezeichnung": "SPD"}]},
                {"id": 2, "vorname": "Max", "nachname": "Schmidt", "fraktion": [{"bezeichnung": "BÜNDNIS 90/DIE GRÜNEN"}]},
            ],
        },
    )
    persons = dip.fetch_dip_persons(wahlperiode=20)
    assert persons[1] == {"name": "Anna Müller", "party": "SPD"}
    # Grünen normalized to match PARTY_ORDER soft-hyphen form
    assert persons[2]["party"] == "BÜNDNIS 90/\xadDIE GRÜNEN"


def test_fetch_dip_persons_no_fraktion(requests_mock):
    """Person with empty fraktion list gets party 'fraktionslos'."""
    requests_mock.get(
        f"{DIP_BASE}/person",
        json={"numFound": 1, "documents": [{"id": 5, "vorname": "X", "nachname": "Y", "fraktion": []}]},
    )
    persons = dip.fetch_dip_persons(wahlperiode=20)
    assert persons[5]["party"] == "fraktionslos"


def test_normalize_dip_party():
    """Party name normalization covers known DIP variants."""
    assert dip.normalize_dip_party("BÜNDNIS 90/DIE GRÜNEN") == "BÜNDNIS 90/\xadDIE GRÜNEN"
    assert dip.normalize_dip_party("DIE LINKE") == "Die Linke"
    assert dip.normalize_dip_party("Bündnis Sahra Wagenknecht (BSW)") == "BSW"
    assert dip.normalize_dip_party("SPD") == "SPD"  # pass-through
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
uv run pytest tests/test_fetch_dip.py::test_fetch_dip_persons tests/test_fetch_dip.py::test_normalize_dip_party -v
```
Expected: `AttributeError: module 'src.fetch_dip' has no attribute 'fetch_dip_persons'`

- [ ] **Step 3: Add normalization + person mapping to `src/fetch_dip.py`**

```python
# Maps DIP's official party names to parlascanned's PARTY_ORDER keys.
# BÜNDNIS 90/DIE GRÜNEN gets the soft-hyphen (\xad) used throughout the codebase.
_PARTY_NORM: dict[str, str] = {
    "BÜNDNIS 90/DIE GRÜNEN": "BÜNDNIS 90/\xadDIE GRÜNEN",
    "Bündnis 90/Die Grünen": "BÜNDNIS 90/\xadDIE GRÜNEN",
    "DIE LINKE": "Die Linke",
    "Die Linke.": "Die Linke",
    "Bündnis Sahra Wagenknecht (BSW)": "BSW",
    "BSW - Bündnis Sahra Wagenknecht": "BSW",
}


def normalize_dip_party(raw: str) -> str:
    """Normalize a DIP faction name to the parlascanned PARTY_ORDER key."""
    return _PARTY_NORM.get(raw, raw)


def fetch_dip_persons(wahlperiode: int) -> dict[int, dict]:
    """Fetch all MdBs for a Bundestag term and return id → {name, party} mapping.

    Used to annotate aktivitaet records with party information.
    """
    docs = fetch_dip_all("person", {"wahlperiode": wahlperiode})
    result: dict[int, dict] = {}
    for doc in docs:
        pid = doc.get("id")
        if pid is None:
            continue
        vorname = doc.get("vorname", "")
        nachname = doc.get("nachname", "")
        fraktionen = doc.get("fraktion", [])
        if fraktionen:
            raw_party = fraktionen[0].get("bezeichnung", "fraktionslos")
        else:
            raw_party = "fraktionslos"
        result[pid] = {
            "name": f"{vorname} {nachname}".strip(),
            "party": normalize_dip_party(raw_party),
        }
    return result
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
uv run pytest tests/test_fetch_dip.py -v
```
Expected: `6 passed`

- [ ] **Step 5: Commit**

```bash
git add src/fetch_dip.py tests/test_fetch_dip.py
git commit -m "feat: DIP person mapping and party normalization"
```

---

## Task 3: Aktivität aggregation → CSV

**Files:**
- Modify: `src/fetch_dip.py`
- Modify: `tests/test_fetch_dip.py`

Fetches `aktivitaet` records for a Bundestag term, counts per person per `aktivitaetsart`, and writes `data/{period_id}/dip_aktivitaet.csv`.

CSV schema:
```
dip_person_id,name,party,reden,kleine_anfragen,antraege,anfragen
12345,Friedrich Merz,CDU/CSU,23,0,12,5
```

The four tracked types map from DIP `aktivitaetsart` values:
- `"Rede"` → `reden`
- `"Kleine Anfrage"` → `kleine_anfragen`
- `"Antrag"` → `antraege`
- `"Anfrage"` → `anfragen` (Schriftliche Anfragen)

- [ ] **Step 1: Write the failing test**

Append to `tests/test_fetch_dip.py`:

```python
import tempfile
from pathlib import Path


def test_fetch_dip_aktivitaet_writes_csv(requests_mock, tmp_path):
    """Aggregates aktivitaet counts per person and writes CSV."""
    persons = {
        1: {"name": "Anna Müller", "party": "SPD"},
        2: {"name": "Max Schmidt", "party": "CDU/CSU"},
    }
    requests_mock.get(
        f"{DIP_BASE}/aktivitaet",
        json={
            "numFound": 4,
            "documents": [
                {"person_id": 1, "aktivitaetsart": "Rede"},
                {"person_id": 1, "aktivitaetsart": "Rede"},
                {"person_id": 1, "aktivitaetsart": "Kleine Anfrage"},
                {"person_id": 2, "aktivitaetsart": "Antrag"},
            ],
        },
    )
    dip.fetch_dip_aktivitaet(wahlperiode=20, persons=persons, out_dir=tmp_path)
    df = pd.read_csv(tmp_path / "dip_aktivitaet.csv")
    anna = df[df["dip_person_id"] == 1].iloc[0]
    assert anna["reden"] == 2
    assert anna["kleine_anfragen"] == 1
    assert anna["antraege"] == 0
    assert anna["party"] == "SPD"
    max_ = df[df["dip_person_id"] == 2].iloc[0]
    assert max_["antraege"] == 1
```

- [ ] **Step 2: Run test — verify it fails**

```bash
uv run pytest tests/test_fetch_dip.py::test_fetch_dip_aktivitaet_writes_csv -v
```
Expected: `AttributeError: module 'src.fetch_dip' has no attribute 'fetch_dip_aktivitaet'`

- [ ] **Step 3: Add `fetch_dip_aktivitaet` to `src/fetch_dip.py`**

```python
_ART_COLS = {
    "Rede": "reden",
    "Kleine Anfrage": "kleine_anfragen",
    "Antrag": "antraege",
    "Anfrage": "anfragen",
}


def fetch_dip_aktivitaet(
    wahlperiode: int,
    persons: dict[int, dict],
    out_dir: "Path | None" = None,
) -> pd.DataFrame:
    """Fetch aktivitaet records for a term, aggregate per person, write CSV.

    Returns the aggregated DataFrame. Writes dip_aktivitaet.csv to out_dir
    (defaults to DATA_DIR / str(period_id) but callers pass out_dir directly
    so tests can use tmp_path).
    """
    docs = fetch_dip_all("aktivitaet", {"wahlperiode": wahlperiode})

    # Count per (person_id, aktivitaetsart)
    counts: dict[int, dict[str, int]] = {}
    for doc in docs:
        pid = doc.get("person_id")
        art = doc.get("aktivitaetsart", "")
        col = _ART_COLS.get(art)
        if pid is None or col is None:
            continue
        if pid not in counts:
            counts[pid] = {c: 0 for c in _ART_COLS.values()}
        counts[pid][col] += 1

    rows = []
    for pid, col_counts in counts.items():
        person = persons.get(pid, {"name": "Unbekannt", "party": "fraktionslos"})
        rows.append({"dip_person_id": pid, **person, **col_counts})

    df = pd.DataFrame(rows, columns=["dip_person_id", "name", "party", *_ART_COLS.values()])
    df = df.fillna(0).astype({c: int for c in _ART_COLS.values()})

    if out_dir is not None:
        path = Path(out_dir) / "dip_aktivitaet.csv"
        path.parent.mkdir(parents=True, exist_ok=True)
        df.to_csv(path, index=False)
        log.info("Wrote %s (%d rows)", path, len(df))

    return df
```

- [ ] **Step 4: Run test — verify it passes**

```bash
uv run pytest tests/test_fetch_dip.py::test_fetch_dip_aktivitaet_writes_csv -v
```
Expected: `1 passed`

- [ ] **Step 5: Commit**

```bash
git add src/fetch_dip.py tests/test_fetch_dip.py
git commit -m "feat: DIP aktivitaet aggregation and CSV export"
```

---

## Task 4: Themen aggregation → CSV + `__main__`

**Files:**
- Modify: `src/fetch_dip.py`
- Modify: `tests/test_fetch_dip.py`

Fetches `vorgang` records for a term, counts per `sachgebiet` per party (via `initiative` field), and writes `data/{period_id}/dip_themen.csv`.

CSV schema:
```
sachgebiet,party,count
Innenpolitik,CDU/CSU,312
Innenpolitik,SPD,245
```

The `vorgang.initiative[]` field is an array of faction name strings (e.g. `["CDU/CSU", "SPD"]`). Each vorgang can have multiple initiators; count it once per party.

The `__main__` block reads `data/periods.csv`, calls both fetch functions for each period that has data.

- [ ] **Step 1: Write the failing tests**

Append to `tests/test_fetch_dip.py`:

```python
def test_fetch_dip_themen_writes_csv(requests_mock, tmp_path):
    """Counts vorgaenge per sachgebiet+party and writes CSV."""
    requests_mock.get(
        f"{DIP_BASE}/vorgang",
        json={
            "numFound": 2,
            "documents": [
                {"sachgebiet": ["Innenpolitik", "Soziales"], "initiative": ["CDU/CSU"]},
                {"sachgebiet": ["Innenpolitik"], "initiative": ["SPD", "CDU/CSU"]},
            ],
        },
    )
    dip.fetch_dip_themen(wahlperiode=20, out_dir=tmp_path)
    df = pd.read_csv(tmp_path / "dip_themen.csv")
    cdu_innen = df[(df["sachgebiet"] == "Innenpolitik") & (df["party"] == "CDU/CSU")]["count"].iloc[0]
    spd_innen = df[(df["sachgebiet"] == "Innenpolitik") & (df["party"] == "SPD")]["count"].iloc[0]
    cdu_soziales = df[(df["sachgebiet"] == "Soziales") & (df["party"] == "CDU/CSU")]["count"].iloc[0]
    assert cdu_innen == 2
    assert spd_innen == 1
    assert cdu_soziales == 1
```

- [ ] **Step 2: Run test — verify it fails**

```bash
uv run pytest tests/test_fetch_dip.py::test_fetch_dip_themen_writes_csv -v
```
Expected: `AttributeError: module 'src.fetch_dip' has no attribute 'fetch_dip_themen'`

- [ ] **Step 3: Add `fetch_dip_themen` + `__main__` to `src/fetch_dip.py`**

```python
def fetch_dip_themen(
    wahlperiode: int,
    out_dir: "Path | None" = None,
) -> pd.DataFrame:
    """Fetch vorgang records for a term, aggregate sachgebiet counts per party, write CSV.

    Each vorgang may list multiple sachgebiete and multiple initiative parties;
    it is counted once per (sachgebiet, party) combination.
    """
    docs = fetch_dip_all("vorgang", {"wahlperiode": wahlperiode})

    rows = []
    for doc in docs:
        sachgebiete = doc.get("sachgebiet") or []
        initiatives = doc.get("initiative") or []
        for sg in sachgebiete:
            for party_raw in initiatives:
                rows.append({"sachgebiet": sg, "party": normalize_dip_party(party_raw)})

    if not rows:
        df = pd.DataFrame(columns=["sachgebiet", "party", "count"])
    else:
        df = (
            pd.DataFrame(rows)
            .groupby(["sachgebiet", "party"], sort=False)
            .size()
            .reset_index(name="count")
        )

    if out_dir is not None:
        path = Path(out_dir) / "dip_themen.csv"
        path.parent.mkdir(parents=True, exist_ok=True)
        df.to_csv(path, index=False)
        log.info("Wrote %s (%d rows)", path, len(df))

    return df


if __name__ == "__main__":
    import argparse
    import logging

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )

    parser = argparse.ArgumentParser(description="Fetch DIP Bundestag data")
    parser.add_argument("--period", type=int, help="Specific period_id to process (default: all)")
    args = parser.parse_args()

    periods_csv = DATA_DIR / "periods.csv"
    periods_df = pd.read_csv(periods_csv)

    for _, row in periods_df.iterrows():
        period_id = int(row["period_id"])
        wahlperiode = int(row["bundestag_number"])
        if args.period and period_id != args.period:
            continue

        out_dir = DATA_DIR / str(period_id)
        log.info("Processing period %d (Wahlperiode %d)...", period_id, wahlperiode)

        persons = fetch_dip_persons(wahlperiode)
        fetch_dip_aktivitaet(wahlperiode, persons, out_dir)
        fetch_dip_themen(wahlperiode, out_dir)
```

- [ ] **Step 4: Run all tests — verify they pass**

```bash
uv run pytest tests/test_fetch_dip.py -v
```
Expected: `8 passed` (all tasks 1–4 combined)

- [ ] **Step 5: Commit**

```bash
git add src/fetch_dip.py tests/test_fetch_dip.py
git commit -m "feat: DIP themen aggregation, CSV export, and __main__ entry point"
```

---

## Task 5: JSON export — `export_dip_aktivitaet` + `export_dip_themen`

**Files:**
- Modify: `src/export_json.py`
- Modify: `tests/test_export_json.py`

`export_dip_aktivitaet` reads `dip_aktivitaet.csv` + `politicians.csv` (for mdb_count per party) and writes `dip_aktivitaet_{period_id}.json`.

`export_dip_themen` reads `dip_themen.csv` and writes `dip_themen_{period_id}.json` in `DeviationPivot` format (reusing existing `_pivot_to_json()`).

### JSON schemas

**`dip_aktivitaet_{period_id}.json`:**
```json
{
  "by_party": [
    {
      "party": "AfD",
      "reden": 412, "kleine_anfragen": 234, "antraege": 89, "anfragen": 45,
      "mdb_count": 78,
      "reden_per_mdb": 5.28, "kleine_anfragen_per_mdb": 3.0,
      "antraege_per_mdb": 1.14, "anfragen_per_mdb": 0.58
    }
  ],
  "by_person": [
    {"dip_person_id": 12345, "name": "Friedrich Merz", "party": "CDU/CSU",
     "reden": 23, "kleine_anfragen": 0, "antraege": 12, "anfragen": 5}
  ]
}
```

`by_person` is sorted by total activity descending. `by_party` is in `PARTY_ORDER`.

**`dip_themen_{period_id}.json`:** `DeviationPivot` format (identical to `party_profile` pivots):
```json
{
  "categories": ["Innenpolitik", "Wirtschaft", ...],
  "parties": ["CDU/CSU", "SPD", ...],
  "pct": [[18.3, 12.1, ...], ...],
  "dev": [[4.2, -1.8, ...], ...],
  "count": [[312, 245, ...], ...],
  "party_totals": [1700, 2100, ...]
}
```

`dev[cat][party]` = pct - Bundestag average for that sachgebiet (in percentage points).

- [ ] **Step 1: Write the failing tests**

Append to `tests/test_export_json.py` (find and open the file first to see existing import style, then add):

```python
import json
import pandas as pd
from src.export_json import export_dip_aktivitaet, export_dip_themen


def test_export_dip_aktivitaet(tmp_path):
    """Computes per-capita rates and writes correct JSON structure."""
    # dip_aktivitaet.csv
    akt_csv = tmp_path / "dip_aktivitaet.csv"
    pd.DataFrame([
        {"dip_person_id": 1, "name": "A B", "party": "SPD", "reden": 10, "kleine_anfragen": 2, "antraege": 3, "anfragen": 1},
        {"dip_person_id": 2, "name": "C D", "party": "SPD", "reden": 6, "kleine_anfragen": 0, "antraege": 1, "anfragen": 0},
    ]).to_csv(akt_csv, index=False)
    # politicians.csv — SPD has 2 members
    pol_csv = tmp_path / "politicians.csv"
    pd.DataFrame([
        {"politician_id": 10, "party": "SPD"},
        {"politician_id": 11, "party": "SPD"},
    ]).to_csv(pol_csv, index=False)

    out_path = tmp_path / "dip_aktivitaet_132.json"
    export_dip_aktivitaet(
        aktivitaet_csv=akt_csv,
        politicians_csv=pol_csv,
        out_path=out_path,
    )

    data = json.loads(out_path.read_text())
    assert len(data["by_party"]) == 1
    spd = data["by_party"][0]
    assert spd["party"] == "SPD"
    assert spd["reden"] == 16          # 10 + 6
    assert spd["mdb_count"] == 2
    assert spd["reden_per_mdb"] == 8.0
    # by_person sorted by total descending: person 1 first (10+2+3+1=16 > 6+0+1+0=7)
    assert data["by_person"][0]["dip_person_id"] == 1


def test_export_dip_themen(tmp_path):
    """Writes DeviationPivot JSON with correct deviation from average."""
    themen_csv = tmp_path / "dip_themen.csv"
    pd.DataFrame([
        {"sachgebiet": "Wirtschaft", "party": "FDP", "count": 100},
        {"sachgebiet": "Wirtschaft", "party": "SPD", "count": 50},
        {"sachgebiet": "Soziales", "party": "SPD", "count": 100},
        {"sachgebiet": "Soziales", "party": "FDP", "count": 10},
    ]).to_csv(themen_csv, index=False)

    out_path = tmp_path / "dip_themen_132.json"
    export_dip_themen(themen_csv=themen_csv, out_path=out_path)

    data = json.loads(out_path.read_text())
    assert "categories" in data
    assert "parties" in data
    assert "pct" in data
    assert "dev" in data
    assert "count" in data
    assert "party_totals" in data
    # FDP: 100 Wirtschaft / 110 total ≈ 90.9%; SPD: 50/150 ≈ 33.3%
    # Avg Wirtschaft: (100+50)/(110+150) ≈ 57.7%
    fdp_idx = data["parties"].index("FDP")
    wirt_idx = data["categories"].index("Wirtschaft")
    fdp_wirt_pct = data["pct"][wirt_idx][fdp_idx]
    assert fdp_wirt_pct is not None
    assert fdp_wirt_pct > 80  # FDP heavily weighted toward Wirtschaft
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
uv run pytest tests/test_export_json.py::test_export_dip_aktivitaet tests/test_export_json.py::test_export_dip_themen -v
```
Expected: `ImportError: cannot import name 'export_dip_aktivitaet'`

- [ ] **Step 3: Add both export functions to `src/export_json.py`**

Add after the existing helper functions (`_sanitize`, `_write`, `_pivot_to_json`):

```python
_AKT_COLS = ["reden", "kleine_anfragen", "antraege", "anfragen"]


def export_dip_aktivitaet(
    aktivitaet_csv: Path,
    politicians_csv: Path,
    out_path: Path,
) -> None:
    """Export MdB activity data as JSON for the /aktivitaet page.

    Reads dip_aktivitaet.csv and politicians.csv, computes per-capita rates,
    and writes the JSON to out_path.
    """
    akt = pd.read_csv(aktivitaet_csv)
    pol = pd.read_csv(politicians_csv)

    mdb_counts = pol.groupby("party").size().rename("mdb_count")

    party_agg = akt.groupby("party")[_AKT_COLS].sum().join(mdb_counts, how="left")
    party_agg["mdb_count"] = party_agg["mdb_count"].fillna(0).astype(int)
    for col in _AKT_COLS:
        mdb_c = party_agg["mdb_count"].replace(0, float("nan"))
        party_agg[f"{col}_per_mdb"] = (party_agg[col] / mdb_c).round(2)

    # Sort by PARTY_ORDER; unknown parties at end
    order_map = {p: i for i, p in enumerate(PARTY_ORDER)}
    party_agg["_order"] = party_agg.index.map(lambda p: order_map.get(p, len(PARTY_ORDER)))
    party_agg = party_agg.sort_values("_order").drop(columns="_order")

    by_party = []
    for party, row in party_agg.iterrows():
        entry: dict = {"party": party}
        for col in _AKT_COLS:
            entry[col] = int(row[col])
        entry["mdb_count"] = int(row["mdb_count"])
        for col in _AKT_COLS:
            entry[f"{col}_per_mdb"] = row[f"{col}_per_mdb"]
        by_party.append(entry)

    akt["_total"] = akt[_AKT_COLS].sum(axis=1)
    akt_sorted = akt.sort_values("_total", ascending=False).drop(columns="_total")
    by_person = akt_sorted.rename(columns={"dip_person_id": "dip_person_id"}).to_dict("records")
    for row in by_person:
        for col in _AKT_COLS:
            row[col] = int(row[col])
        row["dip_person_id"] = int(row["dip_person_id"])

    _write(out_path, {"by_party": by_party, "by_person": by_person})


def export_dip_themen(themen_csv: Path, out_path: Path) -> None:
    """Export sachgebiet topic data as DeviationPivot JSON for the /themen page.

    Reads dip_themen.csv, normalises counts to percentages, computes deviations
    from the Bundestag average, and writes the pivot in the same format as
    party_profile pivots so the existing DeviationHeatmap component can render it.
    """
    df = pd.read_csv(themen_csv)

    pivot_count = df.pivot_table(
        index="sachgebiet", columns="party", values="count", aggfunc="sum", fill_value=0
    )

    # Sort parties by PARTY_ORDER; drop unknown parties not in PARTY_ORDER to keep it clean
    known = [p for p in PARTY_ORDER if p in pivot_count.columns]
    pivot_count = pivot_count[known]

    # pct: share of each party's vorgaenge that fall into this sachgebiet
    party_totals = pivot_count.sum(axis=0)
    pivot_pct = (pivot_count / party_totals * 100).round(1)

    # avg: Bundestag-wide share for each sachgebiet
    total_all = pivot_count.values.sum()
    sg_totals = pivot_count.sum(axis=1)
    avg_pct = (sg_totals / total_all * 100).values  # shape: (n_categories,)

    # dev = pct - avg (percentage points)
    dev = pivot_pct.subtract(avg_pct, axis=0)

    _write(out_path, _pivot_to_json(pivot_pct, dev.to_numpy(), pivot_count))
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
uv run pytest tests/test_export_json.py::test_export_dip_aktivitaet tests/test_export_json.py::test_export_dip_themen -v
```
Expected: `2 passed`

- [ ] **Step 5: Run full test suite**

```bash
uv run pytest tests/ -v
```
Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add src/export_json.py tests/test_export_json.py
git commit -m "feat: JSON export for DIP aktivitaet and themen data"
```

---

## Task 6: `GroupedBarChart` component

**Files:**
- Create: `frontend/components/charts/GroupedBarChart.tsx`

D3-based grouped bar chart. When `activeGroup !== "all"`, collapses to a single horizontal bar chart (nicer on mobile per nice-charts guidelines). Party names on Y-axis (horizontal = mobile-friendly). Direct value labels on bars. Color driven by `PARTY_COLORS`.

**Props:**
```typescript
interface GroupedBarChartProps {
  // parties in display order
  parties: string[];
  // each group is one aktivitaetsart
  groups: { key: string; label: string; color: string; values: number[] }[];
  // "all" shows all groups; specific key shows only that group
  activeGroup: string;
  // label for the x-axis (e.g. "pro MdB")
  xLabel?: string;
  height?: number;
}
```

> **Before writing:** Read `frontend/node_modules/next/dist/docs/` to check for any breaking changes relevant to client components.

- [ ] **Step 1: Verify TypeScript compiles before changes**

```bash
cd frontend && npx tsc --noEmit
```
Expected: `0 errors`

- [ ] **Step 2: Create `frontend/components/charts/GroupedBarChart.tsx`**

```typescript
"use client";

// Grouped/single horizontal bar chart for comparing party activity metrics.
// When activeGroup === "all", renders grouped bars (one per aktivitaetsart).
// When a specific group is active, renders a simple horizontal bar chart.
// Follows nice-charts principles: horizontal bars for mobile readability,
// direct value labels, party colors from constants.
import * as d3 from "d3";
import { useEffect, useRef } from "react";
import { useContainerWidth } from "@/lib/chart-utils";

export interface BarGroup {
  key: string;
  label: string;
  color: string;
  values: number[]; // one value per party (same index as parties array)
}

interface Props {
  parties: string[];
  groups: BarGroup[];
  activeGroup: string; // "all" or a group key
  xLabel?: string;
  height?: number;
}

const MARGIN = { top: 16, right: 48, bottom: 32, left: 120 };
const BAR_HEIGHT = 18;
const BAR_GAP = 4;
const GROUP_GAP = 12;

export function GroupedBarChart({
  parties,
  groups,
  activeGroup,
  xLabel,
  height,
}: Props) {
  const { ref: containerRef, width } = useContainerWidth();
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const svg = d3.select(svgRef.current!);
    svg.selectAll("*").remove();
    const tooltip = d3.select(tooltipRef.current!);

    const visibleGroups =
      activeGroup === "all" ? groups : groups.filter((g) => g.key === activeGroup);

    if (!visibleGroups.length || !parties.length || width < 100) return;

    // Each party block: one row per group, then GROUP_GAP between parties
    const rowsPerParty = visibleGroups.length;
    const blockH = rowsPerParty * (BAR_HEIGHT + BAR_GAP) - BAR_GAP;
    const totalH =
      parties.length * blockH + (parties.length - 1) * GROUP_GAP + MARGIN.top + MARGIN.bottom;

    const svgH = height ?? totalH;
    const innerW = width - MARGIN.left - MARGIN.right;

    svg.attr("width", width).attr("height", svgH);
    const g = svg
      .append("g")
      .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    // X scale: max value across all visible groups
    const maxVal = d3.max(visibleGroups.flatMap((gr) => gr.values)) ?? 0;
    const xScale = d3.scaleLinear().domain([0, maxVal * 1.08]).range([0, innerW]);

    // Y position for each party block
    const partyY = (pi: number) => pi * (blockH + GROUP_GAP);

    // Draw bars
    parties.forEach((party, pi) => {
      const blockG = g
        .append("g")
        .attr("transform", `translate(0,${partyY(pi)})`);

      // Party label (left side)
      blockG
        .append("text")
        .attr("x", -8)
        .attr("y", blockH / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "end")
        .attr("font-size", 11)
        .attr("fill", "#374151")
        .text(party);

      visibleGroups.forEach((gr, gi) => {
        const y = gi * (BAR_HEIGHT + BAR_GAP);
        const val = gr.values[pi] ?? 0;
        const barW = xScale(val);

        blockG
          .append("rect")
          .attr("x", 0)
          .attr("y", y)
          .attr("width", barW)
          .attr("height", BAR_HEIGHT)
          .attr("fill", gr.color)
          .attr("rx", 3)
          .style("cursor", "pointer")
          .on("mouseover", function (event) {
            tooltip
              .style("opacity", 1)
              .html(
                `<b>${party}</b><br/>${gr.label}: <b>${val.toLocaleString("de-DE")}</b>`
              )
              .style("left", `${event.offsetX + 12}px`)
              .style("top", `${event.offsetY - 8}px`);
          })
          .on("mouseout", () => tooltip.style("opacity", 0));

        // Direct label — only when bar is wide enough
        if (barW > 28) {
          blockG
            .append("text")
            .attr("x", barW + 4)
            .attr("y", y + BAR_HEIGHT / 2)
            .attr("dy", "0.35em")
            .attr("font-size", 10)
            .attr("fill", "#6b7280")
            .text(val.toLocaleString("de-DE"));
        }
      });
    });

    // X axis at bottom
    const xAxis = d3.axisBottom(xScale).ticks(4).tickSizeOuter(0);
    g.append("g")
      .attr("transform", `translate(0,${totalH - MARGIN.top - MARGIN.bottom})`)
      .call(xAxis)
      .call((ax) => ax.select(".domain").remove())
      .call((ax) =>
        ax
          .selectAll("text")
          .attr("font-size", 10)
          .attr("fill", "#9ca3af")
      );

    if (xLabel) {
      g.append("text")
        .attr("x", innerW / 2)
        .attr("y", totalH - MARGIN.top - MARGIN.bottom + 26)
        .attr("text-anchor", "middle")
        .attr("font-size", 10)
        .attr("fill", "#9ca3af")
        .text(xLabel);
    }
  }, [parties, groups, activeGroup, xLabel, height, width]);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <svg ref={svgRef} style={{ display: "block" }} />
      <div
        ref={tooltipRef}
        style={{
          position: "absolute",
          opacity: 0,
          background: "rgba(0,0,0,0.75)",
          color: "#fff",
          padding: "6px 10px",
          borderRadius: 8,
          fontSize: 12,
          pointerEvents: "none",
          maxWidth: 200,
        }}
      />
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```
Expected: `0 errors`

- [ ] **Step 4: Commit**

```bash
git add frontend/components/charts/GroupedBarChart.tsx
git commit -m "feat: GroupedBarChart D3 component for activity comparison"
```

---

## Task 7: `/aktivitaet` page

**Files:**
- Create: `frontend/app/aktivitaet/page.tsx`

Tab layout: "Parteien" tab shows `GroupedBarChart` with filter pills. "MdBs" tab shows searchable horizontal bar list with optional party filter. Data loaded from `dip_aktivitaet_{period_id}.json`.

- [ ] **Step 1: Verify TypeScript before adding**

```bash
cd frontend && npx tsc --noEmit
```
Expected: `0 errors`

- [ ] **Step 2: Create `frontend/app/aktivitaet/page.tsx`**

```typescript
"use client";

// /aktivitaet — Parliamentary activity dashboard.
// Tab "Parteien": grouped bar chart comparing parties by activity type.
// Tab "MdBs": searchable list of individual MdB activity breakdowns.
// Data source: dip_aktivitaet_{period_id}.json (fetched from DIP Bundestag API).
import { useEffect, useState } from "react";
import { fetchData, dataUrl, stripSoftHyphen } from "@/lib/data";
import { usePeriod } from "@/lib/period-context";
import { PARTY_COLORS } from "@/lib/constants";
import { GroupedBarChart } from "@/components/charts/GroupedBarChart";
import { ChartSkeleton } from "@/components/ui/ChartSkeleton";
import { Footer } from "@/components/ui/Footer";

// ── Types ────────────────────────────────────────────────────────────────────

interface PartyRow {
  party: string;
  reden: number;
  kleine_anfragen: number;
  antraege: number;
  anfragen: number;
  mdb_count: number;
  reden_per_mdb: number;
  kleine_anfragen_per_mdb: number;
  antraege_per_mdb: number;
  anfragen_per_mdb: number;
}

interface PersonRow {
  dip_person_id: number;
  name: string;
  party: string;
  reden: number;
  kleine_anfragen: number;
  antraege: number;
  anfragen: number;
}

interface DipAktivitaetFile {
  by_party: PartyRow[];
  by_person: PersonRow[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const METRICS = [
  { key: "reden_per_mdb", label: "Reden", raw: "reden", color: "#6366f1" },
  { key: "kleine_anfragen_per_mdb", label: "Kleine Anfragen", raw: "kleine_anfragen", color: "#ef4444" },
  { key: "antraege_per_mdb", label: "Anträge", raw: "antraege", color: "#22c55e" },
  { key: "anfragen_per_mdb", label: "Anfragen", raw: "anfragen", color: "#f59e0b" },
] as const;

type MetricKey = (typeof METRICS)[number]["key"] | "all";

const ACCENT = "#1E1B5E";

// ── Component ─────────────────────────────────────────────────────────────────

export default function AktivitaetPage() {
  const { activePeriodId } = usePeriod();
  const [data, setData] = useState<DipAktivitaetFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"parteien" | "mdbs">("parteien");
  const [activeMetric, setActiveMetric] = useState<MetricKey>("all");
  const [search, setSearch] = useState("");
  const [partyFilter, setPartyFilter] = useState<string | null>(null);

  useEffect(() => {
    if (!activePeriodId) return;
    setLoading(true);
    fetchData<DipAktivitaetFile>(dataUrl("dip_aktivitaet_{period}.json", activePeriodId))
      .then((d) => {
        // Normalize party names (strip soft hyphens etc.)
        setData({
          by_party: d.by_party.map((r) => ({ ...r, party: stripSoftHyphen(r.party) })),
          by_person: d.by_person.map((r) => ({ ...r, party: stripSoftHyphen(r.party) })),
        });
        setLoading(false);
      })
      .catch(console.error);
  }, [activePeriodId]);

  // Build chart data for the Parteien tab
  const chartData = data
    ? (() => {
        const parties = data.by_party.map((r) => r.party);
        const groups = METRICS.map((m) => ({
          key: m.key,
          label: m.label,
          color: m.color,
          values: data.by_party.map((r) => r[m.key] ?? 0),
        }));
        return { parties, groups };
      })()
    : null;

  // Filter for MdB tab
  const filteredPersons = data
    ? data.by_person.filter((p) => {
        const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
        const matchParty = !partyFilter || p.party === partyFilter;
        return matchSearch && matchParty;
      })
    : [];

  const uniqueParties = data ? [...new Set(data.by_person.map((p) => p.party))].sort() : [];

  return (
    <>
      <div className="mb-8 pl-4 border-l-4" style={{ borderColor: ACCENT }}>
        <h1 className="text-[28px] font-black">Parlamentarische Aktivität</h1>
        <p className="text-sm text-gray-500 mt-1">
          Reden, Kleine Anfragen und Anträge im Vergleich
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-gray-200 mb-6">
        {(["parteien", "mdbs"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-2 text-sm font-semibold transition-colors"
            style={{
              color: tab === t ? ACCENT : "#6b7280",
              borderBottom: tab === t ? `2px solid ${ACCENT}` : "2px solid transparent",
              marginBottom: -1,
            }}
          >
            {t === "parteien" ? "Parteien" : "MdBs"}
          </button>
        ))}
      </div>

      {loading || !data ? (
        <ChartSkeleton height={400} />
      ) : tab === "parteien" ? (
        <div className="bg-white rounded-xl border p-5 md:p-6">
          {/* Filter pills */}
          <div className="flex flex-wrap gap-2 mb-5">
            <button
              onClick={() => setActiveMetric("all")}
              className="px-3 py-1 rounded-full text-xs font-semibold transition-colors"
              style={{
                background: activeMetric === "all" ? ACCENT : "#f3f4f6",
                color: activeMetric === "all" ? "#fff" : "#374151",
              }}
            >
              Alle
            </button>
            {METRICS.map((m) => (
              <button
                key={m.key}
                onClick={() => setActiveMetric(m.key)}
                className="px-3 py-1 rounded-full text-xs font-semibold transition-colors"
                style={{
                  background: activeMetric === m.key ? m.color : "#f3f4f6",
                  color: activeMetric === m.key ? "#fff" : "#374151",
                }}
              >
                {m.label}
              </button>
            ))}
          </div>

          <h2 className="font-extrabold text-[15px] mb-1">
            {activeMetric === "all"
              ? "Aktivitäten pro MdB nach Fraktion"
              : `${METRICS.find((m) => m.key === activeMetric)?.label ?? ""} pro MdB`}
          </h2>
          <p className="text-xs text-gray-400 mb-4">Normiert auf Fraktionsgröße</p>

          {chartData && (
            <GroupedBarChart
              parties={chartData.parties}
              groups={chartData.groups}
              activeGroup={activeMetric}
              xLabel="pro MdB"
            />
          )}

          {/* Legend — only in "all" mode */}
          {activeMetric === "all" && (
            <div className="flex flex-wrap gap-4 mt-4">
              {METRICS.map((m) => (
                <div key={m.key} className="flex items-center gap-1.5">
                  <div
                    className="w-3 h-3 rounded-sm"
                    style={{ background: m.color }}
                  />
                  <span className="text-xs text-gray-500">{m.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border p-5 md:p-6">
          {/* Search + party filter */}
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <input
              type="text"
              placeholder="Name suchen…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-indigo-400"
            />
            <select
              value={partyFilter ?? ""}
              onChange={(e) => setPartyFilter(e.target.value || null)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none"
            >
              <option value="">Alle Fraktionen</option>
              {uniqueParties.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* MdB list */}
          <div className="flex flex-col gap-3">
            {filteredPersons.slice(0, 50).map((person) => {
              const total = person.reden + person.kleine_anfragen + person.antraege + person.anfragen;
              const partyColor = PARTY_COLORS[person.party] ?? "#888";
              return (
                <div key={person.dip_person_id} className="border border-gray-100 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      className="w-1.5 h-8 rounded-full flex-shrink-0"
                      style={{ background: partyColor }}
                    />
                    <div>
                      <div className="font-semibold text-sm">{person.name}</div>
                      <div className="text-xs text-gray-400">{person.party} · {total} Aktivitäten</div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {METRICS.map((m) => {
                      const val = person[m.raw as keyof PersonRow] as number;
                      const pct = total > 0 ? (val / total) * 100 : 0;
                      return (
                        <div key={m.key} className="flex items-center gap-2">
                          <div className="w-20 text-xs text-gray-400 flex-shrink-0">{m.label}</div>
                          <div className="flex-1 bg-gray-100 rounded-full h-2">
                            <div
                              className="h-2 rounded-full transition-all"
                              style={{ width: `${pct}%`, background: m.color }}
                            />
                          </div>
                          <div className="w-6 text-xs text-gray-500 text-right">{val}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {filteredPersons.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">Keine Ergebnisse</p>
            )}
          </div>
        </div>
      )}
      <Footer />
    </>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```
Expected: `0 errors`

- [ ] **Step 4: Commit**

```bash
git add frontend/app/aktivitaet/page.tsx
git commit -m "feat: /aktivitaet page with tab layout and activity charts"
```

---

## Task 8: `/themen` page

**Files:**
- Create: `frontend/app/themen/page.tsx`

Reuses the existing `DeviationHeatmap` component directly. Data from `dip_themen_{period_id}.json`. Party column click links to `/aktivitaet?partei=<party>` (sets URL param, picked up by aktivitaet page on load).

- [ ] **Step 1: Create `frontend/app/themen/page.tsx`**

```typescript
"use client";

// /themen — Topic focus heatmap per party.
// Shows which policy areas (Sachgebiete) each party focuses on,
// expressed as deviation from the Bundestag-wide average (in percentage points).
// Reuses DeviationHeatmap component identical to the party-profile page.
// Data source: dip_themen_{period_id}.json (from DIP Bundestag API vorgang records).
import { useEffect, useState } from "react";
import { fetchData, dataUrl, stripSoftHyphen } from "@/lib/data";
import { usePeriod } from "@/lib/period-context";
import { DeviationHeatmap } from "@/components/charts/DeviationHeatmap";
import { ChartSkeleton } from "@/components/ui/ChartSkeleton";
import { Footer } from "@/components/ui/Footer";

// DeviationPivot matches the schema written by export_dip_themen()
interface DeviationPivot {
  categories: string[];
  parties: string[];
  pct: (number | null)[][];
  dev: (number | null)[][];
  count: number[][];
  party_totals: number[];
}

const ACCENT = "#7C3AED"; // violet to differentiate from other pages

export default function ThemenPage() {
  const { activePeriodId } = usePeriod();
  const [pivot, setPivot] = useState<DeviationPivot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activePeriodId) return;
    setLoading(true);
    fetchData<DeviationPivot>(dataUrl("dip_themen_{period}.json", activePeriodId))
      .then((d) => {
        // Normalize party names to match PARTY_COLORS keys
        setPivot({ ...d, parties: d.parties.map(stripSoftHyphen) });
        setLoading(false);
      })
      .catch(console.error);
  }, [activePeriodId]);

  return (
    <>
      <div className="mb-8 pl-4 border-l-4" style={{ borderColor: ACCENT }}>
        <h1 className="text-[28px] font-black">Themenprofile</h1>
        <p className="text-sm text-gray-500 mt-1">
          Welche Partei fokussiert welche Politikfelder?
        </p>
      </div>

      {loading || !pivot ? (
        <ChartSkeleton height={500} />
      ) : (
        <div className="flex flex-col gap-5 stagger">
          <section className="bg-white rounded-xl border p-5 md:p-6">
            <h2 className="font-extrabold text-[15px] mb-1">
              Sachgebiete — Abweichung vom Bundestag-Durchschnitt
            </h2>
            <p className="text-xs text-gray-400 mb-4">
              Prozentpunkte über (+) oder unter (−) dem Durchschnitt aller Fraktionen
            </p>
            <DeviationHeatmap pivot={pivot} height={600} />
          </section>
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
Expected: `0 errors`

- [ ] **Step 3: Commit**

```bash
git add frontend/app/themen/page.tsx
git commit -m "feat: /themen topic heatmap page"
```

---

## Task 9: Navigation

**Files:**
- Modify: `frontend/lib/nav-items.tsx`

Add both new pages to `NAV_ITEMS`. The array already drives both `Sidebar` and `BottomNav` — no other changes needed.

> Note: BottomNav shows all items from NAV_ITEMS. With 6 items it may feel crowded on small screens. If so, consider limiting BottomNav to 5 items (e.g. hide "Themen" there and show it only in Sidebar). Keep this decision for after visual review.

- [ ] **Step 1: Add both entries to `frontend/lib/nav-items.tsx`**

Open `frontend/lib/nav-items.tsx` and add after the last existing entry (before the closing `]`):

```typescript
  {
    href: "/aktivitaet",
    label: "Aktivität",
    icon: (active, size = 24) => (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
  },
  {
    href: "/themen",
    label: "Themen",
    icon: (active, size = 24) => (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```
Expected: `0 errors`

- [ ] **Step 3: Run full Python test suite one final time**

```bash
uv run pytest tests/ -v
```
Expected: all pass

- [ ] **Step 4: Final commit**

```bash
git add frontend/lib/nav-items.tsx
git commit -m "feat: add Aktivität and Themen to navigation"
```

---

## Running the full pipeline

After implementing all tasks, generate the data files:

```bash
# 1. Fetch DIP data (writes CSVs to data/{period_id}/)
uv run python -m src.fetch_dip

# 2. Export JSON (add calls to export_dip_aktivitaet + export_dip_themen
#    in the existing export_json __main__ block, or run manually):
uv run python -c "
from pathlib import Path
from src.export_json import export_dip_aktivitaet, export_dip_themen
import pandas as pd
for row in pd.read_csv('data/periods.csv').itertuples():
    d = Path('data') / str(row.period_id)
    export_dip_aktivitaet(d/'dip_aktivitaet.csv', d/'politicians.csv',
        Path(f'frontend/public/data/dip_aktivitaet_{row.period_id}.json'))
    export_dip_themen(d/'dip_themen.csv',
        Path(f'frontend/public/data/dip_themen_{row.period_id}.json'))
"

# 3. Start frontend
cd frontend && npm run dev
```
