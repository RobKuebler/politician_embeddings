'use client'
import { useState, useEffect, useCallback } from 'react'
import { usePeriod } from '@/lib/period-context'
import { fetchData, dataUrl, EmbeddingsFile, EmbeddingPoint, Politician, VoteRecord, Poll, CohesionRecord } from '@/lib/data'
import { VoteMapScatter } from '@/components/charts/VoteMapScatter'
import { VoteHeatmap } from '@/components/charts/VoteHeatmap'
import { CohesionChart } from '@/components/charts/CohesionChart'
import { PoliticianSearch } from '@/components/charts/PoliticianSearch'
import { PollFilter } from '@/components/charts/PollFilter'
import { ChartSkeleton } from '@/components/ui/ChartSkeleton'
import { Footer } from '@/components/ui/Footer'
import { COLOR_SECONDARY } from '@/lib/constants'

/** Computes per-party cohesion as mean Euclidean distance from each politician to the party centroid. */
function computeCohesion(points: EmbeddingPoint[], politicians: Politician[]): CohesionRecord[] {
  const polMap = new Map(politicians.map(p => [p.politician_id, p]))
  const partyPoints = new Map<string, { x: number; y: number }[]>()
  for (const pt of points) {
    const label = polMap.get(pt.politician_id)?.party.replace(/\u00ad/g, '') ?? 'fraktionslos'
    if (!partyPoints.has(label)) partyPoints.set(label, [])
    partyPoints.get(label)!.push({ x: pt.x, y: pt.y })
  }
  return Array.from(partyPoints.entries()).filter(([label]) => label !== 'fraktionslos').map(([label, pts]) => {
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length
    const streuung = pts.reduce((s, p) => s + Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2), 0) / pts.length
    return { party: label, label, streuung }
  })
}

export default function VoteMapPage() {
  const { activePeriodId } = usePeriod()
  const [embeddings, setEmbeddings] = useState<EmbeddingsFile | null>(null)
  const [politicians, setPoliticians] = useState<Politician[]>([])
  const [cohesion, setCohesion] = useState<CohesionRecord[]>([])
  const [votes, setVotes] = useState<VoteRecord[] | null>(null)
  const [polls, setPolls] = useState<Poll[]>([])
  const [selectedPolIds, setSelectedPolIds] = useState<number[]>([])
  const [selectedPollIds, setSelectedPollIds] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingVotes, setLoadingVotes] = useState(false)

  useEffect(() => {
    if (!activePeriodId) return
    setLoading(true)
    setSelectedPolIds([])
    setVotes(null)
    Promise.all([
      fetchData<EmbeddingsFile>(dataUrl('embeddings_{period}.json', activePeriodId)),
      fetchData<Politician[]>(dataUrl('politicians_{period}.json', activePeriodId)),
    ]).then(([emb, pols]) => {
      setEmbeddings(emb)
      setPoliticians(pols)
      setCohesion(computeCohesion(emb.data, pols))
      setLoading(false)
    }).catch(console.error)
  }, [activePeriodId])

  const handleSelection = useCallback((ids: number[]) => {
    setSelectedPolIds(ids)
    if (ids.length > 0 && !votes && activePeriodId) {
      setLoadingVotes(true)
      Promise.all([
        fetchData<VoteRecord[]>(dataUrl('votes_{period}.json', activePeriodId)),
        fetchData<Poll[]>(dataUrl('polls_{period}.json', activePeriodId)),
      ]).then(([v, p]) => {
        setVotes(v)
        setPolls(p)
        setLoadingVotes(false)
      }).catch(console.error)
    }
  }, [votes, activePeriodId])

  return (
    <>
      <h1 className="text-2xl font-bold mb-1">Wer stimmt mit wem?</h1>
      <p className="text-sm mb-6" style={{ color: COLOR_SECONDARY }}>
        Jeder Punkt = ein Abgeordneter. Nähe = ähnliches Abstimmungsverhalten.
        Box-Auswahl wählt Abgeordnete für die Heatmap unten.
      </p>

      {/* Scatter */}
      <div className="rounded-xl border border-gray-100 p-4 mb-6">
        <h2 className="font-semibold mb-3">Abstimmungslandkarte</h2>
        {loading ? (
          <ChartSkeleton height={typeof window !== 'undefined' && window.innerWidth < 768 ? 350 : 600} />
        ) : (
          <VoteMapScatter
            embeddings={embeddings!.data}
            politicians={politicians}
            selectedIds={selectedPolIds}
            onSelectionChange={handleSelection}
            height={typeof window !== 'undefined' && window.innerWidth < 768 ? 350 : 600}
          />
        )}
      </div>

      {/* Heatmap */}
      <div className="rounded-xl border border-gray-100 p-4 mb-6">
        <h2 className="font-semibold mb-3">Abstimmungsverhalten</h2>

        {/* Politician search — synced with scatter, always visible once loaded */}
        {!loading && (
          <div className="mb-4">
            <PoliticianSearch
              politicians={politicians}
              selected={selectedPolIds}
              onSelectionChange={handleSelection}
            />
          </div>
        )}

        {!selectedPolIds.length ? (
          <p className="text-sm text-center py-8" style={{ color: COLOR_SECONDARY }}>
            Politiker auswählen, um ihre Abstimmungen zu sehen
          </p>
        ) : loadingVotes ? (
          <ChartSkeleton height={300} />
        ) : votes ? (
          <>
            <div className="mb-4">
              <PollFilter polls={polls} selectedIds={selectedPollIds} onChange={setSelectedPollIds} />
            </div>
            {/* Vote legend */}
            <div className="flex flex-wrap gap-4 mb-3 text-xs">
              {(['yes', 'no', 'abstain'] as const).map((k) => (
                <span key={k} className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm inline-block"
                    style={{ background: { yes: '#46962B', no: '#E3000F', abstain: '#F5A623' }[k] }} />
                  {{ yes: 'Ja', no: 'Nein', abstain: 'Enthalten' }[k]}
                </span>
              ))}
            </div>
            <VoteHeatmap
              votes={votes}
              polls={polls}
              politicians={politicians}
              selectedPolIds={selectedPolIds}
              selectedPollIds={selectedPollIds}
            />
          </>
        ) : null}
      </div>

      {/* Cohesion */}
      <div className="rounded-xl border border-gray-100 p-4 mb-6">
        <h2 className="font-semibold mb-1">Fraktionsdisziplin</h2>
        <p className="text-xs mb-3" style={{ color: COLOR_SECONDARY }}>
          Kurzer Balken = hohe Disziplin (Abgeordnete stimmen eng mit ihrer Fraktion).
        </p>
        {loading ? <ChartSkeleton height={300} /> : <CohesionChart cohesion={cohesion} />}
      </div>

      <Footer />
    </>
  )
}
