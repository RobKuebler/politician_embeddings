"use client";

import { ConflictEntry, Politician } from "@/lib/data";
import { PARTY_COLORS, FALLBACK_COLOR } from "@/lib/constants";
import { formatEur } from "@/components/charts/GroupedPartyBars";

// ── ConflictRankedList ────────────────────────────────────────────────────────

interface RankedListProps {
  conflicts: ConflictEntry[];
  politicians: Politician[];
}

/** Ranked list of politicians sorted by total conflicted income.
 * Multiple committee conflicts per politician are merged into one row. */
export function ConflictRankedList({
  conflicts,
  politicians,
}: RankedListProps) {
  const polMap = new Map(politicians.map((p) => [p.politician_id, p.name]));

  // Merge all committee rows per politician: sum income, collect committees
  const merged = new Map<
    number,
    {
      politician_id: number;
      party: string;
      totalIncome: number;
      committees: { label: string; topics: string[] }[];
    }
  >();
  for (const c of conflicts) {
    const existing = merged.get(c.politician_id);
    if (existing) {
      existing.totalIncome += c.conflicted_income;
      existing.committees.push({
        label: c.committee_label,
        topics: c.matching_topics,
      });
    } else {
      merged.set(c.politician_id, {
        politician_id: c.politician_id,
        party: c.party,
        totalIncome: c.conflicted_income,
        committees: [{ label: c.committee_label, topics: c.matching_topics }],
      });
    }
  }

  const rows = [...merged.values()].sort(
    (a, b) => b.totalIncome - a.totalIncome,
  );
  const maxIncome = Math.max(...rows.map((r) => r.totalIncome), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {rows.map((r, i) => {
        const name =
          polMap.get(r.politician_id) ?? `Abgeordnete/r ${r.politician_id}`;
        const color = PARTY_COLORS[r.party] ?? FALLBACK_COLOR;
        const pct = (r.totalIncome / maxIncome) * 100;
        const textColor = r.party === "FDP" ? "#000" : "#fff";

        return (
          <div
            key={r.politician_id}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              padding: "10px 0",
              borderBottom: i < rows.length - 1 ? "1px solid #F0EEE9" : "none",
            }}
          >
            {/* Rank */}
            <span
              style={{
                fontSize: 11,
                color: "#9A9790",
                width: 18,
                flexShrink: 0,
                paddingTop: 2,
                textAlign: "right",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {i + 1}
            </span>

            {/* Name + party + committees + bar */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 4,
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{ fontSize: 13, fontWeight: 700, color: "#171613" }}
                >
                  {name}
                </span>
                <span
                  style={{
                    background: color,
                    color: textColor,
                    borderRadius: 4,
                    padding: "1px 6px",
                    fontSize: 10,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {r.party}
                </span>
              </div>

              {/* One line per conflicting committee */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                  marginBottom: 6,
                }}
              >
                {r.committees.map((c) => (
                  <div
                    key={c.label}
                    style={{ fontSize: 11, color: "#9A9790", lineHeight: 1.4 }}
                  >
                    <span style={{ fontWeight: 600, color: "#6B6760" }}>
                      {c.label}
                    </span>
                    {c.topics.length > 0 && (
                      <span> · {c.topics.join(", ")}</span>
                    )}
                  </div>
                ))}
              </div>

              {/* Income bar */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    flex: 1,
                    height: 6,
                    borderRadius: 9999,
                    background: "#F0EEE9",
                  }}
                >
                  <div
                    style={{
                      width: `${pct}%`,
                      height: "100%",
                      borderRadius: 9999,
                      background: "#c0392b",
                      minWidth: pct > 0 ? 2 : 0,
                    }}
                  />
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#c0392b",
                    flexShrink: 0,
                    minWidth: 70,
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {formatEur(r.totalIncome)}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── ConflictHeatmap ───────────────────────────────────────────────────────────

interface HeatmapProps {
  conflicts: ConflictEntry[];
  parties: string[];
}

/** Topic × party income heatmap. Cells are colored by income relative to max. */
export function ConflictHeatmap({ conflicts, parties }: HeatmapProps) {
  // Aggregate: topic → party → total conflicted income
  const map = new Map<string, Map<string, number>>();
  for (const c of conflicts) {
    for (const topic of c.matching_topics) {
      if (!map.has(topic)) map.set(topic, new Map());
      const partyMap = map.get(topic)!;
      partyMap.set(c.party, (partyMap.get(c.party) ?? 0) + c.conflicted_income);
    }
  }

  // Sort topics by total income across all parties, descending
  const topics = [...map.entries()]
    .sort((a, b) => {
      const sumA = [...a[1].values()].reduce((s, v) => s + v, 0);
      const sumB = [...b[1].values()].reduce((s, v) => s + v, 0);
      return sumB - sumA;
    })
    .map(([topic]) => topic);

  const maxCell = Math.max(
    ...[...map.values()].flatMap((m) => [...m.values()]),
    1,
  );

  // Interpolate white → red based on income intensity
  function cellBg(income: number): string {
    const t = income / maxCell;
    const r = Math.round(255 - t * (255 - 192));
    const g = Math.round(255 - t * (255 - 57));
    const b = Math.round(255 - t * (255 - 43));
    return `rgb(${r},${g},${b})`;
  }

  // Only show parties that appear in at least one conflict
  const activeParties = parties.filter((p) =>
    [...map.values()].some((m) => m.has(p)),
  );

  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}
      >
        <thead>
          <tr>
            <th
              style={{
                textAlign: "left",
                padding: "4px 8px",
                fontSize: 10,
                fontWeight: 700,
                color: "#9A9790",
              }}
            >
              Themenfeld
            </th>
            {activeParties.map((p) => (
              <th
                key={p}
                style={{
                  padding: "4px 6px",
                  fontSize: 10,
                  fontWeight: 700,
                  color: p === "FDP" ? "#999" : (PARTY_COLORS[p] ?? "#333"),
                  textAlign: "center",
                  whiteSpace: "nowrap",
                }}
              >
                {p}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {topics.map((topic, i) => (
            <tr
              key={topic}
              style={{ background: i % 2 === 1 ? "#fafaf8" : "transparent" }}
            >
              <td
                style={{
                  padding: "5px 8px",
                  fontWeight: 600,
                  color: "#171613",
                  whiteSpace: "nowrap",
                  fontSize: 12,
                }}
              >
                {topic}
              </td>
              {activeParties.map((party) => {
                const income = map.get(topic)?.get(party);
                return (
                  <td
                    key={party}
                    style={{ padding: "3px 6px", textAlign: "center" }}
                  >
                    {income ? (
                      <div
                        style={{
                          background: cellBg(income),
                          borderRadius: 4,
                          padding: "2px 6px",
                          fontSize: 11,
                          fontWeight: income > maxCell * 0.5 ? 700 : 400,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatEur(income)}
                      </div>
                    ) : (
                      <span style={{ color: "#ddd", fontSize: 11 }}>-</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
