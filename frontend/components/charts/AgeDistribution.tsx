"use client";
import { useRef, useEffect } from "react";
import * as d3 from "d3";
import { useContainerWidth } from "@/hooks/useContainerWidth";
import { PARTY_COLORS, FALLBACK_COLOR } from "@/lib/constants";

interface AgeRecord {
  name: string;
  party: string;
  age: number;
}
interface Props {
  data: AgeRecord[];
  parties: string[];
}

const M = { left: 160, right: 24, top: 16, bottom: 36 };

function epanechnikovKernel(bandwidth: number) {
  return (x: number) => {
    const u = x / bandwidth;
    return Math.abs(u) <= 1 ? (0.75 * (1 - u * u)) / bandwidth : 0;
  };
}

function kernelDensity(
  kernel: (v: number) => number,
  thresholds: number[],
  values: number[],
): [number, number][] {
  return thresholds.map((x) => [x, d3.mean(values, (v) => kernel(x - v)) ?? 0]);
}

export function AgeDistribution({ data, parties }: Props) {
  const { ref: containerRef, width } = useContainerWidth();
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!width || !svgRef.current) return;

    const H = Math.max(380, parties.length * 72 + M.top + M.bottom);
    const iW = width - M.left - M.right;
    const iH = H - M.top - M.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", H);

    // Clip path so zoomed content doesn't bleed into y-axis area
    const clipId = "age-dist-clip";
    svg
      .append("defs")
      .append("clipPath")
      .attr("id", clipId)
      .append("rect")
      .attr("width", iW)
      .attr("height", iH + 1);

    const g = svg
      .append("g")
      .attr("transform", `translate(${M.left},${M.top})`);

    const xScaleBase = d3.scaleLinear().domain([18, 88]).range([0, iW]);
    const yScale = d3.scaleBand().domain(parties).range([0, iH]).padding(0.2);
    const bw = yScale.bandwidth();
    const violinH = bw * 0.62;
    const dotH = bw * 0.38;

    // Fixed y-axis (outside clip)
    g.append("g")
      .call(d3.axisLeft(yScale).tickSize(0))
      .call((ax) => ax.select(".domain").remove())
      .call((ax) =>
        ax.selectAll("text").style("font-size", "11px").attr("dx", "-6"),
      );

    // Clipped group for everything x-dependent
    const chartG = g.append("g").attr("clip-path", `url(#${clipId})`);
    const gridG = chartG.append("g");
    const dataG = chartG.append("g");
    const xAxisG = g.append("g").attr("transform", `translate(0,${iH})`);

    // Pre-compute per-party density and dot positions
    const byParty = d3.group(data, (d) => d.party);
    const thresholds = d3.range(18, 89, 0.5);
    const kernel = epanechnikovKernel(5);

    const partyData = parties.map((party) => {
      const records = byParty.get(party) ?? [];
      const ages = records.map((d) => d.age);
      const density = kernelDensity(kernel, thresholds, ages);
      const maxDensity = d3.max(density, (d) => d[1]) ?? 1;
      const bandY = yScale(party) ?? 0;
      const baseline = bandY + violinH;
      const dotCenterY = baseline + dotH / 2;
      const jitterAmt = dotH * 0.38;
      const color = PARTY_COLORS[party] ?? FALLBACK_COLOR;
      const densityToPixel = d3
        .scaleLinear()
        .domain([0, maxDensity])
        .range([0, violinH * 0.88]);
      return {
        party,
        records,
        density,
        bandY,
        baseline,
        dotCenterY,
        jitterAmt,
        color,
        densityToPixel,
      };
    });

    const tooltip = d3.select(tooltipRef.current!);

    // Draw static y-position elements once (separator lines)
    partyData.forEach(({ baseline, color: _c }) => {
      dataG
        .append("line")
        .attr("class", "sep-line")
        .attr("x1", 0)
        .attr("x2", iW)
        .attr("y1", baseline)
        .attr("y2", baseline)
        .attr("stroke", "#e0e0e0")
        .attr("stroke-width", 0.5);
    });

    // Draw violin paths and dots (will be updated on zoom)
    partyData.forEach(
      ({
        party,
        records,
        density,
        baseline,
        dotCenterY,
        jitterAmt,
        color,
        densityToPixel,
      }) => {
        dataG
          .append("path")
          .datum(density)
          .attr("class", `violin violin-${party.replace(/\W/g, "_")}`)
          .attr("fill", color)
          .attr("fill-opacity", 0.15)
          .attr("stroke", color)
          .attr("stroke-width", 1.5)
          .attr("stroke-opacity", 0.7)
          .attr("stroke-linejoin", "round");

        dataG
          .selectAll<SVGCircleElement, AgeRecord>(
            `.dot-${party.replace(/\W/g, "_")}`,
          )
          .data(records)
          .join("circle")
          .attr("class", `dot dot-${party.replace(/\W/g, "_")}`)
          .attr(
            "cy",
            (_, i) => dotCenterY + Math.sin(i * 47.431 + baseline) * jitterAmt,
          )
          .attr("r", 2.5)
          .attr("fill", color)
          .attr("opacity", 0.6);
      },
    );

    // Function to redraw all x-dependent elements given a (possibly zoomed) xScale
    function update(xS: d3.ScaleLinear<number, number>) {
      // Gridlines (vertical, spanning full chart height)
      gridG.selectAll("*").remove();
      gridG.call((g2: d3.Selection<SVGGElement, unknown, null, undefined>) =>
        g2
          .call(
            d3
              .axisBottom(xS)
              .ticks(8)
              .tickSize(iH)
              .tickFormat(() => ""),
          )
          .call((ax) => ax.select(".domain").remove())
          .call((ax) =>
            ax
              .selectAll(".tick line")
              .attr("stroke", "#f0f0f0")
              .attr("stroke-dasharray", "3,2"),
          ),
      );

      // X axis
      xAxisG
        .call(d3.axisBottom(xS).ticks(8).tickSize(0))
        .call((ax) => ax.select(".domain").remove())
        .call((ax) =>
          ax.selectAll("text").style("fill", "#888").style("font-size", "11px"),
        );

      // Violin paths
      partyData.forEach(({ party, density, baseline, densityToPixel }) => {
        const path = dataG.select<SVGPathElement>(
          `.violin-${party.replace(/\W/g, "_")}`,
        );

        const area = d3
          .area<[number, number]>()
          .x((d) => xS(d[0]))
          .y0(baseline)
          .y1((d) => baseline - densityToPixel(d[1]))
          .curve(d3.curveBasis);

        path.attr("d", area(density));
      });

      // Dot cx positions
      partyData.forEach(({ party }) => {
        dataG
          .selectAll<
            SVGCircleElement,
            AgeRecord
          >(`.dot-${party.replace(/\W/g, "_")}`)
          .attr("cx", (d) => xS(d.age));
      });

      // Separator lines (full width, not affected by zoom)
      dataG.selectAll<SVGLineElement, unknown>(".sep-line").attr("x2", iW);
    }

    // Initial draw
    // currentXS tracks the live scale (updated on zoom) for tooltip hit-testing
    let currentXS = xScaleBase;
    update(xScaleBase);

    // Zoom (x-only)
    const zoom = d3
      .zoom<SVGRectElement, unknown>()
      .scaleExtent([1, 10])
      .translateExtent([
        [0, 0],
        [iW, iH],
      ])
      .extent([
        [0, 0],
        [iW, iH],
      ])
      .on("zoom", (event: d3.D3ZoomEvent<SVGRectElement, unknown>) => {
        currentXS = event.transform.rescaleX(xScaleBase);
        update(currentXS);
      });

    // Transparent overlay rect captures zoom/pan events and tooltip hover
    g.append("rect")
      .attr("width", iW)
      .attr("height", iH)
      .attr("fill", "none")
      .attr("pointer-events", "all")
      .style("cursor", "crosshair")
      .call(zoom)
      .on("mousemove", (event: MouseEvent) => {
        // Pointer coords are in the g's coordinate space (0..iW, 0..iH)
        const [mx, my] = d3.pointer(event);
        const ageAtMouse = currentXS.invert(mx);

        // Find which party band the cursor is in
        const hoveredParty = parties.find((p) => {
          const bandY = yScale(p) ?? 0;
          return my >= bandY && my <= bandY + bw;
        });
        if (!hoveredParty) {
          tooltip.style("opacity", "0");
          return;
        }

        const pd = partyData.find((p) => p.party === hoveredParty);
        if (!pd || pd.records.length === 0) {
          tooltip.style("opacity", "0");
          return;
        }

        // Nearest politician by age
        const nearest = pd.records.reduce((best, d) =>
          Math.abs(d.age - ageAtMouse) < Math.abs(best.age - ageAtMouse)
            ? d
            : best,
        );

        // Hide tooltip if mouse is more than 20px away from the nearest dot
        if (Math.abs(currentXS(nearest.age) - mx) > 20) {
          tooltip.style("opacity", "0");
          return;
        }

        const [px, py] = d3.pointer(event, containerRef.current!);
        tooltip
          .style("opacity", "1")
          .style("left", `${px + 12}px`)
          .style("top", `${py - 28}px`)
          .html(
            `<b>${nearest.name}</b><br/>${nearest.party} · ${nearest.age} Jahre`,
          );
      })
      .on("mouseleave", () => tooltip.style("opacity", "0"));
  }, [data, parties, width]);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <svg ref={svgRef} style={{ display: "block", width: "100%" }} />
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
          whiteSpace: "nowrap",
          zIndex: 10,
        }}
      />
    </div>
  );
}
