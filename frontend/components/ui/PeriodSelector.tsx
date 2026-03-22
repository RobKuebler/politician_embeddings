'use client'
import { usePeriod } from '@/lib/period-context'

export function PeriodSelector() {
  const { periods, activePeriodId, setActivePeriodId } = usePeriod()
  if (periods.length <= 1) return null  // hide if only one period
  return (
    <select
      value={activePeriodId ?? ''}
      onChange={(e) => setActivePeriodId(Number(e.target.value))}
      className="w-full text-sm rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      {periods.map((p) => (
        <option key={p.period_id} value={p.period_id}>{p.label}</option>
      ))}
    </select>
  )
}
