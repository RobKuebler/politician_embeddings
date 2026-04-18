"use client";
import { useRef, useEffect, memo } from "react";
import { max, scaleLinear, color as d3Color, select, type RGBColor } from "d3";
import cloud from "d3-cloud";
import { useContainerWidth } from "@/hooks/useContainerWidth";
import { WordFreqEntry } from "@/lib/data";
import { CHART_FONT_FAMILY } from "@/lib/constants";

interface Props {
  words: WordFreqEntry[];
  color: string;
  height?: number;
  onClick?: () => void;
  // Delay in ms before the layout starts — stagger multiple clouds to avoid
  // event-loop contention from concurrent d3-cloud setTimeout steps.
  startDelay?: number;
}

// Minimal shape of a d3-cloud Word (mirrors the d3-cloud internal interface).
interface CloudWordBase {
  text?: string;
  size?: number;
  rotate?: number;
  x?: number;
  y?: number;
}

// Combines WordFreqEntry with the d3-cloud Word shape for layout computation.
type CloudWord = WordFreqEntry & CloudWordBase;

// Deterministic PRNG (mulberry32) so the cloud layout is stable across renders.
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

// Wrapped in memo: onClick changes reference on every parent render (expandedParty
// state), but is not a layout dependency — skip re-renders when only it changes.
export const WordCloud = memo(function WordCloud({
  words,
  color,
  height = 200,
  onClick,
  startDelay = 0,
}: Props) {
  const { ref: containerRef, width } = useContainerWidth();
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!width || !svgRef.current || words.length === 0) return;

    // Map tfidf values to font sizes and rank to opacity so prominent words stand out.
    const maxTfidf = max(words, (w) => w.tfidf) ?? 1;
    const fontScale = scaleLinear().domain([0, maxTfidf]).range([11, 34]);
    const opacityScale = scaleLinear()
      .domain([1, words.length])
      .range([1.0, 0.4]);

    // Parse the base color once; fall back to a neutral grey if the color string is invalid.
    const baseColor = (d3Color(color) ?? d3Color("#888888"))! as RGBColor;

    const layout = cloud<CloudWord>()
      .size([width, height])
      .words(
        words.map((w) => ({ ...w, text: w.wort, size: fontScale(w.tfidf) })),
      )
      .padding(3)
      .rotate(0)
      .random(mulberry32(42))
      .font("Libre Franklin")
      .fontSize((d) => d.size ?? 11)
      .on("end", draw);

    const startTimer = setTimeout(() => layout.start(), startDelay);

    function draw(placed: CloudWord[]) {
      if (!svgRef.current) return;
      const svg = select(svgRef.current);
      svg.selectAll("*").remove();
      // Words enter staggered: each fades in after the previous one starts,
      // so the cloud builds up word by word instead of popping in all at once.
      svg
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", `translate(${width / 2},${height / 2})`)
        .selectAll<SVGTextElement, CloudWord>("text")
        .data(placed)
        .join("text")
        .style("font-size", (d) => `${d.size}px`)
        .style("font-family", CHART_FONT_FAMILY)
        // Use heavier weight for larger words to increase visual hierarchy.
        .style("font-weight", (d) => ((d.size ?? 0) > 22 ? "800" : "600"))
        .style("fill", (d) => {
          const c = baseColor.copy();
          c.opacity = opacityScale(d.rang);
          return c.formatRgb();
        })
        .attr("text-anchor", "middle")
        .attr(
          "transform",
          (d) => `translate(${d.x ?? 0},${d.y ?? 0})rotate(${d.rotate ?? 0})`,
        )
        .text((d) => d.text ?? "")
        // CSS animation runs on the compositor thread — stays smooth even when
        // the main thread is busy processing other cloud layouts.
        .style(
          "animation",
          (_, i) => `wc-word-in 350ms ease-out ${i * 22}ms both`,
        );
    }
    return () => {
      clearTimeout(startTimer);
      layout.stop();
    };
  }, [width, height, words, color, startDelay]);

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label="Wortwolke der häufigsten Themen und Begriffe"
      className="w-full"
      style={{ height, cursor: onClick ? "zoom-in" : undefined }}
      onClick={onClick}
    >
      <svg ref={svgRef} style={{ display: "block" }} />
    </div>
  );
});
