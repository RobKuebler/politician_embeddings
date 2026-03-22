'use client'
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Politician, stripSoftHyphen } from '@/lib/data'
import { PARTY_COLORS, FALLBACK_COLOR, COLOR_SECONDARY } from '@/lib/constants'

interface Props {
  politicians: Politician[]
  selected: number[]                          // politician_ids (= selectedPolIds in page.tsx)
  onSelectionChange: (ids: number[]) => void  // = handleSelection in page.tsx
}

// Shared visual constants — must match PollFilter exactly
const ACCENT = '#4B6BFB'
const ACCENT_LIGHT = '#F0F4FF'
const BORDER = '#E2E5EE'
const BG_INPUT = '#FAFBFF'

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

  const polMap = useMemo(() => new Map(politicians.map(p => [p.politician_id, p])), [politicians])
  const selectedSet = useMemo(() => new Set(selected), [selected])

  const results = useMemo(() => {
    const unselected = politicians.filter(p => !selectedSet.has(p.politician_id))
    if (query.length === 0) return [...unselected].sort((a, b) => a.name.localeCompare(b.name, 'de'))
    const lq = query.toLowerCase()
    return unselected.filter(p => p.name.toLowerCase().includes(lq))
  }, [politicians, query, selectedSet])

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
    setQuery(e.target.value)
    setIsOpen(true)
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

      {/* Search row: input + clear-all button */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          {/* Search icon */}
          <svg
            width="14" height="14"
            viewBox="0 0 24 24" fill="none"
            stroke="#bbb" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round"
            style={{
              position: 'absolute', left: 10, top: '50%',
              transform: 'translateY(-50%)', pointerEvents: 'none',
            }}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Politiker suchen…"
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '7px 10px 7px 30px',
              borderRadius: 8,
              border: `1px solid ${BORDER}`,
              fontSize: 13, outline: 'none',
              background: BG_INPUT,
              color: '#333',
              transition: 'border-color 0.15s, box-shadow 0.15s',
            }}
            onFocus={e => {
              e.target.style.borderColor = ACCENT
              e.target.style.boxShadow = `0 0 0 3px ${ACCENT}22`
              setIsOpen(true)
            }}
            onBlur={e => {
              e.target.style.borderColor = BORDER
              e.target.style.boxShadow = 'none'
            }}
          />
        </div>

        {selected.length > 0 && (
          <button
            onClick={() => onSelectionChange([])}
            style={{
              padding: '7px 12px', borderRadius: 8, fontSize: 12,
              border: `1px solid ${BORDER}`,
              background: '#fff', cursor: 'pointer', color: COLOR_SECONDARY,
              whiteSpace: 'nowrap',
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = ACCENT
              e.currentTarget.style.color = ACCENT
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = BORDER
              e.currentTarget.style.color = COLOR_SECONDARY
            }}
          >
            Auswahl aufheben
          </button>
        )}
      </div>

      {/* Chips — below the search bar */}
      {selected.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
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
                />
                {truncate(pol.name, 20)}
                <span style={{ color: '#666', fontSize: 11 }}>{party}</span>
                <button
                  aria-label={`Entferne ${pol.name}`}
                  onClick={() => removeChip(id)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: 0, fontSize: 13, color: FALLBACK_COLOR, lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </span>
            )
          })}
        </div>
      )}

      {/* Dropdown — visible when isOpen (stays open after selection for multiselect UX) */}
      {isOpen && (
        <ul
          role="listbox"
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 30,
            background: '#fff',
            border: `1px solid ${BORDER}`,
            borderRadius: 10,
            padding: 0, margin: 0, listStyle: 'none',
            boxShadow: `0 8px 24px ${ACCENT}14, 0 2px 8px rgba(0,0,0,0.06)`,
            maxHeight: 240, overflowY: 'auto',
          }}
        >
          {/* Subtle header when browsing all politicians */}
          {query.length === 0 && results.length > 0 && (
            <li
              style={{
                padding: '6px 14px 5px',
                fontSize: 11,
                color: COLOR_SECONDARY,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                borderBottom: '1px solid #F3F4F8',
                userSelect: 'none',
                pointerEvents: 'none',
              }}
            >
              {results.length} Abgeordnete
            </li>
          )}

          {results.length === 0 ? (
            <li style={{ padding: '8px 12px', color: COLOR_SECONDARY, fontSize: 13 }}>
              Keine Ergebnisse
            </li>
          ) : (
            results.map((pol, i) => {
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
                    borderBottom: i < results.length - 1 ? '1px solid #F3F4F8' : 'none',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = ACCENT_LIGHT)}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  <span
                    style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }}
                  />
                  <span>{pol.name}</span>
                  <span style={{ color: COLOR_SECONDARY, fontSize: 11, marginLeft: 'auto' }}>{party}</span>
                </li>
              )
            })
          )}
        </ul>
      )}
    </div>
  )
}
