"use client";
import { useRef, useEffect } from "react";
import {
  select,
  scaleLinear,
  type ScaleLinear,
  scaleBand,
  axisLeft,
  axisBottom,
  area as d3Area,
  curveBasis,
  group,
  range,
  max,
  mean,
  zoom as d3Zoom,
  pointer,
} from "d3";
import { useContainerWidth } from "@/hooks/useContainerWidth";
import { getPartyColor, getPartyShortLabel } from "@/lib/constants";
import {
  ChartTooltip,
  styleAxisText,
  positionTooltip,
} from "@/lib/chart-utils";
import { useLanguage } from "@/lib/language-context";

interface AgeRecord {
  name: string;
  party: string;
  age: number;
}
interface Props {
  data: AgeRecord[];
  parties: string[];
}

// Left margin accommodates the longest party name; right/top/bottom are fixed.
const M = { left: 80, right: 24, top: 16, bottom: 36 };

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
  return thresholds.map((x) => [x, mean(values, (v) => kernel(x - v)) ?? 0]);
}

export function AgeDistribution({ data, parties }: Props) {
  const { ref: containerRef, width } = useContainerWidth();
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const { t } = useLanguage();

  useEffect(() => {
    if (!width || !svgRef.current) return;

    const H = Math.max(380, parties.length * 72 + M.top + M.bottom);
    const iW = width - M.left - M.right;
    const iH = H - M.top - M.bottom;

    const svg = select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", H);

    // Adaptive tick count: ~1 tick per 40px so labels never overlap on mobile
    const tickCount = Math.max(3, Math.floor(iW / 40));

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

    const xScaleBase = scaleLinear().domain([18, 88]).range([0, iW]);
    const yScale = scaleBand().domain(parties).range([0, iH]).padding(0.2);
    const bw = yScale.bandwidth();
    const violinH = bw * 0.62;
    const dotH = bw * 0.38;

    // Fixed y-axis (outside clip)
    g.append("g")
      .call(
        axisLeft(yScale)
          .tickSize(0)
          .tickFormat((p) => getPartyShortLabel(p as string)),
      )
      .call((ax) => ax.select(".domain").remove())
      .call((ax) => {
        styleAxisText(ax);
        ax.selectAll("text").attr("dx", "-6");
      });

    // Clipped group for everything x-dependent
    const chartG = g.append("g").attr("clip-path", `url(#${clipId})`);
    const gridG = chartG.append("g");
    const dataG = chartG.append("g");
    const xAxisG = g.append("g").attr("transform", `translate(0,${iH})`);

    // Pre-compute per-party density and dot positions
    const byParty = group(data, (d) => d.party);
    const thresholds = range(18, 89, 0.5);
    const kernel = epanechnikovKernel(5);

    const partyData = parties.map((party) => {
      // Sort by age so evenly-spaced y positions follow the data order
      const records = [...(byParty.get(party) ?? [])].sort(
        (a, b) => a.age - b.age,
      );
      const ages = records.map((d) => d.age);
      const density = kernelDensity(kernel, thresholds, ages);
      const maxDensity = max(density, (d) => d[1]) ?? 1;
      const bandY = yScale(party) ?? 0;
      const baseline = bandY + violinH;
      const dotCenterY = baseline + dotH / 2;
      const jitterAmt = dotH * 0.38;
      const color = getPartyColor(party);
      const densityToPixel = scaleLinear()
        .domain([0, maxDensity])
        .range([0, violinH * 0.88]);

      // Pre-compute fixed cy per record (grouped by age, evenly spaced)
      const ageGroups = group(records, (d) => d.age);
      const yIndex = new Map<AgeRecord, number>();
      const yTotal = new Map<AgeRecord, number>();
      ageGroups.forEach((group) => {
        group.forEach((rec, i) => {
          yIndex.set(rec, i);
          yTotal.set(rec, group.length);
        });
      });
      const dotCY = records.map((rec) => {
        const i = yIndex.get(rec) ?? 0;
        const n = yTotal.get(rec) ?? 1;
        const t = n > 1 ? i / (n - 1) : 0.5;
        return dotCenterY + (t - 0.5) * 2 * jitterAmt;
      });

      return {
        party,
        records,
        dotCY,
        density,
        bandY,
        baseline,
        dotCenterY,
        jitterAmt,
        color,
        densityToPixel,
      };
    });

    const tooltip = select(tooltipRef.current!);

    // Draw static y-position elements once (separator lines)
    partyData.forEach(({ baseline }) => {
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
    partyData.forEach(({ party, records, dotCY, density, color }) => {
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
        .attr("cy", (_, i) => dotCY[i])
        .attr("r", 2.5)
        .attr("fill", color)
        .attr("opacity", 0.6);
    });

    // Redraws all x-dependent elements for a given (possibly zoomed) xScale
    function update(xS: ScaleLinear<number, number>) {
      gridG.selectAll("*").remove();
      gridG.call((g2: ReturnType<typeof select<SVGGElement, unknown>>) =>
        g2
          .call(
            axisBottom(xS)
              .ticks(tickCount)
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

      xAxisG
        .call(axisBottom(xS).ticks(tickCount).tickSize(0))
        .call((ax) => ax.select(".domain").remove())
        .call(styleAxisText);

      partyData.forEach(({ party, density, baseline, densityToPixel }) => {
        const path = dataG.select<SVGPathElement>(
          `.violin-${party.replace(/\W/g, "_")}`,
        );
        const area = d3Area<[number, number]>()
          .x((d) => xS(d[0]))
          .y0(baseline)
          .y1((d) => baseline - densityToPixel(d[1]))
          .curve(curveBasis);
        path.attr("d", area(density));
      });

      partyData.forEach(({ party }) => {
        dataG
          .selectAll<
            SVGCircleElement,
            AgeRecord
          >(`.dot-${party.replace(/\W/g, "_")}`)
          .attr("cx", (d) => xS(d.age));
      });

      dataG.selectAll<SVGLineElement, unknown>(".sep-line").attr("x2", iW);
    }

    let currentXS = xScaleBase;
    update(xScaleBase);

    // X-axis label — added once outside update() so it isn't redrawn on every zoom event
    g.append("text")
      .attr("class", "axis-label")
      .attr("x", iW / 2)
      .attr("y", iH + M.bottom - 6)
      .attr("text-anchor", "middle")
      .attr("fill", "var(--color-muted)")
      .style("font-size", "11px")
      .text(t.party_profile.age_axis_label);

    // Zoom (x-only)
    const zoom = d3Zoom<SVGRectElement, unknown>()
      .scaleExtent([1, 10])
      .translateExtent([
        [0, 0],
        [iW, iH],
      ])
      .extent([
        [0, 0],
        [iW, iH],
      ])
      .on("zoom", (event) => {
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
        const [mx, my] = pointer(event);

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

        // Find nearest dot by 2D distance so same-age dots are distinguishable
        let nearest = pd.records[0];
        let nearestDist = Infinity;
        pd.records.forEach((d, i) => {
          const dx = currentXS(d.age) - mx;
          const dy = pd.dotCY[i] - my;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearest = d;
          }
        });

        if (Math.abs(currentXS(nearest.age) - mx) > 20) {
          tooltip.style("opacity", "0");
          return;
        }

        const [px, py] = pointer(event, containerRef.current!);
        positionTooltip(
          tooltip,
          containerRef.current!,
          px,
          py,
          `<b>${nearest.name}</b><br/>${getPartyShortLabel(nearest.party)} · ${t.party_profile.age_tooltip_years.replace("{age}", String(nearest.age))}`,
        );
      })
      .on("mouseleave", () => tooltip.style("opacity", "0"));
  }, [containerRef, data, parties, t, width]);

  // Update only the axis label text when language changes — avoids full chart rebuild.
  useEffect(() => {
    if (!svgRef.current) return;
    select(svgRef.current)
      .select<SVGTextElement>(".axis-label")
      .text(t.party_profile.age_axis_label);
  }, [t]);

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label="Altersverteilung der Abgeordneten nach Partei"
      style={{ position: "relative" }}
    >
      <svg ref={svgRef} style={{ display: "block", width: "100%" }} />
      <ChartTooltip tooltipRef={tooltipRef} />
    </div>
  );
}
