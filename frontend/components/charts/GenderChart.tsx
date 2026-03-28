"use client";
import { useRef, useEffect } from "react";
import * as d3 from "d3";
import { useContainerWidth } from "@/hooks/useContainerWidth";
import { ChartTooltip, drawStackedVerticalBarChart } from "@/lib/chart-utils";
import { COLOR_SECONDARY } from "@/lib/constants";

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

    // Precompute total members per party for absolute counts in tooltip
    const partyTotals = Object.fromEntries(
      parties.map((party) => [
        party,
        data
          .filter((r) => r.party_label === party)
          .reduce((s, r) => s + r.count, 0),
      ]),
    );

    drawStackedVerticalBarChart({
      svgEl: svgRef.current,
      width,
      labels: parties,
      series: GENDERS.map((gender) => ({
        key: gender,
        color: GENDER_COLORS[gender],
        getValue: (party) =>
          data.find((r) => r.party_label === party && r.geschlecht === gender)
            ?.count ?? 0,
      })),
      tooltipHtml: (party, gender, pct, count) =>
        `<b>${party}</b><br/>${count} von ${partyTotals[party] ?? 0} Abgeordneten sind ${gender.toLowerCase()} (${pct}%)`,
      tooltip: d3.select(tooltipRef.current!),
      container: containerRef.current!,
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
