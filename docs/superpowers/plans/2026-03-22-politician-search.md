# PoliticianSearch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a politician search/multiselect between the scatter plot and heatmap on `/vote-map`, bidirectionally synced with the scatter's selection state.

**Architecture:** New `PoliticianSearch` component owns search input, dropdown, and chip display. It shares `selectedPolIds` state already in `vote-map/page.tsx` with `VoteMapScatter` — no new state needed. The existing `handleSelection` callback is passed to both components, so lazy-loading of votes/polls triggers correctly from either source. The component tracks `isOpen` separately from `query` so the dropdown stays open after a selection (Multiselect-Kontext).

**Tech Stack:** React 18, TypeScript, Jest 30, Testing Library, `@testing-library/jest-dom`, `@testing-library/user-event`. New devDependency: `@testing-library/user-event@14`.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `frontend/components/charts/PoliticianSearch.tsx` | Search input, dropdown, chip list, clear button |
| Create | `frontend/__tests__/components/charts/PoliticianSearch.test.tsx` | RTL tests for all behaviours |
| Modify | `frontend/components/charts/VoteMapScatter.tsx:291-302` | Remove "Auswahl löschen" button and "N ausgewählt" counter |
| Modify | `frontend/app/vote-map/page.tsx:97-99` | Add `<PoliticianSearch>` between scatter card and heatmap card |

---

## Task 1: Remove button and counter from VoteMapScatter

**Files:**
- Modify: `frontend/components/charts/VoteMapScatter.tsx:291-302`

No test needed — this is a pure deletion of existing JSX.

- [ ] **Step 1: Delete the "Auswahl löschen" button and counter**

In `VoteMapScatter.tsx`, remove lines 291–302 (the `<button>Auswahl löschen</button>` and the `{selectedIds.length > 0 && <span>...</span>}` counter that follows it). Keep the mode-selector buttons (lines 276–290) untouched.

The `<div>` wrapping the buttons at line 275 and the mode buttons at lines 276–290 stay. Only these two elements are deleted:

```tsx
// DELETE this block (lines 291-302):
<button
  onClick={() => onSelectionChange([])}
  style={{
    padding: '4px 12px', borderRadius: 6, fontSize: 12,
    border: '1px solid #ddd', background: '#fff', cursor: 'pointer', color: '#666',
  }}
>
  Auswahl löschen
</button>
{selectedIds.length > 0 && (
  <span style={{ fontSize: 12, color: '#666' }}>{selectedIds.length} ausgewählt</span>
)}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/charts/VoteMapScatter.tsx
git commit -m "refactor: remove Auswahl-löschen button from VoteMapScatter (moved to PoliticianSearch)"
```

---

## Task 2: Write failing tests for PoliticianSearch

**Files:**
- Create: `frontend/__tests__/components/charts/PoliticianSearch.test.tsx`

Tests use React Testing Library. The test file must live under `__tests__/` to be picked up by Jest (see `jest.config.ts` `testMatch`).

- [ ] **Step 0: Install `@testing-library/user-event`**

```bash
cd frontend && npm install --save-dev @testing-library/user-event@14
```

Expected: Package added to `node_modules/@testing-library/user-event`.

- [ ] **Step 1: Create the test file**

```tsx
// frontend/__tests__/components/charts/PoliticianSearch.test.tsx
import React from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PoliticianSearch } from '@/components/charts/PoliticianSearch'
import { Politician } from '@/lib/data'

// Soft-hyphen in party name to test stripSoftHyphen usage
const POLITICIANS: Politician[] = [
  { politician_id: 1, name: 'Anna Schmidt', party: 'SPD', sex: 'f', year_of_birth: 1980, occupation: null, education: null, field_title: null },
  { politician_id: 2, name: 'Bernd Müller', party: 'CDU/CSU', sex: 'm', year_of_birth: 1975, occupation: null, education: null, field_title: null },
  { politician_id: 3, name: 'Clara Grün', party: 'BÜNDNIS 90/\u00adDIE GRÜNEN', sex: 'f', year_of_birth: 1990, occupation: null, education: null, field_title: null },
]

describe('PoliticianSearch', () => {
  describe('dropdown filtering', () => {
    it('shows no dropdown when input is empty', () => {
      render(<PoliticianSearch politicians={POLITICIANS} selected={[]} onSelectionChange={jest.fn()} />)
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })

    it('shows dropdown with matching results when input has ≥1 character', async () => {
      render(<PoliticianSearch politicians={POLITICIANS} selected={[]} onSelectionChange={jest.fn()} />)
      await userEvent.type(screen.getByPlaceholderText('Politiker suchen…'), 'Anna')
      expect(screen.getByRole('listbox')).toBeInTheDocument()
      expect(screen.getByRole('option', { name: /Anna Schmidt/ })).toBeInTheDocument()
    })

    it('filters case-insensitively by name', async () => {
      render(<PoliticianSearch politicians={POLITICIANS} selected={[]} onSelectionChange={jest.fn()} />)
      await userEvent.type(screen.getByPlaceholderText('Politiker suchen…'), 'anna')
      expect(screen.getByRole('option', { name: /Anna Schmidt/ })).toBeInTheDocument()
      expect(screen.queryByRole('option', { name: /Bernd/ })).not.toBeInTheDocument()
    })

    it('shows "Keine Ergebnisse" when no politicians match', async () => {
      render(<PoliticianSearch politicians={POLITICIANS} selected={[]} onSelectionChange={jest.fn()} />)
      await userEvent.type(screen.getByPlaceholderText('Politiker suchen…'), 'xyz')
      expect(screen.getByText('Keine Ergebnisse')).toBeInTheDocument()
    })

    it('hides already-selected politicians from dropdown', async () => {
      render(<PoliticianSearch politicians={POLITICIANS} selected={[1]} onSelectionChange={jest.fn()} />)
      await userEvent.type(screen.getByPlaceholderText('Politiker suchen…'), 'a')
      // Anna (id=1) is selected → should not appear in dropdown
      expect(screen.queryByRole('option', { name: /Anna Schmidt/ })).not.toBeInTheDocument()
      // Clara matches 'a' and is not selected → should appear
      expect(screen.getByRole('option', { name: /Clara/ })).toBeInTheDocument()
    })
  })

  describe('selection', () => {
    it('calls onSelectionChange with new id when a result is clicked', async () => {
      const onChange = jest.fn()
      render(<PoliticianSearch politicians={POLITICIANS} selected={[]} onSelectionChange={onChange} />)
      await userEvent.type(screen.getByPlaceholderText('Politiker suchen…'), 'Anna')
      await userEvent.click(screen.getByRole('option', { name: /Anna Schmidt/ }))
      expect(onChange).toHaveBeenCalledWith([1])
    })

    it('clears the search input after selecting a result', async () => {
      render(<PoliticianSearch politicians={POLITICIANS} selected={[]} onSelectionChange={jest.fn()} />)
      const input = screen.getByPlaceholderText('Politiker suchen…')
      await userEvent.type(input, 'Anna')
      await userEvent.click(screen.getByRole('option', { name: /Anna Schmidt/ }))
      expect(input).toHaveValue('')
    })

    it('keeps dropdown open after selecting a result (multiselect UX)', async () => {
      render(<PoliticianSearch politicians={POLITICIANS} selected={[]} onSelectionChange={jest.fn()} />)
      await userEvent.type(screen.getByPlaceholderText('Politiker suchen…'), 'a')
      await userEvent.click(screen.getByRole('option', { name: /Clara/ }))
      // Dropdown stays open so user can continue selecting without retyping
      expect(screen.getByRole('listbox')).toBeInTheDocument()
    })

    it('appends to existing selection when adding a second politician', async () => {
      const onChange = jest.fn()
      render(<PoliticianSearch politicians={POLITICIANS} selected={[1]} onSelectionChange={onChange} />)
      await userEvent.type(screen.getByPlaceholderText('Politiker suchen…'), 'Bernd')
      await userEvent.click(screen.getByRole('option', { name: /Bernd Müller/ }))
      expect(onChange).toHaveBeenCalledWith([1, 2])
    })
  })

  describe('chips', () => {
    it('renders a chip for each selected politician', () => {
      render(<PoliticianSearch politicians={POLITICIANS} selected={[1, 2]} onSelectionChange={jest.fn()} />)
      expect(screen.getByTestId('chip-1')).toBeInTheDocument()
      expect(screen.getByTestId('chip-2')).toBeInTheDocument()
    })

    it('removes politician from selection when chip × is clicked', async () => {
      const onChange = jest.fn()
      render(<PoliticianSearch politicians={POLITICIANS} selected={[1, 2]} onSelectionChange={onChange} />)
      await userEvent.click(within(screen.getByTestId('chip-1')).getByRole('button', { name: '×' }))
      expect(onChange).toHaveBeenCalledWith([2])
    })

    it('truncates politician name at 20 characters in chip', () => {
      // 'Maximilian Mustermann' = 21 chars → slice(0,20) = 'Maximilian Musterman' + '…'
      const longNamePol: Politician = {
        politician_id: 99, name: 'Maximilian Mustermann', party: 'SPD',
        sex: 'm', year_of_birth: 1970, occupation: null, education: null, field_title: null,
      }
      render(<PoliticianSearch politicians={[...POLITICIANS, longNamePol]} selected={[99]} onSelectionChange={jest.fn()} />)
      expect(screen.getByTestId('chip-99')).toHaveTextContent('Maximilian Musterman…')
    })

    it('renders party badge without soft-hyphen in chip', () => {
      render(<PoliticianSearch politicians={POLITICIANS} selected={[3]} onSelectionChange={jest.fn()} />)
      const chip = screen.getByTestId('chip-3')
      // Party name must be stripped of soft-hyphen
      expect(chip).not.toHaveTextContent('\u00ad')
      expect(chip).toHaveTextContent('BÜNDNIS 90/DIE GRÜNEN')
    })
  })

  describe('clear button', () => {
    it('does not show "Auswahl aufheben" when nothing is selected', () => {
      render(<PoliticianSearch politicians={POLITICIANS} selected={[]} onSelectionChange={jest.fn()} />)
      expect(screen.queryByRole('button', { name: 'Auswahl aufheben' })).not.toBeInTheDocument()
    })

    it('shows "Auswahl aufheben" when ≥1 politician is selected', () => {
      render(<PoliticianSearch politicians={POLITICIANS} selected={[1]} onSelectionChange={jest.fn()} />)
      expect(screen.getByRole('button', { name: 'Auswahl aufheben' })).toBeInTheDocument()
    })

    it('calls onSelectionChange([]) when "Auswahl aufheben" is clicked', async () => {
      const onChange = jest.fn()
      render(<PoliticianSearch politicians={POLITICIANS} selected={[1, 2]} onSelectionChange={onChange} />)
      await userEvent.click(screen.getByRole('button', { name: 'Auswahl aufheben' }))
      expect(onChange).toHaveBeenCalledWith([])
    })
  })

  describe('dropdown close behavior', () => {
    it('closes dropdown when Escape is pressed', async () => {
      render(<PoliticianSearch politicians={POLITICIANS} selected={[]} onSelectionChange={jest.fn()} />)
      await userEvent.type(screen.getByPlaceholderText('Politiker suchen…'), 'Anna')
      expect(screen.getByRole('listbox')).toBeInTheDocument()
      await userEvent.keyboard('{Escape}')
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })

    it('clears input when Escape is pressed', async () => {
      render(<PoliticianSearch politicians={POLITICIANS} selected={[]} onSelectionChange={jest.fn()} />)
      const input = screen.getByPlaceholderText('Politiker suchen…')
      await userEvent.type(input, 'Anna')
      await userEvent.keyboard('{Escape}')
      expect(input).toHaveValue('')
    })

    it('closes dropdown when clicking outside the component', async () => {
      render(
        <div>
          <PoliticianSearch politicians={POLITICIANS} selected={[]} onSelectionChange={jest.fn()} />
          <div data-testid="outside">outside</div>
        </div>
      )
      await userEvent.type(screen.getByPlaceholderText('Politiker suchen…'), 'Anna')
      expect(screen.getByRole('listbox')).toBeInTheDocument()
      await userEvent.click(screen.getByTestId('outside'))
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })

    it('closes dropdown when user manually clears the input', async () => {
      render(<PoliticianSearch politicians={POLITICIANS} selected={[]} onSelectionChange={jest.fn()} />)
      const input = screen.getByPlaceholderText('Politiker suchen…')
      await userEvent.type(input, 'Anna')
      expect(screen.getByRole('listbox')).toBeInTheDocument()
      await userEvent.clear(input)
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })
  })

  describe('external selection sync (scatter → chips)', () => {
    it('renders chips for politicians selected externally (e.g. from scatter)', () => {
      const { rerender } = render(
        <PoliticianSearch politicians={POLITICIANS} selected={[]} onSelectionChange={jest.fn()} />
      )
      expect(screen.queryByTestId('chip-1')).not.toBeInTheDocument()
      rerender(<PoliticianSearch politicians={POLITICIANS} selected={[1, 2]} onSelectionChange={jest.fn()} />)
      expect(screen.getByTestId('chip-1')).toBeInTheDocument()
      expect(screen.getByTestId('chip-2')).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd frontend && npx jest __tests__/components/charts/PoliticianSearch.test.tsx --no-coverage
```

Expected: All tests FAIL with `Cannot find module '@/components/charts/PoliticianSearch'`

---

## Task 3: Implement PoliticianSearch

**Files:**
- Create: `frontend/components/charts/PoliticianSearch.tsx`

Key design note: `isOpen` is tracked separately from `query`. This allows the dropdown to stay open after a selection (query is cleared, but `isOpen` remains `true`). The dropdown closes only on: Escape, outside click, or manual clear of the input.

- [ ] **Step 1: Create the component**

```tsx
// frontend/components/charts/PoliticianSearch.tsx
'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { Politician, stripSoftHyphen } from '@/lib/data'
import { PARTY_COLORS, FALLBACK_COLOR } from '@/lib/constants'

interface Props {
  politicians: Politician[]
  selected: number[]                          // politician_ids (= selectedPolIds in page.tsx)
  onSelectionChange: (ids: number[]) => void  // = handleSelection in page.tsx
}

/** Truncates a string to maxLen characters, appending '…' if truncated. */
function truncate(s: string, maxLen: number): string {
  return s.length > maxLen ? s.slice(0, maxLen) + '…' : s
}

/** Search input + dropdown + chip list for selecting politicians, bidirectionally synced with the scatter plot. */
export function PoliticianSearch({ politicians, selected, onSelectionChange }: Props) {
  const [query, setQuery] = useState('')
  // isOpen is tracked independently from query so the dropdown stays open after a selection
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Build a lookup map for fast access by id
  const polMap = new Map(politicians.map(p => [p.politician_id, p]))

  // Filter politicians: name match (case-insensitive), not already selected
  const selectedSet = new Set(selected)
  const results = query.length > 0
    ? politicians.filter(p =>
        !selectedSet.has(p.politician_id) &&
        p.name.toLowerCase().includes(query.toLowerCase())
      )
    : []

  // Close dropdown on outside click
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setQuery('')
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setQuery(val)
    // Close dropdown when user manually clears input; open it when they type
    if (val.length === 0) setIsOpen(false)
    else setIsOpen(true)
  }

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setQuery('')
      setIsOpen(false)
    }
  }, [])

  function selectPolitician(id: number) {
    onSelectionChange([...selected, id])
    setQuery('')
    // isOpen intentionally not set to false — dropdown stays open for continued multiselect
  }

  function removeChip(id: number) {
    onSelectionChange(selected.filter(x => x !== id))
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Chips for selected politicians */}
      {selected.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {selected.map(id => {
            const pol = polMap.get(id)
            if (!pol) return null
            const party = stripSoftHyphen(pol.party)
            const color = PARTY_COLORS[party] ?? FALLBACK_COLOR
            return (
              <span
                key={id}
                data-testid={`chip-${id}`}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '2px 8px', borderRadius: 12,
                  background: '#f0f0f0', fontSize: 12, color: '#333',
                }}
              >
                <span
                  style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }}
                  title={party}
                />
                {truncate(pol.name, 20)}
                <button
                  aria-label="×"
                  onClick={() => removeChip(id)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: 0, fontSize: 13, color: '#888', lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </span>
            )
          })}
        </div>
      )}

      {/* Search row: input + clear-all button */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Politiker suchen…"
          style={{
            flex: 1, padding: '6px 10px', borderRadius: 8,
            border: '1px solid #ddd', fontSize: 13, outline: 'none',
          }}
        />
        {selected.length > 0 && (
          <button
            onClick={() => onSelectionChange([])}
            style={{
              padding: '6px 12px', borderRadius: 8, fontSize: 12,
              border: '1px solid #ddd', background: '#fff', cursor: 'pointer', color: '#666',
              whiteSpace: 'nowrap',
            }}
          >
            Auswahl aufheben
          </button>
        )}
      </div>

      {/* Dropdown — visible when isOpen (stays open after selection for multiselect UX) */}
      {isOpen && (
        <ul
          role="listbox"
          style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
            background: '#fff', border: '1px solid #ddd', borderRadius: 8,
            marginTop: 4, padding: 0, listStyle: 'none',
            maxHeight: 240, overflowY: 'auto',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          }}
        >
          {results.length === 0 ? (
            <li style={{ padding: '8px 12px', color: '#999', fontSize: 13 }}>
              {query.length === 0 ? 'Tippe um zu suchen…' : 'Keine Ergebnisse'}
            </li>
          ) : (
            results.map(pol => {
              const party = stripSoftHyphen(pol.party)
              const color = PARTY_COLORS[party] ?? FALLBACK_COLOR
              return (
                <li
                  key={pol.politician_id}
                  role="option"
                  aria-selected={false}
                  onClick={() => selectPolitician(pol.politician_id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 12px', cursor: 'pointer', fontSize: 13,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  <span
                    style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }}
                  />
                  <span>{pol.name}</span>
                  <span style={{ color: '#999', fontSize: 11, marginLeft: 'auto' }}>{party}</span>
                </li>
              )
            })
          )}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run tests**

```bash
cd frontend && npx jest __tests__/components/charts/PoliticianSearch.test.tsx --no-coverage
```

Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/charts/PoliticianSearch.tsx frontend/__tests__/components/charts/PoliticianSearch.test.tsx
git commit -m "feat: add PoliticianSearch component with bidirectional scatter sync"
```

---

## Task 4: Integrate PoliticianSearch into vote-map/page.tsx

**Files:**
- Modify: `frontend/app/vote-map/page.tsx`

No separate test needed — the page is an integration point; the component's behavior is already tested.

- [ ] **Step 1: Add import**

At the top of `frontend/app/vote-map/page.tsx`, add alongside the existing chart imports:

```ts
import { PoliticianSearch } from '@/components/charts/PoliticianSearch'
```

- [ ] **Step 2: Add the component between scatter and heatmap**

In `page.tsx`, after the closing `</div>` of the Scatter card (line ~95) and before the opening `<div>` of the Heatmap card (line ~98), add:

```tsx
{/* Politician search — rendered as soon as politicians are loaded, synced with scatter */}
{!loading && (
  <div className="mb-6">
    <PoliticianSearch
      politicians={politicians}
      selected={selectedPolIds}
      onSelectionChange={handleSelection}
    />
  </div>
)}
```

- [ ] **Step 3: Run the full test suite**

```bash
cd frontend && npx jest --no-coverage
```

Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/vote-map/page.tsx
git commit -m "feat: integrate PoliticianSearch into vote-map page"
```
