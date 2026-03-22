'use client'
import ReactECharts from 'echarts-for-react'
import { PARTY_COLORS, FALLBACK_COLOR } from '@/lib/constants'

interface SexRecord { party_label: string; geschlecht: string; count: number; pct: number }

export function GenderChart({ data, parties }: { data: SexRecord[]; parties: string[] }) {
  const genders = ['Männlich', 'Weiblich', 'Divers']
  const colors: Record<string, string> = { 'Männlich': '#4C9BE8', 'Weiblich': '#E87E9B', 'Divers': '#9B59B6' }
  const option = {
    animation: false,
    tooltip: { trigger: 'item', formatter: (p: any) => `<b>${p.seriesName}</b><br/>${p.name}: ${p.value}%` },
    legend: { data: genders, bottom: 0 },
    xAxis: { type: 'category', data: parties, axisLabel: { fontSize: 11 } },
    yAxis: { type: 'value', max: 100, axisLabel: { formatter: '{value}%' } },
    series: genders.map((g) => ({
      name: g,
      type: 'bar',
      stack: 'total',
      data: parties.map((p) => {
        const row = data.find((r) => r.party_label === p && r.geschlecht === g)
        return row ? Math.round(row.pct) : 0
      }),
      itemStyle: { color: colors[g] },
    })),
    grid: { left: 48, right: 16, top: 16, bottom: 48 },
  }
  return <ReactECharts option={option} style={{ width: '100%', height: 300 }} notMerge />
}
