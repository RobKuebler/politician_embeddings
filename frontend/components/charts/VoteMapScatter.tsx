'use client'
import { useEffect, useRef, useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import { EmbeddingPoint, Politician } from '@/lib/data'
import { PARTY_COLORS, FALLBACK_COLOR, DARK_FILL_PARTY, MARKER_OUTLINE } from '@/lib/constants'

interface Props {
  embeddings: EmbeddingPoint[]
  politicians: Politician[]
  selectedIds: number[]
  onSelectionChange: (ids: number[]) => void
  height?: number
}

export function VoteMapScatter({
  embeddings, politicians, selectedIds, onSelectionChange, height = 600
}: Props) {
  const chartRef = useRef<ReactECharts>(null)

  // Stable ref to per-series point arrays in the same order as the ECharts series array.
  // Used in the brush handler to avoid relying on getOption() normalization.
  const seriesPointsRef = useRef<EmbeddingPoint[][]>([])

  const polMap = useMemo(
    () => new Map(politicians.map((p) => [p.politician_id, p])),
    [politicians]
  )

  // Group data by party for separate series (needed for per-party colors).
  const seriesByParty = useMemo(() => {
    const map = new Map<string, EmbeddingPoint[]>()
    for (const pt of embeddings) {
      const pol = polMap.get(pt.politician_id)
      const party = pol?.party.replace(/\u00ad/g, '') ?? 'fraktionslos'
      if (!map.has(party)) map.set(party, [])
      map.get(party)!.push(pt)
    }
    return map
  }, [embeddings, polMap])

  const option: EChartsOption = useMemo(() => {
    const entries = Array.from(seriesByParty.entries())
    // Keep ref in sync with the series order we pass to ECharts
    seriesPointsRef.current = entries.map(([, pts]) => pts)
    return {
      animation: false,
      brush: {
        toolbox: ['rect', 'polygon', 'clear'],
        brushLink: 'all',
      },
      toolbox: {
        feature: {
          brush: {
            type: ['rect', 'polygon', 'clear'],
            iconStyle: { borderWidth: 2 },
          },
        },
        right: 16,
        top: 8,
        itemSize: 20,
      },
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const pol = polMap.get(params.data[2])
          if (!pol) return ''
          return `<b>${pol.name}</b><br/><span style="color:#999">${pol.party.replace(/\u00ad/g, '')}</span>`
        },
      },
      xAxis: { show: false },
      yAxis: { show: false },
      series: entries.map(([party, points]) => ({
        type: 'scatter',
        name: party,
        data: points.map((pt) => [pt.x, pt.y, pt.politician_id]),
        symbolSize: 8,
        itemStyle: {
          color: PARTY_COLORS[party] ?? FALLBACK_COLOR,
          opacity: 0.82,
          borderColor: party === DARK_FILL_PARTY ? 'rgba(255,255,255,0.5)' : MARKER_OUTLINE,
          borderWidth: 1,
        },
      })),
      grid: { left: 0, right: 0, top: 40, bottom: 0 },
    }
  }, [seriesByParty, polMap])

  // Handle brush selection events.
  // brushselected gives per-series dataIndex values — look up directly from our ref
  // to avoid any getOption() data normalization issues.
  useEffect(() => {
    const chart = chartRef.current?.getEchartsInstance()
    if (!chart) return
    const handler = (params: any) => {
      const ids: number[] = []
      for (const batch of params.batch ?? []) {
        for (const sel of batch.selected ?? []) {
          const pts = seriesPointsRef.current[sel.seriesIndex]
          if (!pts) continue
          for (const idx of sel.dataIndex ?? []) {
            if (pts[idx]) ids.push(pts[idx].politician_id)
          }
        }
      }
      onSelectionChange([...new Set(ids)])
    }
    chart.on('brushselected', handler)
    return () => { chart.off('brushselected', handler) }
  }, [onSelectionChange])

  return (
    <ReactECharts
      ref={chartRef}
      option={option}
      style={{ width: '100%', height }}
      notMerge
    />
  )
}
