"use client";
import { useRef, useEffect } from "react";
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
}

const MARGIN = { top: 16, right: 24, bottom: 36, left: 48 };
const HEIGHT = 320;

/** D3 line chart rendering one line per active keyword over time. */
export function KeywordTimeline({
  months,
  totalWords,
  series,
  normalized,
}: Props) {
  const { ref: containerRef, width } = useContainerWidth();
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

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

    // Y value: normalized (per 1000 words) or absolute count
    const val = (s: KeywordSeries, i: number): number =>
      normalized && totalWords[i] > 0
        ? (s.counts[i] / totalWords[i]) * 1000
        : s.counts[i];

    const xScale = d3
      .scaleTime()
      .domain([dates[0], dates[dates.length - 1]])
      .range([0, innerW]);

    const allVals = series.flatMap((s) => months.map((_, i) => val(s, i)));
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
          .attr("stroke", "#F0EEE9")
          .attr("stroke-dasharray", "3,3"),
      );

    // X axis — reduce tick density for long date ranges
    const tickEvery =
      months.length > 24 ? d3.timeMonth.every(3) : d3.timeMonth.every(1);
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
    const fmtMonth = (d: Date) =>
      `${DE_MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(
        d3
          .axisBottom(xScale)
          .ticks(tickEvery)
          .tickFormat((d) => fmtMonth(d as Date)),
      )
      .call((ax) => ax.select(".domain").remove())
      .selectAll("text")
      .style("font-size", "11px")
      .attr("fill", "#9A9790");

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
      .attr("fill", "#9A9790");

    // Lines — one per active keyword series
    const line = d3
      .line<number>()
      .x((_, i) => xScale(dates[i]))
      .y((v) => yScale(v))
      .curve(d3.curveCatmullRom.alpha(0.5));

    for (const s of series) {
      const values = months.map((_, i) => val(s, i));
      g.append("path")
        .datum(values)
        .attr("fill", "none")
        .attr("stroke", s.color)
        .attr("stroke-width", 2.5)
        .attr("d", line);
    }

    // Crosshair + tooltip on hover
    const bisect = d3.bisector((d: Date) => d).left;
    const overlay = g
      .append("rect")
      .attr("width", innerW)
      .attr("height", innerH)
      .attr("fill", "none")
      .attr("pointer-events", "all");

    const crosshair = g
      .append("line")
      .attr("y1", 0)
      .attr("y2", innerH)
      .attr("stroke", "#9A9790")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "4,2")
      .attr("opacity", 0);

    const tooltip = d3.select(tooltipRef.current!);

    overlay
      .on("mousemove", (event: MouseEvent) => {
        const [mx] = d3.pointer(event);
        const hoveredDate = xScale.invert(mx);
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
          .attr("x1", xScale(dates[i]))
          .attr("x2", xScale(dates[i]))
          .attr("opacity", 1);

        const rows = series
          .map(
            (s) =>
              `<span style="color:${s.color}">■</span> ${s.keyword}: <b>${
                normalized ? val(s, i).toFixed(2) : val(s, i)
              }</b>`,
          )
          .join("<br/>");
        const html = `<span style="font-size:11px;color:#9A9790">${months[i]}</span><br/>${rows}`;

        const [cx, cy] = d3.pointer(event, containerRef.current!);
        positionTooltip(tooltip, containerRef.current!, cx, cy, html);
      })
      .on("mouseleave", () => {
        crosshair.attr("opacity", 0);
        tooltip.style("opacity", "0");
      });
  }, [months, totalWords, series, normalized, width]);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <svg ref={svgRef} style={{ display: "block", width: "100%" }} />
      <ChartTooltip tooltipRef={tooltipRef} />
    </div>
  );
}
