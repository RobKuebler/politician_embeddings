'use client'
import ReactECharts from 'echarts-for-react'
import { PARTY_COLORS, FALLBACK_COLOR } from '@/lib/constants'

interface AgeRecord { party: string; age: number }
interface Props { data: AgeRecord[]; parties: string[] }

export function AgeDistribution({ data, parties }: Props) {
  const byParty = new Map<string, number[]>()
  for (const { party, age } of data) {
    if (!byParty.has(party)) byParty.set(party, [])
    byParty.get(party)!.push(age)
  }

  const option = {
    animation: false,
    tooltip: { trigger: 'item', formatter: (p: any) => `${p.seriesName}: ${p.data[0]} Jahre` },
    xAxis: { type: 'value', min: 20, max: 85, name: 'Alter', nameLocation: 'end' },
    yAxis: {
      type: 'category', data: parties,
      axisLabel: { fontSize: 11 }, inverse: true,
    },
    series: parties.map((party) => {
      const values = byParty.get(party) ?? []
      const color = PARTY_COLORS[party] ?? FALLBACK_COLOR
      return {
        name: party,
        type: 'scatter',
        data: values.map((age) => [age, party]),
        symbolSize: 5,
        itemStyle: { color, opacity: 0.55 },
      }
    }),
    grid: { left: 100, right: 24, top: 16, bottom: 40 },
  }

  return <ReactECharts option={option} style={{ width: '100%', height: 400 }} notMerge />
}
