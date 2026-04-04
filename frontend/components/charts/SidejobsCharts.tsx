"use client";
import { PARTY_COLORS, FALLBACK_COLOR, sortParties } from "@/lib/constants";
import { SidejobRecord, stripSoftHyphen } from "@/lib/data";
import { HorizontalBarRow } from "@/components/charts/HorizontalBarRow";

function formatEur(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M €`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K €`;
  return `${Math.round(n)} €`;
}

/** Small colored dot used as party legend marker in group headers. */
function PartyDot({ color }: { color: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: color,
        flexShrink: 0,
      }}
    />
  );
}

// ── Chart 1: Sidejobs per party ───────────────────────────────────────────────

export function SidejobsByPartyChart({ jobs }: { jobs: SidejobRecord[] }) {
  const counts: Record<string, number> = {};
  for (const j of jobs) {
    const party = stripSoftHyphen(j.party);
    if (party === "fraktionslos") continue;
    counts[party] = (counts[party] ?? 0) + 1;
  }
  const parties = sortParties(Object.keys(counts));
  const max = Math.max(...parties.map((p) => counts[p]), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {parties.map((party) => (
        <HorizontalBarRow
          key={party}
          label={party}
          labelWidth={80}
          value={counts[party]}
          max={max}
          color={PARTY_COLORS[party] ?? FALLBACK_COLOR}
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
// Category as section header, one bar per party below.
// Bottom "Gesamt" section sums all categories per party.

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

  // Totals per party across all categories (for Gesamt section)
  const totalByParty: Record<string, number> = {};
  for (const [, pm] of catMap)
    for (const [party, income] of pm)
      totalByParty[party] = (totalByParty[party] ?? 0) + income;

  const sortedParties = sortParties(parties);
  const gesamtMax = Math.max(
    ...sortedParties.map((p) => totalByParty[p] ?? 0),
    1,
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {sortedCats.map((cat) => {
        const pm = catMap.get(cat)!;
        const catMax = Math.max(...sortedParties.map((p) => pm.get(p) ?? 0), 1);
        return (
          <div key={cat} style={{ marginBottom: 16 }}>
            <p
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#555",
                marginBottom: 8,
              }}
            >
              {cat}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {sortedParties.map((party) => {
                const income = pm.get(party) ?? 0;
                return (
                  <div
                    key={party}
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <PartyDot color={PARTY_COLORS[party] ?? FALLBACK_COLOR} />
                    <HorizontalBarRow
                      label={party}
                      labelWidth={72}
                      value={income}
                      max={catMax}
                      color={PARTY_COLORS[party] ?? FALLBACK_COLOR}
                      displayValue={formatEur(income)}
                      barHeight={7}
                      valueWidth={52}
                      style={{ flex: 1, minWidth: 0 }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Gesamt section */}
      <div
        style={{ borderTop: "1px solid #F0EEE9", paddingTop: 14, marginTop: 2 }}
      >
        <p
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "#9A9790",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            marginBottom: 10,
          }}
        >
          Gesamt alle Kategorien
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {sortedParties.map((party) => {
            const total = totalByParty[party] ?? 0;
            return (
              <div
                key={party}
                style={{ display: "flex", alignItems: "center", gap: 8 }}
              >
                <PartyDot color={PARTY_COLORS[party] ?? FALLBACK_COLOR} />
                <HorizontalBarRow
                  label={party}
                  labelWidth={72}
                  value={total}
                  max={gesamtMax}
                  color={PARTY_COLORS[party] ?? FALLBACK_COLOR}
                  displayValue={formatEur(total)}
                  barHeight={7}
                  valueWidth={52}
                  style={{ flex: 1, minWidth: 0 }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Chart 3: Top topics ───────────────────────────────────────────────────────
// Topic as section header, one bar per party below.

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

  // Top 10 topics by total income
  const topTopics = Array.from(topicMap.entries())
    .map(([topic, pm]) => ({
      topic,
      total: Array.from(pm.values()).reduce((a, b) => a + b, 0),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)
    .map((x) => x.topic);

  const sortedParties = sortParties(parties);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {topTopics.map((topic) => {
        const pm = topicMap.get(topic)!;
        const topicMax = Math.max(
          ...sortedParties.map((p) => pm.get(p) ?? 0),
          1,
        );
        return (
          <div key={topic} style={{ marginBottom: 16 }}>
            <p
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#555",
                marginBottom: 8,
                lineHeight: 1.4,
              }}
            >
              {topic}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {sortedParties.map((party) => {
                const income = pm.get(party) ?? 0;
                return (
                  <div
                    key={party}
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <PartyDot color={PARTY_COLORS[party] ?? FALLBACK_COLOR} />
                    <HorizontalBarRow
                      label={party}
                      labelWidth={72}
                      value={income}
                      max={topicMax}
                      color={PARTY_COLORS[party] ?? FALLBACK_COLOR}
                      displayValue={formatEur(income)}
                      barHeight={7}
                      valueWidth={52}
                      style={{ flex: 1, minWidth: 0 }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
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
          color={PARTY_COLORS[stripSoftHyphen(pol.party)] ?? FALLBACK_COLOR}
          displayValue={formatEur(income)}
          valueWidth={52}
          rank={i + 1}
        />
      ))}
    </div>
  );
}

// ── Chart 5: Sidejob coverage per party ──────────────────────────────────────
// Party as group header, 3 sub-bars: income / no_amount / none.

const COVERAGE_LABELS = {
  income: "Nebenverdienst ≥ 1.000 €/Monat",
  no_amount: "Nebentätigkeit ohne Einkommensangabe",
  none: "Kein Nebenjob",
} as const;

type CoverageKey = keyof typeof COVERAGE_LABELS;

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

  type Counts = Record<CoverageKey, number> & { total: number };
  const byParty = new Map<string, Counts>();
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

  const parties = sortParties(Array.from(byParty.keys()));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {parties.map((party) => {
        const counts = byParty.get(party)!;
        const color = PARTY_COLORS[party] ?? FALLBACK_COLOR;
        const keys: CoverageKey[] = ["income", "no_amount", "none"];
        return (
          <div key={party}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 6,
              }}
            >
              <PartyDot color={color} />
              <span style={{ fontSize: 12, fontWeight: 700, color: "#171613" }}>
                {party}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 5,
                marginLeft: 14,
              }}
            >
              {keys.map((key) => {
                const pct =
                  counts.total > 0
                    ? Math.round((counts[key] / counts.total) * 100)
                    : 0;
                const barColor =
                  key === "none"
                    ? "#D0CEC8"
                    : key === "no_amount"
                      ? (PARTY_COLORS[party] ?? FALLBACK_COLOR) + "99"
                      : color;
                return (
                  <HorizontalBarRow
                    key={key}
                    label={COVERAGE_LABELS[key]}
                    labelWidth={90}
                    value={pct}
                    max={100}
                    color={barColor}
                    displayValue={`${pct}%`}
                    barHeight={7}
                    valueWidth={36}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
