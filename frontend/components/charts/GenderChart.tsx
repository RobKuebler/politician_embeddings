"use client";
import { useRef, useEffect } from "react";
import * as d3 from "d3";
import { useContainerWidth } from "@/hooks/useContainerWidth";
import {
  ChartTooltip,
  styleAxisText,
  TOOLTIP_DX,
  TOOLTIP_DY,
} from "@/lib/chart-utils";
import {
  COLOR_SECONDARY,
  CHART_ROTATION_THRESHOLD,
  CHART_BOTTOM_ROTATED,
} from "@/lib/constants";

interface SexRecord {
  party_label: string;
  geschlecht: string;
  count: number;
  pct: number;
}

const GENDERS = ["Männlich", "Weiblich", "Divers"] as const;
const GENDER_COLORS: Record<string, string> = {
  Männlich: "#4C9BE8",
  Weiblich: "#E87E9B",
  Divers: "#9B59B6",
};
const M_LEFT = 48;
const M_RIGHT = 16;
const M_TOP = 16;
// Bottom margin — straight labels need 36px, rotated labels need CHART_BOTTOM_ROTATED
const BOTTOM_NORMAL = 36;
// Chart heights — legend is rendered as HTML below the SVG, so no extra SVG space needed
const H_NORMAL = 270;
const H_ROTATED = 320;

export function GenderChart({
  data,
  parties,
}: {
  data: SexRecord[];
  parties: string[];
}) {
  const { ref: containerRef, width } = useContainerWidth();
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!width || !svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Determine whether party labels need rotation to avoid overlap
    const tempScale = d3
      .scaleBand()
      .domain(parties)
      .range([0, width - M_LEFT - M_RIGHT])
      .padding(0.25);
    const needsRotation = tempScale.bandwidth() < CHART_ROTATION_THRESHOLD;

    const M = {
      left: M_LEFT,
      right: M_RIGHT,
      top: M_TOP,
      bottom: needsRotation ? CHART_BOTTOM_ROTATED : BOTTOM_NORMAL,
    };
    const H = needsRotation ? H_ROTATED : H_NORMAL;
    const iW = width - M.left - M.right;
    const iH = H - M.top - M.bottom;
    svg.attr("width", width).attr("height", H);

    const g = svg
      .append("g")
      .attr("transform", `translate(${M.left},${M.top})`);

    const xScale = d3.scaleBand().domain(parties).range([0, iW]).padding(0.25);
    const yScale = d3.scaleLinear().domain([0, 100]).range([iH, 0]);

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

    const tooltip = d3.select(tooltipRef.current!);

    // Build stacked segments per party
    parties.forEach((party) => {
      let y0 = 0;
      GENDERS.forEach((gender) => {
        const row = data.find(
          (r) => r.party_label === party && r.geschlecht === gender,
        );
        const pct = row ? Math.round(row.pct) : 0;
        const y1 = y0 + pct;
        g.append("rect")
          .attr("x", xScale(party) ?? 0)
          .attr("y", yScale(y1))
          .attr("width", xScale.bandwidth())
          .attr("height", Math.max(0, yScale(y0) - yScale(y1)))
          .attr("fill", GENDER_COLORS[gender])
          .on("mousemove", (event) => {
            const [px, py] = d3.pointer(event, containerRef.current!);
            tooltip
              .style("opacity", "1")
              .style("left", `${px + TOOLTIP_DX}px`)
              .style("top", `${py + TOOLTIP_DY}px`)
              .html(`<b>${gender}</b><br/>${party}: ${pct}%`);
          })
          .on("mouseleave", () => tooltip.style("opacity", "0"));
        y0 = y1;
      });
    });
  }, [data, parties, width]);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      {/* overflow: visible so rotated axis labels are never clipped */}
      <svg
        ref={svgRef}
        style={{ display: "block", width: "100%", overflow: "visible" }}
      />
      {/* Legend as HTML — always below the SVG, can never overlap axis labels */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 px-1">
        {GENDERS.map((gender) => (
          <span
            key={gender}
            className="flex items-center gap-1 text-[11px]"
            style={{ color: COLOR_SECONDARY }}
          >
            <span
              style={{
                display: "inline-block",
                width: 10,
                height: 10,
                borderRadius: 2,
                background: GENDER_COLORS[gender],
                flexShrink: 0,
              }}
            />
            {gender}
          </span>
        ))}
      </div>
      <ChartTooltip tooltipRef={tooltipRef} />
    </div>
  );
}
