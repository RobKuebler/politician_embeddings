"use client";
import { useRef, useEffect } from "react";
import * as d3 from "d3";
import { useContainerWidth } from "@/hooks/useContainerWidth";
import { SidejobRecord, stripSoftHyphen } from "@/lib/data";
import {
  PARTY_COLORS,
  FALLBACK_COLOR,
  sortParties,
  COLOR_SECONDARY,
} from "@/lib/constants";
import {
  ChartTooltip,
  drawSimpleHorizontalBarChart,
  drawStackedHorizontalBarChart,
  drawSimpleVerticalBarChart,
  drawPartyColoredStackedBarChart,
} from "@/lib/chart-utils";

// ── Chart 1: Income by party (sum + mean) ─────────────────────────────────────

export function IncomeByPartyChart({
  jobs,
  parties,
  politicians,
}: {
  jobs: SidejobRecord[];
  parties: string[];
  politicians: { politician_id: number; name: string; party: string }[];
}) {
  const { ref: containerRef, width } = useContainerWidth();
  const svgSumRef = useRef<SVGSVGElement>(null);
  const svgMeanRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!width) return;
    // Total income per party, divided by all politicians in that party (incl. those with no sidejobs).
    const partySize = new Map<string, number>();
    for (const pol of politicians) {
      const party = stripSoftHyphen(pol.party);
      partySize.set(party, (partySize.get(party) ?? 0) + 1);
    }
    const totals = parties.map((p) =>
      jobs
        .filter((j) => j.party === p)
        .reduce((s, j) => s + j.prorated_income, 0),
    );
    const means = parties.map((p, i) => {
      const n = partySize.get(p) ?? 0;
      return n > 0 ? totals[i] / n : 0;
    });

    // Draws a bar chart in PARTY_ORDER (seat count order).
    // Vertical on desktop, horizontal on mobile — handled by drawSimpleVerticalBarChart.
    const draw = (svgEl: SVGSVGElement, values: number[]) => {
      drawSimpleVerticalBarChart({
        svgEl,
        width,
        labels: parties,
        values,
        colors: parties.map((p) => PARTY_COLORS[p] ?? FALLBACK_COLOR),
        tooltipHtml: (label, value) =>
          `<b>${label}</b><br/>${Math.round(value).toLocaleString("de")} €`,
        tooltip: d3.select(tooltipRef.current!),
        container: containerRef.current!,
        hBar: { rowSlotHeight: 30, minHeight: 180 },
      });
    };

    if (svgSumRef.current) draw(svgSumRef.current, totals);
    if (svgMeanRef.current) draw(svgMeanRef.current, means);
  }, [jobs, parties, politicians, width]);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Summe</p>
          <svg
            ref={svgSumRef}
            style={{ display: "block", width: "100%", overflow: "visible" }}
          />
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">
            Ø pro Abgeordnetem
          </p>
          <svg
            ref={svgMeanRef}
            style={{ display: "block", width: "100%", overflow: "visible" }}
          />
        </div>
      </div>
      <ChartTooltip tooltipRef={tooltipRef} />
    </div>
  );
}

// ── Chart 2: Income by category (stacked horizontal bars) ────────────────────

export function IncomeByCategoryChart({
  jobs,
  parties,
}: {
  jobs: SidejobRecord[];
  parties: string[];
}) {
  const { ref: containerRef, width } = useContainerWidth();
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!width || !svgRef.current) return;
    const allCats = Array.from(new Set(jobs.map((j) => j.category_label)));
    // Build rows first so we can sort by total income descending
    const rows = allCats
      .map((cat) => {
        const row: Record<string, string | number> = { cat };
        parties.forEach((party) => {
          row[party] = Math.round(
            jobs
              .filter((j) => j.party === party && j.category_label === cat)
              .reduce((s, j) => s + j.prorated_income, 0),
          );
        });
        return row;
      })
      .sort((a, b) => {
        const totA = parties.reduce((s, p) => s + (a[p] as number), 0);
        const totB = parties.reduce((s, p) => s + (b[p] as number), 0);
        return totB - totA;
      });
    const cats = rows.map((r) => r.cat as string);

    drawStackedHorizontalBarChart({
      svgEl: svgRef.current,
      width,
      categories: cats,
      categoryKey: "cat",
      seriesKeys: parties,
      colorFn: (key) => PARTY_COLORS[key] ?? FALLBACK_COLOR,
      dataRows: rows,
      tooltipHtml: (cat, party, value) =>
        `<b>${party}</b><br/>${cat}<br/>${value.toLocaleString("de")} €`,
      tooltip: d3.select(tooltipRef.current!),
      container: containerRef.current!,
      rowSlotHeight: 36,
      minHeight: 300,
    });
  }, [jobs, parties, width]);

  return (
    <div>
      <div ref={containerRef} style={{ position: "relative" }}>
        <svg
          ref={svgRef}
          style={{ display: "block", width: "100%", overflow: "visible" }}
        />
        <ChartTooltip tooltipRef={tooltipRef} />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 px-1">
        {parties.map((party) => (
          <span
            key={party}
            className="flex items-center gap-1 text-[10px] text-muted"
          >
            <span
              style={{
                display: "inline-block",
                width: 10,
                height: 10,
                borderRadius: 2,
                background: PARTY_COLORS[party] ?? FALLBACK_COLOR,
                flexShrink: 0,
              }}
            />
            {party}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Chart 3: Top topics (stacked horizontal bars) ─────────────────────────────

export function TopTopicsChart({
  jobs,
  parties,
}: {
  jobs: SidejobRecord[];
  parties: string[];
}) {
  const { ref: containerRef, width } = useContainerWidth();
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!width || !svgRef.current) return;

    // Aggregate income per topic per party, take top 15 by total
    const topicMap = new Map<string, Map<string, number>>();
    for (const j of jobs) {
      for (const topic of j.topics) {
        if (!topicMap.has(topic)) topicMap.set(topic, new Map());
        const m = topicMap.get(topic)!;
        m.set(j.party, (m.get(j.party) ?? 0) + j.prorated_income);
      }
    }
    const topTopics = Array.from(topicMap.entries())
      .map(([topic, pm]) => ({
        topic,
        total: Array.from(pm.values()).reduce((a, b) => a + b, 0),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 15)
      .map((t) => t.topic);

    const rows = topTopics.map((topic) => {
      const row: Record<string, string | number> = { topic };
      parties.forEach((party) => {
        row[party] = Math.round(topicMap.get(topic)?.get(party) ?? 0);
      });
      return row;
    });

    drawStackedHorizontalBarChart({
      svgEl: svgRef.current,
      width,
      categories: topTopics,
      categoryKey: "topic",
      seriesKeys: parties,
      colorFn: (key) => PARTY_COLORS[key] ?? FALLBACK_COLOR,
      dataRows: rows,
      tooltipHtml: (topic, party, value) =>
        `<b>${party}</b><br/>${topic}<br/>${value.toLocaleString("de")} €`,
      tooltip: d3.select(tooltipRef.current!),
      container: containerRef.current!,
      rowSlotHeight: 32,
      minHeight: 300,
    });
  }, [jobs, parties, width]);

  return (
    <div>
      <div ref={containerRef} style={{ position: "relative" }}>
        <svg
          ref={svgRef}
          style={{ display: "block", width: "100%", overflow: "visible" }}
        />
        <ChartTooltip tooltipRef={tooltipRef} />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 px-1">
        {parties.map((party) => (
          <span
            key={party}
            className="flex items-center gap-1 text-[10px] text-muted"
          >
            <span
              style={{
                display: "inline-block",
                width: 10,
                height: 10,
                borderRadius: 2,
                background: PARTY_COLORS[party] ?? FALLBACK_COLOR,
                flexShrink: 0,
              }}
            />
            {party}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Chart 4: Top earners (horizontal bars) ────────────────────────────────────

export function TopEarnersChart({
  jobs,
  politicians,
  parties,
}: {
  jobs: SidejobRecord[];
  politicians: { politician_id: number; name: string; party: string }[];
  parties: string[];
}) {
  void parties; // available for future filtering
  const { ref: containerRef, width } = useContainerWidth();
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!width || !svgRef.current) return;
    const polMap = new Map(politicians.map((p) => [p.politician_id, p]));
    const byPol = new Map<number, number>();
    for (const j of jobs)
      byPol.set(
        j.politician_id,
        (byPol.get(j.politician_id) ?? 0) + j.prorated_income,
      );

    const top = Array.from(byPol.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([id, income]) => ({ pol: polMap.get(id), income }))
      .filter((t) => t.pol != null) as {
      pol: NonNullable<ReturnType<typeof polMap.get>>;
      income: number;
    }[];

    drawSimpleHorizontalBarChart({
      svgEl: svgRef.current,
      width,
      labels: top.map((t) => t.pol.name),
      values: top.map((t) => t.income),
      colors: top.map(
        (t) => PARTY_COLORS[stripSoftHyphen(t.pol.party)] ?? FALLBACK_COLOR,
      ),
      tooltipHtml: (label, value) =>
        `<b>${label}</b><br/>${Math.round(value).toLocaleString("de")} €`,
      tooltip: d3.select(tooltipRef.current!),
      container: containerRef.current!,
      rowSlotHeight: 28,
      minHeight: 300,
    });
  }, [jobs, politicians, width]);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <svg ref={svgRef} style={{ display: "block", width: "100%" }} />
      <ChartTooltip tooltipRef={tooltipRef} />
    </div>
  );
}

// ── Chart 5: Coverage per party (stacked bar: Nebenverdienst / keine Angabe / kein Nebenjob) ──

// Series definitions: color comes from the party, opacity encodes the category.
// "none" overrides to neutral gray since it represents absence of a sidejob.
const COVERAGE_SERIES = [
  {
    key: "income",
    opacity: 1,
    fallbackColor: undefined,
    label: "Nebenverdienst ≥ 1.000 €/Monat",
  },
  {
    key: "no_amount",
    opacity: 0.4,
    fallbackColor: undefined,
    label: "Nebentätigkeit, ohne Einkommensangabe",
  },
  { key: "none", opacity: 1, fallbackColor: "#E8E7E2", label: "Kein Nebenjob" },
] as const;

/**
 * Categorises each politician into one of three buckets:
 *   "income"    — has at least one sidejob with income_level set (above threshold)
 *   "no_amount" — has sidejob(s) but none with income_level (no amount declared)
 *   "none"      — no sidejob entry at all
 * Rendered as a 100%-stacked bar chart (same style as GenderChart).
 */
export function SidejobCoverageByPartyChart({
  jobs,
  politicians,
}: {
  jobs: SidejobRecord[];
  politicians: { politician_id: number; name: string; party: string }[];
}) {
  const { ref: containerRef, width } = useContainerWidth();
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Build lookup: which politicians have qualifying income / any sidejob
  const withIncome = new Set<number>();
  const withAnySidejob = new Set<number>();
  for (const j of jobs) {
    withAnySidejob.add(j.politician_id);
    if (j.income_level !== null) withIncome.add(j.politician_id);
  }

  // Aggregate counts per party
  type Counts = {
    income: number;
    no_amount: number;
    none: number;
    total: number;
  };
  const byParty = new Map<string, Counts>();
  for (const pol of politicians) {
    const party = stripSoftHyphen(pol.party);
    if (!byParty.has(party))
      byParty.set(party, { income: 0, no_amount: 0, none: 0, total: 0 });
    const c = byParty.get(party)!;
    c.total++;
    if (withIncome.has(pol.politician_id)) c.income++;
    else if (withAnySidejob.has(pol.politician_id)) c.no_amount++;
    else c.none++;
  }

  const parties = sortParties(
    Array.from(byParty.keys()).filter((p) => p !== "fraktionslos"),
  );

  useEffect(() => {
    if (!width || !svgRef.current) return;
    drawPartyColoredStackedBarChart({
      svgEl: svgRef.current,
      width,
      labels: parties,
      series: COVERAGE_SERIES.map((s) => ({
        key: s.key,
        opacity: s.opacity,
        fallbackColor: s.fallbackColor,
      })),
      partyColor: (party) => PARTY_COLORS[party] ?? FALLBACK_COLOR,
      getValue: (party, key) =>
        byParty.get(party)?.[key as "income" | "no_amount" | "none"] ?? 0,
      tooltipHtml: (party, key, pct, count, total) => {
        const label = COVERAGE_SERIES.find((s) => s.key === key)?.label ?? key;
        return `<b>${party}</b><br/>${label}<br/>${count} von ${total} (${pct}%)`;
      },
      tooltip: d3.select(tooltipRef.current!),
      container: containerRef.current!,
    });
  }, [jobs, politicians, width]);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <svg
        ref={svgRef}
        style={{ display: "block", width: "100%", overflow: "visible" }}
      />
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 px-1">
        {COVERAGE_SERIES.map(({ key, label, opacity, fallbackColor }) => (
          <span
            key={key}
            className="flex items-center gap-1 text-[11px]"
            style={{ color: COLOR_SECONDARY }}
          >
            <span
              style={{
                display: "inline-block",
                width: 10,
                height: 10,
                borderRadius: 2,
                flexShrink: 0,
                background: fallbackColor ?? "#888",
                opacity,
              }}
            />
            {label}
          </span>
        ))}
      </div>
      <ChartTooltip tooltipRef={tooltipRef} />
    </div>
  );
}
