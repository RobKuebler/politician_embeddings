# Wer stimmt mit wem?

Ein interaktives Dashboard, das zeigt, wie ähnlich Bundestagsabgeordnete abstimmen, und wo die echten politischen Trennlinien verlaufen.

[**Demo ansehen**](https://politicianembeddings.streamlit.app/) | [**Daten: abgeordnetenwatch.de**](https://www.abgeordnetenwatch.de)

---

## Idee

Namentliche Abstimmungen im Bundestag sind öffentlich zugänglich, aber schwer zu überblicken. Dieses Projekt lädt alle verfügbaren Abstimmungsdaten seit dem Jahr 2021 (20. Bundestag) herunter und trainiert darauf ein Modell, das jedem Abgeordneten eine Position im zweidimensionalen Raum zuweist. Je näher zwei Punkte beieinander liegen, desto ähnlicher haben die beiden in der Vergangenheit abgestimmt.

Das Ergebnis ist eine interaktive Landkarte des Abstimmungsverhaltens, die keine Parteizugehörigkeit voraussetzt, sondern sie aus den Daten selbst ableitet.

## Das Modell

Das Modell ist ein kollaboratives Filtermodell nach dem Vorbild von Matrix-Faktorisierungen, wie sie aus Empfehlungssystemen bekannt sind. Für jede namentliche Abstimmung wird ein Ja/Nein-Ergebnis pro Abgeordnetem als Trainingssignal verwendet.

**Architektur:**

- Jeder Abgeordnete und jede Abstimmung bekommt einen gelernten Embedding-Vektor (standardmäßig 2 Dimensionen).
- Das Modell berechnet die **L2-Distanz** zwischen dem Embedding eines Abgeordneten und dem einer Abstimmung.
- Zusätzlich lernt jede Einheit einen **Bias**, der allgemeine Ja/Nein-Tendenzen absorbiert, damit die Embeddings die inhaltliche Struktur sauber abbilden können.
- Verlustfunktion: `BCEWithLogitsLoss` auf binären Ja/Nein-Votes.
- Training mit `PyTorch Lightning`, frühem Abbruch wenn der relative Fortschritt unter 1 % pro Epoche fällt.

Nach dem Training werden nur die Abgeordneten-Embeddings exportiert. Ihre relative Position im Raum bildet das Abstimmungsverhalten ab.

## Features

- **Abstimmungslandkarte:** Scatter-Plot aller Abgeordneten als Punkte. Per Box- oder Lasso-Auswahl lassen sich mehrere gleichzeitig markieren.
- **Abstimmungsverhalten (Heatmap):** Für ausgewählte Abgeordnete und Abstimmungen zeigt eine Heatmap Ja, Nein, Enthalten und Abwesenheit auf einen Blick.
- **Fraktionsdisziplin:** Ein Balkendiagramm zeigt, wie weit Abgeordnete einer Fraktion im Durchschnitt vom Fraktionsmittelpunkt entfernt sind, ein Maß dafür, wie geschlossen eine Fraktion abstimmt.
- **Wahlperioden-Auswahl:** Alle Wahlperioden ab dem 20. Bundestag (2021) sind verfügbar, sofern Daten und trainierte Embeddings vorhanden sind.

## Setup

Voraussetzungen: Python 3.13, [uv](https://github.com/astral-sh/uv)

```bash
# Abhängigkeiten installieren
uv sync

# Voting-Daten von abgeordnetenwatch.de laden (aktuelle Wahlperiode)
uv run src/fetch_data.py

# Modell trainieren und Embeddings berechnen
uv run src/train_model.py

# Dashboard starten
uv run streamlit run app.py
```

Optionale Parameter (jeweils `--help` für Details):

```bash
uv run src/fetch_data.py --period 111       # bestimmte Wahlperiode
uv run src/train_model.py --factors 2 --epochs 50 --lr 0.01
```

## Projektstruktur

```
src/
  fetch_data.py     Datenabruf von der abgeordnetenwatch.de API
  models.py         Modellarchitektur, Training, Embedding-Export
  train_model.py    Einstiegspunkt für das Training
app.py              Streamlit-App (Navigation)
pages/
  overview.py       Hauptseite: Scatter, Heatmap, Fraktionsdisziplin
data/               Rohdaten (gitignored)
outputs/            Embedding-CSVs (gitignored)
```

## Danksagung

Die Abstimmungsdaten stammen von [**abgeordnetenwatch.de**](https://www.abgeordnetenwatch.de), einer gemeinnützigen Plattform, die Bürger mit ihren gewählten Abgeordneten verbindet und seit Jahren Transparenz über das parlamentarische Handeln schafft. Ohne ihre offene API ware dieses Projekt nicht möglich. Herzlichen Dank.

## Lizenz

MIT
