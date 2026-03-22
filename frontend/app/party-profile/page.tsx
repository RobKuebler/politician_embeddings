'use client'
import { useState, useEffect } from 'react'
import { usePeriod } from '@/lib/period-context'
import { fetchData, dataUrl, PartyProfileFile } from '@/lib/data'
import { AgeDistribution } from '@/components/charts/AgeDistribution'
import { GenderChart } from '@/components/charts/GenderChart'
import { DeviationHeatmap } from '@/components/charts/DeviationHeatmap'
import { ChartSkeleton } from '@/components/ui/ChartSkeleton'
import { Footer } from '@/components/ui/Footer'
import { COLOR_SECONDARY, sortParties } from '@/lib/constants'

export default function PartyProfilePage() {
  const { activePeriodId } = usePeriod()
  const [data, setData] = useState<PartyProfileFile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!activePeriodId) return
    setLoading(true)
    fetchData<PartyProfileFile>(dataUrl('party_profile_{period}.json', activePeriodId))
      .then((d) => { setData(d); setLoading(false) })
      .catch(console.error)
  }, [activePeriodId])

  // Sort parties by seat count (most seats first), fraktionslos always last.
  const parties = data ? sortParties(data.parties) : []

  return (
    <>
      <h1 className="text-2xl font-bold mb-6">Parteiprofil</h1>
      {loading || !data ? (
        <div className="flex flex-col gap-6">
          <ChartSkeleton height={300} />
          <ChartSkeleton height={300} />
          <ChartSkeleton height={400} />
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          <section className="rounded-xl border border-gray-100 p-4">
            <h2 className="font-semibold mb-1">Altersverteilung</h2>
            <p className="text-xs mb-3" style={{ color: COLOR_SECONDARY }}>Jeder Punkt = ein Abgeordneter.</p>
            <AgeDistribution data={data.age} parties={parties} />
          </section>

          <section className="rounded-xl border border-gray-100 p-4">
            <h2 className="font-semibold mb-3">Geschlecht</h2>
            <GenderChart data={data.sex} parties={parties} />
          </section>

          <section className="rounded-xl border border-gray-100 p-4">
            <h2 className="font-semibold mb-1">Berufe</h2>
            <p className="text-xs mb-3" style={{ color: COLOR_SECONDARY }}>
              Blau = überproportional, rot = unterproportional (Abweichung vom Bundestag-Durchschnitt in Prozentpunkten).
            </p>
            <DeviationHeatmap pivot={data.occupation} height={500} />
          </section>

          <section className="rounded-xl border border-gray-100 p-4">
            <h2 className="font-semibold mb-1">Ausbildung / Studienrichtung</h2>
            <p className="text-xs mb-3" style={{ color: COLOR_SECONDARY }}>
              Blau = überproportional, rot = unterproportional.
            </p>
            <DeviationHeatmap pivot={data.education_field} height={400} />
          </section>

          <section className="rounded-xl border border-gray-100 p-4">
            <h2 className="font-semibold mb-1">Abschlussniveau</h2>
            <DeviationHeatmap pivot={data.education_degree} height={250} />
          </section>
        </div>
      )}
      <Footer />
    </>
  )
}
