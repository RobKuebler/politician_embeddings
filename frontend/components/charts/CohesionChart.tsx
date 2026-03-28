"use client";
import { useRef, useEffect } from "react";
import * as d3 from "d3";
import { useContainerWidth } from "@/hooks/useContainerWidth";
import { CohesionRecord } from "@/lib/data";
import { PARTY_COLORS, FALLBACK_COLOR } from "@/lib/constants";
import { ChartTooltip, drawSimpleHorizontalBarChart } from "@/lib/chart-utils";

interface Props {
  cohesion: CohesionRecord[];
  height?: number;
}

export function CohesionChart({ cohesion, height = 300 }: Props) {
  const { ref: containerRef, width } = useContainerWidth();
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!width || !svgRef.current) return;
    const sorted = [...cohesion].sort((a, b) => b.streuung - a.streuung);
    const labels = sorted.map((c) => c.label);
    const maxLabelWidth = labels.reduce(
      (max, l) => Math.max(max, l.length * 7),
      0,
    );

    drawSimpleHorizontalBarChart({
      svgEl: svgRef.current,
      width,
      labels,
      values: sorted.map((c) => c.streuung),
      colors: sorted.map((c) => PARTY_COLORS[c.label] ?? FALLBACK_COLOR),
      tooltipHtml: (label, value) =>
        `<b>${label}</b><br/>Ø Abstand: ${value.toFixed(3)}`,
      tooltip: d3.select(tooltipRef.current!),
      container: containerRef.current!,
      desktopLeftMargin: maxLabelWidth + 8,
      xTickFormat: (v) => String(parseFloat((+v).toFixed(2))),
      yPadding: 0.3,
      minHeight: height,
    });
  }, [cohesion, height, width]);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <svg ref={svgRef} style={{ display: "block", width: "100%" }} />
      <ChartTooltip tooltipRef={tooltipRef} />
    </div>
  );
}
