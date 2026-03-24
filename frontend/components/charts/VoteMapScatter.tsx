"use client";
import React, { useRef, useEffect, useState } from "react";
import * as d3 from "d3";
import { EmbeddingPoint, Politician } from "@/lib/data";
import {
  PARTY_COLORS,
  FALLBACK_COLOR,
  DARK_FILL_PARTY,
  MARKER_OUTLINE,
} from "@/lib/constants";

type Mode = "pan" | "rect" | "lasso";

interface Props {
  embeddings: EmbeddingPoint[];
  politicians: Politician[];
  selectedIds: number[];
  onSelectionChange: (ids: number[]) => void;
  height?: number;
}

const M = { left: 0, right: 0, top: 0, bottom: 0 };

export function VoteMapScatter({
  embeddings,
  politicians,
  selectedIds,
  onSelectionChange,
  height = 600,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [mode, setMode] = useState<Mode>("pan");

  // Stable refs so event handlers always see latest values
  const selectedIdsRef = useRef(selectedIds);
  useEffect(() => {
    selectedIdsRef.current = selectedIds;
  }, [selectedIds]);
  const modeRef = useRef<Mode>("pan");
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  const onChangeRef = useRef(onSelectionChange);
  useEffect(() => {
    onChangeRef.current = onSelectionChange;
  }, [onSelectionChange]);

  // D3 state shared across effects
  const transformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  const xScaleRef = useRef<d3.ScaleLinear<number, number> | null>(null);
  const yScaleRef = useRef<d3.ScaleLinear<number, number> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const brushRef = useRef<d3.BrushBehavior<unknown> | null>(null);
  const brushGRef = useRef<SVGGElement | null>(null);
  const allPointsRef = useRef<EmbeddingPoint[]>([]);

  // Width measurement
  useEffect(() => {
    if (!containerRef.current) return;
    setWidth(containerRef.current.clientWidth);
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Main draw effect: full SVG setup (runs when data or dimensions change)
  useEffect(() => {
    if (!width || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const iW = width - M.left - M.right;
    const iH = height - M.top - M.bottom;
    svg.attr("width", width).attr("height", height);

    // Compute scales from embedding extents
    const xExt = d3.extent(embeddings, (d) => d.x) as [number, number];
    const yExt = d3.extent(embeddings, (d) => d.y) as [number, number];
    const xPad = (xExt[1] - xExt[0]) * 0.05;
    const yPad = (yExt[1] - yExt[0]) * 0.05;
    const xScale = d3
      .scaleLinear()
      .domain([xExt[0] - xPad, xExt[1] + xPad])
      .range([0, iW]);
    const yScale = d3
      .scaleLinear()
      .domain([yExt[0] - yPad, yExt[1] + yPad])
      .range([iH, 0]);
    xScaleRef.current = xScale;
    yScaleRef.current = yScale;

    // Clip path so dots don't overflow chart area
    svg
      .append("defs")
      .append("clipPath")
      .attr("id", "scatter-clip")
      .append("rect")
      .attr("width", iW)
      .attr("height", iH);

    // Content group — zoom transform is applied here; clip-path keeps dots inside chart
    const contentG = svg
      .append("g")
      .attr("class", "scatter-content")
      .attr("transform", `translate(${M.left},${M.top})`)
      .attr("clip-path", "url(#scatter-clip)");

    // Unclipped layer for centroid labels so they're never cropped at chart edges
    const labelsG = svg
      .append("g")
      .attr("class", "centroid-labels")
      .attr("transform", `translate(${M.left},${M.top})`);

    // Group embeddings by party for rendering
    const polMap = new Map(politicians.map((p) => [p.politician_id, p]));
    const seriesByParty = new Map<string, EmbeddingPoint[]>();
    for (const pt of embeddings) {
      const party =
        polMap.get(pt.politician_id)?.party.replace(/\u00ad/g, "") ??
        "fraktionslos";
      if (!seriesByParty.has(party)) seriesByParty.set(party, []);
      seriesByParty.get(party)!.push(pt);
    }
    allPointsRef.current = embeddings;

    const selectedSet = new Set(selectedIdsRef.current);
    const hasSelection = selectedSet.size > 0;

    // Draw one circle per embedding point, grouped by party
    for (const [party, points] of seriesByParty) {
      const partyColor = PARTY_COLORS[party] ?? FALLBACK_COLOR;
      const borderColor =
        party === DARK_FILL_PARTY ? "rgba(255,255,255,0.5)" : MARKER_OUTLINE;

      const partyCls = "dot-" + party.replace(/\W/g, "_");
      contentG
        .selectAll<SVGCircleElement, EmbeddingPoint>("." + partyCls)
        .data(points)
        .join("circle")
        .attr("class", "dot " + partyCls)
        .attr("data-polid", (d) => d.politician_id)
        .attr("data-party", party)
        .attr("cx", (d) => xScale(d.x))
        .attr("cy", (d) => yScale(d.y))
        .attr("r", 4)
        .attr("fill", (d) =>
          !hasSelection || selectedSet.has(d.politician_id)
            ? partyColor
            : "#cccccc",
        )
        .attr("opacity", (d) =>
          !hasSelection || selectedSet.has(d.politician_id) ? 0.82 : 0.3,
        )
        .attr("stroke", (d) =>
          !hasSelection || selectedSet.has(d.politician_id)
            ? borderColor
            : "transparent",
        )
        .attr("stroke-width", 1)
        .style("cursor", "pointer")
        .on("mousemove", (event, d) => {
          const pol = polMap.get(d.politician_id);
          if (!pol) return;
          const [px, py] = d3.pointer(event, containerRef.current!);
          d3.select(tooltipRef.current!)
            .style("opacity", "1")
            .style("left", `${px + 12}px`)
            .style("top", `${py - 28}px`)
            .html(
              `<b>${pol.name}</b><br/><span style="color:#bbb">${pol.party.replace(/\u00ad/g, "")}</span>`,
            );
        })
        .on("mouseleave", () =>
          d3.select(tooltipRef.current!).style("opacity", "0"),
        )
        .on("click", (event, d) => {
          if (modeRef.current !== "pan") return;
          event.stopPropagation();
          const current = selectedIdsRef.current;
          const next = current.includes(d.politician_id)
            ? current.filter((x) => x !== d.politician_id)
            : [...current, d.politician_id];
          onChangeRef.current(next);
        });
    }

    // Draw party centroids (after dots so they render on top)
    for (const [party, points] of seriesByParty) {
      if (points.length < 2) continue;
      const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
      const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
      const partyColor = PARTY_COLORS[party] ?? FALLBACK_COLOR;
      const sx = xScale(cx);
      const sy = yScale(cy);
      const arm = 6;

      const cg = contentG
        .append("g")
        .attr("class", "centroid")
        .attr("transform", `translate(${sx},${sy})`)
        .style("cursor", "default");

      // Filled circle background for legibility
      cg.append("circle")
        .attr("r", arm + 2)
        .attr("fill", "#fff")
        .attr("opacity", 0.7);

      // Cross arms
      cg.append("line")
        .attr("x1", -arm)
        .attr("y1", 0)
        .attr("x2", arm)
        .attr("y2", 0)
        .attr("stroke", partyColor)
        .attr("stroke-width", 2.5)
        .attr("stroke-linecap", "round");
      cg.append("line")
        .attr("x1", 0)
        .attr("y1", -arm)
        .attr("x2", 0)
        .attr("y2", arm)
        .attr("stroke", partyColor)
        .attr("stroke-width", 2.5)
        .attr("stroke-linecap", "round");

      // Outer ring
      cg.append("circle")
        .attr("r", arm + 2)
        .attr("fill", "none")
        .attr("stroke", partyColor)
        .attr("stroke-width", 1.5);

      // Adaptive text-anchor: labels near edges stay within the SVG boundary
      const halfLabelW = (party.length * 6.5) / 2;
      const edgeAnchor =
        sx <= halfLabelW ? "start" : sx >= iW - halfLabelW ? "end" : "middle";
      // Party label in the unclipped layer so it's never cropped at chart edges
      labelsG
        .append("text")
        .attr("x", sx)
        .attr("y", sy - (arm + 8))
        .attr("text-anchor", edgeAnchor)
        .style("font-size", "11px")
        .style("font-weight", "700")
        .style("fill", partyColor)
        .style("paint-order", "stroke")
        .style("stroke", "#fff")
        .style("stroke-width", "3px")
        .style("stroke-linejoin", "round")
        .style("pointer-events", "none")
        .text(party);

      cg.style("cursor", "pointer")
        .on("click", (event) => {
          event.stopPropagation();
          const partyIds = new Set(points.map((pt) => pt.politician_id));
          const existing = selectedIdsRef.current;
          const allSelected = points.every((pt) =>
            existing.includes(pt.politician_id),
          );
          const next = allSelected
            ? existing.filter((id) => !partyIds.has(id))
            : [...new Set([...existing, ...partyIds])];
          onChangeRef.current(next);
        })
        .on("mousemove", (event) => {
          const [px, py] = d3.pointer(event, containerRef.current!);
          d3.select(tooltipRef.current!)
            .style("opacity", "1")
            .style("left", `${px + 12}px`)
            .style("top", `${py - 28}px`)
            .html(`<b>${party}</b> – Klicken zum Auswählen`);
        })
        .on("mouseleave", () =>
          d3.select(tooltipRef.current!).style("opacity", "0"),
        );
    }

    // Click on background (pan mode) clears selection
    svg.on("click.background", (event) => {
      if (modeRef.current !== "pan") return;
      if ((event.target as Element).closest(".dot")) return;
      onChangeRef.current([]);
    });

    // Zoom behavior for pan mode
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 20])
      .on("zoom", (event) => {
        transformRef.current = event.transform;
        const tx = `translate(${M.left + event.transform.x},${M.top + event.transform.y}) scale(${event.transform.k})`;
        contentG.attr("transform", tx);
        labelsG.attr("transform", tx);
      });
    zoomRef.current = zoom;

    // Brush group (sits above content, below lasso path)
    const brushG = svg
      .append("g")
      .attr("class", "brush-group")
      .attr("transform", `translate(${M.left},${M.top})`);
    brushGRef.current = brushG.node()!;

    // Rect-selection brush behavior
    const brush = d3
      .brush()
      .extent([
        [0, 0],
        [iW, iH],
      ])
      .on("end", (event) => {
        if (!event.selection) return;
        const [[x0, y0], [x1, y1]] = event.selection as [
          [number, number],
          [number, number],
        ];
        const t = transformRef.current;
        // Invert zoom transform to find which data-space points fall inside the brush
        const xMin = t.invertX(x0),
          xMax = t.invertX(x1);
        const yMin = t.invertY(y0),
          yMax = t.invertY(y1);
        const ids = allPointsRef.current
          .filter((pt) => {
            const px = xScaleRef.current!(pt.x);
            const py = yScaleRef.current!(pt.y);
            return px >= xMin && px <= xMax && py >= yMin && py <= yMax;
          })
          .map((pt) => pt.politician_id);
        onChangeRef.current([...new Set(ids)]);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        d3.select(brushGRef.current!).call(brush.clear as any);
      });
    brushRef.current = brush;

    // Lasso state + path element
    let lassoPoints: [number, number][] = [];
    const lassoPath = svg
      .append("path")
      .attr("class", "lasso-path")
      .attr("transform", `translate(${M.left},${M.top})`)
      .attr("fill", "rgba(0,0,0,0.06)")
      .attr("stroke", "rgba(80,80,80,0.7)")
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "5,3")
      .attr("pointer-events", "none");

    svg.on("mousedown.lasso", (event) => {
      if (modeRef.current !== "lasso") return;
      event.preventDefault();
      const [mx, my] = d3.pointer(event);
      lassoPoints = [[mx - M.left, my - M.top]];
    });
    svg.on("mousemove.lasso", (event) => {
      if (modeRef.current !== "lasso" || lassoPoints.length === 0) return;
      const [mx, my] = d3.pointer(event);
      lassoPoints.push([mx - M.left, my - M.top]);
      lassoPath.attr(
        "d",
        `M${lassoPoints.map(([x, y]) => `${x},${y}`).join("L")}Z`,
      );
    });
    svg.on("mouseup.lasso", () => {
      if (modeRef.current !== "lasso" || lassoPoints.length < 3) {
        lassoPoints = [];
        lassoPath.attr("d", "");
        return;
      }
      // Find dots whose screen position (in brush-group space) is inside the lasso polygon
      const t = transformRef.current;
      const ids = allPointsRef.current
        .filter((pt) =>
          d3.polygonContains(lassoPoints, [
            t.applyX(xScaleRef.current!(pt.x)),
            t.applyY(yScaleRef.current!(pt.y)),
          ]),
        )
        .map((pt) => pt.politician_id);
      onChangeRef.current([...new Set(ids)]);
      lassoPoints = [];
      lassoPath.attr("d", "");
    });

    // Apply the current mode's interaction behavior
    applyInteraction(svg, modeRef.current, zoom, brush, brushG);

    // Restore zoom position if we had one
    if (transformRef.current !== d3.zoomIdentity) {
      svg.call(zoom.transform, transformRef.current);
    }
  }, [embeddings, politicians, width, height]);

  // Mode effect: swaps interaction behaviors without redrawing
  useEffect(() => {
    if (
      !svgRef.current ||
      !zoomRef.current ||
      !brushRef.current ||
      !brushGRef.current
    )
      return;
    applyInteraction(
      d3.select(svgRef.current),
      mode,
      zoomRef.current,
      brushRef.current,
      d3.select(brushGRef.current),
    );
  }, [mode]);

  // Selection update effect: re-styles dots without full redraw (preserves zoom)
  useEffect(() => {
    if (!svgRef.current) return;
    const selectedSet = new Set(selectedIds);
    const hasSelection = selectedSet.size > 0;
    d3.select(svgRef.current)
      .selectAll<SVGCircleElement, unknown>(".dot")
      .each(function () {
        const el = d3.select(this);
        const polId = Number(el.attr("data-polid"));
        const party = el.attr("data-party");
        const partyColor = PARTY_COLORS[party] ?? FALLBACK_COLOR;
        const borderColor =
          party === DARK_FILL_PARTY ? "rgba(255,255,255,0.5)" : MARKER_OUTLINE;
        const sel = !hasSelection || selectedSet.has(polId);
        el.attr("fill", sel ? partyColor : "#cccccc")
          .attr("opacity", sel ? 0.82 : 0.3)
          .attr("stroke", sel ? borderColor : "transparent");
      });
  }, [selectedIds]);

  const BUTTONS: {
    m: Mode;
    label: string;
    icon: React.ReactNode;
    hint: string;
  }[] = [
    {
      m: "pan",
      label: "Pan",
      hint: "Verschieben & Zoomen",
      icon: (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" />
        </svg>
      ),
    },
    {
      m: "rect",
      label: "Rechteck",
      hint: "Rechteck-Auswahl",
      icon: (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect
            x="3"
            y="3"
            width="18"
            height="18"
            rx="2"
            strokeDasharray="4 2"
          />
        </svg>
      ),
    },
    {
      m: "lasso",
      label: "Lasso",
      hint: "Freihand-Auswahl",
      icon: (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path
            d="M12 4C7 4 3 7.5 3 11c0 2.5 1.5 4.5 4 5.5l1 3.5 2-2 2 2 1-3.5c2.5-1 4-3 4-5.5 0-3.5-4-7-5-7z"
            strokeDasharray="3 2"
          />
        </svg>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className="flex items-center bg-[#F4F3F0] rounded-lg p-0.5 border border-[#E3E0DA]">
          {BUTTONS.map(({ m, label, icon, hint }) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              title={hint}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 cursor-pointer ${
                mode === m
                  ? "bg-white text-[#2347C8] shadow-sm border border-[#E3E0DA]"
                  : "text-[#6B6760] hover:text-[#171613]"
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
      </div>
      <div ref={containerRef} style={{ position: "relative" }}>
        <svg
          ref={svgRef}
          style={{
            display: "block",
            width: "100%",
            overflow: "visible",
            cursor: mode === "pan" ? "grab" : "crosshair",
          }}
        />
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
    </div>
  );
}

/** Applies the correct D3 interaction behavior for the given mode. */
function applyInteraction(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  mode: Mode,
  zoom: d3.ZoomBehavior<SVGSVGElement, unknown>,
  brush: d3.BrushBehavior<unknown>,
  brushG: d3.Selection<SVGGElement, unknown, null, undefined>,
) {
  // Tear down both behaviors first
  svg.on(".zoom", null);
  brushG.selectAll("*").remove();

  if (mode === "pan") {
    svg.call(zoom);
  } else if (mode === "rect") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    brushG.call(brush as any);
  }
  // lasso: mouse events are already registered on the SVG via .lasso namespace
}
