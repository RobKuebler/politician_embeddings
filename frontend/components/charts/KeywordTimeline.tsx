"use client";
import { useRef, useEffect, useId } from "react";
import * as d3 from "d3";
import { useContainerWidth } from "@/hooks/useContainerWidth";
import { positionTooltip, ChartTooltip } from "@/lib/chart-utils";

export interface KeywordSeries {
  keyword: string;
  color: string;
  counts: number[];
}

interface Props {
  months: string[];
  totalWords: number[];
  series: KeywordSeries[];
  normalized: boolean;
  /** Per-series word counts for independent normalization (e.g. party comparison).
   * When provided, series[i] is normalized by seriesWords[i] instead of totalWords. */
  seriesWords?: number[][];
}

const MARGIN = { top: 16, right: 24, bottom: 48, left: 48 };
const HEIGHT = 320;

// Renders the x-axis ticks + year sub-labels onto an existing axis group.
// Called once on initial draw and again on every zoom event.
function renderXAxis(
  axisG: d3.Selection<SVGGElement, unknown, null, undefined>,
  scale: d3.ScaleTime<number, number>,
  tickEvery: d3.TimeInterval | null,
  fmtMonth: (d: Date) => string,
) {
  axisG.call(
    d3
      .axisBottom(scale)
      .ticks(tickEvery)
      .tickFormat((d) => fmtMonth(d as Date)),
  );
  axisG.select(".domain").remove();
  axisG.selectAll("text").style("font-size", "11px").attr("fill", "#7872a8");

  // Remove stale year labels before re-adding so they don't stack on zoom.
  axisG.selectAll(".year-label").remove();
  axisG
    .selectAll<SVGGElement, Date>(".tick")
    .filter((d, i) => d.getMonth() === 0 || i === 0)
    .append("text")
    .attr("class", "year-label")
    .attr("y", 30)
    .attr("text-anchor", "middle")
    .style("font-size", "10px")
    .attr("fill", "#7872a8")
    .text((d) => `'${String(d.getFullYear()).slice(2)}`);
}

/** D3 line chart rendering one line per active keyword over time. */
export function KeywordTimeline({
  months,
  totalWords,
  series,
  normalized,
  seriesWords,
}: Props) {
  const { ref: containerRef, width } = useContainerWidth();
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  // Stable unique ID for the SVG clipPath so multiple chart instances don't collide.
  const clipId = useId().replace(/:/g, "");

  useEffect(() => {
    if (
      !width ||
      !svgRef.current ||
      series.length === 0 ||
      months.length === 0
    ) {
      d3.select(svgRef.current).selectAll("*").remove();
      return;
    }

    const innerW = width - MARGIN.left - MARGIN.right;
    const innerH = HEIGHT - MARGIN.top - MARGIN.bottom;
    const dates = months.map((m) => new Date(m + "-01"));

    // Y value: normalized (per 1000 words) or absolute count.
    // When seriesWords is provided, each series uses its own word baseline (party comparison).
    const val = (s: KeywordSeries, i: number, si: number): number => {
      if (!normalized) return s.counts[i];
      const base = seriesWords ? (seriesWords[si]?.[i] ?? 0) : totalWords[i];
      return base > 0 ? (s.counts[i] / base) * 1000 : 0;
    };

    const xScale = d3
      .scaleTime()
      .domain([dates[0], dates[dates.length - 1]])
      .range([0, innerW]);

    const allVals = series.flatMap((s, si) =>
      months.map((_, i) => val(s, i, si)),
    );
    const yScale = d3
      .scaleLinear()
      .domain([0, d3.max(allVals) ?? 1])
      .nice()
      .range([innerH, 0]);

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", HEIGHT);

    const g = svg
      .append("g")
      .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

    // Horizontal grid lines
    g.append("g")
      .call(
        d3
          .axisLeft(yScale)
          .tickSize(-innerW)
          .tickFormat(() => ""),
      )
      .call((ax) => ax.select(".domain").remove())
      .call((ax) =>
        ax
          .selectAll(".tick line")
          .attr("stroke", "#eeedf8")
          .attr("stroke-dasharray", "3,3"),
      );

    // X axis — reduce tick density for long date ranges or narrow screens
    const isMobile = width < 480;
    const tickEvery =
      months.length > 24 || (isMobile && months.length > 12)
        ? d3.timeMonth.every(3)
        : d3.timeMonth.every(1);
    const DE_MONTHS = [
      "Jan",
      "Feb",
      "Mär",
      "Apr",
      "Mai",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Okt",
      "Nov",
      "Dez",
    ];
    // Month label: first letter on mobile, 3-letter abbreviation on desktop.
    // Year appears as a second line only at year boundaries (January + first tick).
    const fmtMonth = (d: Date) =>
      isMobile ? String(d.getMonth() + 1) : DE_MONTHS[d.getMonth()];

    const xAxisG = g.append("g").attr("transform", `translate(0,${innerH})`);
    renderXAxis(xAxisG, xScale, tickEvery, fmtMonth);

    // Y axis
    g.append("g")
      .call(
        d3
          .axisLeft(yScale)
          .ticks(4)
          .tickFormat((v) => String(+v % 1 === 0 ? +v : (+v).toFixed(2))),
      )
      .call((ax) => ax.select(".domain").remove())
      .selectAll("text")
      .style("font-size", "11px")
      .attr("fill", "#7872a8");

    // Clip-path keeps lines inside the chart area during zoom/pan.
    svg
      .append("defs")
      .append("clipPath")
      .attr("id", clipId)
      .append("rect")
      .attr("width", innerW)
      .attr("height", innerH);

    // Lines — one per active keyword series.
    // Each path gets a class so zoom can redraw them without a full re-render.
    const makeLine = (xs: d3.ScaleTime<number, number>) =>
      d3
        .line<number>()
        .x((_, i) => xs(dates[i]))
        .y((v) => yScale(v))
        .curve(d3.curveCatmullRom.alpha(0.5));

    for (const [si, s] of series.entries()) {
      const values = months.map((_, i) => val(s, i, si));
      g.append("path")
        .datum(values)
        .attr("class", "series-line")
        .attr("clip-path", `url(#${clipId})`)
        .attr("fill", "none")
        .attr("stroke", s.color)
        .attr("stroke-width", 2.5)
        .attr("d", makeLine(xScale));
    }

    // Crosshair + tooltip on hover
    const bisect = d3.bisector((d: Date) => d).left;
    const overlay = g
      .append("rect")
      .attr("width", innerW)
      .attr("height", innerH)
      .attr("fill", "none")
      .attr("pointer-events", "all")
      .style("cursor", "crosshair");

    const crosshair = g
      .append("line")
      .attr("y1", 0)
      .attr("y2", innerH)
      .attr("stroke", "#7872a8")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "4,2")
      .attr("opacity", 0);

    const tooltip = d3.select(tooltipRef.current!);

    // currentXScale is updated by the zoom handler so tooltip always uses
    // the visible (zoomed) scale rather than the original.
    let currentXScale = xScale;

    overlay
      .on("mousemove", (event: MouseEvent) => {
        const [mx] = d3.pointer(event);
        const hoveredDate = currentXScale.invert(mx);
        const idx = Math.min(bisect(dates, hoveredDate, 1), dates.length - 1);
        // Guard against idx === 0 to avoid reading dates[-1]
        let i: number;
        if (idx === 0) {
          i = 0;
        } else {
          i =
            hoveredDate.getTime() - dates[idx - 1].getTime() <
            dates[idx].getTime() - hoveredDate.getTime()
              ? idx - 1
              : idx;
        }

        crosshair
          .attr("x1", currentXScale(dates[i]))
          .attr("x2", currentXScale(dates[i]))
          .attr("opacity", 1);

        const rows = series
          .map(
            (s, si) =>
              `<span style="color:${s.color}">■</span> ${s.keyword}: <b>${
                normalized ? val(s, i, si).toFixed(2) : val(s, i, si)
              }</b>`,
          )
          .join("<br/>");
        const html = `<span style="font-size:11px;color:#7872a8">${months[i]}</span><br/>${rows}`;

        const [cx, cy] = d3.pointer(event, containerRef.current!);
        positionTooltip(tooltip, containerRef.current!, cx, cy, html);
      })
      .on("mouseleave", () => {
        crosshair.attr("opacity", 0);
        tooltip.style("opacity", "0");
      });

    // X-axis zoom (scroll to zoom, drag to pan, double-click to reset).
    // Only the x-axis is affected — y scale and y axis stay fixed.
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 20])
      .translateExtent([
        [0, 0],
        [innerW, innerH],
      ])
      .extent([
        [0, 0],
        [innerW, innerH],
      ])
      .on("zoom", (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        // Apply zoom only to x — rescaleY is intentionally omitted.
        const xZoomed = event.transform.rescaleX(xScale);
        currentXScale = xZoomed;

        // Update line paths with the zoomed x scale.
        g.selectAll<SVGPathElement, number[]>(".series-line").attr(
          "d",
          makeLine(xZoomed),
        );

        // Update x axis and year labels.
        renderXAxis(xAxisG, xZoomed, tickEvery, fmtMonth);
      });

    svg.call(zoom);

    // Double-click resets to the original view.
    svg.on("dblclick.zoom", () => {
      svg.transition().duration(300).call(zoom.transform, d3.zoomIdentity);
    });
  }, [
    containerRef,
    months,
    totalWords,
    series,
    normalized,
    seriesWords,
    width,
    clipId,
  ]);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <svg ref={svgRef} style={{ display: "block", width: "100%" }} />
      <ChartTooltip tooltipRef={tooltipRef} />
    </div>
  );
}
