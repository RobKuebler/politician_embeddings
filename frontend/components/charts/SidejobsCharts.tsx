"use client";
import {
  sortParties,
  getPartyColor,
  getPartyShortLabel,
} from "@/lib/constants";
import { SidejobRecord, stripSoftHyphen } from "@/lib/data";
import { HorizontalBarRow } from "@/components/charts/HorizontalBarRow";
import { formatEur } from "@/components/charts/GroupedPartyBars";
import { PartyHeatmap } from "@/components/charts/PartyHeatmap";

// ── Chart 1: Sidejobs per party ───────────────────────────────────────────────

export function SidejobsByPartyChart({ jobs }: { jobs: SidejobRecord[] }) {
  const counts: Record<string, number> = {};
  for (const j of jobs) {
    const party = stripSoftHyphen(j.party);
    if (party === "fraktionslos") continue;
    counts[party] = (counts[party] ?? 0) + 1;
  }
  const parties = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  const max = counts[parties[0]] ?? 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {parties.map((party) => (
        <HorizontalBarRow
          key={party}
          label={getPartyShortLabel(party)}
          labelWidth={80}
          value={counts[party]}
          max={max}
          color={getPartyColor(party)}
          displayValue={String(counts[party])}
          barHeight={8}
        />
      ))}
    </div>
  );
}

/**
 * Alias for the sidejobs page which imports IncomeByPartyChart.
 * Extra props (parties, politicians) are accepted but not used since
 * the chart now shows job counts rather than income totals.
 */
export function IncomeByPartyChart({
  jobs,
}: {
  jobs: SidejobRecord[];
  parties?: string[];
  politicians?: { politician_id: number; name: string; party: string }[];
}) {
  return <SidejobsByPartyChart jobs={jobs} />;
}

// ── Chart 2: Income by category ───────────────────────────────────────────────
// Heatmap: rows = categories sorted by total income, cols = parties.
// Log colour scale so mid-range categories stay visible.

export function IncomeByCategoryChart({
  jobs,
  parties,
}: {
  jobs: SidejobRecord[];
  parties: string[];
}) {
  // Aggregate income per category per party
  const catMap = new Map<string, Map<string, number>>();
  for (const j of jobs) {
    const party = stripSoftHyphen(j.party);
    if (!parties.includes(party)) continue;
    if (!catMap.has(j.category_label)) catMap.set(j.category_label, new Map());
    const m = catMap.get(j.category_label)!;
    m.set(party, (m.get(party) ?? 0) + j.prorated_income);
  }

  // Sort categories by total income descending
  const sortedCats = Array.from(catMap.entries())
    .map(([cat, pm]) => ({
      cat,
      total: Array.from(pm.values()).reduce((a, b) => a + b, 0),
    }))
    .sort((a, b) => b.total - a.total)
    .map((x) => x.cat);

  const sortedParties = sortParties(parties);

  const data = sortedCats.map((cat) => {
    const pm = catMap.get(cat)!;
    return sortedParties.map((party) => pm.get(party) ?? null);
  });

  const cellLabel = (v: number) => {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${Math.round(v / 1_000)}k`;
    return `${Math.round(v)}`;
  };

  return (
    <PartyHeatmap
      rows={sortedCats}
      cols={sortedParties}
      data={data}
      mode="sequential"
      cellLabel={cellLabel}
      tooltipHtml={(row, col, val) =>
        `<b>${col}</b><br/>${row}<br/>${formatEur(val)}`
      }
    />
  );
}

// ── Chart 3: Top topics ───────────────────────────────────────────────────────
// Heatmap: rows = top 15 topics by total income, cols = parties.
// Colour uses quantile ranking so right-skewed income distributions don't
// wash out mid-range cells.

export function TopTopicsChart({
  jobs,
  parties,
}: {
  jobs: SidejobRecord[];
  parties: string[];
}) {
  // Aggregate income per topic per party
  const topicMap = new Map<string, Map<string, number>>();
  for (const j of jobs) {
    const party = stripSoftHyphen(j.party);
    if (!parties.includes(party)) continue;
    for (const topic of j.topics) {
      if (!topicMap.has(topic)) topicMap.set(topic, new Map());
      const m = topicMap.get(topic)!;
      m.set(party, (m.get(party) ?? 0) + j.prorated_income);
    }
  }

  // Top 15 topics by total income across all parties
  const topTopics = Array.from(topicMap.entries())
    .map(([topic, pm]) => ({
      topic,
      total: Array.from(pm.values()).reduce((a, b) => a + b, 0),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 15)
    .map((x) => x.topic);

  const sortedParties = sortParties(parties);

  const data = topTopics.map((topic) => {
    const pm = topicMap.get(topic)!;
    // null = no income from this topic for this party (cell left blank)
    return sortedParties.map((party) => pm.get(party) ?? null);
  });

  // Abbreviated label for inside the cell (shown only when wide enough)
  const cellLabel = (v: number) => {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${Math.round(v / 1_000)}k`;
    return `${Math.round(v)}`;
  };

  return (
    <PartyHeatmap
      rows={topTopics}
      cols={sortedParties}
      data={data}
      mode="sequential"
      cellLabel={cellLabel}
      tooltipHtml={(row, col, val) =>
        `<b>${col}</b><br/>${row}<br/>${formatEur(val)}`
      }
    />
  );
}

// ── Chart 4: Top earners ──────────────────────────────────────────────────────

export function TopEarnersChart({
  jobs,
  politicians,
  parties,
}: {
  jobs: SidejobRecord[];
  politicians: { politician_id: number; name: string; party: string }[];
  parties: string[];
}) {
  const polMap = new Map(politicians.map((p) => [p.politician_id, p]));
  const byPol = new Map<number, number>();
  for (const j of jobs) {
    const party = stripSoftHyphen(polMap.get(j.politician_id)?.party ?? "");
    if (!parties.includes(party)) continue;
    byPol.set(
      j.politician_id,
      (byPol.get(j.politician_id) ?? 0) + j.prorated_income,
    );
  }

  const top = Array.from(byPol.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([id, income]) => ({ pol: polMap.get(id), income }))
    .filter(
      (
        t,
      ): t is {
        pol: NonNullable<ReturnType<typeof polMap.get>>;
        income: number;
      } => t.pol != null,
    );

  const max = top[0]?.income ?? 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {top.map(({ pol, income }, i) => (
        <HorizontalBarRow
          key={pol.politician_id}
          label={pol.name}
          labelWidth={155}
          value={income}
          max={max}
          color={getPartyColor(pol.party)}
          displayValue={formatEur(income)}
          valueWidth={52}
          rank={i + 1}
        />
      ))}
    </div>
  );
}

// ── Chart 5: Sidejob coverage per party ──────────────────────────────────────
// 100% stacked horizontal bar. Each party is one bar with three segments:
//   full party colour  = Nebenverdienst ≥ 1.000 €/Monat
//   party colour @60%  = Nebentätigkeit ohne Einkommensangabe
//   light grey         = Kein Nebenjob
// Parties sorted by "income" share descending.

const LEGEND_ITEMS = [
  { label: "Nebenverdienst ≥ 1.000 €/Monat", style: "full" },
  { label: "Ohne Einkommensangabe", style: "faded" },
  { label: "Kein Nebenjob", style: "none" },
] as const;

// Swatch colours used only in the legend (party-neutral).
const LEGEND_DEMO_COLOR = "#6B7280";

type CoverageSegment = {
  income: number;
  no_amount: number;
  none: number;
  total: number;
};

export function SidejobCoverageByPartyChart({
  jobs,
  politicians,
}: {
  jobs: SidejobRecord[];
  politicians: { politician_id: number; name: string; party: string }[];
}) {
  const withIncome = new Set<number>();
  const withAnySidejob = new Set<number>();
  for (const j of jobs) {
    withAnySidejob.add(j.politician_id);
    if (j.income_level !== null) withIncome.add(j.politician_id);
  }

  const byParty = new Map<string, CoverageSegment>();
  for (const pol of politicians) {
    const party = stripSoftHyphen(pol.party);
    if (party === "fraktionslos") continue;
    if (!byParty.has(party))
      byParty.set(party, { income: 0, no_amount: 0, none: 0, total: 0 });
    const c = byParty.get(party)!;
    c.total++;
    if (withIncome.has(pol.politician_id)) c.income++;
    else if (withAnySidejob.has(pol.politician_id)) c.no_amount++;
    else c.none++;
  }

  // Sort parties by income share descending so the main metric drives the ranking.
  const parties = Array.from(byParty.keys()).sort((a, b) => {
    const ca = byParty.get(a)!,
      cb = byParty.get(b)!;
    return (
      cb.income / Math.max(cb.total, 1) - ca.income / Math.max(ca.total, 1)
    );
  });

  return (
    <div>
      {/* Legend */}
      <div
        style={{
          display: "flex",
          gap: "6px 18px",
          marginBottom: 14,
          flexWrap: "wrap",
        }}
      >
        {LEGEND_ITEMS.map(({ label, style }) => {
          const bg =
            style === "full"
              ? LEGEND_DEMO_COLOR
              : style === "faded"
                ? LEGEND_DEMO_COLOR + "99"
                : "#D0CEC8";
          return (
            <span
              key={label}
              style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
            >
              <span
                style={{
                  width: 11,
                  height: 11,
                  borderRadius: 2,
                  background: bg,
                  flexShrink: 0,
                  display: "inline-block",
                }}
              />
              <span style={{ fontSize: 11, color: "#7872a8" }}>{label}</span>
            </span>
          );
        })}
      </div>

      {/* Bars */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {parties.map((party) => {
          const c = byParty.get(party)!;
          const total = Math.max(c.total, 1);
          const incomePct = (c.income / total) * 100;
          const noAmountPct = (c.no_amount / total) * 100;
          const nonePct = (c.none / total) * 100;
          const partyColor = getPartyColor(party);

          return (
            <div
              key={party}
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              <span
                style={{
                  width: 72,
                  fontSize: 11,
                  fontWeight: 600,
                  textAlign: "right",
                  flexShrink: 0,
                  color: "#555",
                }}
              >
                {getPartyShortLabel(party)}
              </span>
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  height: 24,
                  borderRadius: 4,
                  overflow: "hidden",
                }}
              >
                <CoverageSegment
                  pct={incomePct}
                  bg={partyColor}
                  textColor="#fff"
                  title={`Nebenverdienst: ${c.income} von ${c.total} (${Math.round(incomePct)}%)`}
                />
                <CoverageSegment
                  pct={noAmountPct}
                  bg={partyColor + "99"}
                  textColor="#fff"
                  title={`Ohne Einkommensangabe: ${c.no_amount} von ${c.total} (${Math.round(noAmountPct)}%)`}
                />
                {/* "none" takes remaining space to avoid sub-pixel rounding gaps */}
                <CoverageSegment
                  pct={nonePct}
                  bg="#D0CEC8"
                  textColor="#888"
                  title={`Kein Nebenjob: ${c.none} von ${c.total} (${Math.round(nonePct)}%)`}
                  flex1
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** One coloured segment inside a stacked bar. */
function CoverageSegment({
  pct,
  bg,
  textColor,
  title,
  flex1 = false,
}: {
  pct: number;
  bg: string;
  textColor: string;
  title: string;
  flex1?: boolean;
}) {
  if (pct <= 0 && !flex1) return null;
  return (
    <div
      style={{
        ...(flex1 ? { flex: 1 } : { width: `${pct}%` }),
        background: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
      title={title}
    >
      {pct >= 10 && (
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: textColor,
            whiteSpace: "nowrap",
          }}
        >
          {Math.round(pct)}%
        </span>
      )}
    </div>
  );
}
