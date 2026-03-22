'use client'
import { useState, useEffect } from 'react'
import { usePeriod } from '@/lib/period-context'
import { fetchData, dataUrl, SidejobsFile, Politician } from '@/lib/data'
import { IncomeByPartyChart, IncomeByCategoryChart, TopTopicsChart, TopEarnersChart } from '@/components/charts/SidejobsCharts'
import { ChartSkeleton } from '@/components/ui/ChartSkeleton'
import { Footer } from '@/components/ui/Footer'
import { COLOR_SECONDARY, PARTY_ORDER } from '@/lib/constants'

export default function SidejobsPage() {
  const { activePeriodId } = usePeriod()
  const [sjData, setSjData] = useState<SidejobsFile | null>(null)
  const [politicians, setPoliticians] = useState<Politician[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!activePeriodId) return
    setLoading(true)
    Promise.all([
      fetchData<SidejobsFile>(dataUrl('sidejobs_{period}.json', activePeriodId)),
      fetchData<Politician[]>(dataUrl('politicians_{period}.json', activePeriodId)),
    ]).then(([sj, pols]) => {
      setSjData(sj)
      setPoliticians(pols)
      setLoading(false)
    }).catch(console.error)
  }, [activePeriodId])

  // Build ordered party list using canonical PARTY_ORDER, falling back to alphabetical for unknowns
  const present = sjData ? new Set(sjData.jobs.map((j) => j.party)) : new Set<string>()
  const parties = sjData
    ? [...PARTY_ORDER.filter((p) => present.has(p)), ...Array.from(present).filter((p) => !PARTY_ORDER.includes(p)).sort()]
    : []

  return (
    <>
      <h1 className="text-2xl font-bold mb-1">Nebeneinkünfte</h1>
      <p className="text-sm mb-4" style={{ color: COLOR_SECONDARY }}>
        Offengelegte Nebentätigkeiten und Einkünfte der Bundestagsabgeordneten.
      </p>

      {/* Coverage info */}
      {sjData && (
        <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-sm mb-6">
          <strong>{sjData.coverage.total - sjData.coverage.with_amount} von {sjData.coverage.total}</strong>{' '}
          Nebentätigkeiten ({Math.round((1 - sjData.coverage.with_amount / sjData.coverage.total) * 100)} %) haben
          keine Betragsangabe und fließen nicht in die Einkommens-Auswertungen ein.
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-6">
          <ChartSkeleton /><ChartSkeleton /><ChartSkeleton /><ChartSkeleton />
        </div>
      ) : sjData ? (
        <div className="flex flex-col gap-8">
          <section className="rounded-xl border border-gray-100 p-4">
            <h2 className="font-semibold mb-1">Einkommen nach Partei</h2>
            <p className="text-xs mb-3" style={{ color: COLOR_SECONDARY }}>
              Monatliche und jährliche Zahlungen werden auf die Periodendauer hochgerechnet.
            </p>
            <IncomeByPartyChart jobs={sjData.jobs} parties={parties} politicians={politicians} />
          </section>

          <section className="rounded-xl border border-gray-100 p-4">
            <h2 className="font-semibold mb-1">Einkommen nach Kategorie</h2>
            <p className="text-xs mb-3" style={{ color: COLOR_SECONDARY }}>
              Kategorien der Bundestagsverwaltung, gestapelt nach Partei.
            </p>
            <IncomeByCategoryChart jobs={sjData.jobs} parties={parties} />
          </section>

          <section className="rounded-xl border border-gray-100 p-4">
            <h2 className="font-semibold mb-1">Themenfelder der Nebentätigkeiten</h2>
            <p className="text-xs mb-3" style={{ color: COLOR_SECONDARY }}>
              Top-15 Themenfelder nach Gesamteinkommen. Ein Job kann mehreren Themen zugeordnet sein.
            </p>
            <TopTopicsChart jobs={sjData.jobs} parties={parties} />
          </section>

          <section className="rounded-xl border border-gray-100 p-4">
            <h2 className="font-semibold mb-1">Top-Verdiener</h2>
            <TopEarnersChart jobs={sjData.jobs} politicians={politicians} parties={parties} />
          </section>
        </div>
      ) : null}
      <Footer />
    </>
  )
}
