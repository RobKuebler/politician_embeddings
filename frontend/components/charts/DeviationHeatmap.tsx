'use client'
import ReactECharts from 'echarts-for-react'
import { DeviationPivot } from '@/lib/data'

interface Props { pivot: DeviationPivot; height?: number }

export function DeviationHeatmap({ pivot, height = 400 }: Props) {
  // Build ECharts heatmap data: [partyIdx, catIdx, devValue]
  const data: [number, number, number | null][] = []
  pivot.categories.forEach((_, catIdx) => {
    pivot.parties.forEach((_, partyIdx) => {
      data.push([partyIdx, catIdx, pivot.dev[catIdx]?.[partyIdx] ?? null])
    })
  })

  const maxDev = Math.max(...pivot.dev.flat().filter((v): v is number => v !== null).map(Math.abs), 1)

  const option = {
    animation: false,
    tooltip: {
      trigger: 'item',
      formatter: (p: any) => {
        const cat = pivot.categories[p.data[1]]
        const party = pivot.parties[p.data[0]]
        const dev = p.data[2]
        const pct = pivot.pct[p.data[1]]?.[p.data[0]]
        if (dev === null) return `${party}<br/>${cat}: keine Daten`
        return `<b>${party}</b><br/>${cat}<br/>Anteil: ${pct?.toFixed(1) ?? '?'}%<br/>Abweichung: ${dev > 0 ? '+' : ''}${dev.toFixed(1)} pp`
      },
    },
    xAxis: {
      type: 'category', data: pivot.parties,
      axisLabel: { fontSize: 10, rotate: -20 }, splitLine: { show: false },
    },
    yAxis: {
      type: 'category', data: pivot.categories,
      axisLabel: { fontSize: 10 }, splitLine: { show: false },
    },
    visualMap: {
      type: 'continuous', show: false,
      min: -maxDev, max: maxDev,
      // red = below avg, white = avg, blue = above avg (matches Streamlit app)
      inRange: { color: ['#c0392b', '#fff', '#2471a3'] },
    },
    series: [{
      type: 'heatmap', data,
      label: {
        show: true, fontSize: 9,
        formatter: (p: any) => {
          const v = p.data[2]
          if (v === null) return ''
          return `${v > 0 ? '+' : ''}${v.toFixed(0)}`
        },
      },
      itemStyle: { borderWidth: 1, borderColor: '#fff' },
      emphasis: { itemStyle: { borderColor: '#333', borderWidth: 1 } },
    }],
    grid: { left: 160, right: 16, top: 8, bottom: 60 },
  }

  return (
    <div className="overflow-x-auto">
      <ReactECharts option={option} style={{ width: '100%', minWidth: 500, height }} notMerge />
    </div>
  )
}
