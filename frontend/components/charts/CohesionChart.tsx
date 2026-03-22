'use client'
import { useRef, useEffect } from 'react'
import * as d3 from 'd3'
import { useContainerWidth } from '@/hooks/useContainerWidth'
import { CohesionRecord } from '@/lib/data'
import { PARTY_COLORS, FALLBACK_COLOR } from '@/lib/constants'

interface Props {
  cohesion: CohesionRecord[]
  height?: number
}

const M_FIXED = { right: 16, top: 8, bottom: 8 }

export function CohesionChart({ cohesion, height = 300 }: Props) {
  const { ref: containerRef, width } = useContainerWidth()
  const svgRef = useRef<SVGSVGElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!width || !svgRef.current) return
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    // Measure longest label to set left margin dynamically
    const sorted = [...cohesion].sort((a, b) => b.streuung - a.streuung)
    const labels = sorted.map(c => c.label)
    const maxLabelWidth = labels.reduce((max, l) => Math.max(max, l.length * 7), 0)
    const M = { ...M_FIXED, left: maxLabelWidth + 8 }

    const iW = width - M.left - M.right
    const iH = height - M.top - M.bottom
    svg.attr('width', width).attr('height', height)

    const g = svg.append('g').attr('transform', `translate(${M.left},${M.top})`)

    const xMax = d3.max(sorted, c => c.streuung) ?? 1

    const xScale = d3.scaleLinear().domain([0, xMax * 1.05]).range([0, iW])
    const yScale = d3.scaleBand().domain(labels).range([0, iH]).padding(0.3)

    g.append('g')
      .call(d3.axisLeft(yScale).tickSize(0))
      .call(ax => ax.select('.domain').remove())
      .call(ax => ax.selectAll('text').style('font-size', '11px'))

    const tooltip = d3.select(tooltipRef.current!)

    g.selectAll<SVGRectElement, CohesionRecord>('rect')
      .data(sorted)
      .join('rect')
      .attr('x', 0)
      .attr('y', d => yScale(d.label) ?? 0)
      .attr('width', d => xScale(d.streuung))
      .attr('height', yScale.bandwidth())
      .attr('fill', d => PARTY_COLORS[d.label] ?? FALLBACK_COLOR)
      .attr('rx', 2)
      .on('mousemove', (event, d) => {
        tooltip
          .style('opacity', '1')
          .style('left', `${event.clientX + 12}px`)
          .style('top', `${event.clientY - 28}px`)
          .html(`<b>${d.label}</b><br/>Ø Abstand: ${d.streuung.toFixed(3)}`)
      })
      .on('mouseleave', () => tooltip.style('opacity', '0'))
  }, [cohesion, height, width])

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <svg ref={svgRef} style={{ display: 'block', width: '100%' }} />
      <div
        ref={tooltipRef}
        style={{
          position: 'fixed', pointerEvents: 'none',
          background: 'rgba(0,0,0,0.78)', color: '#fff',
          padding: '4px 8px', borderRadius: 4, fontSize: 12,
          opacity: 0, transition: 'opacity 0.1s', whiteSpace: 'nowrap', zIndex: 10,
        }}
      />
    </div>
  )
}
