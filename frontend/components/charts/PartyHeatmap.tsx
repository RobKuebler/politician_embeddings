"use client";
/**
 * PartyHeatmap — generic D3 heatmap with party-colored column headers.
 *
 * Two modes:
 *  - "deviation": diverging red–white–blue scale, symmetric around 0.
 *    Pass `divergingMax` to cap the scale; auto-computed from |data| if omitted.
 *  - "sequential": single-hue gradient (low → high).
 *    Override colours via `seqColorLow` / `seqColorHigh`.
 *
 * Row labels are plain text (D3 y-axis with truncation + tooltip).
 * Column labels must be party names — rendered as coloured blocks with white text.
 */
import { useRef, useEffect, useState } from "react";
import * as d3 from "d3";
import { useContainerWidth } from "@/hooks/useContainerWidth";
import {
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

// ── Color defaults ─────────────────────────────────────────────────────────────
const DIVERGING_LOW = "#d73027";
const DIVERGING_MID = "#f7f7f7";
const DIVERGING_HIGH = "#4575b4";
const SEQ_DEFAULT_LOW = "#fff8f6";
const SEQ_DEFAULT_HIGH = "#7f3a1a";

const MIN_COL_W = 44;
const CHAR_W = 5.8; // estimated px per character at 9.5px font

export interface PartyHeatmapProps {
  /** Row labels shown on the y-axis. */
  rows: string[];
  /** Column labels — must be party names (rendered as coloured party blocks). */
  cols: string[];
  /**
   * Cell values: data[rowIdx][colIdx].
   * null means "no data" — cell is left empty (no fill, no label).
   */
  data: (number | null)[][];

  /**
   * "deviation": diverging red–white–blue palette, centred on 0.
   * "sequential": single-hue gradient from seqColorLow to seqColorHigh.
   */
  mode: "deviation" | "sequential";

  /**
   * Deviation mode only — caps the colour scale at ± this value.
   * Auto-computed as max(|data|) if omitted.
   */
  divergingMax?: number;

  /** Sequential mode — low-end colour. Default: near-white warm cream. */
  seqColorLow?: string;
  /** Sequential mode — high-end colour. Default: dark warm brown. */
  seqColorHigh?: string;
  /**
   * Sequential mode — percentile used to cap the colour domain so a single
   * outlier cell doesn't wash out all others. Values above the cap get the
   * max colour. Default: 0.95.
   */
  seqQuantile?: number;

  /**
   * Optional text rendered inside each non-empty cell.
   * Only shown when the column is wide enough (≥ 10 px).
   */
  cellLabel?: (value: number) => string;

  /**
   * Optional tooltip HTML for non-empty cells.
   * Receives the row label, column (party) label, and cell value.
   */
  tooltipHtml?: (row: string, col: string, value: number) => string;

  /** Hint height used to derive per-row height. Default 400. */
  height?: number;
}

export function PartyHeatmap({
  rows,
  cols,
  data,
  mode,
  divergingMax,
  seqColorLow = SEQ_DEFAULT_LOW,
  seqColorHigh = SEQ_DEFAULT_HIGH,
  seqQuantile = 0.95,
  cellLabel,
  tooltipHtml,
  height = 400,
}: PartyHeatmapProps) {
  const { ref: containerRef, width } = useContainerWidth();
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [legend, setLegend] = useState<{ name: string; color: string }[]>([]);

  useEffect(() => {
    if (!width || !svgRef.current) return;

    const isMobile = width < 520;
    const ML = isMobile ? 88 : 130; // left margin (row labels)
    const MR = isMobile ? 24 : 40; // right margin
    const BLOCK_H = isMobile ? 22 : 26; // height of coloured column-header block
    const HEADER_H = BLOCK_H + 10; // 10 px gap between block bottom and first row

    // Column width: at least MIN_COL_W, or wide enough for the longest party name.
    const longestColName = cols.reduce(
      (a, b) => (a.length > b.length ? a : b),
      "",
    );
    const minColW = isMobile
      ? 36
      : Math.max(MIN_COL_W, Math.ceil(longestColName.length * CHAR_W) + 10);
    const colW = Math.max(minColW, Math.floor((width - ML - MR) / cols.length));
    const iW = colW * cols.length;

    // Row height: derived from hint height, clamped to [22, 48] px.
    const ROW_H = Math.min(
      48,
      Math.max(22, Math.floor((height - HEADER_H) / rows.length)),
    );
    const bodyHeight = ROW_H * rows.length;
    const totalH = HEADER_H + bodyHeight;

    const xScale = d3.scaleBand().domain(cols).range([0, iW]).padding(0.05);
    const yScale = d3
      .scaleBand()
      .domain(rows)
      .range([0, bodyHeight])
      .padding(0.05);

    // ── Colour scale ────────────────────────────────────────────────────────
    const allValues = data.flat().filter((v): v is number => v !== null);

    let colorFn: (v: number) => string;
    let maxAbs = 1; // used for text-contrast logic in deviation mode

    if (mode === "deviation") {
      maxAbs = divergingMax ?? Math.max(...allValues.map(Math.abs), 1);
      const scale = d3
        .scaleLinear<string>()
        .domain([-maxAbs, 0, maxAbs])
        .range([DIVERGING_LOW, DIVERGING_MID, DIVERGING_HIGH])
        .clamp(true);
      colorFn = scale;
    } else {
      const sorted = [...allValues].sort((a, b) => a - b);
      const q = seqQuantile ?? 0.95;
      const capIdx = Math.min(Math.floor(sorted.length * q), sorted.length - 1);
      const domainMax = Math.max(
        sorted[capIdx] ?? sorted[sorted.length - 1] ?? 1,
        1,
      );
      const scale = d3
        .scaleSequential(d3.interpolateRgb(seqColorLow, seqColorHigh))
        .domain([0, domainMax])
        .clamp(true);
      colorFn = scale;
    }

    // ── SVG setup ───────────────────────────────────────────────────────────
    const tooltip = d3.select(tooltipRef.current!);
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", ML + iW + MR).attr("height", totalH);

    // ── Party colour blocks (column headers) ────────────────────────────────
    const headerG = svg.append("g").attr("transform", `translate(${ML}, 0)`);
    cols.forEach((party) => {
      const bw = xScale.bandwidth();
      const x = xScale(party) ?? 0;
      const color = PARTY_COLORS[party] ?? FALLBACK_COLOR;
      const blockY = HEADER_H - BLOCK_H - 2;
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
        const maxChars = Math.floor((bw - 8) / CHAR_W);
        const display =
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
          .text(display);
        if (display !== party) {
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
        // Mobile: tap shows party name in tooltip; legend shows below.
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

    // ── Y-axis (row labels) ─────────────────────────────────────────────────
    svg
      .append("g")
      .attr("transform", `translate(${ML}, ${HEADER_H})`)
      .call(d3.axisLeft(yScale).tickSize(0))
      .call((ax) => ax.select(".domain").remove())
      .call(styleAxisText)
      .call((ax) =>
        truncateAxisLabels(ax, ML - 8, tooltip, containerRef.current!),
      );

    // ── Cells ───────────────────────────────────────────────────────────────
    const g = svg
      .append("g")
      .attr("transform", `translate(${ML}, ${HEADER_H})`);
    const bw = xScale.bandwidth();
    const bh = yScale.bandwidth();

    rows.forEach((row, rowIdx) => {
      cols.forEach((col, colIdx) => {
        const val = data[rowIdx]?.[colIdx] ?? null;
        if (val === null) return; // leave empty cell unfilled

        const fill = colorFn(val);
        const cx = xScale(col) ?? 0;
        const cy = yScale(row) ?? 0;

        g.append("rect")
          .attr("x", cx)
          .attr("y", cy)
          .attr("width", bw)
          .attr("height", bh)
          .attr("rx", 3)
          .attr("fill", fill)
          .attr("stroke", "#fff")
          .attr("stroke-width", 1)
          .on("mousemove", (event) => {
            if (!tooltipHtml) return;
            const [px, py] = d3.pointer(event, containerRef.current!);
            positionTooltip(
              tooltip,
              containerRef.current!,
              px,
              py,
              tooltipHtml(row, col, val),
            );
          })
          .on("mouseleave", () => tooltip.style("opacity", "0"));

        // Cell text label
        if (cellLabel && bw > 10) {
          const label = cellLabel(val);
          // Contrast: bright cells → dark text; dark cells → white text.
          const textColor =
            mode === "deviation"
              ? Math.abs(val) > maxAbs * 0.5
                ? "#fff"
                : "#333"
              : d3.lab(fill).l < 50
                ? "#fff"
                : "#333";

          g.append("text")
            .attr("x", cx + bw / 2)
            .attr("y", cy + bh / 2)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "central")
            .style("font-size", bw < 20 ? "7px" : "9px")
            .style("font-family", CHART_FONT_FAMILY)
            .style("pointer-events", "none")
            .style("fill", textColor)
            .text(label);
        }
      });
    });

    // Mobile legend (party colour swatches shown below the chart).
    setLegend(
      isMobile
        ? cols.map((p) => ({
            name: p,
            color: PARTY_COLORS[p] ?? FALLBACK_COLOR,
          }))
        : [],
    );
  }, [
    rows,
    cols,
    data,
    mode,
    divergingMax,
    seqColorLow,
    seqColorHigh,
    seqQuantile,
    cellLabel,
    tooltipHtml,
    height,
    width,
    containerRef,
  ]);

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
