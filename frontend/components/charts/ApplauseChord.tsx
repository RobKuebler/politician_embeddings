"use client";
/**
 * ApplauseChord — D3 chord diagram showing cross-party Beifall flows.
 *
 * Rows/source = acting party (who applauds).
 * Cols/target = speaker party (during whose speech).
 * Arc size ∝ total activity (given + received).
 * Chord colored by the acting (source) party.
 * Hover a party arc to highlight only its chords.
 */
import { useRef, useEffect, useCallback } from "react";
import * as d3 from "d3";
import {
  PARTY_COLORS,
  FALLBACK_COLOR,
  CHART_FONT_FAMILY,
} from "@/lib/constants";
import { ChartTooltip, positionTooltip } from "@/lib/chart-utils";
import { useContainerWidth } from "@/hooks/useContainerWidth";
import type { KommentareData } from "@/lib/data";

interface Props {
  data: KommentareData;
}

const PAD_ANGLE = 0.022;
const LABEL_OFFSET = 10;
const TICK_STEP = 20_000;

function partyColor(party: string): string {
  return PARTY_COLORS[party] ?? FALLBACK_COLOR;
}

/** Format large numbers as "12k" or "1,2k" */
function fmt(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export default function ApplauseChord({ data }: Props) {
  const { ref: containerRef, width } = useContainerWidth();
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const draw = useCallback(() => {
    const svg = svgRef.current;
    const tooltip = tooltipRef.current;
    const container = containerRef.current;
    if (!svg || !tooltip || !container || width < 10) return;

    const { parties, cross } = data;
    const matrix = cross["Beifall"] as number[][];
    if (!matrix) return;

    const size = Math.min(width, 520);
    const outerR = size / 2 - 56;
    const innerR = outerR - 20;
    const cx = width / 2;
    const cy = size / 2;

    const sel = d3.select(svg);
    sel.selectAll("*").remove();
    sel.attr("width", width).attr("height", size);

    const g = sel.append("g").attr("transform", `translate(${cx},${cy})`);
    const tip = d3.select(tooltip);

    // ── Chord layout ───────────────────────────────────────────────────────
    const chordLayout = d3
      .chord()
      .padAngle(PAD_ANGLE)
      .sortSubgroups(d3.descending);
    const chords = chordLayout(matrix);

    const arcGen = d3
      .arc<d3.ChordGroup>()
      .innerRadius(innerR)
      .outerRadius(outerR);

    const ribbonGen = d3
      .ribbon<d3.Chord, d3.ChordSubgroup>()
      .radius(innerR - 1);

    // ── Helper: set opacity on all chords given a highlighted party index ──
    function highlightParty(idx: number | null) {
      g.selectAll<SVGPathElement, d3.Chord>("path.chord").attr(
        "opacity",
        (d) => {
          if (idx === null) return 0.65;
          return d.source.index === idx || d.target.index === idx ? 0.85 : 0.08;
        },
      );
      g.selectAll<SVGPathElement, d3.ChordGroup>("path.arc").attr(
        "opacity",
        (d) => (idx === null ? 1 : d.index === idx ? 1 : 0.35),
      );
      g.selectAll<SVGTextElement, d3.ChordGroup>("text.arc-label").attr(
        "opacity",
        (d) => (idx === null ? 1 : d.index === idx ? 1 : 0.35),
      );
    }

    // ── Arcs ───────────────────────────────────────────────────────────────
    const arcGroup = g
      .append("g")
      .selectAll<SVGGElement, d3.ChordGroup>("g")
      .data(chords.groups)
      .join("g");

    arcGroup
      .append("path")
      .attr("class", "arc")
      .attr("d", arcGen)
      .attr("fill", (d) => partyColor(parties[d.index]))
      .attr("stroke", "white")
      .attr("stroke-width", 1)
      .style("cursor", "pointer")
      .on("mousemove", (event, d) => {
        highlightParty(d.index);
        const party = parties[d.index];
        const given = matrix[d.index].reduce((s, v) => s + v, 0);
        const received = matrix.reduce((s, row) => s + row[d.index], 0);
        const [px, py] = d3.pointer(event, container);
        positionTooltip(
          tip,
          container,
          px,
          py,
          `<strong>${party}</strong><br>klatscht bei anderen: ${fmt(given - matrix[d.index][d.index])}<br>bekommt Beifall: ${fmt(received - matrix[d.index][d.index])}<br><span style="color:#aaa">davon Eigenbeifall: ${fmt(matrix[d.index][d.index])}</span>`,
        );
      })
      .on("mouseleave", () => {
        highlightParty(null);
        tip.style("opacity", "0");
      });

    // Tick marks on each arc
    arcGroup.each(function (d) {
      const group = d3.select(this);
      const angleSpan = d.endAngle - d.startAngle;
      const nTicks = Math.max(1, Math.floor(d.value / TICK_STEP));
      const step = angleSpan / nTicks;
      for (let i = 0; i <= nTicks; i++) {
        const angle = d.startAngle + i * step - Math.PI / 2;
        const x1 = Math.cos(angle) * outerR;
        const y1 = Math.sin(angle) * outerR;
        const x2 = Math.cos(angle) * (outerR + 5);
        const y2 = Math.sin(angle) * (outerR + 5);
        group
          .append("line")
          .attr("x1", x1)
          .attr("y1", y1)
          .attr("x2", x2)
          .attr("y2", y2)
          .attr("stroke", "#ccc")
          .attr("stroke-width", 0.8);
      }
    });

    // Arc labels — placed at midpoint angle, outside the arc
    arcGroup
      .append("text")
      .attr("class", "arc-label")
      .attr("dy", "0.35em")
      .attr("transform", (d) => {
        const angle = (d.startAngle + d.endAngle) / 2 - Math.PI / 2;
        const r = outerR + LABEL_OFFSET + 14;
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        const rotate = ((d.startAngle + d.endAngle) / 2) * (180 / Math.PI) - 90;
        return `translate(${x},${y}) rotate(${rotate > 90 ? rotate + 180 : rotate})`;
      })
      .attr("text-anchor", (d) => {
        const angle = (d.startAngle + d.endAngle) / 2;
        return angle > Math.PI ? "end" : "start";
      })
      .style("font-size", "11px")
      .style("font-family", CHART_FONT_FAMILY)
      .style("fill", "#444")
      .style("pointer-events", "none")
      .text((d) => parties[d.index]);

    // ── Chords (ribbons) ───────────────────────────────────────────────────
    g.append("g")
      .selectAll<SVGPathElement, d3.Chord>("path.chord")
      .data(chords)
      .join("path")
      .attr("class", "chord")
      .attr("d", ribbonGen)
      .attr("fill", (d) => partyColor(parties[d.source.index]))
      .attr("opacity", 0.65)
      .attr("stroke", "white")
      .attr("stroke-width", 0.4)
      .style("cursor", "pointer")
      .on("mousemove", (event, d) => {
        const src = parties[d.source.index];
        const tgt = parties[d.target.index];
        const fwd = matrix[d.source.index][d.target.index];
        const rev = matrix[d.target.index][d.source.index];
        const [px, py] = d3.pointer(event, container);
        positionTooltip(
          tip,
          container,
          px,
          py,
          src === tgt
            ? `<strong>${src}</strong> klatscht bei eigenen Reden: ${fmt(fwd)}`
            : `<strong>${src} ↔ ${tgt}</strong><br>${src} bei ${tgt}-Reden: ${fmt(fwd)}<br>${tgt} bei ${src}-Reden: ${fmt(rev)}`,
        );
      })
      .on("mouseleave", () => tip.style("opacity", "0"));
  }, [data, width]);

  useEffect(() => {
    draw();
  }, [draw]);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <svg ref={svgRef} style={{ display: "block" }} />
      <ChartTooltip tooltipRef={tooltipRef} maxWidth={220} zIndex={50} />
    </div>
  );
}
