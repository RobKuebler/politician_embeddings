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
  CHART_ROTATION_THRESHOLD,
  CHART_BOTTOM_ROTATED,
} from "@/lib/constants";

// ── Tooltip offset constants ───────────────────────────────────────────────────
// All charts position tooltips at pointer + these offsets.
export const TOOLTIP_DX = 12;
export const TOOLTIP_DY = -28;

// ── positionTooltip ────────────────────────────────────────────────────────────
// Sets tooltip content and positions it near (px, py) relative to container.
// Clamps horizontally so the tooltip never overflows the container's right edge,
// preventing browser scrollbars. Clamps vertically so it never goes above 0.
export function positionTooltip(
  tooltip: d3.Selection<HTMLDivElement, unknown, null, undefined>,
  container: Element,
  px: number,
  py: number,
  html: string,
): void {
  tooltip.style("opacity", "1").html(html);
  const tipEl = tooltip.node()!;
  const containerW = (container as HTMLElement).offsetWidth;
  const left = Math.min(px + TOOLTIP_DX, containerW - tipEl.offsetWidth - 4);
  const top = Math.max(py + TOOLTIP_DY, 4);
  tooltip.style("left", `${left}px`).style("top", `${top}px`);
}

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

// ── Mobile horizontal bar chart constants ────────────────────────────────────
// Width threshold below which horizontal bar charts switch to label-above layout.
export const MOBILE_BAR_W = 480;
// Pixels reserved per bar row for the category label rendered above the bar.
export const MOBILE_BAR_LABEL_H = 14;

// ── renderMobileBarLabels ─────────────────────────────────────────────────────
// Renders category labels above each bar row for the mobile layout of horizontal
// bar charts. Call this instead of axisLeft when M.left = 0 on mobile.
// Labels that exceed the available width are truncated with a "…" tooltip.
export function renderMobileBarLabels(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  labels: string[],
  yScale: d3.ScaleBand<string>,
  containerWidth: number,
  rightMargin: number,
  tooltip: d3.Selection<HTMLDivElement, unknown, null, undefined>,
  container: Element,
): void {
  const maxChars = Math.floor((containerWidth - rightMargin) / 6.5);
  labels.forEach((label) => {
    const displayText =
      label.length > maxChars ? label.slice(0, maxChars - 1) + "…" : label;
    const textEl = g
      .append("text")
      .attr("x", 0)
      .attr("y", (yScale(label) ?? 0) + 2)
      .attr("dominant-baseline", "hanging")
      .style("font-size", CHART_AXIS_FONT_SIZE)
      .style("font-family", CHART_FONT_FAMILY)
      .style("fill", COLOR_SECONDARY)
      .text(displayText);
    if (displayText !== label) {
      textEl
        .style("cursor", "default")
        .on("mousemove", (event: MouseEvent) => {
          const [px, py] = d3.pointer(event, container);
          positionTooltip(tooltip, container, px, py, label);
        })
        .on("mouseleave", () => tooltip.style("opacity", "0"));
    }
  });
}

// ── appendHBarXAxis ───────────────────────────────────────────────────────────
// Standardised x-axis for every horizontal bar chart: subtle tick lines,
// domain removed, project axis text style. One place to change for all charts.
export function appendHBarXAxis(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  xScale: d3.ScaleLinear<number, number>,
  iH: number,
  tickFormat: (v: d3.NumberValue) => string,
  ticks = 4,
): void {
  g.append("g")
    .attr("transform", `translate(0,${iH})`)
    // tickSize(-iH) extends tick lines upward into the chart area as gridlines.
    .call(
      d3.axisBottom(xScale).ticks(ticks).tickSize(-iH).tickFormat(tickFormat),
    )
    .call((ax) => ax.select(".domain").remove())
    .call(styleAxisText)
    .call((ax) =>
      ax.selectAll(".tick line").attr("stroke", "#eee").attr("stroke-width", 1),
    )
    // The 0-tick sits at x=0, so "middle" alignment clips it against the left edge.
    // Left-align only that tick so it's fully visible without adding margin.
    .call((ax) =>
      ax
        .selectAll<SVGGElement, number>(".tick")
        .filter((d) => d === 0)
        .select("text")
        .style("text-anchor", "start"),
    );
}

// ── Shared margin/layout helper (internal) ────────────────────────────────────
interface _HBarM {
  left: number;
  right: number;
  top: number;
  bottom: number;
}
function _hBarLayout(
  width: number,
  labelCount: number,
  rowSlotHeight: number,
  desktopLeftMargin: number | undefined,
  labels: string[],
  minHeight: number,
  mobileExtra: number,
): { isMobile: boolean; M: _HBarM; H: number; iW: number; iH: number } {
  const isMobile = width < MOBILE_BAR_W;
  const autoLeft =
    labels.reduce((max, l) => Math.max(max, l.length * 7), 0) + 8;
  const M: _HBarM = isMobile
    ? { left: 0, right: 8, top: 6, bottom: 36 }
    : { left: desktopLeftMargin ?? autoLeft, right: 16, top: 8, bottom: 36 };
  const H = Math.max(
    minHeight,
    labelCount * (rowSlotHeight + (isMobile ? mobileExtra : 0)) +
      M.top +
      M.bottom,
  );
  return {
    isMobile,
    M,
    H,
    iW: width - M.left - M.right,
    iH: H - M.top - M.bottom,
  };
}

// ── drawSimpleHorizontalBarChart ──────────────────────────────────────────────
// Renders a single-value horizontal bar chart with full desktop/mobile support.
// Desktop: labels on left (axisLeft + truncation).
// Mobile:  labels above bars (renderMobileBarLabels).
// Use this instead of writing D3 from scratch for every new horizontal bar chart.
export interface HBarConfig {
  svgEl: SVGSVGElement;
  width: number;
  labels: string[];
  values: number[];
  colors: string[];
  tooltipHtml: (label: string, value: number) => string;
  tooltip: d3.Selection<HTMLDivElement, unknown, null, undefined>;
  container: Element;
  rowSlotHeight?: number;
  desktopLeftMargin?: number;
  xTickFormat?: (v: d3.NumberValue) => string;
  barRx?: number;
  minHeight?: number;
  yPadding?: number;
}

export function drawSimpleHorizontalBarChart({
  svgEl,
  width,
  labels,
  values,
  colors,
  tooltipHtml,
  tooltip,
  container,
  rowSlotHeight = 32,
  desktopLeftMargin,
  xTickFormat,
  barRx = 2,
  minHeight = 200,
  yPadding = 0.25,
}: HBarConfig): void {
  const { isMobile, M, H, iW, iH } = _hBarLayout(
    width,
    labels.length,
    rowSlotHeight,
    desktopLeftMargin,
    labels,
    minHeight,
    MOBILE_BAR_LABEL_H,
  );
  const svg = d3.select(svgEl);
  svg.selectAll("*").remove();
  svg.attr("width", width).attr("height", H);
  const g = svg.append("g").attr("transform", `translate(${M.left},${M.top})`);

  const xMax = d3.max(values) ?? 1;
  const xScale = d3
    .scaleLinear()
    .domain([0, xMax * 1.05])
    .range([0, iW]);
  const yScale = d3.scaleBand().domain(labels).range([0, iH]).padding(yPadding);

  if (!isMobile) {
    g.append("g")
      .call(d3.axisLeft(yScale).tickSize(0))
      .call((ax) => ax.select(".domain").remove())
      .call(styleAxisText)
      .call((ax) => truncateAxisLabels(ax, M.left - 8, tooltip, container));
  } else {
    renderMobileBarLabels(
      g,
      labels,
      yScale,
      width,
      M.right,
      tooltip,
      container,
    );
  }

  appendHBarXAxis(
    g,
    xScale,
    iH,
    xTickFormat ?? ((v) => `${(+v / 1000).toFixed(0)}k`),
  );

  type Row = { label: string; value: number; color: string };
  const data: Row[] = labels.map((l, i) => ({
    label: l,
    value: values[i] ?? 0,
    color: colors[i],
  }));
  g.selectAll<SVGRectElement, Row>("rect")
    .data(data)
    .join("rect")
    .attr("x", 0)
    .attr(
      "y",
      (d) => (yScale(d.label) ?? 0) + (isMobile ? MOBILE_BAR_LABEL_H : 0),
    )
    .attr("width", (d) => Math.max(0, xScale(d.value)))
    .attr(
      "height",
      Math.max(0, yScale.bandwidth() - (isMobile ? MOBILE_BAR_LABEL_H : 0)),
    )
    .attr("fill", (d) => d.color)
    .attr("rx", barRx)
    .on("mousemove", (event, d) => {
      const [px, py] = d3.pointer(event, container);
      positionTooltip(
        tooltip,
        container,
        px,
        py,
        tooltipHtml(d.label, d.value),
      );
    })
    .on("mouseleave", () => tooltip.style("opacity", "0"));
}

// ── drawStackedHorizontalBarChart ─────────────────────────────────────────────
// Renders a stacked horizontal bar chart with full desktop/mobile support.
// dataRows must contain a string field named categoryKey plus one numeric field
// per key in seriesKeys.
export interface HStackedBarConfig {
  svgEl: SVGSVGElement;
  width: number;
  categories: string[];
  categoryKey: string;
  seriesKeys: string[];
  colorFn: (key: string) => string;
  dataRows: Record<string, string | number>[];
  tooltipHtml: (category: string, key: string, value: number) => string;
  tooltip: d3.Selection<HTMLDivElement, unknown, null, undefined>;
  container: Element;
  rowSlotHeight?: number;
  desktopLeftMargin?: number;
  xTickFormat?: (v: d3.NumberValue) => string;
  minHeight?: number;
}

export function drawStackedHorizontalBarChart({
  svgEl,
  width,
  categories,
  categoryKey,
  seriesKeys,
  colorFn,
  dataRows,
  tooltipHtml,
  tooltip,
  container,
  rowSlotHeight = 36,
  desktopLeftMargin,
  xTickFormat,
  minHeight = 300,
}: HStackedBarConfig): void {
  const { isMobile, M, H, iW, iH } = _hBarLayout(
    width,
    categories.length,
    rowSlotHeight,
    desktopLeftMargin,
    categories,
    minHeight,
    MOBILE_BAR_LABEL_H,
  );
  const svg = d3.select(svgEl);
  svg.selectAll("*").remove();
  svg.attr("width", width).attr("height", H);
  const g = svg.append("g").attr("transform", `translate(${M.left},${M.top})`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const series = (d3.stack().keys(seriesKeys) as any)(dataRows) as d3.Series<
    Record<string, string | number>,
    string
  >[];
  const xMax = d3.max(series, (s) => d3.max(s, (d) => d[1])) ?? 1;
  const xScale = d3
    .scaleLinear()
    .domain([0, xMax * 1.02])
    .range([0, iW]);
  const yScale = d3.scaleBand().domain(categories).range([0, iH]).padding(0.2);

  if (!isMobile) {
    g.append("g")
      .call(d3.axisLeft(yScale).tickSize(0))
      .call((ax) => ax.select(".domain").remove())
      .call(styleAxisText)
      .call((ax) => truncateAxisLabels(ax, M.left - 8, tooltip, container));
  } else {
    renderMobileBarLabels(
      g,
      categories,
      yScale,
      width,
      M.right,
      tooltip,
      container,
    );
  }

  appendHBarXAxis(
    g,
    xScale,
    iH,
    xTickFormat ?? ((v) => `${(+v / 1000).toFixed(0)}k`),
  );

  series.forEach((s) => {
    const key = s.key;
    const cls = `s-${key.replace(/\W/g, "_")}`;
    g.selectAll<
      SVGRectElement,
      d3.SeriesPoint<Record<string, string | number>>
    >(`rect.${cls}`)
      .data(s)
      .join("rect")
      .attr("class", cls)
      .attr(
        "y",
        (d) =>
          (yScale(d.data[categoryKey] as string) ?? 0) +
          (isMobile ? MOBILE_BAR_LABEL_H : 0),
      )
      .attr("x", (d) => xScale(d[0]))
      .attr(
        "height",
        Math.max(0, yScale.bandwidth() - (isMobile ? MOBILE_BAR_LABEL_H : 0)),
      )
      .attr("width", (d) => Math.max(0, xScale(d[1]) - xScale(d[0])))
      .attr("fill", colorFn(key))
      .on("mousemove", (event, d) => {
        const [px, py] = d3.pointer(event, container);
        positionTooltip(
          tooltip,
          container,
          px,
          py,
          tooltipHtml(
            d.data[categoryKey] as string,
            key,
            Math.round(d[1] - d[0]),
          ),
        );
      })
      .on("mouseleave", () => tooltip.style("opacity", "0"));
  });
}

// ── Vertical bar chart builders ───────────────────────────────────────────────
// Below MOBILE_BAR_W these render as horizontal bars (via the hbar builders
// above). Above it they render as classic vertical bars with optional label
// rotation. This is the single place that encodes the "vertical on desktop,
// horizontal on mobile" rule for all party-column charts.

// Internal layout helper for vertical bar charts.
function _vBarLayout(
  width: number,
  labels: string[],
): {
  needsRotation: boolean;
  M: { left: number; right: number; top: number; bottom: number };
  H: number;
  iW: number;
  iH: number;
} {
  const tempScale = d3
    .scaleBand()
    .domain(labels)
    .range([0, width - 48 - 16])
    .padding(0.25);
  const needsRotation = tempScale.bandwidth() < CHART_ROTATION_THRESHOLD;
  const M = {
    left: 48,
    right: 16,
    top: 16,
    bottom: needsRotation ? CHART_BOTTOM_ROTATED : 36,
  };
  const H = needsRotation ? 320 : 270;
  return {
    needsRotation,
    M,
    H,
    iW: width - M.left - M.right,
    iH: H - M.top - M.bottom,
  };
}

// Appends a styled x-axis for vertical bar charts with optional label rotation.
function _appendVBarXAxis(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  xScale: d3.ScaleBand<string>,
  iH: number,
  needsRotation: boolean,
): void {
  g.append("g")
    .attr("transform", `translate(0,${iH})`)
    .call(d3.axisBottom(xScale).tickSize(0))
    .call((ax) => ax.select(".domain").remove())
    .call((ax) => {
      styleAxisText(ax);
      if (needsRotation) {
        ax.selectAll("text")
          .style("text-anchor", "end")
          .attr("dx", "-0.5em")
          .attr("dy", "0.15em")
          .attr("transform", "rotate(-40)");
      }
    });
}

// ── drawSimpleVerticalBarChart ────────────────────────────────────────────────
// Renders a vertical bar chart on desktop (width ≥ MOBILE_BAR_W) and falls
// back to drawSimpleHorizontalBarChart on mobile. Labels rotate automatically
// when bandwidth is too tight to fit them straight.
export interface VBarConfig {
  svgEl: SVGSVGElement;
  width: number;
  labels: string[];
  values: number[];
  colors: string[];
  tooltipHtml: (label: string, value: number) => string;
  tooltip: d3.Selection<HTMLDivElement, unknown, null, undefined>;
  container: Element;
  yTickFormat?: (v: d3.NumberValue) => string;
  barRx?: number;
  // Overrides for the horizontal fallback (mobile)
  hBar?: Partial<
    Omit<
      HBarConfig,
      | "svgEl"
      | "width"
      | "labels"
      | "values"
      | "colors"
      | "tooltipHtml"
      | "tooltip"
      | "container"
    >
  >;
}

export function drawSimpleVerticalBarChart({
  svgEl,
  width,
  labels,
  values,
  colors,
  tooltipHtml,
  tooltip,
  container,
  yTickFormat,
  barRx = 2,
  hBar,
}: VBarConfig): void {
  if (width < MOBILE_BAR_W) {
    drawSimpleHorizontalBarChart({
      svgEl,
      width,
      labels,
      values,
      colors,
      tooltipHtml,
      tooltip,
      container,
      ...hBar,
    });
    return;
  }

  const { needsRotation, M, H, iW, iH } = _vBarLayout(width, labels);
  const svg = d3.select(svgEl);
  svg.selectAll("*").remove();
  svg.attr("width", width).attr("height", H);
  const g = svg.append("g").attr("transform", `translate(${M.left},${M.top})`);

  const xScale = d3.scaleBand().domain(labels).range([0, iW]).padding(0.25);
  const yMax = d3.max(values) ?? 1;
  const yScale = d3
    .scaleLinear()
    .domain([0, yMax * 1.05])
    .range([iH, 0]);

  _appendVBarXAxis(g, xScale, iH, needsRotation);

  g.append("g")
    .call(
      d3
        .axisLeft(yScale)
        .ticks(4)
        .tickFormat(yTickFormat ?? ((v) => `${(+v / 1000).toFixed(0)}k`)),
    )
    .call((ax) => ax.select(".domain").remove())
    .call(styleAxisText)
    .call((ax) => ax.selectAll(".tick line").attr("stroke", "#eee"));

  type Row = { label: string; value: number; color: string };
  const data: Row[] = labels.map((l, i) => ({
    label: l,
    value: values[i] ?? 0,
    color: colors[i],
  }));
  g.selectAll<SVGRectElement, Row>("rect")
    .data(data)
    .join("rect")
    .attr("x", (d) => xScale(d.label) ?? 0)
    .attr("y", (d) => yScale(d.value))
    .attr("width", xScale.bandwidth())
    .attr("height", (d) => Math.max(0, iH - yScale(d.value)))
    .attr("fill", (d) => d.color)
    .attr("rx", barRx)
    .on("mousemove", (event, d) => {
      const [px, py] = d3.pointer(event, container);
      positionTooltip(
        tooltip,
        container,
        px,
        py,
        tooltipHtml(d.label, d.value),
      );
    })
    .on("mouseleave", () => tooltip.style("opacity", "0"));
}

// ── drawStackedVerticalBarChart ───────────────────────────────────────────────
// Renders a 100%-stacked vertical bar chart on desktop and falls back to
// drawStackedHorizontalBarChart on mobile.
// seriesData: ordered array of { key, color, getValue(label) → number }
// The y-axis always shows 0–100%.
export interface VStackedBarSeries {
  key: string;
  color: string;
  getValue: (label: string) => number; // raw value (not pre-normalised)
}

export interface VStackedBarConfig {
  svgEl: SVGSVGElement;
  width: number;
  labels: string[];
  series: VStackedBarSeries[];
  tooltipHtml: (
    label: string,
    seriesKey: string,
    pct: number,
    count: number,
    total: number,
  ) => string;
  tooltip: d3.Selection<HTMLDivElement, unknown, null, undefined>;
  container: Element;
  // "percent" (default): x/y-axis 0–100%, all bars equally long.
  // "absolute": axis shows raw sums, bar lengths reflect totals.
  mode?: "percent" | "absolute";
  // Overrides for the horizontal fallback (mobile)
  hBar?: Partial<
    Omit<
      HStackedBarConfig,
      | "svgEl"
      | "width"
      | "categories"
      | "seriesKeys"
      | "colorFn"
      | "dataRows"
      | "tooltipHtml"
      | "tooltip"
      | "container"
    >
  >;
}

export function drawStackedVerticalBarChart({
  svgEl,
  width,
  labels,
  series,
  tooltipHtml,
  tooltip,
  container,
  mode = "percent",
  hBar,
}: VStackedBarConfig): void {
  if (width < MOBILE_BAR_W) {
    const categoryKey = "__label__";
    // In percent mode normalize each row to 0–100 so all bars are equal length.
    const dataRows = labels.map((label) => {
      const total = series.reduce((sum, s) => sum + s.getValue(label), 0);
      const row: Record<string, string | number> = { [categoryKey]: label };
      for (const s of series) {
        const raw = s.getValue(label);
        row[s.key] =
          mode === "percent"
            ? total > 0
              ? Math.round((raw / total) * 100)
              : 0
            : raw;
      }
      return row;
    });
    drawStackedHorizontalBarChart({
      svgEl,
      width,
      categories: labels,
      categoryKey,
      seriesKeys: series.map((s) => s.key),
      colorFn: (key) => series.find((s) => s.key === key)?.color ?? "#888",
      dataRows,
      tooltipHtml: (label, key, value) => {
        const total = series.reduce((sum, s) => sum + s.getValue(label), 0);
        if (mode === "percent") {
          // value is already the percentage; recover raw count via getValue
          const raw = series.find((s) => s.key === key)?.getValue(label) ?? 0;
          return tooltipHtml(label, key, value, raw, total);
        }
        const pct = total > 0 ? Math.round((value / total) * 100) : 0;
        return tooltipHtml(label, key, pct, value, total);
      },
      tooltip,
      container,
      // In percent mode default x-axis to 0–100% labels unless caller overrides
      xTickFormat: mode === "percent" ? (v) => `${+v}%` : undefined,
      ...hBar,
    });
    return;
  }

  const { needsRotation, M, H, iW, iH } = _vBarLayout(width, labels);
  const svg = d3.select(svgEl);
  svg.selectAll("*").remove();
  svg.attr("width", width).attr("height", H);
  const g = svg.append("g").attr("transform", `translate(${M.left},${M.top})`);

  const xScale = d3.scaleBand().domain(labels).range([0, iW]).padding(0.25);

  // In percent mode the y-axis is always 0–100. In absolute mode it scales to
  // the maximum column total so bar heights reflect actual counts.
  const yMax =
    mode === "absolute"
      ? (d3.max(labels, (label) =>
          series.reduce((sum, s) => sum + s.getValue(label), 0),
        ) ?? 1)
      : 100;
  const yScale = d3.scaleLinear().domain([0, yMax]).range([iH, 0]);

  _appendVBarXAxis(g, xScale, iH, needsRotation);

  g.append("g")
    .call(
      d3
        .axisLeft(yScale)
        .ticks(5)
        .tickFormat(
          mode === "percent"
            ? (d) => `${d}%`
            : (v) => `${(+v / 1000).toFixed(0)}k`,
        ),
    )
    .call((ax) => ax.select(".domain").remove())
    .call(styleAxisText)
    .call((ax) => ax.selectAll(".tick line").attr("stroke", "#eee"));

  labels.forEach((label) => {
    const total = series.reduce((sum, s) => sum + s.getValue(label), 0);
    let y0 = 0;
    for (const s of series) {
      const raw = s.getValue(label);
      const segValue =
        mode === "percent"
          ? total > 0
            ? Math.round((raw / total) * 100)
            : 0
          : raw;
      const pct =
        mode === "percent"
          ? segValue
          : total > 0
            ? Math.round((raw / total) * 100)
            : 0;
      const y1 = y0 + segValue;
      g.append("rect")
        .attr("x", xScale(label) ?? 0)
        .attr("y", yScale(y1))
        .attr("width", xScale.bandwidth())
        .attr("height", Math.max(0, yScale(y0) - yScale(y1)))
        .attr("fill", s.color)
        .on("mousemove", (event) => {
          const [px, py] = d3.pointer(event, container);
          positionTooltip(
            tooltip,
            container,
            px,
            py,
            tooltipHtml(label, s.key, pct, raw, total),
          );
        })
        .on("mouseleave", () => tooltip.style("opacity", "0"));
      y0 = y1;
    }
  });
}

// ── drawPartyColoredStackedBarChart ──────────────────────────────────────────
// Like drawStackedVerticalBarChart, but color comes from the *label* (e.g. party
// color), not the series. Segments are distinguished by opacity and an optional
// fallbackColor override (e.g. neutral gray for a "none" bucket).
//
// Desktop: vertical 100%-stacked bars. Mobile: horizontal 100%-stacked bars.
export interface PartyStackedBarSeries {
  key: string;
  opacity: number; // applied to the party color
  fallbackColor?: string; // overrides party color for this segment (e.g. "#E8E7E2")
}

export interface PartyStackedBarConfig {
  svgEl: SVGSVGElement;
  width: number;
  labels: string[];
  series: PartyStackedBarSeries[];
  partyColor: (label: string) => string;
  getValue: (label: string, key: string) => number;
  tooltipHtml: (
    label: string,
    key: string,
    pct: number,
    count: number,
    total: number,
  ) => string;
  tooltip: d3.Selection<HTMLDivElement, unknown, null, undefined>;
  container: Element;
}

export function drawPartyColoredStackedBarChart({
  svgEl,
  width,
  labels,
  series,
  partyColor,
  getValue,
  tooltipHtml,
  tooltip,
  container,
}: PartyStackedBarConfig): void {
  // Shared helper: renders stacked rects for one label starting at (x0, y0) in
  // the appropriate direction.
  function renderStacks(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    label: string,
    xPos: number,
    yPos: number,
    bandW: number,
    bandH: number,
    scale: d3.ScaleLinear<number, number>,
    horizontal: boolean,
    mobileOffset = 0,
  ) {
    const total = series.reduce((sum, s) => sum + getValue(label, s.key), 0);
    let offset = 0;
    for (const s of series) {
      const raw = getValue(label, s.key);
      const pct = total > 0 ? Math.round((raw / total) * 100) : 0;
      const next = offset + pct;
      const color = s.fallbackColor ?? partyColor(label);
      if (horizontal) {
        g.append("rect")
          .attr("x", scale(offset))
          .attr("y", yPos + mobileOffset)
          .attr("width", Math.max(0, scale(next) - scale(offset)))
          .attr("height", Math.max(0, bandH - mobileOffset))
          .attr("fill", color)
          .attr("opacity", s.opacity)
          .on("mousemove", (event) => {
            const [px, py] = d3.pointer(event, container);
            positionTooltip(
              tooltip,
              container,
              px,
              py,
              tooltipHtml(label, s.key, pct, raw, total),
            );
          })
          .on("mouseleave", () => tooltip.style("opacity", "0"));
      } else {
        g.append("rect")
          .attr("x", xPos)
          .attr("y", scale(next))
          .attr("width", bandW)
          .attr("height", Math.max(0, scale(offset) - scale(next)))
          .attr("fill", color)
          .attr("opacity", s.opacity)
          .on("mousemove", (event) => {
            const [px, py] = d3.pointer(event, container);
            positionTooltip(
              tooltip,
              container,
              px,
              py,
              tooltipHtml(label, s.key, pct, raw, total),
            );
          })
          .on("mouseleave", () => tooltip.style("opacity", "0"));
      }
      offset = next;
    }
  }

  if (width < MOBILE_BAR_W) {
    const { M, H, iW, iH } = _hBarLayout(
      width,
      labels.length,
      36,
      undefined,
      labels,
      200,
      MOBILE_BAR_LABEL_H,
    );
    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", H);
    const g = svg
      .append("g")
      .attr("transform", `translate(${M.left},${M.top})`);
    const xScale = d3.scaleLinear().domain([0, 100]).range([0, iW]);
    const yScale = d3.scaleBand().domain(labels).range([0, iH]).padding(0.2);

    renderMobileBarLabels(
      g,
      labels,
      yScale,
      width,
      M.right,
      tooltip,
      container,
    );
    appendHBarXAxis(g, xScale, iH, (v) => `${+v}%`);

    labels.forEach((label) => {
      renderStacks(
        g,
        label,
        0,
        yScale(label) ?? 0,
        0,
        yScale.bandwidth(),
        xScale,
        true,
        MOBILE_BAR_LABEL_H,
      );
    });
    return;
  }

  const { needsRotation, M, H, iW, iH } = _vBarLayout(width, labels);
  const svg = d3.select(svgEl);
  svg.selectAll("*").remove();
  svg.attr("width", width).attr("height", H);
  const g = svg.append("g").attr("transform", `translate(${M.left},${M.top})`);
  const xScale = d3.scaleBand().domain(labels).range([0, iW]).padding(0.25);
  const yScale = d3.scaleLinear().domain([0, 100]).range([iH, 0]);

  _appendVBarXAxis(g, xScale, iH, needsRotation);
  g.append("g")
    .call(
      d3
        .axisLeft(yScale)
        .ticks(5)
        .tickFormat((d) => `${d}%`),
    )
    .call((ax) => ax.select(".domain").remove())
    .call(styleAxisText)
    .call((ax) => ax.selectAll(".tick line").attr("stroke", "#eee"));

  labels.forEach((label) => {
    renderStacks(
      g,
      label,
      xScale(label) ?? 0,
      0,
      xScale.bandwidth(),
      iH,
      yScale,
      false,
    );
  });
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
          positionTooltip(tooltip, container, px, py, full);
        })
        .on("mouseleave", () => tooltip.style("opacity", "0"));
    }
  });
}
