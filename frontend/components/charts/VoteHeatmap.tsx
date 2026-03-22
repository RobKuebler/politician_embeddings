'use client'
import { useRef, useEffect } from 'react'
import * as d3 from 'd3'
import { useContainerWidth } from '@/hooks/useContainerWidth'
import { VoteRecord, Poll, Politician } from '@/lib/data'
import { VOTE_META, VOTE_NUMERIC } from '@/lib/constants'

interface Props {
  votes: VoteRecord[]
  polls: Poll[]
  politicians: Politician[]
  selectedPolIds: number[]
  selectedPollIds: number[]
}

const VOTE_COLOR: Record<string, string> = {
  yes: '#46962B',
  no: '#E3000F',
  abstain: '#F5A623',
  no_show: 'none',
}

const ML = 240         // left margin for y-labels
const MR = 180         // right margin to catch rotated x-label overflow
const HEADER_H = 110   // header height — must fit labels rotated -30° upward
const ROW_H = 22       // row height — matches DeviationHeatmap cell height
const COL_W = 80       // minimum column width
const MAX_VISIBLE_ROWS = 20

export function VoteHeatmap({ votes, polls, politicians, selectedPolIds, selectedPollIds }: Props) {
  const { ref: containerRef, width } = useContainerWidth()
  const headerSvgRef = useRef<SVGSVGElement>(null)
  const bodySvgRef = useRef<SVGSVGElement>(null)
  const bodyWrapRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!width || !headerSvgRef.current || !bodySvgRef.current || selectedPolIds.length === 0) return

    const polMap = new Map(politicians.map(p => [p.politician_id, p]))
    const pollsToShow = selectedPollIds.length > 0
      ? polls.filter(p => selectedPollIds.includes(p.poll_id))
      : polls

    // Build vote lookup: politician_id → poll_id → answer
    const voteIndex = new Map<number, Map<number, string>>()
    for (const v of votes) {
      if (!voteIndex.has(v.politician_id)) voteIndex.set(v.politician_id, new Map())
      voteIndex.get(v.politician_id)!.set(v.poll_id, v.answer)
    }

    const xLabels = selectedPolIds.map(id => {
      const pol = polMap.get(id)
      return pol ? `${pol.name} (${pol.party.replace(/\u00ad/g, '')})` : String(id)
    })

    // Use poll_id as scale domain to avoid collisions when truncated topics are identical
    const yIds = pollsToShow.map(p => String(p.poll_id))
    const yTopicFull = new Map(pollsToShow.map(p => [String(p.poll_id), p.topic]))
    const yTopicShort = new Map(pollsToShow.map(p => [
      String(p.poll_id),
      p.topic.length > 35 ? p.topic.slice(0, 34) + '…' : p.topic,
    ]))

    // Ensure minimum column width when many politicians are selected
    const totalWidth = Math.max(width, ML + selectedPolIds.length * COL_W + MR)
    const iW = totalWidth - ML - MR
    const bodyHeight = ROW_H * pollsToShow.length

    // Body wrapper must match totalWidth so overflow-x: hidden doesn't clip cells
    if (bodyWrapRef.current) bodyWrapRef.current.style.width = `${totalWidth}px`

    const xScale = d3.scaleBand().domain(xLabels).range([0, iW]).padding(0.05)
    const yScale = d3.scaleBand().domain(yIds).range([0, bodyHeight]).padding(0.05)

    const tooltip = d3.select(tooltipRef.current!)

    // ── Header SVG: x-axis labels (sticky) ──────────────────────────────────
    const headerSvg = d3.select(headerSvgRef.current)
    headerSvg.selectAll('*').remove()
    headerSvg.attr('width', totalWidth).attr('height', HEADER_H)

    // Axis placed at bottom of header so rotated labels extend upward into the header area
    headerSvg.append('g')
      .attr('transform', `translate(${ML}, ${HEADER_H})`)
      .call(d3.axisTop(xScale).tickSize(0))
      .call(ax => ax.select('.domain').remove())
      .call(ax => ax.selectAll('text')
        .style('font-size', '11px')
        .attr('transform', 'rotate(-30)')
        .attr('text-anchor', 'start')
        .attr('dy', '-0.5em')
        .attr('dx', '0.5em')
      )

    // ── Body SVG: y-axis + cells ─────────────────────────────────────────────
    const bodySvg = d3.select(bodySvgRef.current)
    bodySvg.selectAll('*').remove()
    bodySvg.attr('width', totalWidth).attr('height', bodyHeight)

    // Y axis
    bodySvg.append('g')
      .attr('transform', `translate(${ML}, 0)`)
      .call(d3.axisLeft(yScale).tickSize(0).tickFormat(id => yTopicShort.get(id) ?? id))
      .call(ax => ax.select('.domain').remove())
      .call(ax => ax.selectAll<SVGTextElement, string>('text')
        .style('font-size', '11px')
        .style('cursor', 'default')
        .on('mousemove', function(event, id) {
          const full = yTopicFull.get(id)
          if (!full) return
          tooltip
            .style('opacity', '1')
            .style('left', `${event.clientX + 12}px`)
            .style('top', `${event.clientY - 28}px`)
            .html(full)
        })
        .on('mouseleave', () => tooltip.style('opacity', '0'))
      )

    // Cells
    const g = bodySvg.append('g').attr('transform', `translate(${ML}, 0)`)

    type Cell = { xIdx: number; pollId: number; answer: string }
    const cells: Cell[] = []
    pollsToShow.forEach(poll => {
      selectedPolIds.forEach((polId, xIdx) => {
        const answer = voteIndex.get(polId)?.get(poll.poll_id) ?? 'no_show'
        cells.push({ xIdx, pollId: poll.poll_id, answer })
      })
    })

    g.selectAll<SVGRectElement, Cell>('rect.cell')
      .data(cells)
      .join('rect')
      .attr('class', 'cell')
      .attr('x', d => xScale(xLabels[d.xIdx]) ?? 0)
      .attr('y', d => yScale(String(d.pollId)) ?? 0)
      .attr('width', xScale.bandwidth())
      .attr('height', yScale.bandwidth())
      .attr('fill', d => VOTE_COLOR[d.answer] ?? VOTE_COLOR.no_show)
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .on('mousemove', (event, d) => {
        const meta = VOTE_META[d.answer as keyof typeof VOTE_META]
        tooltip
          .style('opacity', '1')
          .style('left', `${event.clientX + 12}px`)
          .style('top', `${event.clientY - 28}px`)
          .html(`<b>${xLabels[d.xIdx]}</b><br/>${yTopicFull.get(String(d.pollId)) ?? ''}<br/>${meta.label}`)
      })
      .on('mouseleave', () => tooltip.style('opacity', '0'))

  }, [votes, polls, politicians, selectedPolIds, selectedPollIds, width])

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Single horizontal scroll wrapper — header and body scroll left/right together */}
      <div style={{ overflowX: 'auto' }}>
        {/* Header: outside the vertical scroll area, so it never moves up */}
        <div style={{ background: '#fff' }}>
          <svg ref={headerSvgRef} style={{ display: 'block' }} />
        </div>
        {/* Body: only this scrolls vertically */}
        <div ref={bodyWrapRef} style={{ overflowY: 'auto', overflowX: 'hidden', maxHeight: MAX_VISIBLE_ROWS * ROW_H }}>
          <svg ref={bodySvgRef} style={{ display: 'block' }} />
        </div>
      </div>
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
