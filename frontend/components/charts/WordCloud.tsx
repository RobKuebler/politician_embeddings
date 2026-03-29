"use client";
import { useRef, useEffect } from "react";
import * as d3 from "d3";
import cloud from "d3-cloud";
import { useContainerWidth } from "@/hooks/useContainerWidth";
import { WordFreqEntry } from "@/lib/data";

interface Props {
  words: WordFreqEntry[];
  color: string;
  height?: number;
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

export function WordCloud({ words, color, height = 200 }: Props) {
  const { ref: containerRef, width } = useContainerWidth();
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!width || !svgRef.current || words.length === 0) return;

    // Map tfidf values to font sizes and rank to opacity so prominent words stand out.
    const maxTfidf = d3.max(words, (w) => w.tfidf) ?? 1;
    const fontScale = d3.scaleLinear().domain([0, maxTfidf]).range([11, 34]);
    const opacityScale = d3
      .scaleLinear()
      .domain([1, words.length])
      .range([1.0, 0.4]);

    // Parse the base color once; fall back to a neutral grey if the color string is invalid.
    const baseColor = (d3.color(color) ?? d3.color("#888888"))! as d3.RGBColor;

    const layout = cloud<CloudWord>()
      .size([width, height])
      .words(
        words.map((w) => ({ ...w, text: w.wort, size: fontScale(w.tfidf) })),
      )
      .padding(3)
      .rotate(0)
      .font("Plus Jakarta Sans")
      .fontSize((d) => d.size ?? 11)
      .on("end", draw);

    layout.start();

    function draw(placed: CloudWord[]) {
      if (!svgRef.current) return;
      const svg = d3.select(svgRef.current);
      svg.selectAll("*").remove();
      svg
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", `translate(${width / 2},${height / 2})`)
        .selectAll<SVGTextElement, CloudWord>("text")
        .data(placed)
        .join("text")
        .style("font-size", (d) => `${d.size}px`)
        .style("font-family", "Plus Jakarta Sans, sans-serif")
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
        .text((d) => d.text ?? "");
    }
  }, [width, height, words, color]);

  return (
    <div ref={containerRef} className="w-full" style={{ height }}>
      <svg ref={svgRef} style={{ display: "block" }} />
    </div>
  );
}
