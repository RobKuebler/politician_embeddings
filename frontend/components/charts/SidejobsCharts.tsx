'use client'
import { useRef, useEffect } from 'react'
import * as d3 from 'd3'
import { useContainerWidth } from '@/hooks/useContainerWidth'
import { SidejobRecord } from '@/lib/data'
import { PARTY_COLORS, FALLBACK_COLOR } from '@/lib/constants'

// ── Shared tooltip div ────────────────────────────────────────────────────────

function Tooltip({ ref: tooltipRef }: { ref: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div
      ref={tooltipRef}
      style={{
        position: 'fixed', pointerEvents: 'none',
        background: 'rgba(0,0,0,0.78)', color: '#fff',
        padding: '4px 8px', borderRadius: 4, fontSize: 12,
        opacity: 0, transition: 'opacity 0.1s', whiteSpace: 'nowrap', zIndex: 10,
      }}
    />
  )
}

// ── Chart 1: Income by party (sum + mean) ─────────────────────────────────────

export function IncomeByPartyChart({ jobs, parties, politicians }: {
  jobs: SidejobRecord[]
  parties: string[]
  politicians: { politician_id: number; name: string; party: string }[]
}) {
  const { ref: containerRef, width } = useContainerWidth()
  const svgSumRef = useRef<SVGSVGElement>(null)
  const svgMeanRef = useRef<SVGSVGElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!width) return
    // Total income per party, divided by all politicians in that party (incl. those with no sidejobs).
    const partySize = new Map<string, number>()
    for (const pol of politicians) {
      const party = pol.party.replace(/\u00ad/g, '')
      partySize.set(party, (partySize.get(party) ?? 0) + 1)
    }
    const totals = parties.map(p =>
      jobs.filter(j => j.party === p).reduce((s, j) => s + j.prorated_income, 0)
    )
    const means = parties.map((p, i) => {
      const n = partySize.get(p) ?? 0
      return n > 0 ? totals[i] / n : 0
    })

    // Draws a vertical bar chart in PARTY_ORDER (seat count order)
    const draw = (svgEl: SVGSVGElement, values: number[]) => {
      const sorted = parties.map((p, i) => ({ party: p, value: values[i] }))

      const M = { left: 60, right: 16, top: 12, bottom: 40 }
      const H = 280
      const iW = width - M.left - M.right
      const iH = H - M.top - M.bottom
      const svg = d3.select(svgEl)
      svg.selectAll('*').remove()
      svg.attr('width', width).attr('height', H)
      const g = svg.append('g').attr('transform', `translate(${M.left},${M.top})`)

      const xScale = d3.scaleBand().domain(sorted.map(d => d.party)).range([0, iW]).padding(0.25)
      const yMax = d3.max(sorted, d => d.value) ?? 1
      const yScale = d3.scaleLinear().domain([0, yMax * 1.05]).range([iH, 0])

      g.append('g')
        .attr('transform', `translate(0,${iH})`)
        .call(d3.axisBottom(xScale).tickSize(0))
        .call(ax => ax.select('.domain').remove())
        .call(ax => ax.selectAll('text').style('font-size', '11px'))

      g.append('g')
        .call(d3.axisLeft(yScale).ticks(4).tickFormat(v => `${((v as number) / 1000).toFixed(0)}k`))
        .call(ax => ax.select('.domain').remove())
        .call(ax => ax.selectAll('.tick line').attr('stroke', '#eee'))

      const tooltip = d3.select(tooltipRef.current!)
      g.selectAll<SVGRectElement, typeof sorted[number]>('rect')
        .data(sorted)
        .join('rect')
        .attr('x', d => xScale(d.party) ?? 0)
        .attr('y', d => yScale(d.value))
        .attr('width', xScale.bandwidth())
        .attr('height', d => Math.max(0, iH - yScale(d.value)))
        .attr('fill', d => PARTY_COLORS[d.party] ?? FALLBACK_COLOR)
        .attr('rx', 2)
        .on('mousemove', (event, d) => {
          tooltip
            .style('opacity', '1')
            .style('left', `${event.clientX + 12}px`)
            .style('top', `${event.clientY - 28}px`)
            .html(`<b>${d.party}</b><br/>${Math.round(d.value).toLocaleString('de')} €`)
        })
        .on('mouseleave', () => tooltip.style('opacity', '0'))
    }

    if (svgSumRef.current) draw(svgSumRef.current, totals)
    if (svgMeanRef.current) draw(svgMeanRef.current, means)
  }, [jobs, parties, politicians, width])

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Summe</p>
          <svg ref={svgSumRef} style={{ display: 'block', width: '100%' }} />
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Ø pro Abgeordnetem</p>
          <svg ref={svgMeanRef} style={{ display: 'block', width: '100%' }} />
        </div>
      </div>
      <Tooltip ref={tooltipRef} />
    </div>
  )
}

// ── Chart 2: Income by category (stacked horizontal bars) ────────────────────

export function IncomeByCategoryChart({ jobs, parties }: { jobs: SidejobRecord[]; parties: string[] }) {
  const { ref: containerRef, width } = useContainerWidth()
  const svgRef = useRef<SVGSVGElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!width || !svgRef.current) return
    const allCats = Array.from(new Set(jobs.map(j => j.category_label)))
    // Build rows first so we can sort by total income descending
    const rows = allCats.map(cat => {
      const row: Record<string, string | number> = { cat }
      parties.forEach(party => {
        row[party] = Math.round(jobs.filter(j => j.party === party && j.category_label === cat).reduce((s, j) => s + j.prorated_income, 0))
      })
      return row
    }).sort((a, b) => {
      const totA = parties.reduce((s, p) => s + (a[p] as number), 0)
      const totB = parties.reduce((s, p) => s + (b[p] as number), 0)
      return totB - totA
    })
    const cats = rows.map(r => r.cat as string)
    const legendRows = Math.ceil(parties.length / 4)
    const legendH = legendRows * 16 + 8
    const H = Math.max(300, cats.length * 36 + 80) + legendH
    const M = { left: 240, right: 16, top: 8, bottom: legendH + 36 }
    const iW = width - M.left - M.right
    const iH = H - M.top - M.bottom

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    svg.attr('width', width).attr('height', H)

    const g = svg.append('g').attr('transform', `translate(${M.left},${M.top})`)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const series = (d3.stack().keys(parties) as any)(rows) as d3.Series<Record<string, string | number>, string>[]
    const xMax = d3.max(series, s => d3.max(s, d => d[1])) ?? 1

    const xScale = d3.scaleLinear().domain([0, xMax * 1.02]).range([0, iW])
    const yScale = d3.scaleBand().domain(cats).range([0, iH]).padding(0.2)

    g.append('g')
      .call(d3.axisLeft(yScale).tickSize(0))
      .call(ax => ax.select('.domain').remove())
      .call(ax => ax.selectAll('text').style('font-size', '10px'))

    g.append('g')
      .attr('transform', `translate(0,${iH})`)
      .call(d3.axisBottom(xScale).ticks(4).tickFormat(v => `${((v as number) / 1000).toFixed(0)}k`))
      .call(ax => ax.select('.domain').remove())

    const tooltip = d3.select(tooltipRef.current!)

    series.forEach(s => {
      const party = s.key
      const cls = `s-${party.replace(/\W/g, '_')}`
      g.selectAll<SVGRectElement, d3.SeriesPoint<Record<string, string | number>>>(`rect.${cls}`)
        .data(s)
        .join('rect')
        .attr('class', cls)
        .attr('y', d => yScale(d.data.cat as string) ?? 0)
        .attr('x', d => xScale(d[0]))
        .attr('height', yScale.bandwidth())
        .attr('width', d => Math.max(0, xScale(d[1]) - xScale(d[0])))
        .attr('fill', PARTY_COLORS[party] ?? FALLBACK_COLOR)
        .on('mousemove', (event, d) => {
          const [x, y] = [event.clientX, event.clientY]
          const val = Math.round(d[1] - d[0])
          tooltip
            .style('opacity', '1')
            .style('left', `${x + 12}px`)
            .style('top', `${y - 28}px`)
            .html(`<b>${party}</b><br/>${d.data.cat}<br/>${val.toLocaleString('de')} €`)
        })
        .on('mouseleave', () => tooltip.style('opacity', '0'))
    })

    // Legend
    const legendG = svg.append('g').attr('transform', `translate(${M.left},${H - legendH})`)
    parties.forEach((party, i) => {
      const lx = (i % 4) * (iW / 4)
      const ly = Math.floor(i / 4) * 16
      legendG.append('rect').attr('x', lx).attr('y', ly).attr('width', 10).attr('height', 10).attr('fill', PARTY_COLORS[party] ?? FALLBACK_COLOR)
      legendG.append('text').attr('x', lx + 14).attr('y', ly + 9).style('font-size', '10px').text(party)
    })
  }, [jobs, parties, width])

  return (
    <div className="overflow-x-auto">
      <div ref={containerRef} style={{ position: 'relative', minWidth: 500 }}>
        <svg ref={svgRef} style={{ display: 'block', width: '100%' }} />
        <Tooltip ref={tooltipRef} />
      </div>
    </div>
  )
}

// ── Chart 3: Top topics (stacked horizontal bars) ─────────────────────────────

export function TopTopicsChart({ jobs, parties }: { jobs: SidejobRecord[]; parties: string[] }) {
  const { ref: containerRef, width } = useContainerWidth()
  const svgRef = useRef<SVGSVGElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!width || !svgRef.current) return

    // Aggregate income per topic per party, take top 15 by total
    const topicMap = new Map<string, Map<string, number>>()
    for (const j of jobs) {
      for (const topic of j.topics) {
        if (!topicMap.has(topic)) topicMap.set(topic, new Map())
        const m = topicMap.get(topic)!
        m.set(j.party, (m.get(j.party) ?? 0) + j.prorated_income)
      }
    }
    const topTopics = Array.from(topicMap.entries())
      .map(([topic, pm]) => ({ topic, total: Array.from(pm.values()).reduce((a, b) => a + b, 0) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 15)
      .map(t => t.topic)

    const legendRows = Math.ceil(parties.length / 4)
    const legendH = legendRows * 16 + 8
    const H = Math.max(300, topTopics.length * 32 + 80) + legendH
    const M = { left: 180, right: 16, top: 8, bottom: legendH + 36 }
    const iW = width - M.left - M.right
    const iH = H - M.top - M.bottom

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    svg.attr('width', width).attr('height', H)

    const g = svg.append('g').attr('transform', `translate(${M.left},${M.top})`)

    const rows = topTopics.map(topic => {
      const row: Record<string, string | number> = { topic }
      parties.forEach(party => {
        row[party] = Math.round(topicMap.get(topic)?.get(party) ?? 0)
      })
      return row
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const series = (d3.stack().keys(parties) as any)(rows) as d3.Series<Record<string, string | number>, string>[]
    const xMax = d3.max(series, s => d3.max(s, d => d[1])) ?? 1

    const xScale = d3.scaleLinear().domain([0, xMax * 1.02]).range([0, iW])
    const yScale = d3.scaleBand().domain(topTopics).range([0, iH]).padding(0.2)

    g.append('g')
      .call(d3.axisLeft(yScale).tickSize(0))
      .call(ax => ax.select('.domain').remove())
      .call(ax => ax.selectAll('text').style('font-size', '10px'))

    g.append('g')
      .attr('transform', `translate(0,${iH})`)
      .call(d3.axisBottom(xScale).ticks(4).tickFormat(v => `${((v as number) / 1000).toFixed(0)}k`))
      .call(ax => ax.select('.domain').remove())

    const tooltip = d3.select(tooltipRef.current!)

    series.forEach(s => {
      const party = s.key
      const cls = `s-${party.replace(/\W/g, '_')}`
      g.selectAll<SVGRectElement, d3.SeriesPoint<Record<string, string | number>>>(`rect.${cls}`)
        .data(s)
        .join('rect')
        .attr('class', cls)
        .attr('y', d => yScale(d.data.topic as string) ?? 0)
        .attr('x', d => xScale(d[0]))
        .attr('height', yScale.bandwidth())
        .attr('width', d => Math.max(0, xScale(d[1]) - xScale(d[0])))
        .attr('fill', PARTY_COLORS[party] ?? FALLBACK_COLOR)
        .on('mousemove', (event, d) => {
          const [x, y] = [event.clientX, event.clientY]
          const val = Math.round(d[1] - d[0])
          tooltip
            .style('opacity', '1')
            .style('left', `${x + 12}px`)
            .style('top', `${y - 28}px`)
            .html(`<b>${party}</b><br/>${d.data.topic}<br/>${val.toLocaleString('de')} €`)
        })
        .on('mouseleave', () => tooltip.style('opacity', '0'))
    })

    const legendG = svg.append('g').attr('transform', `translate(${M.left},${H - legendH})`)
    parties.forEach((party, i) => {
      const lx = (i % 4) * (iW / 4)
      const ly = Math.floor(i / 4) * 16
      legendG.append('rect').attr('x', lx).attr('y', ly).attr('width', 10).attr('height', 10).attr('fill', PARTY_COLORS[party] ?? FALLBACK_COLOR)
      legendG.append('text').attr('x', lx + 14).attr('y', ly + 9).style('font-size', '10px').text(party)
    })
  }, [jobs, parties, width])

  return (
    <div className="overflow-x-auto">
      <div ref={containerRef} style={{ position: 'relative', minWidth: 500 }}>
        <svg ref={svgRef} style={{ display: 'block', width: '100%' }} />
        <Tooltip ref={tooltipRef} />
      </div>
    </div>
  )
}

// ── Chart 4: Top earners (horizontal bars) ────────────────────────────────────

export function TopEarnersChart({
  jobs, politicians, parties,
}: {
  jobs: SidejobRecord[]
  politicians: { politician_id: number; name: string; party: string }[]
  parties: string[]
}) {
  void parties  // available for future filtering
  const { ref: containerRef, width } = useContainerWidth()
  const svgRef = useRef<SVGSVGElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!width || !svgRef.current) return
    const polMap = new Map(politicians.map(p => [p.politician_id, p]))
    const byPol = new Map<number, number>()
    for (const j of jobs) byPol.set(j.politician_id, (byPol.get(j.politician_id) ?? 0) + j.prorated_income)

    const top = Array.from(byPol.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([id, income]) => ({ pol: polMap.get(id), income }))
      .filter(t => t.pol != null) as { pol: NonNullable<ReturnType<typeof polMap.get>>; income: number }[]

    const H = Math.max(300, top.length * 28 + 60)
    const M = { left: 140, right: 24, top: 8, bottom: 40 }
    const iW = width - M.left - M.right
    const iH = H - M.top - M.bottom

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    svg.attr('width', width).attr('height', H)

    const g = svg.append('g').attr('transform', `translate(${M.left},${M.top})`)

    const names = top.map(t => t.pol.name)
    const xMax = d3.max(top, t => t.income) ?? 1

    const xScale = d3.scaleLinear().domain([0, xMax * 1.05]).range([0, iW])
    const yScale = d3.scaleBand().domain(names).range([0, iH]).padding(0.25)

    g.append('g')
      .call(d3.axisLeft(yScale).tickSize(0))
      .call(ax => ax.select('.domain').remove())
      .call(ax => ax.selectAll('text').style('font-size', '11px'))

    g.append('g')
      .attr('transform', `translate(0,${iH})`)
      .call(d3.axisBottom(xScale).ticks(4).tickFormat(v => `${((v as number) / 1000).toFixed(0)}k`))
      .call(ax => ax.select('.domain').remove())

    const tooltip = d3.select(tooltipRef.current!)

    g.selectAll<SVGRectElement, typeof top[number]>('rect')
      .data(top)
      .join('rect')
      .attr('x', 0)
      .attr('y', d => yScale(d.pol.name) ?? 0)
      .attr('width', d => xScale(d.income))
      .attr('height', yScale.bandwidth())
      .attr('fill', d => PARTY_COLORS[d.pol.party.replace(/\u00ad/g, '')] ?? FALLBACK_COLOR)
      .attr('rx', 2)
      .on('mousemove', (event, d) => {
        tooltip
          .style('opacity', '1')
          .style('left', `${event.clientX + 12}px`)
          .style('top', `${event.clientY - 28}px`)
          .html(`<b>${d.pol.name}</b><br/>${Math.round(d.income).toLocaleString('de')} €`)
      })
      .on('mouseleave', () => tooltip.style('opacity', '0'))
  }, [jobs, politicians, width])

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <svg ref={svgRef} style={{ display: 'block', width: '100%' }} />
      <Tooltip ref={tooltipRef} />
    </div>
  )
}
