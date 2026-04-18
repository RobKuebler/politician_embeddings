"use client";
import { useRef, useEffect } from "react";
import { scaleBand, axisLeft, select, pointer } from "d3";
import { useContainerWidth } from "@/hooks/useContainerWidth";
import { VoteRecord, Poll, Politician, stripSoftHyphen } from "@/lib/data";
import {
  VOTE_META,
  VOTE_NUMERIC,
  PARTY_ORDER,
  getPartyColor,
  getPartyShortLabel,
  CHART_FONT_FAMILY,
} from "@/lib/constants";
import {
  ChartTooltip,
  styleAxisText,
  TOOLTIP_DX,
  TOOLTIP_DY,
} from "@/lib/chart-utils";

interface Props {
  votes: VoteRecord[];
  polls: Poll[];
  politicians: Politician[];
  selectedPolIds: number[];
  selectedPollIds: number[];
}

const VOTE_COLOR: Record<string, string> = {
  yes: "var(--color-vote-yes)",
  no: "var(--color-vote-no)",
  abstain: "var(--color-vote-abstain)",
  no_show: "none",
};

const ML = 240; // left margin for y-labels
const MR = 16; // right margin
const PARTY_BAND_H = 22; // height of the colored party header band
const MEMBER_LABEL_H = 26; // height of the "A. Lastname" label row
const HEADER_H = PARTY_BAND_H + MEMBER_LABEL_H;
const ROW_H = 22;
const COL_W = 64; // minimum column width — enough for "A. Lastname" labels
const MAX_VISIBLE_ROWS = 20;

/** Returns "A. Lastname" abbreviation for a full name. */
function abbreviateName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return name;
  return `${parts[0][0]}. ${parts[parts.length - 1]}`;
}

/** Returns #333 for bright backgrounds (FDP yellow), #fff for dark ones. */
function contrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.55 ? "#333333" : "#ffffff";
}

export function VoteHeatmap({
  votes,
  polls,
  politicians,
  selectedPolIds,
  selectedPollIds,
}: Props) {
  const { ref: containerRef, width } = useContainerWidth();
  const headerSvgRef = useRef<SVGSVGElement>(null);
  const bodySvgRef = useRef<SVGSVGElement>(null);
  const bodyWrapRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (
      !width ||
      !headerSvgRef.current ||
      !bodySvgRef.current ||
      selectedPolIds.length === 0
    )
      return;

    const polMap = new Map(politicians.map((p) => [p.politician_id, p]));
    const pollsToShow =
      selectedPollIds.length > 0
        ? polls.filter((p) => selectedPollIds.includes(p.poll_id))
        : polls;

    // Build vote lookup: politician_id → poll_id → answer
    const voteIndex = new Map<number, Map<number, string>>();
    for (const v of votes) {
      if (!voteIndex.has(v.politician_id))
        voteIndex.set(v.politician_id, new Map());
      voteIndex.get(v.politician_id)!.set(v.poll_id, v.answer);
    }

    // Sort politicians by party (PARTY_ORDER), then alphabetically by name within party
    const partyIndex = Object.fromEntries(PARTY_ORDER.map((p, i) => [p, i]));
    const sortedPolIds = [...selectedPolIds].sort((a, b) => {
      const partyA = stripSoftHyphen(polMap.get(a)?.party ?? "");
      const partyB = stripSoftHyphen(polMap.get(b)?.party ?? "");
      const idxDiff = (partyIndex[partyA] ?? 99) - (partyIndex[partyB] ?? 99);
      if (idxDiff !== 0) return idxDiff;
      return (polMap.get(a)?.name ?? "").localeCompare(
        polMap.get(b)?.name ?? "",
      );
    });

    // x-scale domain: polId strings, so bandwidth lookups are unambiguous
    const xDomain = sortedPolIds.map((id) => String(id));

    // Build consecutive party groups for the two-level header
    const partyGroups: { party: string; color: string; polIds: number[] }[] =
      [];
    for (const polId of sortedPolIds) {
      const party = stripSoftHyphen(polMap.get(polId)?.party ?? "");
      const color = getPartyColor(party);
      const last = partyGroups[partyGroups.length - 1];
      if (last && last.party === party) {
        last.polIds.push(polId);
      } else {
        partyGroups.push({ party, color, polIds: [polId] });
      }
    }

    const yIds = pollsToShow.map((p) => String(p.poll_id));
    const yTopicFull = new Map(
      pollsToShow.map((p) => [String(p.poll_id), p.topic]),
    );
    const yTopicShort = new Map(
      pollsToShow.map((p) => [
        String(p.poll_id),
        p.topic.length > 35 ? p.topic.slice(0, 34) + "…" : p.topic,
      ]),
    );

    const totalWidth = Math.max(width, ML + sortedPolIds.length * COL_W + MR);
    const iW = totalWidth - ML - MR;
    const bodyHeight = ROW_H * pollsToShow.length;

    if (bodyWrapRef.current)
      bodyWrapRef.current.style.width = `${totalWidth}px`;

    const xScale = scaleBand().domain(xDomain).range([0, iW]).padding(0.05);
    const yScale = scaleBand()
      .domain(yIds)
      .range([0, bodyHeight])
      .padding(0.05);

    const tooltip = select(tooltipRef.current!);

    // ── Header SVG: two-level x-axis (party band + member labels) ───────────
    const headerSvg = select(headerSvgRef.current);
    headerSvg.selectAll("*").remove();
    headerSvg.attr("width", totalWidth).attr("height", HEADER_H);

    const headerG = headerSvg
      .append("g")
      .attr("transform", `translate(${ML}, 0)`);

    // Top band: colored rect per party group, clipped to avoid last pixel overlap
    for (const group of partyGroups) {
      const firstX = xScale(String(group.polIds[0])) ?? 0;
      const lastX = xScale(String(group.polIds[group.polIds.length - 1])) ?? 0;
      const bandW = lastX + xScale.bandwidth() - firstX - 1;
      const textColor = contrastColor(group.color);

      headerG
        .append("rect")
        .attr("x", firstX)
        .attr("y", 0)
        .attr("width", bandW)
        .attr("height", PARTY_BAND_H - 2)
        .attr("rx", 3)
        .attr("fill", group.color);

      headerG
        .append("text")
        .attr("x", firstX + bandW / 2)
        .attr("y", PARTY_BAND_H / 2 - 1)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("fill", textColor)
        .attr("font-size", "11px")
        .attr("font-weight", "600")
        .attr("font-family", CHART_FONT_FAMILY)
        .text(getPartyShortLabel(group.party));
    }

    // Bottom row: "A. Lastname" label centered on each column
    for (const polId of sortedPolIds) {
      const pol = polMap.get(polId);
      const label = pol ? abbreviateName(pol.name) : String(polId);
      const x = (xScale(String(polId)) ?? 0) + xScale.bandwidth() / 2;

      headerG
        .append("text")
        .attr("x", x)
        .attr("y", PARTY_BAND_H + MEMBER_LABEL_H / 2 + 1)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("fill", "#374151")
        .attr("font-size", "11px")
        .attr("font-family", CHART_FONT_FAMILY)
        .text(label);
    }

    // ── Body SVG: y-axis + cells ─────────────────────────────────────────────
    const bodySvg = select(bodySvgRef.current);
    bodySvg.selectAll("*").remove();
    bodySvg.attr("width", totalWidth).attr("height", bodyHeight);

    // Y axis
    bodySvg
      .append("g")
      .attr("transform", `translate(${ML}, 0)`)
      .call(
        axisLeft(yScale)
          .tickSize(0)
          .tickFormat((id) => yTopicShort.get(id) ?? id),
      )
      .call((ax) => ax.select(".domain").remove())
      .call((ax) => {
        styleAxisText(ax);
        ax.selectAll<SVGTextElement, string>("text")
          .style("cursor", "default")
          .on("mousemove", function (event, id) {
            const full = yTopicFull.get(id);
            if (!full) return;
            const [px, py] = pointer(event, containerRef.current!);
            tooltip
              .style("opacity", "1")
              .style("left", `${px + TOOLTIP_DX}px`)
              .style("top", `${py + TOOLTIP_DY}px`)
              .html(full);
          })
          .on("mouseleave", () => tooltip.style("opacity", "0"));
      });

    // Cells
    const g = bodySvg.append("g").attr("transform", `translate(${ML}, 0)`);

    type Cell = { polId: number; pollId: number; answer: string };
    const cells: Cell[] = [];
    pollsToShow.forEach((poll) => {
      sortedPolIds.forEach((polId) => {
        const answer = voteIndex.get(polId)?.get(poll.poll_id) ?? "no_show";
        cells.push({ polId, pollId: poll.poll_id, answer });
      });
    });

    g.selectAll<SVGRectElement, Cell>("rect.cell")
      .data(cells)
      .join("rect")
      .attr("class", "cell")
      .attr("x", (d) => xScale(String(d.polId)) ?? 0)
      .attr("y", (d) => yScale(String(d.pollId)) ?? 0)
      .attr("width", xScale.bandwidth())
      .attr("height", yScale.bandwidth())
      .attr("fill", (d) => VOTE_COLOR[d.answer] ?? VOTE_COLOR.no_show)
      .attr("stroke", "#fff")
      .attr("stroke-width", 2)
      .on("mousemove", (event, d) => {
        if (d.answer === "no_show") return;
        const meta = VOTE_META[d.answer as keyof typeof VOTE_META];
        const pol = polMap.get(d.polId);
        const name = pol ? pol.name : String(d.polId);
        const party = pol ? getPartyShortLabel(pol.party) : "";
        const topic = yTopicFull.get(String(d.pollId)) ?? "";
        const [px, py] = pointer(event, containerRef.current!);
        tooltip
          .style("opacity", "1")
          .style("left", `${px + TOOLTIP_DX}px`)
          .style("top", `${py + TOOLTIP_DY}px`)
          .html(
            `<b>${meta.label}</b><br/>${name} · ${getPartyShortLabel(party)}<br/><span style="font-size:0.85em">${topic}</span>`,
          );
      })
      .on("mouseleave", () => tooltip.style("opacity", "0"));
  }, [
    containerRef,
    votes,
    polls,
    politicians,
    selectedPolIds,
    selectedPollIds,
    width,
  ]);

  void VOTE_NUMERIC; // imported for potential future use

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label="Abstimmungsmatrix: Wie Abgeordnete bei ausgewählten Abstimmungen votiert haben"
      style={{ position: "relative" }}
    >
      {/* Single horizontal scroll wrapper — header and body scroll left/right together */}
      <div style={{ overflowX: "auto" }}>
        {/* Header: outside the vertical scroll area, so it never moves up */}
        <div style={{ background: "#fff" }}>
          <svg ref={headerSvgRef} style={{ display: "block" }} />
        </div>
        {/* Body: only this scrolls vertically */}
        <div
          ref={bodyWrapRef}
          style={{
            overflowY: "auto",
            overflowX: "hidden",
            maxHeight: MAX_VISIBLE_ROWS * ROW_H,
          }}
        >
          <svg ref={bodySvgRef} style={{ display: "block" }} />
        </div>
      </div>
      <ChartTooltip tooltipRef={tooltipRef} maxWidth={280} zIndex={50} />
    </div>
  );
}
