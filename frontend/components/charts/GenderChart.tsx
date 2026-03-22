'use client'
import { useRef, useEffect } from 'react'
import * as d3 from 'd3'
import { useContainerWidth } from '@/hooks/useContainerWidth'

interface SexRecord { party_label: string; geschlecht: string; count: number; pct: number }

const GENDERS = ['Männlich', 'Weiblich', 'Divers'] as const
const GENDER_COLORS: Record<string, string> = {
  'Männlich': '#4C9BE8',
  'Weiblich': '#E87E9B',
  'Divers': '#9B59B6',
}
const M = { left: 48, right: 16, top: 16, bottom: 56 }
const H = 300

export function GenderChart({ data, parties }: { data: SexRecord[]; parties: string[] }) {
  const { ref: containerRef, width } = useContainerWidth()
  const svgRef = useRef<SVGSVGElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!width || !svgRef.current) return
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const iW = width - M.left - M.right
    const iH = H - M.top - M.bottom
    svg.attr('width', width).attr('height', H)

    const g = svg.append('g').attr('transform', `translate(${M.left},${M.top})`)

    const xScale = d3.scaleBand().domain(parties).range([0, iW]).padding(0.25)
    const yScale = d3.scaleLinear().domain([0, 100]).range([iH, 0])

    g.append('g')
      .attr('transform', `translate(0,${iH})`)
      .call(d3.axisBottom(xScale).tickSize(0))
      .call(ax => ax.select('.domain').remove())
      .call(ax => ax.selectAll('text').style('font-size', '11px'))

    g.append('g')
      .call(d3.axisLeft(yScale).ticks(5).tickFormat(d => `${d}%`))
      .call(ax => ax.select('.domain').remove())
      .call(ax => ax.selectAll('.tick line').attr('stroke', '#eee'))

    const tooltip = d3.select(tooltipRef.current!)

    // Build stacked segments per party
    parties.forEach(party => {
      let y0 = 0
      GENDERS.forEach(gender => {
        const row = data.find(r => r.party_label === party && r.geschlecht === gender)
        const pct = row ? Math.round(row.pct) : 0
        const y1 = y0 + pct
        g.append('rect')
          .attr('x', xScale(party) ?? 0)
          .attr('y', yScale(y1))
          .attr('width', xScale.bandwidth())
          .attr('height', Math.max(0, yScale(y0) - yScale(y1)))
          .attr('fill', GENDER_COLORS[gender])
          .on('mousemove', (event) => {
            tooltip
              .style('opacity', '1')
              .style('left', `${event.clientX + 12}px`)
              .style('top', `${event.clientY - 28}px`)
              .html(`<b>${gender}</b><br/>${party}: ${pct}%`)
          })
          .on('mouseleave', () => tooltip.style('opacity', '0'))
        y0 = y1
      })
    })

    // Legend
    const legend = svg.append('g').attr('transform', `translate(${M.left},${H - 20})`)
    GENDERS.forEach((gender, i) => {
      legend.append('rect').attr('x', i * 90).attr('y', 0).attr('width', 12).attr('height', 12).attr('fill', GENDER_COLORS[gender])
      legend.append('text').attr('x', i * 90 + 16).attr('y', 10).style('font-size', '11px').text(gender)
    })
  }, [data, parties, width])

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
