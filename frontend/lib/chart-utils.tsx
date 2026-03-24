"use client";
/**
 * Shared D3 chart utilities used across all chart components.
 *
 * Centralises:
 *  - ChartTooltip — the absolute-positioned hover tooltip div
 *  - styleAxisText — applies consistent font/size/color to D3 axis text
 *  - truncateAxisLabels — truncates long labels and shows full text on hover
 *  - TOOLTIP_DX / TOOLTIP_DY — standard tooltip offset constants
 */

import React from "react";
import * as d3 from "d3";
import {
  COLOR_SECONDARY,
  CHART_FONT_FAMILY,
  CHART_AXIS_FONT_SIZE,
} from "@/lib/constants";

// ── Tooltip offset constants ───────────────────────────────────────────────────
// All charts position tooltips at pointer + these offsets.
export const TOOLTIP_DX = 12;
export const TOOLTIP_DY = -28;

// ── ChartTooltip ──────────────────────────────────────────────────────────────
// Renders the shared tooltip div. Pass the same ref to d3.select() in useEffect.
// Use maxWidth for tooltips with multi-line content (heatmaps).
// Use zIndex=50 when the chart is inside a scroll container.
export function ChartTooltip({
  tooltipRef,
  maxWidth,
  zIndex = 10,
}: {
  tooltipRef: React.RefObject<HTMLDivElement | null>;
  maxWidth?: number;
  zIndex?: number;
}) {
  return (
    <div
      ref={tooltipRef}
      style={{
        position: "absolute",
        pointerEvents: "none",
        background: "rgba(0,0,0,0.78)",
        color: "#fff",
        padding: "4px 8px",
        borderRadius: 4,
        fontSize: 12,
        opacity: 0,
        transition: "opacity 0.1s",
        whiteSpace: maxWidth ? undefined : "nowrap",
        maxWidth,
        zIndex,
      }}
    />
  );
}

// ── styleAxisText ─────────────────────────────────────────────────────────────
// Applies the project-wide axis text style (font, size, colour) to all <text>
// children of a D3 axis selection. Designed for use with .call():
//
//   g.append("g").call(d3.axisLeft(scale)).call(styleAxisText)
//
// When you need additional attr/style calls after (e.g. rotation), call it
// directly inside a lambda:
//
//   .call((ax) => { styleAxisText(ax); ax.selectAll("text").attr("transform", "rotate(-30)"); })
export function styleAxisText(
  ax: d3.Selection<SVGGElement, unknown, null, undefined>,
): void {
  ax.selectAll<SVGTextElement, unknown>("text")
    .style("font-size", CHART_AXIS_FONT_SIZE)
    .style("font-family", CHART_FONT_FAMILY)
    .style("fill", COLOR_SECONDARY);
}

// ── truncateAxisLabels ────────────────────────────────────────────────────────
// Truncates axis tick labels that exceed maxPx pixels, appending "…".
// Truncated labels show the full text in the shared tooltip on hover.
export function truncateAxisLabels(
  ax: d3.Selection<SVGGElement, unknown, null, undefined>,
  maxPx: number,
  tooltip: d3.Selection<HTMLDivElement, unknown, null, undefined>,
  container: Element,
): void {
  ax.selectAll<SVGTextElement, unknown>("text").each(function () {
    const el = d3.select(this);
    const full = el.text();
    let truncated = full;
    while (
      (this as SVGTextElement).getComputedTextLength() > maxPx &&
      truncated.length > 1
    ) {
      truncated = truncated.slice(0, -1);
      el.text(truncated + "…");
    }
    if (truncated !== full) {
      el.style("cursor", "default")
        .on("mousemove", (event: MouseEvent) => {
          const [px, py] = d3.pointer(event, container);
          tooltip
            .style("opacity", "1")
            .style("left", `${px + TOOLTIP_DX}px`)
            .style("top", `${py + TOOLTIP_DY}px`)
            .html(full);
        })
        .on("mouseleave", () => tooltip.style("opacity", "0"));
    }
  });
}
