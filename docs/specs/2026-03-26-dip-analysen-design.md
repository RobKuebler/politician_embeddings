# Design: DIP Bundestag API — Neue Analyseseiten

**Datum:** 2026-03-26
**Status:** Approved

## Überblick

Zwei neue Seiten, die Daten aus der DIP Bundestag API (search.dip.bundestag.de/api/v1) integrieren:

1. `/aktivitaet` — MdB-Aktivitätsprofile + Kleine Anfragen
2. `/themen` — Themen-Profil der Fraktionen

Datenpipeline: Python → statische JSON-Dateien → Next.js (identisch zum bestehenden abgeordnetenwatch-Flow).

---

## Seite 1: `/aktivitaet`

**Kernaussage:** Wer arbeitet wirklich — und wer kontrolliert die Regierung am meisten?

### Layout: Tab-Layout mit Metrik-Filter

**Tabs:** "Parteien" | "MdBs"

---

### Tab "Parteien"

**Filter-Pills** oben: `Alle` | `Reden` | `Kleine Anfragen` | `Anträge` | `Anfragen`

**Visualisierung:** Grouped Bar Chart
- X-Achse: Fraktionen (AfD, CDU/CSU, SPD, Grüne, FDP, BSW, …)
- Y-Achse: Anzahl Aktivitäten **pro MdB** (normiert auf Fraktionsgröße)
- Gruppierte Balken: je nach aktivem Filter 1–4 Balkengruppen pro Fraktion
- Mobile: horizontale Balken (Parteien auf Y-Achse)

**Farben:**
- Reden: `colorScheme.primary`
- Kleine Anfragen: `colorScheme.error` (rot — Oppositionskontrolle)
- Anträge: `colorScheme.tertiary`
- Anfragen: `colorScheme.secondary`
- Inaktive Typen: grau

**Beschriftung:**
- Direkte Wert-Labels auf Balkende wo Platz
- Titel als Aussage (dynamisch je nach Filter), z.B. "Die AfD stellt die meisten Kleinen Anfragen pro Kopf"
- Tooltip: "42 Kleine Anfragen · 6,3 pro MdB"

**Cross-Link:** Klick auf eine Fraktion → wechselt zu Tab "MdBs" mit Partei vorfiltriert

---

### Tab "MdBs"

**Suche + Filter:**
- Suchfeld (Name)
- Partei-Filter (optional; wird von Themen-Seite oder Parteien-Tab gesetzt)

**Default-Ansicht:** Top-10 aktivste MdBs (nach Gesamtaktivität)

**Visualisierung pro MdB:** Horizontale Balken
- Reden / Kleine Anfragen / Anträge nebeneinander
- Direkte Labels ("12 Reden", "34 Anfragen")
- Parteifarbe als Akzent-Element (Punkt oder linker Rand)

---

## Seite 2: `/themen`

**Kernaussage:** Welche Partei beschäftigt sich mit welchen Politikfeldern?

### Layout: Heatmap

**Struktur:**
- Zeilen: Sachgebiete aus `vorgang.sachgebiet[]` (ca. 20–30 Kategorien)
- Spalten: Fraktionen
- Zellwert: Abweichung vom Bundestag-Durchschnitt für dieses Sachgebiet (in Prozentpunkten)

**Farbskala:** Divergierend
- Negativ (unter Durchschnitt) → neutral → positiv (über Durchschnitt)
- Midpoint klar beschriftet: "Ø Bundestag"
- Identisches Schema zur bestehenden Deviation-Heatmap auf der Party-Profile-Seite

**Sortierung:** Zeilen nach Gesamtaktivität absteigend (wichtigste Themen oben)

**Interaktion:**
- Hover/Tap auf Zelle → Tooltip: "CDU/CSU: +8,3 Pp über Durchschnitt bei Wirtschaft (312 Vorgänge)"
- Klick auf Fraktions-Spalte → Link zu `/aktivitaet?partei=CDU/CSU`

**Legende:** Sticky am oberen Rand, wiederholt bei langen Listen

---

## Datenpipeline

### Neues Skript: `backend/fetch_dip.py`

**API-Key:** `OSOegLs.PR2lwJ1dwCeje9vTj7FPOt3hvpYKtwKkhw`
**Base URL:** `https://search.dip.bundestag.de/api/v1`

**Endpoints genutzt:**

| Endpoint | Zweck |
|---|---|
| `aktivitaet` | Aktivitäten pro Person (Typ + Anzahl) |
| `drucksache?drucksachetyp=Kleine+Anfrage` | Kleine Anfragen mit Einreicher |
| `vorgang` | Sachgebiete für Themen-Profil |
| `person` | MdB-Namen + Fraktionszuordnung |

**Output-Dateien:**

```
frontend/public/data/
  dip_aktivitaet_{period}.json    # Aktivitäten aggregiert pro MdB + Fraktion
  dip_themen_{period}.json        # Sachgebiet-Anteile pro Fraktion (normiert)
```

**Schema `dip_aktivitaet_{period}.json`:**
```json
{
  "by_party": {
    "CDU/CSU": { "reden": 412, "kleine_anfragen": 23, "antraege": 156, "anfragen": 89, "mdb_count": 197 },
    ...
  },
  "by_person": {
    "person_id": { "name": "...", "party": "...", "reden": 12, "kleine_anfragen": 5, "antraege": 3, "anfragen": 8 },
    ...
  }
}
```

**Schema `dip_themen_{period}.json`:**
```json
{
  "sachgebiete": ["Innenpolitik", "Soziales", "Wirtschaft", ...],
  "by_party": {
    "CDU/CSU": { "Innenpolitik": 0.18, "Soziales": 0.12, ... },
    ...
  },
  "average": { "Innenpolitik": 0.14, "Soziales": 0.11, ... }
}
```

### Integration in bestehenden Build-Prozess

`fetch_dip.py` wird zusammen mit `fetch_data.py` ausgeführt (gleicher Perioden-Parameter).

---

## Visualisierungs-Prinzipien (nice-charts)

- **Horizontal auf Mobile:** Balkendiagramme wechseln auf horizontale Ausrichtung bei schmalen Viewports
- **Divergierende Skala mit Midpoint:** Heatmap nutzt symmetrische Farbskala, Nulllinie klar beschriftet
- **Direkte Labels:** Balkenwerte direkt am Balkenende, keine separate Legende
- **Titel als Aussage:** Chart-Überschriften beschreiben den Befund, nicht die Daten
- **Grau für Kontext:** Inaktive Metrik-Typen werden grau dargestellt
- **Tooltip erklärt:** "42 Kleine Anfragen (6,3 pro MdB)" statt nur "42"
- **Max 4 Farben** für Aktivitätstypen

---

## Navigation

Beide Seiten werden in die bestehende BottomNav/Sidebar aufgenommen:
- `/aktivitaet` → Icon: Aktivitäts-Symbol (z.B. Blitz oder Person)
- `/themen` → Icon: Themen-Symbol (z.B. Tag oder Kategorie)
