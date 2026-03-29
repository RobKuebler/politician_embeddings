# Parlascanned

Ein interaktives Dashboard, das Bundestagsabgeordnete durchleuchtet: Abstimmungsverhalten, politische Trennlinien, demografische Profile, und mehr.

[**Demo ansehen**](https://parlascanned.vercel.app/) | [**Daten: abgeordnetenwatch.de**](https://www.abgeordnetenwatch.de)

---

## Idee

Namentliche Abstimmungen, Berufe, Alter, Geschlecht, akademische Titel -- all das ist öffentlich zugänglich, aber schwer zu überblicken. Parlascanned bündelt diese Daten für alle Wahlperioden ab 2021 und macht sie interaktiv erkundbar.

## Features

- **Abstimmungslandkarte:** Ein KI-Modell (kollaboratives Filtermodell, ähnlich Matrix-Faktorisierungen aus Empfehlungssystemen) weist jedem Abgeordneten eine Position im zweidimensionalen Raum zu. Je näher zwei Punkte, desto ähnlicher das Abstimmungsverhalten. Per Box- oder Lasso-Auswahl lassen sich mehrere Abgeordnete gleichzeitig markieren.
- **Abstimmungsverhalten (Heatmap):** Für ausgewählte Abgeordnete und Abstimmungen zeigt eine Heatmap Ja, Nein, Enthalten und Abwesenheit auf einen Blick.
- **Fraktionsdisziplin:** Wie geschlossen stimmt eine Fraktion ab? Ein Balkendiagramm zeigt die durchschnittliche Streuung der Abgeordneten um den Fraktionsmittelpunkt.
- **Parteiprofil:** Demografische und berufliche Profile der Fraktionen im Vergleich: Berufe, Altersverteilung, Geschlecht, akademische Titel.
- **Nebeneinkünfte:** Offengelegte Nebentätigkeiten und Einkünfte der Abgeordneten nach Partei, Kategorie und Themenfeld.
- **Wahlperioden-Auswahl:** Alle Wahlperioden ab dem 20. Bundestag (2021) sind verfügbar, sofern Daten und trainierte Embeddings vorhanden sind.

## Das Modell

Das Modell ist ein kollaboratives Filtermodell nach dem Vorbild von Matrix-Faktorisierungen, wie sie aus Empfehlungssystemen bekannt sind. Für jede namentliche Abstimmung wird ein Ja/Nein-Ergebnis pro Abgeordnetem als Trainingssignal verwendet.

**Architektur:**

- Jeder Abgeordnete und jede Abstimmung bekommt einen gelernten Embedding-Vektor (standardmäßig 2 Dimensionen).
- Das Modell berechnet die **L2-Distanz** zwischen dem Embedding eines Abgeordneten und dem einer Abstimmung.
- Zusätzlich lernt jede Einheit einen **Bias**, der allgemeine Ja/Nein-Tendenzen absorbiert, damit die Embeddings die inhaltliche Struktur sauber abbilden können.
- Verlustfunktion: `BCEWithLogitsLoss` auf binären Ja/Nein-Votes.
- Training mit `PyTorch Lightning`, frühem Abbruch wenn der relative Fortschritt unter 1 % pro Epoche fällt.

Nach dem Training werden nur die Abgeordneten-Embeddings exportiert. Ihre relative Position im Raum bildet das Abstimmungsverhalten ab.

## Setup

Voraussetzungen: Python 3.13, [uv](https://github.com/astral-sh/uv), Node.js 20+

```bash
# Python-Abhängigkeiten installieren (inkl. Dev-Tools)
uv sync --group dev

# spaCy-Modell für Textanalyse herunterladen
uv run python -m spacy download de_core_news_sm
```

### Datenpipeline

Die Schritte müssen in dieser Reihenfolge ausgeführt werden. Die Python-CLIs werden als Module gestartet, also mit `uv run python -m ...`. Alle Pipeline-Schritte akzeptieren `--wahlperiode INT`; bei `src.export` ist das optional und ohne Angabe werden alle exportierbaren Perioden verarbeitet. Jeweils `--help` für alle Optionen.

```bash
# 1. Abstimmungen, Politiker, Nebenjobs und Ausschüsse von abgeordnetenwatch.de laden
uv run python -m src.fetch.abgeordnetenwatch

# 2. Plenarprotokoll-Liste vom DIP Bundestag API laden
uv run python -m src.fetch.protokolle

# 3. Protokoll-XMLs herunterladen (liest dip_plenarprotokolle.csv aus Schritt 2)
uv run python -m src.fetch.protokoll_xml

# 4. XMLs parsen → speeches.csv
uv run python -m src.parse.protokolle

# 5. TF-IDF Wortstatistiken aus speeches.csv berechnen
uv run python -m src.analysis.word_stats

# 6. Embedding-Modell trainieren (benötigt PyTorch; --group train)
uv run --group train python -m src.model.train

# 7. JSON-Dateien für das Frontend exportieren
uv run python -m src.export
```

```bash
# Frontend starten (Next.js)
cd frontend && npm install && npm run dev
```

## Projektstruktur

```
src/
  fetch/
    abgeordnetenwatch.py  Abstimmungen, Politiker, Nebenjobs, Ausschüsse
    protokolle.py         Plenarprotokoll-Liste vom DIP API
    protokoll_xml.py      Protokoll-XMLs herunterladen
  parse/
    protokolle.py         XMLs parsen → speeches.csv
  analysis/
    word_stats.py         TF-IDF Wortstatistiken berechnen
    transforms.py         Reine Datentransformationen (Cohesion, Pivot, ...)
    occupation_clusters.py  Normalisierung von Berufsbezeichnungen
    education_clusters.py   Normalisierung von Bildungsabschlüssen
  model/
    model.py              Modellarchitektur (PoliticianEmbeddingModel)
    train.py              Einstiegspunkt für das Training
  export.py               JSON-Dateien für das Frontend generieren
  storage.py              CSV-Lesen/Schreiben, Pfade
frontend/
  app/                    Next.js App Router (Seiten und Layout)
  components/             UI-Komponenten und D3-Charts
  lib/                    Daten-Fetching, Kontexte, Konstanten
data/                     Rohdaten (gitignored)
outputs/                  Embedding-CSVs (gitignored)
```

## Danksagung

Die Abstimmungsdaten stammen von [**abgeordnetenwatch.de**](https://www.abgeordnetenwatch.de), einer gemeinnützigen Plattform, die Bürger mit ihren gewählten Abgeordneten verbindet und seit Jahren Transparenz über das parlamentarische Handeln schafft. Ohne ihre offene API wäre dieses Projekt nicht möglich. Herzlichen Dank.

## Lizenz

MIT
