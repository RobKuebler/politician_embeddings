'use client'
import { useRef, useEffect } from 'react'
import * as d3 from 'd3'
import { useContainerWidth } from '@/hooks/useContainerWidth'
import { DeviationPivot } from '@/lib/data'
import { sortParties } from '@/lib/constants'

interface Props { pivot: DeviationPivot; height?: number }

function truncateAxisLabels(
  ax: d3.Selection<SVGGElement, unknown, null, undefined>,
  maxPx: number,
  tooltip: d3.Selection<HTMLDivElement, unknown, null, undefined>,
) {
  ax.selectAll<SVGTextElement, unknown>('text').each(function () {
    const el = d3.select(this)
    const full = el.text()
    let truncated = full
    while ((this as SVGTextElement).getComputedTextLength() > maxPx && truncated.length > 1) {
      truncated = truncated.slice(0, -1)
      el.text(truncated + '…')
    }
    if (truncated !== full) {
      el.style('cursor', 'default')
        .on('mousemove', (event: MouseEvent) => {
          tooltip
            .style('opacity', '1')
            .style('left', `${event.clientX + 12}px`)
            .style('top', `${event.clientY - 28}px`)
            .html(full)
        })
        .on('mouseleave', () => tooltip.style('opacity', '0'))
    }
  })
}

const ML = 160      // left margin for y-labels
const MR = 40       // right margin — extra room for last label extending rightward
const HEADER_H = 84 // sticky header height — room for rotated party labels
const SCROLL_THRESHOLD = 25

function drawCells(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  cells: { partyIdx: number; catIdx: number; dev: number | null; pct: number | null }[],
  xScale: d3.ScaleBand<string>,
  yScale: d3.ScaleBand<string>,
  pivot: DeviationPivot,
  colorScale: d3.ScaleLinear<string, string>,
  maxDev: number,
  tooltip: d3.Selection<HTMLDivElement, unknown, null, undefined>,
) {
  type Cell = typeof cells[number]

  g.selectAll<SVGRectElement, Cell>('rect.cell')
    .data(cells)
    .join('rect')
    .attr('class', 'cell')
    .attr('x', d => xScale(pivot.parties[d.partyIdx]) ?? 0)
    .attr('y', d => yScale(pivot.categories[d.catIdx]) ?? 0)
    .attr('width', xScale.bandwidth())
    .attr('height', yScale.bandwidth())
    .attr('fill', d => d.dev !== null ? colorScale(d.dev) : 'none')
    .attr('stroke', '#fff')
    .attr('stroke-width', 1)
    .on('mousemove', (event, d) => {
      const cat = pivot.categories[d.catIdx]
      const party = pivot.parties[d.partyIdx]
      let html = `<b>${party}</b><br/>${cat}<br/>`
      html += d.dev === null
        ? 'keine Daten'
        : `Anteil: ${d.pct?.toFixed(1) ?? '?'}%<br/>Abweichung: ${d.dev > 0 ? '+' : ''}${d.dev.toFixed(1)} pp`
      tooltip
        .style('opacity', '1')
        .style('left', `${event.clientX + 12}px`)
        .style('top', `${event.clientY - 28}px`)
        .html(html)
    })
    .on('mouseleave', () => tooltip.style('opacity', '0'))

  const bw = xScale.bandwidth()
  if (bw > 10) {
    const fontSize = bw < 20 ? '7px' : '9px'
    g.selectAll<SVGTextElement, Cell>('text.cell-label')
      .data(cells.filter(c => c.dev !== null))
      .join('text')
      .attr('class', 'cell-label')
      .attr('x', d => (xScale(pivot.parties[d.partyIdx]) ?? 0) + bw / 2)
      .attr('y', d => (yScale(pivot.categories[d.catIdx]) ?? 0) + yScale.bandwidth() / 2)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .style('font-size', fontSize)
      .style('pointer-events', 'none')
      .style('fill', d => Math.abs(d.dev!) > maxDev * 0.5 ? '#fff' : '#333')
      .text(d => `${d.dev! > 0 ? '+' : ''}${d.dev!.toFixed(0)}`)
  }
}

export function DeviationHeatmap({ pivot, height = 400 }: Props) {
  const { ref: containerRef, width } = useContainerWidth()
  const singleSvgRef = useRef<SVGSVGElement>(null)
  const headerSvgRef = useRef<SVGSVGElement>(null)
  const bodySvgRef = useRef<SVGSVGElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  const useScroll = pivot.categories.length >= SCROLL_THRESHOLD

  useEffect(() => {
    if (!width) return

    // Re-order parties by seat count (PARTY_ORDER), fraktionslos always last.
    const sortedParties = sortParties(pivot.parties)
    const colMap = sortedParties.map(p => pivot.parties.indexOf(p))
    const sortedPivot: DeviationPivot = {
      categories: pivot.categories,
      parties: sortedParties,
      pct: pivot.pct.map(row => colMap.map(ci => row[ci] ?? null)),
      dev: pivot.dev.map(row => colMap.map(ci => row[ci] ?? null)),
    }
    // Use sortedPivot everywhere below instead of prop pivot
    const { categories, parties, pct: pctData, dev: devData } = sortedPivot

    const iW = width - ML - MR
    const allDevs = devData.flat().filter((v): v is number => v !== null)
    // Clamp to 95th percentile of absolute deviations so one outlier doesn't
    // wash out all other cells. The scale is clamped so outliers still get
    // the full saturation colour instead of going out-of-range.
    const absDevs = allDevs.map(Math.abs).sort((a, b) => a - b)
    const p95idx = Math.floor(absDevs.length * 0.95)
    const clampMax = Math.max(absDevs[p95idx] ?? absDevs[absDevs.length - 1] ?? 1, 1)
    const colorScale = d3.scaleLinear<string>()
      .domain([-clampMax, 0, clampMax])
      .range(['#d73027', '#f7f7f7', '#4575b4'])
      .clamp(true)

    type Cell = { partyIdx: number; catIdx: number; dev: number | null; pct: number | null }
    const cells: Cell[] = []
    categories.forEach((_, catIdx) => {
      parties.forEach((_, partyIdx) => {
        cells.push({
          partyIdx, catIdx,
          dev: devData[catIdx]?.[partyIdx] ?? null,
          pct: pctData[catIdx]?.[partyIdx] ?? null,
        })
      })
    })

    const tooltip = d3.select(tooltipRef.current!)

    const xAxis = (sel: d3.Selection<SVGGElement, unknown, null, undefined>, xScale: d3.ScaleBand<string>) =>
      sel.call(d3.axisTop(xScale).tickSize(0))
        .call(ax => ax.select('.domain').remove())
        .call(ax => ax.selectAll('text')
          .style('font-size', '10px')
          .attr('transform', 'rotate(-30)')
          .attr('text-anchor', 'start')
          .attr('dy', '-0.4em')
          .attr('dx', '0.4em')
        )

    if (!useScroll) {
      // ── Simple mode: single SVG, no scroll ───────────────────────────────
      if (!singleSvgRef.current) return
      const maxBodyH = height - HEADER_H
      const ROW_H = Math.min(48, Math.max(22, Math.floor(maxBodyH / categories.length)))
      const bodyHeight = ROW_H * categories.length
      const totalH = HEADER_H + bodyHeight

      const xScale = d3.scaleBand().domain(parties).range([0, iW]).padding(0.05)
      const yScale = d3.scaleBand().domain(categories).range([0, bodyHeight]).padding(0.05)

      const svg = d3.select(singleSvgRef.current)
      svg.selectAll('*').remove()
      svg.attr('width', width).attr('height', totalH)

      // X axis at top
      svg.append('g')
        .attr('transform', `translate(${ML}, ${HEADER_H})`)
        .call(sel => xAxis(sel, xScale))

      // Y axis
      svg.append('g')
        .attr('transform', `translate(${ML}, ${HEADER_H})`)
        .call(d3.axisLeft(yScale).tickSize(0))
        .call(ax => ax.select('.domain').remove())
        .call(ax => ax.selectAll('text').style('font-size', '10px'))
        .call(ax => truncateAxisLabels(ax, ML - 8, tooltip))

      const g = svg.append('g').attr('transform', `translate(${ML}, ${HEADER_H})`)
      drawCells(g, cells, xScale, yScale, sortedPivot, colorScale, clampMax, tooltip)

    } else {
      // ── Scroll mode: sticky header SVG + scrolling body SVG ──────────────
      if (!headerSvgRef.current || !bodySvgRef.current) return
      const maxBodyH = height - HEADER_H
      const ROW_H = Math.min(48, Math.max(22, Math.floor(maxBodyH / categories.length)))
      const bodyHeight = ROW_H * categories.length

      const xScale = d3.scaleBand().domain(parties).range([0, iW]).padding(0.05)
      const yScale = d3.scaleBand().domain(categories).range([0, bodyHeight]).padding(0.05)

      const headerSvg = d3.select(headerSvgRef.current)
      headerSvg.selectAll('*').remove()
      headerSvg.attr('width', width).attr('height', HEADER_H)
      headerSvg.append('g')
        .attr('transform', `translate(${ML}, ${HEADER_H})`)
        .call(sel => xAxis(sel, xScale))

      const bodySvg = d3.select(bodySvgRef.current)
      bodySvg.selectAll('*').remove()
      bodySvg.attr('width', width).attr('height', bodyHeight)
      bodySvg.append('g')
        .attr('transform', `translate(${ML}, 0)`)
        .call(d3.axisLeft(yScale).tickSize(0))
        .call(ax => ax.select('.domain').remove())
        .call(ax => ax.selectAll('text').style('font-size', '10px'))
        .call(ax => truncateAxisLabels(ax, ML - 8, tooltip))

      const g = bodySvg.append('g').attr('transform', `translate(${ML}, 0)`)
      drawCells(g, cells, xScale, yScale, sortedPivot, colorScale, clampMax, tooltip)
    }
  }, [pivot, height, width, useScroll])

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {!useScroll ? (
        // Simple: single SVG, no scroll, overflow visible for rotated labels
        <svg ref={singleSvgRef} style={{ display: 'block', overflow: 'visible' }} />
      ) : (
        // Scroll: sticky header + scrolling body
        <div style={{ overflowX: 'auto' }}>
          <div style={{ background: '#fff', position: 'sticky', top: 0, zIndex: 1, overflow: 'visible' }}>
            <svg ref={headerSvgRef} style={{ display: 'block', overflow: 'visible' }} />
          </div>
          <div style={{ overflowY: 'auto', overflowX: 'hidden', maxHeight: height - HEADER_H }}>
            <svg ref={bodySvgRef} style={{ display: 'block' }} />
          </div>
        </div>
      )}
      <div
        ref={tooltipRef}
        style={{
          position: 'fixed', pointerEvents: 'none',
          background: 'rgba(0,0,0,0.78)', color: '#fff',
          padding: '4px 8px', borderRadius: 4, fontSize: 12,
          opacity: 0, transition: 'opacity 0.1s', zIndex: 50,
          maxWidth: 280,
        }}
      />
    </div>
  )
}
