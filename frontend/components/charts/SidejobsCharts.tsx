"use client";
import { useRef, useEffect } from "react";
import * as d3 from "d3";
import { useContainerWidth } from "@/hooks/useContainerWidth";
import { SidejobRecord } from "@/lib/data";
import {
  PARTY_COLORS,
  FALLBACK_COLOR,
  sortParties,
  CHART_ROTATION_THRESHOLD,
  CHART_BOTTOM_ROTATED,
} from "@/lib/constants";
import {
  ChartTooltip,
  styleAxisText,
  truncateAxisLabels,
  TOOLTIP_DX,
  TOOLTIP_DY,
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
      const party = pol.party.replace(/\u00ad/g, "");
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

    // Draws a vertical bar chart in PARTY_ORDER (seat count order)
    const draw = (svgEl: SVGSVGElement, values: number[]) => {
      const sorted = parties.map((p, i) => ({ party: p, value: values[i] }));

      const iW0 = width - 60 - 16;
      const tempScale = d3
        .scaleBand()
        .domain(sorted.map((d) => d.party))
        .range([0, iW0])
        .padding(0.25);
      const needsRotation = tempScale.bandwidth() < CHART_ROTATION_THRESHOLD;
      const M = {
        left: 60,
        right: 16,
        top: 12,
        bottom: needsRotation ? CHART_BOTTOM_ROTATED : 52,
      };
      const H = needsRotation ? 320 : 270;
      const iW = width - M.left - M.right;
      const iH = H - M.top - M.bottom;
      const svg = d3.select(svgEl);
      svg.selectAll("*").remove();
      svg.attr("width", width).attr("height", H);
      const g = svg
        .append("g")
        .attr("transform", `translate(${M.left},${M.top})`);

      const xScale = d3
        .scaleBand()
        .domain(sorted.map((d) => d.party))
        .range([0, iW])
        .padding(0.25);
      const yMax = d3.max(sorted, (d) => d.value) ?? 1;
      const yScale = d3
        .scaleLinear()
        .domain([0, yMax * 1.05])
        .range([iH, 0]);

      g.append("g")
        .attr("transform", `translate(0,${iH})`)
        .call(d3.axisBottom(xScale).tickSize(0))
        .call((ax) => ax.select(".domain").remove())
        .call((ax) => {
          if (needsRotation) {
            styleAxisText(ax);
            ax.selectAll("text")
              .style("text-anchor", "end")
              .attr("dx", "-0.5em")
              .attr("dy", "0.15em")
              .attr("transform", "rotate(-40)");
          } else {
            styleAxisText(ax);
          }
        });

      g.append("g")
        .call(
          d3
            .axisLeft(yScale)
            .ticks(4)
            .tickFormat((v) => `${((v as number) / 1000).toFixed(0)}k`),
        )
        .call((ax) => ax.select(".domain").remove())
        .call(styleAxisText)
        .call((ax) => ax.selectAll(".tick line").attr("stroke", "#eee"));

      const tooltip = d3.select(tooltipRef.current!);
      g.selectAll<SVGRectElement, (typeof sorted)[number]>("rect")
        .data(sorted)
        .join("rect")
        .attr("x", (d) => xScale(d.party) ?? 0)
        .attr("y", (d) => yScale(d.value))
        .attr("width", xScale.bandwidth())
        .attr("height", (d) => Math.max(0, iH - yScale(d.value)))
        .attr("fill", (d) => PARTY_COLORS[d.party] ?? FALLBACK_COLOR)
        .attr("rx", 2)
        .on("mousemove", (event, d) => {
          const [px, py] = d3.pointer(event, containerRef.current!);
          tooltip
            .style("opacity", "1")
            .style("left", `${px + TOOLTIP_DX}px`)
            .style("top", `${py + TOOLTIP_DY}px`)
            .html(
              `<b>${d.party}</b><br/>${Math.round(d.value).toLocaleString("de")} €`,
            );
        })
        .on("mouseleave", () => tooltip.style("opacity", "0"));
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
    const H = Math.max(300, cats.length * 36 + 80);
    const M = { left: 240, right: 16, top: 8, bottom: 36 };
    const iW = width - M.left - M.right;
    const iH = H - M.top - M.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", H);

    const g = svg
      .append("g")
      .attr("transform", `translate(${M.left},${M.top})`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const series = (d3.stack().keys(parties) as any)(rows) as d3.Series<
      Record<string, string | number>,
      string
    >[];
    const xMax = d3.max(series, (s) => d3.max(s, (d) => d[1])) ?? 1;

    const xScale = d3
      .scaleLinear()
      .domain([0, xMax * 1.02])
      .range([0, iW]);
    const yScale = d3.scaleBand().domain(cats).range([0, iH]).padding(0.2);

    const tooltip = d3.select(tooltipRef.current!);

    g.append("g")
      .call(d3.axisLeft(yScale).tickSize(0))
      .call((ax) => ax.select(".domain").remove())
      .call(styleAxisText)
      .call((ax) =>
        truncateAxisLabels(ax, M.left - 8, tooltip, containerRef.current!),
      );

    g.append("g")
      .attr("transform", `translate(0,${iH})`)
      .call(
        d3
          .axisBottom(xScale)
          .ticks(4)
          .tickFormat((v) => `${((v as number) / 1000).toFixed(0)}k`),
      )
      .call((ax) => ax.select(".domain").remove())
      .call(styleAxisText);

    series.forEach((s) => {
      const party = s.key;
      const cls = `s-${party.replace(/\W/g, "_")}`;
      g.selectAll<
        SVGRectElement,
        d3.SeriesPoint<Record<string, string | number>>
      >(`rect.${cls}`)
        .data(s)
        .join("rect")
        .attr("class", cls)
        .attr("y", (d) => yScale(d.data.cat as string) ?? 0)
        .attr("x", (d) => xScale(d[0]))
        .attr("height", yScale.bandwidth())
        .attr("width", (d) => Math.max(0, xScale(d[1]) - xScale(d[0])))
        .attr("fill", PARTY_COLORS[party] ?? FALLBACK_COLOR)
        .on("mousemove", (event, d) => {
          const [px, py] = d3.pointer(event, containerRef.current!);
          const val = Math.round(d[1] - d[0]);
          tooltip
            .style("opacity", "1")
            .style("left", `${px + TOOLTIP_DX}px`)
            .style("top", `${py + TOOLTIP_DY}px`)
            .html(
              `<b>${party}</b><br/>${d.data.cat}<br/>${val.toLocaleString("de")} €`,
            );
        })
        .on("mouseleave", () => tooltip.style("opacity", "0"));
    });
  }, [jobs, parties, width]);

  return (
    <div>
      <div className="overflow-x-auto">
        <div ref={containerRef} style={{ position: "relative", minWidth: 500 }}>
          <svg
            ref={svgRef}
            style={{ display: "block", width: "100%", overflow: "visible" }}
          />
          <ChartTooltip tooltipRef={tooltipRef} />
        </div>
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

    const H = Math.max(300, topTopics.length * 32 + 80);
    const M = { left: 210, right: 16, top: 8, bottom: 36 };
    const iW = width - M.left - M.right;
    const iH = H - M.top - M.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", H);

    const g = svg
      .append("g")
      .attr("transform", `translate(${M.left},${M.top})`);

    const rows = topTopics.map((topic) => {
      const row: Record<string, string | number> = { topic };
      parties.forEach((party) => {
        row[party] = Math.round(topicMap.get(topic)?.get(party) ?? 0);
      });
      return row;
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const series = (d3.stack().keys(parties) as any)(rows) as d3.Series<
      Record<string, string | number>,
      string
    >[];
    const xMax = d3.max(series, (s) => d3.max(s, (d) => d[1])) ?? 1;

    const xScale = d3
      .scaleLinear()
      .domain([0, xMax * 1.02])
      .range([0, iW]);
    const yScale = d3.scaleBand().domain(topTopics).range([0, iH]).padding(0.2);

    const tooltip = d3.select(tooltipRef.current!);

    g.append("g")
      .call(d3.axisLeft(yScale).tickSize(0))
      .call((ax) => ax.select(".domain").remove())
      .call(styleAxisText)
      .call((ax) =>
        truncateAxisLabels(ax, M.left - 8, tooltip, containerRef.current!),
      );

    g.append("g")
      .attr("transform", `translate(0,${iH})`)
      .call(
        d3
          .axisBottom(xScale)
          .ticks(4)
          .tickFormat((v) => `${((v as number) / 1000).toFixed(0)}k`),
      )
      .call((ax) => ax.select(".domain").remove())
      .call(styleAxisText);

    series.forEach((s) => {
      const party = s.key;
      const cls = `s-${party.replace(/\W/g, "_")}`;
      g.selectAll<
        SVGRectElement,
        d3.SeriesPoint<Record<string, string | number>>
      >(`rect.${cls}`)
        .data(s)
        .join("rect")
        .attr("class", cls)
        .attr("y", (d) => yScale(d.data.topic as string) ?? 0)
        .attr("x", (d) => xScale(d[0]))
        .attr("height", yScale.bandwidth())
        .attr("width", (d) => Math.max(0, xScale(d[1]) - xScale(d[0])))
        .attr("fill", PARTY_COLORS[party] ?? FALLBACK_COLOR)
        .on("mousemove", (event, d) => {
          const [px, py] = d3.pointer(event, containerRef.current!);
          const val = Math.round(d[1] - d[0]);
          tooltip
            .style("opacity", "1")
            .style("left", `${px + TOOLTIP_DX}px`)
            .style("top", `${py + TOOLTIP_DY}px`)
            .html(
              `<b>${party}</b><br/>${d.data.topic}<br/>${val.toLocaleString("de")} €`,
            );
        })
        .on("mouseleave", () => tooltip.style("opacity", "0"));
    });
  }, [jobs, parties, width]);

  return (
    <div>
      <div className="overflow-x-auto">
        <div ref={containerRef} style={{ position: "relative", minWidth: 520 }}>
          <svg
            ref={svgRef}
            style={{ display: "block", width: "100%", overflow: "visible" }}
          />
          <ChartTooltip tooltipRef={tooltipRef} />
        </div>
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

    const H = Math.max(300, top.length * 28 + 60);
    const M = { left: 140, right: 24, top: 8, bottom: 40 };
    const iW = width - M.left - M.right;
    const iH = H - M.top - M.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", H);

    const g = svg
      .append("g")
      .attr("transform", `translate(${M.left},${M.top})`);

    const names = top.map((t) => t.pol.name);
    const xMax = d3.max(top, (t) => t.income) ?? 1;

    const xScale = d3
      .scaleLinear()
      .domain([0, xMax * 1.05])
      .range([0, iW]);
    const yScale = d3.scaleBand().domain(names).range([0, iH]).padding(0.25);

    const tooltip = d3.select(tooltipRef.current!);

    g.append("g")
      .call(d3.axisLeft(yScale).tickSize(0))
      .call((ax) => ax.select(".domain").remove())
      .call(styleAxisText)
      .call((ax) =>
        truncateAxisLabels(ax, M.left - 8, tooltip, containerRef.current!),
      );

    g.append("g")
      .attr("transform", `translate(0,${iH})`)
      .call(
        d3
          .axisBottom(xScale)
          .ticks(4)
          .tickFormat((v) => `${((v as number) / 1000).toFixed(0)}k`),
      )
      .call((ax) => ax.select(".domain").remove());

    g.selectAll<SVGRectElement, (typeof top)[number]>("rect")
      .data(top)
      .join("rect")
      .attr("x", 0)
      .attr("y", (d) => yScale(d.pol.name) ?? 0)
      .attr("width", (d) => xScale(d.income))
      .attr("height", yScale.bandwidth())
      .attr(
        "fill",
        (d) =>
          PARTY_COLORS[d.pol.party.replace(/\u00ad/g, "")] ?? FALLBACK_COLOR,
      )
      .attr("rx", 2)
      .on("mousemove", (event, d) => {
        const [px, py] = d3.pointer(event, containerRef.current!);
        tooltip
          .style("opacity", "1")
          .style("left", `${px + TOOLTIP_DX}px`)
          .style("top", `${py + TOOLTIP_DY}px`)
          .html(
            `<b>${d.pol.name}</b><br/>${Math.round(d.income).toLocaleString("de")} €`,
          );
      })
      .on("mouseleave", () => tooltip.style("opacity", "0"));
  }, [jobs, politicians, width]);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <svg ref={svgRef} style={{ display: "block", width: "100%" }} />
      <ChartTooltip tooltipRef={tooltipRef} />
    </div>
  );
}

// ── Chart 5: Coverage per party (stacked bar: Nebenverdienst / keine Angabe / kein Nebenjob) ──

/**
 * Categorises each politician into one of three buckets:
 *   "income"   — has at least one sidejob with income_level set (above threshold)
 *   "no_amount" — has sidejob(s) but none with income_level (no amount declared)
 *   "none"     — no sidejob entry at all
 * Then renders one horizontal stacked bar per party.
 */
export function SidejobCoverageByPartyChart({
  jobs,
  politicians,
}: {
  jobs: SidejobRecord[];
  politicians: { politician_id: number; name: string; party: string }[];
}) {
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
    const party = pol.party.replace(/\u00ad/g, "");
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

  const LEGEND = [
    { key: "income" as const, label: "Nebenverdienst ≥ 1.000 €/Monat" },
    {
      key: "no_amount" as const,
      label: "Nebentätigkeit, ohne Einkommensangabe",
    },
    { key: "none" as const, label: "Kein Nebenjob" },
  ];

  return (
    <div className="flex flex-col gap-4">
      {parties.map((party) => {
        const c = byParty.get(party);
        if (!c) return null;
        const pct = (n: number) => ((n / c.total) * 100).toFixed(1);
        const color = PARTY_COLORS[party] ?? FALLBACK_COLOR;

        // Lighten the party color for the "no_amount" segment via opacity
        return (
          <div key={party}>
            {/* Party label + seat count */}
            <div className="flex items-baseline gap-2 mb-1">
              <span
                className="text-[12px] font-bold"
                style={{ color: "#1E1B5E" }}
              >
                {party}
              </span>
              <span className="text-[11px]" style={{ color: "#9A9790" }}>
                {c.total} Abgeordnete
              </span>
            </div>

            {/* Stacked bar */}
            <div
              style={{
                display: "flex",
                height: 28,
                borderRadius: 6,
                overflow: "hidden",
                gap: 1,
              }}
            >
              {/* Segment 1: Nebenverdienst — full party color */}
              <BarSegment
                width={c.income / c.total}
                bg={color}
                label={`${c.income} (${pct("income" in c ? c.income : 0)}%)`}
                title={`Nebenverdienst ≥ 1.000 €/Monat: ${c.income}`}
              />
              {/* Segment 2: keine Angabe — party color at 40% opacity */}
              <BarSegment
                width={c.no_amount / c.total}
                bg={color}
                opacity={0.35}
                label={`${c.no_amount} (${pct(c.no_amount)}%)`}
                title={`Nebentätigkeit, ohne Einkommensangabe: ${c.no_amount}`}
              />
              {/* Segment 3: kein Nebenjob — neutral */}
              <BarSegment
                width={c.none / c.total}
                bg="#E8E7E2"
                label={`${c.none} (${pct(c.none)}%)`}
                title={`Kein Nebenjob: ${c.none}`}
              />
            </div>
          </div>
        );
      })}

      {/* Legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-1 mt-1">
        {LEGEND.map(({ key, label }) => (
          <span
            key={key}
            className="flex items-center gap-1.5 text-[11px]"
            style={{ color: "#6B6760" }}
          >
            <span
              style={{
                display: "inline-block",
                width: 10,
                height: 10,
                borderRadius: 2,
                background:
                  key === "income"
                    ? "#E67E22"
                    : key === "no_amount"
                      ? "rgba(230,126,34,0.35)"
                      : "#E8E7E2",
                border: key === "none" ? "1px solid #ccc" : undefined,
                flexShrink: 0,
              }}
            />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Single segment in the stacked bar — shows label when wide enough. */
function BarSegment({
  width,
  bg,
  opacity = 1,
  label,
  title,
}: {
  width: number;
  bg: string;
  opacity?: number;
  label: string;
  title: string;
}) {
  if (width <= 0) return null;
  const pct = width * 100;
  return (
    <div
      title={title}
      style={{
        width: `${pct}%`,
        background: bg,
        opacity,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        cursor: "default",
        transition: "opacity 0.15s",
      }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLDivElement).style.opacity = String(
          opacity * 0.8,
        ))
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLDivElement).style.opacity = String(opacity))
      }
    >
      {/* Only show label text if segment is wide enough */}
      {pct > 12 && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: opacity < 0.5 ? "#555" : bg === "#E8E7E2" ? "#888" : "#fff",
            whiteSpace: "nowrap",
            pointerEvents: "none",
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}
