"use client";

import { useMemo } from "react";
import { ConflictEntry, Politician } from "@/lib/data";
import { getPartyColor, getPartyShortLabel } from "@/lib/constants";
import { formatEur } from "@/components/charts/GroupedPartyBars";
import { PartyHeatmap } from "./PartyHeatmap";

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

  // Compute a display cap: when the top value dwarfs the second, cap the bar
  // axis so smaller bars stay readable. The break is marked visually — the
  // value label always shows the real (uncapped) amount.
  const sorted = rows.map((r) => r.totalIncome).sort((a, b) => b - a);
  const second = sorted[1] ?? sorted[0] ?? 1;
  const displayMax = sorted[0] > 1.5 * second ? second * 1.3 : (sorted[0] ?? 1);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        maxHeight: 480,
        overflowY: "auto",
      }}
    >
      {rows.map((r, i) => {
        const name =
          polMap.get(r.politician_id) ?? `Abgeordnete/r ${r.politician_id}`;
        const color = getPartyColor(r.party);
        const isTruncated = r.totalIncome > displayMax;
        const pct = (Math.min(r.totalIncome, displayMax) / displayMax) * 100;
        const textColor = r.party === "FDP" ? "#000" : "#fff";

        return (
          <div
            key={r.politician_id}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              padding: "10px 0",
              borderBottom: i < rows.length - 1 ? "1px solid #eeedf8" : "none",
            }}
          >
            {/* Rank */}
            <span
              style={{
                fontSize: 11,
                color: "#7872a8",
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
                  {getPartyShortLabel(r.party)}
                </span>
              </div>

              {/* One block per conflicting committee */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 5,
                  marginBottom: 6,
                }}
              >
                {r.committees.map((c) => (
                  <div key={c.label} style={{ fontSize: 11, lineHeight: 1.4 }}>
                    {/* Committee name */}
                    <div
                      style={{
                        color: "#5a556b",
                        fontWeight: 600,
                        marginBottom: 3,
                      }}
                    >
                      {c.label}
                    </div>
                    {/* Sidejob area tags — what the conflict is actually about */}
                    {c.topics.length > 0 && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                          flexWrap: "wrap",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 10,
                            color: "#9c97b8",
                            letterSpacing: "0.04em",
                            fontWeight: 500,
                            flexShrink: 0,
                          }}
                        >
                          Nebentätigkeit in:
                        </span>
                        {c.topics.map((t) => (
                          <span
                            key={t}
                            style={{
                              background: "#f0effe",
                              color: "#5a51a8",
                              borderRadius: 4,
                              padding: "1px 6px",
                              fontSize: 10,
                              fontWeight: 600,
                            }}
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Income bar — truncated bars show a break marker (≈) */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    flex: 1,
                    height: 6,
                    borderRadius: isTruncated ? "9999px 0 0 9999px" : 9999,
                    background: "#eeedf8",
                    position: "relative",
                    overflow: "visible",
                  }}
                >
                  <div
                    style={{
                      width: `${pct}%`,
                      height: "100%",
                      borderRadius: isTruncated ? "9999px 0 0 9999px" : 9999,
                      background: "#0f2d5c",
                      minWidth: pct > 0 ? 2 : 0,
                      position: "relative",
                    }}
                  >
                    {/* Break marker: two white diagonal notches at the right edge */}
                    {isTruncated && (
                      <div
                        aria-label="Balken abgeschnitten"
                        style={{
                          position: "absolute",
                          right: -1,
                          top: "50%",
                          transform: "translateY(-50%)",
                          display: "flex",
                          gap: 2,
                          alignItems: "center",
                        }}
                      >
                        {[0, 1].map((k) => (
                          <div
                            key={k}
                            style={{
                              width: 2,
                              height: 10,
                              background: "#fff",
                              transform: "skewX(-20deg)",
                              borderRadius: 1,
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#0f2d5c",
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

/**
 * Topic × party heatmap showing total conflicted income per cell.
 * Colour intensity = income relative to maximum cell (sequential red scale).
 * Wraps PartyHeatmap (mode="sequential").
 */
export function ConflictHeatmap({ conflicts, parties }: HeatmapProps) {
  const { rows, cols, data } = useMemo(() => {
    // Aggregate: topic → party → total conflicted income
    const map = new Map<string, Map<string, number>>();
    for (const c of conflicts) {
      for (const topic of c.matching_topics) {
        if (!map.has(topic)) map.set(topic, new Map());
        const pm = map.get(topic)!;
        pm.set(c.party, (pm.get(c.party) ?? 0) + c.conflicted_income);
      }
    }

    // Sort topics by total income descending
    const rows = [...map.entries()]
      .sort((a, b) => {
        const sumA = [...a[1].values()].reduce((s, v) => s + v, 0);
        const sumB = [...b[1].values()].reduce((s, v) => s + v, 0);
        return sumB - sumA;
      })
      .map(([topic]) => topic);

    // Only include parties that have at least one conflict
    const cols = parties.filter((p) => [...map.values()].some((m) => m.has(p)));

    const data = rows.map((topic) =>
      cols.map((party) => map.get(topic)?.get(party) ?? null),
    );

    return { rows, cols, data };
  }, [conflicts, parties]);

  return (
    <PartyHeatmap
      rows={rows}
      cols={cols}
      data={data}
      mode="sequential"
      cellLabel={formatEur}
      tooltipHtml={(row, col, val) =>
        `<b>${col}</b><br/>${row}<br/>${formatEur(val)}`
      }
    />
  );
}
