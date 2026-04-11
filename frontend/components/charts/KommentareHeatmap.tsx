"use client";
/**
 * KommentareHeatmap — interactive heatmap for cross-party event data.
 *
 * Rows = acting party (who does the action).
 * Cols = speaker party (during whose speech).
 * Cell intensity = event count (sequential color scale).
 *
 * Tab-switched between event types: Zwischenruf, Lachen, Heiterkeit, Widerspruch.
 */
import { useRef, useEffect, useCallback, useState } from "react";
import * as d3 from "d3";
import {
  CHART_FONT_FAMILY,
  getPartyColor,
  getPartyShortLabel,
} from "@/lib/constants";
import { ChartTooltip, positionTooltip } from "@/lib/chart-utils";
import { ToggleGroup } from "@/components/ui/ToggleGroup";
import { useContainerWidth } from "@/hooks/useContainerWidth";
import type { KommentareData } from "@/lib/data";

interface Props {
  data: KommentareData;
}

const EVENT_TABS = [
  "Beifall",
  "Zwischenruf",
  "Lachen",
  "Heiterkeit",
  "Widerspruch",
] as const;
type EventTab = (typeof EVENT_TABS)[number];

const EVENT_LABEL: Record<EventTab, string> = {
  Beifall: "Beifall",
  Zwischenruf: "Zwischenrufe",
  Lachen: "Lachen",
  Heiterkeit: "Heiterkeit",
  Widerspruch: "Widerspruch",
};

// Sequential color scale: very light to saturated red-brown (neutral, not politically charged)
const COLOR_LOW = "#f7f0eb";
const COLOR_HIGH = "#7f3a1a";

function partyColor(party: string): string {
  return getPartyColor(party);
}

function fmt(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function fmtCompact(n: number): string {
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(n);
}

function HeatmapCanvas({
  data,
  eventType,
}: {
  data: KommentareData;
  eventType: EventTab;
}) {
  const { ref: containerRef, width } = useContainerWidth();
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const draw = useCallback(() => {
    const svg = svgRef.current;
    const tooltip = tooltipRef.current;
    if (!svg || !tooltip || width < 10) return;

    const { parties, cross } = data;
    const matrix = cross[eventType] as number[][] | undefined;
    if (!matrix) return;

    const n = parties.length;
    const cellH = 36;
    const BLOCK_H = cellH; // column header same height as row cells
    const BLOCK_W = 90; // width of colored party block (row label)
    const BLOCK_GAP = 4; // gap between block and grid
    const LABEL_H = BLOCK_H + BLOCK_GAP;
    const LABEL_W = BLOCK_W + BLOCK_GAP;
    const MR = 8;
    const MB = 8;
    const CHAR_W = 5.8; // estimated px per character at 9.5px font

    const availW = width - LABEL_W - MR;
    const cellW = Math.max(24, Math.floor(availW / n));
    const gridW = cellW * n;
    const gridH = cellH * n;
    const H = LABEL_H + gridH + MB;

    const sel = d3.select(svg);
    sel.selectAll("*").remove();
    sel.attr("width", width).attr("height", H);

    const g = sel
      .append("g")
      .attr("transform", `translate(${LABEL_W},${LABEL_H})`);
    const tip = d3.select(tooltip);
    const container = containerRef.current!;

    // Color scale
    const maxVal = d3.max(matrix.flat()) ?? 1;
    const colorScale = d3
      .scaleSequential(d3.interpolateRgb(COLOR_LOW, COLOR_HIGH))
      .domain([0, maxVal]);

    // ── Column headers (speaker party) — colored blocks with white text ────
    parties.forEach((party, j) => {
      const x = LABEL_W + j * cellW;
      const bw = cellW - 2;
      const color = partyColor(party);
      const blockG = sel.append("g");

      blockG
        .append("rect")
        .attr("x", x + 1)
        .attr("y", 0)
        .attr("width", bw)
        .attr("height", BLOCK_H)
        .attr("rx", 4)
        .attr("fill", color);

      const shortLabelCol = getPartyShortLabel(party);
      const maxChars = Math.floor((bw - 6) / CHAR_W);
      const display =
        shortLabelCol.length > maxChars
          ? shortLabelCol.slice(0, maxChars - 1) + "…"
          : shortLabelCol;
      blockG
        .append("text")
        .attr("x", x + 1 + bw / 2)
        .attr("y", BLOCK_H / 2)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "central")
        .style("font-size", "9.5px")
        .style("font-family", CHART_FONT_FAMILY)
        .style("font-weight", "600")
        .style("fill", "#fff")
        .style("filter", "drop-shadow(0 1px 1.5px rgba(0,0,0,0.4))")
        .style("pointer-events", "none")
        .text(display);

      if (display !== shortLabelCol) {
        blockG
          .select("rect")
          .style("cursor", "default")
          .on("mousemove", (event) => {
            const [px, py] = d3.pointer(event, container);
            positionTooltip(tip, container, px, py, shortLabelCol);
          })
          .on("mouseleave", () => tip.style("opacity", "0"));
      }
    });

    // ── Row labels (acting party) — colored blocks with white text ─────────
    parties.forEach((party, i) => {
      const y = LABEL_H + i * cellH;
      const bh = cellH - 2;
      const color = partyColor(party);
      const blockG = sel.append("g");

      blockG
        .append("rect")
        .attr("x", 0)
        .attr("y", y + 1)
        .attr("width", BLOCK_W)
        .attr("height", bh)
        .attr("rx", 4)
        .attr("fill", color);

      const shortLabelRow = getPartyShortLabel(party);
      const maxChars = Math.floor((BLOCK_W - 8) / CHAR_W);
      const display =
        shortLabelRow.length > maxChars
          ? shortLabelRow.slice(0, maxChars - 1) + "…"
          : shortLabelRow;
      blockG
        .append("text")
        .attr("x", BLOCK_W / 2)
        .attr("y", y + 1 + bh / 2)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "central")
        .style("font-size", "9.5px")
        .style("font-family", CHART_FONT_FAMILY)
        .style("font-weight", "600")
        .style("fill", "#fff")
        .style("filter", "drop-shadow(0 1px 1.5px rgba(0,0,0,0.4))")
        .style("pointer-events", "none")
        .text(display);

      if (display !== shortLabelRow) {
        blockG
          .select("rect")
          .style("cursor", "default")
          .on("mousemove", (event) => {
            const [px, py] = d3.pointer(event, container);
            positionTooltip(tip, container, px, py, shortLabelRow);
          })
          .on("mouseleave", () => tip.style("opacity", "0"));
      }
    });

    // ── Cells ──────────────────────────────────────────────────────────────
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const val = matrix[i][j];
        const isDiag = i === j;
        g.append("rect")
          .attr("x", j * cellW + 1)
          .attr("y", i * cellH + 1)
          .attr("width", cellW - 2)
          .attr("height", cellH - 2)
          .attr("rx", 3)
          .attr("fill", val === 0 ? "#f7f7f7" : colorScale(val))
          .attr("stroke", isDiag ? "#bbb" : "none")
          .attr("stroke-width", isDiag ? 1 : 0)
          .attr("stroke-dasharray", isDiag ? "3,2" : "none")
          .on("mousemove", (event) => {
            const [px, py] = d3.pointer(event, container);
            const rowTotal = matrix[i].reduce((s, v) => s + v, 0);
            const pct = rowTotal > 0 ? Math.round((val / rowTotal) * 100) : 0;
            positionTooltip(
              tip,
              container,
              px,
              py,
              `<strong>${getPartyShortLabel(parties[i])}</strong> → <strong>${getPartyShortLabel(parties[j])}</strong><br>${fmt(val)} (${pct}% aller ${getPartyShortLabel(parties[i])}-${EVENT_LABEL[eventType]})`,
            );
          })
          .on("mouseleave", () => tip.style("opacity", "0"));

        // Cell value label — show on all cells >= minimum size
        if (val > 0) {
          const isSmall = cellW < 34;
          const textColor =
            colorScale(val) === COLOR_LOW
              ? "#888"
              : d3.lab(colorScale(val)).l < 50
                ? "#fff"
                : "#333";
          g.append("text")
            .attr("x", j * cellW + cellW / 2)
            .attr("y", i * cellH + cellH / 2)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "central")
            .style("font-size", isSmall ? "7.5px" : "9px")
            .style("font-family", CHART_FONT_FAMILY)
            .style("fill", textColor)
            .style("pointer-events", "none")
            .text(isSmall ? fmtCompact(val) : fmt(val));
        }
      }
    }

    // ── Grid lines ─────────────────────────────────────────────────────────
    for (let k = 0; k <= n; k++) {
      g.append("line")
        .attr("x1", k * cellW)
        .attr("y1", 0)
        .attr("x2", k * cellW)
        .attr("y2", gridH)
        .attr("stroke", "#e8e8e8")
        .attr("stroke-width", 1);
      g.append("line")
        .attr("x1", 0)
        .attr("y1", k * cellH)
        .attr("x2", gridW)
        .attr("y2", k * cellH)
        .attr("stroke", "#e8e8e8")
        .attr("stroke-width", 1);
    }
  }, [containerRef, data, eventType, width]);

  useEffect(() => {
    draw();
  }, [draw]);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <svg ref={svgRef} style={{ display: "block" }} />
      <ChartTooltip tooltipRef={tooltipRef} maxWidth={280} zIndex={50} />
    </div>
  );
}

export default function KommentareHeatmap({ data }: Props) {
  const [activeTab, setActiveTab] = useState<EventTab>("Beifall");

  return (
    <div>
      {/* Tabs */}
      <div style={{ marginBottom: 16 }}>
        <ToggleGroup
          options={EVENT_TABS.map((t) => ({ value: t, label: EVENT_LABEL[t] }))}
          value={activeTab}
          onChange={setActiveTab}
        />
      </div>

      {/* Axis legend */}
      <div
        style={{
          display: "flex",
          gap: 16,
          marginBottom: 8,
          fontSize: 11,
          color: "#9A9790",
          fontFamily: CHART_FONT_FAMILY,
        }}
      >
        <span>↓ Zeile = handelnde Partei</span>
        <span>→ Spalte = Redner-Partei</span>
      </div>

      <HeatmapCanvas data={data} eventType={activeTab} />
    </div>
  );
}
