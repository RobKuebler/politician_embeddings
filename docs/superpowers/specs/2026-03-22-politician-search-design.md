# Design: PoliticianSearch — Suche & bidirektionale Sync mit Abstimmungslandkarte

**Datum:** 2026-03-22
**Seite:** `/vote-map` (Abstimmungskarte)
**Bereich:** Zwischen VoteMapScatter und VoteHeatmap

---

## Ziel

Auf der Abstimmungskarte soll zwischen dem Scatter-Plot (Abstimmungslandkarte) und dem Heatmap (Abstimmungsverhalten) eine Suchleiste mit Multiselect für Politiker erscheinen. Die Auswahl soll bidirektional mit dem Scatter-Plot synchronisiert sein:

- Auswahl im Multiselect → Punkte im Scatter werden markiert
- Auswahl im Scatter (Klick, Rechteck, Lasso) → Chips im Multiselect erscheinen

---

## Komponente: `PoliticianSearch`

**Datei:** `frontend/components/charts/PoliticianSearch.tsx`

### Props

```typescript
interface PoliticianSearchProps {
  politicians: Politician[]
  selected: number[]                          // politician_ids (= selectedPolIds aus page.tsx)
  onSelectionChange: (ids: number[]) => void  // = handleSelection aus page.tsx
}
```

### UI-Verhalten

1. **Suchfeld** mit Placeholder „Politiker suchen…"
2. **Dropdown** erscheint ab 1 eingegebenem Zeichen:
   - Gefilterte Treffer (case-insensitive, nur nach Name — Suche nach Partei ist Out of Scope)
   - Jeder Eintrag zeigt: Name + Partei-Badge (Farbe aus `PARTY_COLORS`; `party`-Feld vor dem Farblookup und der Anzeige mit `stripSoftHyphen()` aus `data.ts` bereinigen)
   - Bereits ausgewählte Politiker werden im Dropdown ausgeblendet (bewusste Entscheidung: Entfernen nur via Chip, nicht via Dropdown-Re-Selektion)
   - Bei 0 Treffern: Text „Keine Ergebnisse"
3. **Dropdown-Schließverhalten:**
   - Nach Auswahl eines Eintrags: Dropdown bleibt offen (Multiselect-Kontext), Suchfeld wird geleert
   - Klick außerhalb der Komponente: Dropdown schließt
   - Escape-Taste: Dropdown schließt, Suchfeld wird geleert
   - Suchfeld wird geleert (z.B. nach Auswahl): Dropdown schließt
4. **Chips** für ausgewählte Politiker, oberhalb des Suchfelds:
   - Zeigen Name (ggf. gekürzt auf 20 Zeichen) + ×-Button zum Entfernen
   - Chip-Farbe neutral, Partei-Badge als farbiger Punkt
   - Bei vielen Chips: Container wrapped frei (kein Limit, kein „+N mehr")
5. **„Auswahl aufheben"**-Button erscheint wenn ≥1 Politiker ausgewählt

### Duplikat-Button in VoteMapScatter

`VoteMapScatter` hat bereits einen eigenen „Auswahl löschen"-Button. Dieser wird **entfernt** — der neue „Auswahl aufheben"-Button in `PoliticianSearch` übernimmt diese Funktion für die gesamte Seite.

---

## Bidirektionale Sync

Kein zusätzlicher State nötig. `vote-map/page.tsx` hält bereits `selectedPolIds` (Array von `politician_id`). Beide Komponenten lesen und schreiben denselben State über `handleSelection`:

```
VoteMapScatter ──onSelectionChange──┐
                                    ▼
                         selectedPolIds + handleSelection (page.tsx)
                                    │            │
                                    │            └─► Lazy-load von votes/polls
                                    │                bei erster Auswahl
PoliticianSearch ◄──selected────────┘
                 └──onSelectionChange──► handleSelection (selber Callback)
```

**Wichtig:** `handleSelection` löst beim Übergang von leer → nicht-leer auch das Lazy-Loading von `votes` und `polls` aus. `PoliticianSearch` nutzt denselben Callback — das Lazy-Loading funktioniert also auch bei Auswahl über die Suche korrekt.

---

## Änderungen in `vote-map/page.tsx`

- `<PoliticianSearch>` zwischen `<VoteMapScatter>` und `<VoteHeatmap>` einbinden
- Props: `politicians={politicians}`, `selected={selectedPolIds}`, `onSelectionChange={handleSelection}`
- `PoliticianSearch` wird bedingungslos gerendert (sobald `politicians` geladen ist), unabhängig davon ob Politiker ausgewählt sind oder Votes geladen werden
- Keine weiteren State-Änderungen erforderlich

---

## Änderungen in `VoteMapScatter.tsx`

- Den internen „Auswahl löschen"-Button **und** den zugehörigen „N ausgewählt"-Counter entfernen (ersetzt durch `PoliticianSearch`)

---

## Was sich NICHT ändert

- `VoteHeatmap` — keine Änderungen
- Datenmodell / API-Calls — keine Änderungen
- Scatter-Selektionslogik (Klick, Rechteck, Lasso) — keine Änderungen

---

## Out of Scope

- Suche nach Parteiname (nur Suche nach Politikername)
- Sortierung der Chips (erscheinen in Reihenfolge der Auswahl)
- Keyboard-Navigation im Dropdown
- Virtualisierung des Dropdowns (max. ~700 Einträge, performant genug ohne)
