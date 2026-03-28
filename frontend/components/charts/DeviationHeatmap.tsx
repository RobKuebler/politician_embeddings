"use client";
import { useRef, useEffect, useState } from "react";
import * as d3 from "d3";
import { useContainerWidth } from "@/hooks/useContainerWidth";
import { DeviationPivot } from "@/lib/data";
import {
  sortParties,
  PARTY_COLORS,
  FALLBACK_COLOR,
  CHART_FONT_FAMILY,
} from "@/lib/constants";
import {
  ChartTooltip,
  styleAxisText,
  truncateAxisLabels,
  positionTooltip,
} from "@/lib/chart-utils";

interface Props {
  pivot: DeviationPivot;
  height?: number;
}

// Desktop default minimum column width (may be widened to fit party name text).
const MIN_COL_W = 44;

function drawCells(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  cells: {
    partyIdx: number;
    catIdx: number;
    dev: number | null;
    pct: number | null;
    count: number;
  }[],
  xScale: d3.ScaleBand<string>,
  yScale: d3.ScaleBand<string>,
  pivot: DeviationPivot,
  colorScale: d3.ScaleLinear<string, string>,
  maxDev: number,
  tooltip: d3.Selection<HTMLDivElement, unknown, null, undefined>,
  container: Element,
) {
  type Cell = (typeof cells)[number];

  g.selectAll<SVGRectElement, Cell>("rect.cell")
    .data(cells)
    .join("rect")
    .attr("class", "cell")
    .attr("x", (d) => xScale(pivot.parties[d.partyIdx]) ?? 0)
    .attr("y", (d) => yScale(pivot.categories[d.catIdx]) ?? 0)
    .attr("width", xScale.bandwidth())
    .attr("height", yScale.bandwidth())
    .attr("fill", (d) =>
      pivot.categories[d.catIdx] === "Unbekannt"
        ? d.count > 0
          ? "#d4d4d4"
          : "none"
        : d.dev !== null
          ? colorScale(d.dev)
          : "none",
    )
    .attr("stroke", "#fff")
    .attr("stroke-width", 1)
    .on("mousemove", (event, d) => {
      if (d.dev === null) return;
      const cat = pivot.categories[d.catIdx];
      const party = pivot.parties[d.partyIdx];
      const partyTotal = pivot.party_totals[d.partyIdx];
      const html = `<b>${party}</b><br/>${cat}<br/>${d.count} von ${partyTotal} Abgeordneten (${d.pct?.toFixed(1) ?? "?"}%)<br/>Abweichung: ${d.dev > 0 ? "+" : ""}${d.dev.toFixed(1)} pp`;
      const [px, py] = d3.pointer(event, container);
      positionTooltip(tooltip, container, px, py, html);
    })
    .on("mouseleave", () => tooltip.style("opacity", "0"));

  const bw = xScale.bandwidth();
  if (bw > 10) {
    const fontSize = bw < 20 ? "7px" : "9px";
    g.selectAll<SVGTextElement, Cell>("text.cell-label")
      .data(cells.filter((c) => c.dev !== null))
      .join("text")
      .attr("class", "cell-label")
      .attr("x", (d) => (xScale(pivot.parties[d.partyIdx]) ?? 0) + bw / 2)
      .attr(
        "y",
        (d) =>
          (yScale(pivot.categories[d.catIdx]) ?? 0) + yScale.bandwidth() / 2,
      )
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .style("font-size", fontSize)
      .style("pointer-events", "none")
      .style("fill", (d) =>
        pivot.categories[d.catIdx] === "Unbekannt"
          ? "#333"
          : Math.abs(d.dev!) > maxDev * 0.5
            ? "#fff"
            : "#333",
      )
      .text((d) => `${d.dev! > 0 ? "+" : ""}${d.dev!.toFixed(0)}`);
  }
}

export function DeviationHeatmap({ pivot, height = 400 }: Props) {
  const { ref: containerRef, width } = useContainerWidth();
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [legend, setLegend] = useState<{ name: string; color: string }[]>([]);

  useEffect(() => {
    if (!width) return;

    // Responsive layout constants.
    const isMobile = width < 520;
    const ML = isMobile ? 88 : 130;
    const MR = isMobile ? 24 : 40;
    // Colored party blocks replace rotated text labels → much shorter header.
    const BLOCK_H = isMobile ? 22 : 26; // height of the colored column-header block
    const HEADER_H = BLOCK_H + 10; // 10px gap between block bottom and first row
    // Estimated px per character at 9.5px font (for desktop column sizing).
    const CHAR_W = 5.8;

    // Re-order parties by seat count (PARTY_ORDER), fraktionslos always last.
    const sortedParties = sortParties(pivot.parties);
    const colMap = sortedParties.map((p) => pivot.parties.indexOf(p));
    const sortedPivot: DeviationPivot = {
      categories: pivot.categories,
      parties: sortedParties,
      pct: pivot.pct.map((row) => colMap.map((ci) => row[ci] ?? null)),
      dev: pivot.dev.map((row) => colMap.map((ci) => row[ci] ?? null)),
      count: pivot.count.map((row) => colMap.map((ci) => row[ci] ?? 0)),
      party_totals: colMap.map((ci) => pivot.party_totals[ci] ?? 0),
    };
    const {
      categories,
      parties,
      pct: pctData,
      dev: devData,
      count: countData,
    } = sortedPivot;

    // Desktop: widen columns enough to fit the longest party name.
    const longestName = parties.reduce(
      (a, b) => (a.length > b.length ? a : b),
      "",
    );
    const minColW = isMobile
      ? 36
      : Math.max(MIN_COL_W, Math.ceil(longestName.length * CHAR_W) + 10);

    const colW = Math.max(
      minColW,
      Math.floor((width - ML - MR) / parties.length),
    );
    const iW = colW * parties.length;

    // Exclude "Unbekannt" and small parties (< 10 members) from the color scale
    // so they don't distort the range with statistically noisy deviations.
    const allDevs = devData
      .flatMap((row, catIdx) =>
        categories[catIdx] === "Unbekannt"
          ? []
          : row.filter((_, pi) => sortedPivot.party_totals[pi] >= 10),
      )
      .filter((v): v is number => v !== null);
    // Clamp to 95th percentile of absolute deviations so one outlier doesn't
    // wash out all other cells.
    const absDevs = allDevs.map(Math.abs).sort((a, b) => a - b);
    const p95idx = Math.floor(absDevs.length * 0.95);
    const clampMax = Math.max(
      absDevs[p95idx] ?? absDevs[absDevs.length - 1] ?? 1,
      1,
    );
    const colorScale = d3
      .scaleLinear<string>()
      .domain([-clampMax, 0, clampMax])
      .range(["#d73027", "#f7f7f7", "#4575b4"])
      .clamp(true);

    type Cell = {
      partyIdx: number;
      catIdx: number;
      dev: number | null;
      pct: number | null;
      count: number;
    };
    const cells: Cell[] = [];
    categories.forEach((_, catIdx) => {
      parties.forEach((_, partyIdx) => {
        cells.push({
          partyIdx,
          catIdx,
          dev: devData[catIdx]?.[partyIdx] ?? null,
          pct: pctData[catIdx]?.[partyIdx] ?? null,
          count: countData[catIdx]?.[partyIdx] ?? 0,
        });
      });
    });

    const tooltip = d3.select(tooltipRef.current!);

    if (!svgRef.current) return;

    // Row height derived from the hint height, but always at least 22px.
    // The SVG grows to show all rows — the page scrolls, no inner scroll needed.
    const maxBodyH = height - HEADER_H;
    const ROW_H = Math.min(
      48,
      Math.max(22, Math.floor(maxBodyH / categories.length)),
    );
    const bodyHeight = ROW_H * categories.length;
    const totalH = HEADER_H + bodyHeight;

    const xScale = d3.scaleBand().domain(parties).range([0, iW]).padding(0.05);
    const yScale = d3
      .scaleBand()
      .domain(categories)
      .range([0, bodyHeight])
      .padding(0.05);

    const svgW = ML + iW + MR;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", svgW).attr("height", totalH);

    // ── Party color blocks (x-axis header) ───────────────────────────────────
    // Desktop: colored rectangle with the full party name inside (truncated
    //          with "…" + tooltip if the column is too narrow).
    // Mobile: colored square only; party name appears in a tooltip on hover/tap,
    //         and a flex-wrap legend is shown below the chart.
    const headerG = svg.append("g").attr("transform", `translate(${ML}, 0)`);
    parties.forEach((party) => {
      const bw = xScale.bandwidth();
      const x = xScale(party) ?? 0;
      const color = PARTY_COLORS[party] ?? FALLBACK_COLOR;
      const blockY = HEADER_H - BLOCK_H - 2; // 2px above first data row

      const blockG = headerG.append("g");
      blockG
        .append("rect")
        .attr("x", x)
        .attr("y", blockY)
        .attr("width", bw)
        .attr("height", BLOCK_H)
        .attr("rx", 4)
        .attr("fill", color);

      if (!isMobile) {
        // Party name centered in the block; truncate if column is too narrow.
        const maxChars = Math.floor((bw - 8) / CHAR_W);
        const displayText =
          party.length > maxChars ? party.slice(0, maxChars - 1) + "…" : party;
        blockG
          .append("text")
          .attr("x", x + bw / 2)
          .attr("y", blockY + BLOCK_H / 2)
          .attr("text-anchor", "middle")
          .attr("dominant-baseline", "central")
          .style("font-size", "9.5px")
          .style("font-family", CHART_FONT_FAMILY)
          .style("font-weight", "600")
          .style("fill", "#fff")
          .style("filter", "drop-shadow(0 1px 1.5px rgba(0,0,0,0.4))")
          .style("pointer-events", "none")
          .text(displayText);
        if (displayText !== party) {
          blockG
            .select("rect")
            .style("cursor", "default")
            .on("mousemove", (event) => {
              const [px, py] = d3.pointer(event, containerRef.current!);
              positionTooltip(tooltip, containerRef.current!, px, py, party);
            })
            .on("mouseleave", () => tooltip.style("opacity", "0"));
        }
      } else {
        // Mobile: tooltip reveals party name on hover/tap.
        blockG
          .select("rect")
          .style("cursor", "pointer")
          .on("mousemove", (event) => {
            const [px, py] = d3.pointer(event, containerRef.current!);
            positionTooltip(tooltip, containerRef.current!, px, py, party);
          })
          .on("mouseleave", () => tooltip.style("opacity", "0"));
      }
    });

    // Y-axis (category names)
    svg
      .append("g")
      .attr("transform", `translate(${ML}, ${HEADER_H})`)
      .call(d3.axisLeft(yScale).tickSize(0))
      .call((ax) => ax.select(".domain").remove())
      .call(styleAxisText)
      .call((ax) =>
        truncateAxisLabels(ax, ML - 8, tooltip, containerRef.current!),
      );

    const g = svg
      .append("g")
      .attr("transform", `translate(${ML}, ${HEADER_H})`);
    drawCells(
      g,
      cells,
      xScale,
      yScale,
      sortedPivot,
      colorScale,
      clampMax,
      tooltip,
      containerRef.current!,
    );

    // Update mobile legend (shows below the chart; hidden on desktop).
    setLegend(
      isMobile
        ? parties.map((p) => ({
            name: p,
            color: PARTY_COLORS[p] ?? FALLBACK_COLOR,
          }))
        : [],
    );
  }, [pivot, height, width]);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <div style={{ overflowX: "auto" }}>
        <svg ref={svgRef} style={{ display: "block", overflow: "visible" }} />
      </div>
      {legend.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "4px 12px",
            marginTop: 10,
          }}
        >
          {legend.map(({ name, color }) => (
            <span
              key={name}
              style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: color,
                  display: "inline-block",
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 11, color: "#9A9790" }}>{name}</span>
            </span>
          ))}
        </div>
      )}
      <ChartTooltip tooltipRef={tooltipRef} maxWidth={280} zIndex={50} />
    </div>
  );
}
