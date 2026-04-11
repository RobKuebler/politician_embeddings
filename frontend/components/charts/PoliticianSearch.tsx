"use client";
import { useMemo } from "react";
import { Politician, stripSoftHyphen } from "@/lib/data";
import {
  COLOR_SECONDARY,
  getPartyColor,
  FILTER_ACCENT as ACCENT,
  FILTER_ACCENT_LIGHT as ACCENT_LIGHT,
  FILTER_BORDER as BORDER,
  truncateText as truncate,
  getPartyShortLabel,
} from "@/lib/constants";
import { useDropdown } from "@/hooks/useDropdown";
import { SearchInput } from "@/components/ui/SearchInput";
import { RemovableChip } from "@/components/ui/RemovableChip";

interface Props {
  politicians: Politician[];
  selected: number[]; // individual politician_ids
  onSelectionChange: (ids: number[]) => void;
  selectedParties?: string[]; // party names selected via centroid click
  onPartyRemove?: (party: string) => void;
  onClearAll?: () => void; // clears both individual + party selections
}

/** Search input + dropdown + chip list for selecting politicians, bidirectionally synced with the scatter plot. */
export function PoliticianSearch({
  politicians,
  selected,
  onSelectionChange,
  selectedParties = [],
  onPartyRemove,
  onClearAll,
}: Props) {
  const {
    query,
    isOpen,
    containerRef,
    handleChange,
    handleKeyDown,
    clearQuery,
    open,
  } = useDropdown();

  const polMap = useMemo(
    () => new Map(politicians.map((p) => [p.politician_id, p])),
    [politicians],
  );
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const results = useMemo(() => {
    const unselected = politicians.filter(
      (p) => !selectedSet.has(p.politician_id),
    );
    if (query.length === 0)
      return [...unselected].sort((a, b) => a.name.localeCompare(b.name, "de"));
    const lq = query.toLowerCase();
    return unselected.filter((p) => p.name.toLowerCase().includes(lq));
  }, [politicians, query, selectedSet]);

  function selectPolitician(id: number) {
    onSelectionChange([...selected, id]);
    clearQuery();
    // isOpen intentionally not set to false — dropdown stays open for continued multiselect
  }

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      {/* Search row: input + clear-all button */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <SearchInput
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={open}
          placeholder="Politiker suchen…"
        />

        {(selected.length > 0 || selectedParties.length > 0) && (
          <button
            onClick={() => (onClearAll ? onClearAll() : onSelectionChange([]))}
            style={{
              padding: "7px 12px",
              borderRadius: 8,
              fontSize: 12,
              border: `1px solid ${BORDER}`,
              background: "#fff",
              cursor: "pointer",
              color: COLOR_SECONDARY,
              whiteSpace: "nowrap",
              transition: "border-color 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = ACCENT;
              e.currentTarget.style.color = ACCENT;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = BORDER;
              e.currentTarget.style.color = COLOR_SECONDARY;
            }}
          >
            Auswahl aufheben
          </button>
        )}
      </div>

      {/* Chips — below the search bar */}
      {(selected.length > 0 || selectedParties.length > 0) && (
        <div
          style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}
        >
          {/* Party chips (from centroid click) */}
          {selectedParties.map((party) => (
            <RemovableChip
              key={party}
              label={getPartyShortLabel(party)}
              onRemove={() => onPartyRemove?.(party)}
              removeLabel={`Entferne ${party}`}
              dotColor={getPartyColor(party)}
            />
          ))}
          {/* Individual politician chips */}
          {selected.map((id) => {
            const pol = polMap.get(id);
            if (!pol) return null;
            const party = stripSoftHyphen(pol.party);
            return (
              <RemovableChip
                key={id}
                testId={`chip-${id}`}
                label={truncate(pol.name, 20)}
                onRemove={() =>
                  onSelectionChange(selected.filter((x) => x !== id))
                }
                removeLabel={`Entferne ${pol.name}`}
                dotColor={getPartyColor(party)}
                suffix={
                  <span style={{ color: "#666", fontSize: 11 }}>
                    {getPartyShortLabel(party)}
                  </span>
                }
              />
            );
          })}
        </div>
      )}

      {/* Dropdown */}
      {isOpen && (
        <ul
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            zIndex: 30,
            background: "#fff",
            border: `1px solid ${BORDER}`,
            borderRadius: 10,
            padding: 0,
            margin: 0,
            listStyle: "none",
            boxShadow: `0 8px 24px ${ACCENT}14, 0 2px 8px rgba(0,0,0,0.06)`,
            maxHeight: 240,
            overflowY: "auto",
          }}
        >
          {query.length === 0 && results.length > 0 && (
            <li
              style={{
                padding: "6px 14px 5px",
                fontSize: 11,
                color: COLOR_SECONDARY,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                borderBottom: "1px solid #F3F4F8",
                userSelect: "none",
                pointerEvents: "none",
              }}
            >
              {results.length} Abgeordnete
            </li>
          )}

          {results.length === 0 ? (
            <li
              style={{
                padding: "8px 12px",
                color: COLOR_SECONDARY,
                fontSize: 13,
              }}
            >
              Keine Ergebnisse
            </li>
          ) : (
            results.map((pol, i) => {
              const party = stripSoftHyphen(pol.party);
              const color = getPartyColor(party);
              return (
                <li
                  key={pol.politician_id}
                  role="option"
                  aria-selected={false}
                  onClick={() => selectPolitician(pol.politician_id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "7px 12px",
                    cursor: "pointer",
                    fontSize: 13,
                    borderBottom:
                      i < results.length - 1 ? "1px solid #F3F4F8" : "none",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = ACCENT_LIGHT)
                  }
                  onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: color,
                      flexShrink: 0,
                    }}
                  />
                  <span>{pol.name}</span>
                  <span
                    style={{
                      color: COLOR_SECONDARY,
                      fontSize: 11,
                      marginLeft: "auto",
                    }}
                  >
                    {getPartyShortLabel(party)}
                  </span>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
