"use client";
import { useRef, useEffect } from "react";
import * as d3 from "d3";
import { useContainerWidth } from "@/hooks/useContainerWidth";
import {
  sortParties,
  CHART_FONT_FAMILY,
  CHART_AXIS_FONT_SIZE,
} from "@/lib/constants";
import {
  ChartTooltip,
  styleAxisText,
  TOOLTIP_DX,
  TOOLTIP_DY,
} from "@/lib/chart-utils";

export interface Centroid {
  party: string;
  cx: number;
  cy: number;
}

const HEADER_H = 72; // room for −30° rotated column labels
const MIN_CELL_W = 28;
const CELL_H = 36; // fixed row height — cells are rectangular, width fills the column

export function PartyDistanceMatrix({ centroids }: { centroids: Centroid[] }) {
  const { ref: containerRef, width } = useContainerWidth();
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!width || !svgRef.current || centroids.length === 0) return;

    const parties = sortParties(centroids.map((c) => c.party));
    const centroidMap = new Map(centroids.map((c) => [c.party, c]));
    const n = parties.length;

    // Pairwise Euclidean distances between party centroids
    const dist: number[][] = parties.map((pa) =>
      parties.map((pb) => {
        const a = centroidMap.get(pa)!;
        const b = centroidMap.get(pb)!;
        return Math.sqrt((a.cx - b.cx) ** 2 + (a.cy - b.cy) ** 2);
      }),
    );
    const maxDist = d3.max(dist.flat().filter((d) => d > 0)) ?? 1;

    // Inverted: dark/warm (similar, small distance) → light (different, large distance)
    const colorScale = d3
      .scaleSequential()
      .domain([0, maxDist])
      .interpolator(d3.interpolate("#1E1B5E", "#EEF0FF"));

    const ML = Math.max(...parties.map((p) => p.length * 6)) + 10;
    const MR = 8;
    const cellW = Math.max(MIN_CELL_W, Math.floor((width - ML - MR) / n));
    const iW = cellW * n;
    const iH = CELL_H * n;
    const totalW = ML + iW + MR;
    const totalH = HEADER_H + iH;

    const xScale = d3.scaleBand().domain(parties).range([0, iW]).padding(0.05);
    const yScale = d3.scaleBand().domain(parties).range([0, iH]).padding(0.05);

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", totalW).attr("height", totalH);

    const tooltip = d3.select(tooltipRef.current!);

    // Column headers — rotated −30°
    svg
      .append("g")
      .attr("transform", `translate(${ML}, ${HEADER_H})`)
      .call(d3.axisTop(xScale).tickSize(0))
      .call((ax) => ax.select(".domain").remove())
      .call((ax) => {
        styleAxisText(ax);
        ax.selectAll("text")
          .attr("transform", "rotate(-30)")
          .attr("text-anchor", "start")
          .attr("dy", "-0.4em")
          .attr("dx", "0.4em");
      });

    // Row labels
    svg
      .append("g")
      .attr("transform", `translate(${ML}, ${HEADER_H})`)
      .call(d3.axisLeft(yScale).tickSize(0))
      .call((ax) => ax.select(".domain").remove())
      .call(styleAxisText);

    // Upper triangle cells only (ci > ri)
    const g = svg
      .append("g")
      .attr("transform", `translate(${ML}, ${HEADER_H})`);

    parties.forEach((pa, ri) => {
      parties.forEach((pb, ci) => {
        if (ci <= ri) return; // skip diagonal and lower triangle

        const d = dist[ri][ci];
        const x = xScale(pb) ?? 0;
        const y = yScale(pa) ?? 0;
        const bw = xScale.bandwidth();
        const bh = yScale.bandwidth();

        g.append("rect")
          .attr("x", x)
          .attr("y", y)
          .attr("width", bw)
          .attr("height", bh)
          .attr("fill", colorScale(d))
          .attr("rx", 3)
          .on("mousemove", (event) => {
            const [px, py] = d3.pointer(event, containerRef.current!);
            // Set content first so offsetWidth reflects actual tooltip width
            tooltip
              .style("opacity", "1")
              .html(`<b>${pa}</b> ↔ <b>${pb}</b><br/>Abstand: ${d.toFixed(3)}`);
            const containerW = containerRef.current!.offsetWidth;
            const tipW = tooltipRef.current!.offsetWidth;
            const left = Math.min(px + TOOLTIP_DX, containerW - tipW - 4);
            tooltip
              .style("left", `${left}px`)
              .style("top", `${py + TOOLTIP_DY}px`);
          })
          .on("mouseleave", () => tooltip.style("opacity", "0"));

        // Value label if cell is wide enough
        if (bw >= 36) {
          g.append("text")
            .attr("x", x + bw / 2)
            .attr("y", y + bh / 2)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "central")
            .style("font-size", CHART_AXIS_FONT_SIZE)
            .style("font-family", CHART_FONT_FAMILY)
            .style("fill", d < maxDist * 0.45 ? "#fff" : "#333")
            .style("pointer-events", "none")
            .text(d.toFixed(2));
        }
      });
    });
  }, [centroids, width]);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <div style={{ overflowX: "auto" }}>
        <svg ref={svgRef} style={{ display: "block", overflow: "visible" }} />
      </div>
      <ChartTooltip tooltipRef={tooltipRef} />
    </div>
  );
}
