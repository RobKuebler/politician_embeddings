"use client";
import { useState, useEffect, useCallback } from "react";
import { usePeriod } from "@/lib/period-context";
import {
  fetchData,
  dataUrl,
  stripSoftHyphen,
  EmbeddingsFile,
  EmbeddingPoint,
  Politician,
  VoteRecord,
  Poll,
  CohesionRecord,
} from "@/lib/data";
import { VoteMapScatter } from "@/components/charts/VoteMapScatter";
import {
  PartyDistanceMatrix,
  Centroid,
} from "@/components/charts/PartyDistanceMatrix";
import { VoteHeatmap } from "@/components/charts/VoteHeatmap";
import { CohesionChart } from "@/components/charts/CohesionChart";
import { PoliticianSearch } from "@/components/charts/PoliticianSearch";
import { PollFilter } from "@/components/charts/PollFilter";
import { ChartSkeleton } from "@/components/ui/ChartSkeleton";
import { Footer } from "@/components/ui/Footer";
import {
  GOVERNING_PARTIES,
  PARTY_COLORS,
  FALLBACK_COLOR,
} from "@/lib/constants";

/** Computes per-party cohesion (mean distance to centroid) and centroid positions. */
function computeCohesionAndCentroids(
  points: EmbeddingPoint[],
  politicians: Politician[],
): { cohesion: CohesionRecord[]; centroids: Centroid[] } {
  const polMap = new Map(politicians.map((p) => [p.politician_id, p]));
  const partyPoints = new Map<string, { x: number; y: number }[]>();
  for (const pt of points) {
    const label = stripSoftHyphen(
      polMap.get(pt.politician_id)?.party ?? "fraktionslos",
    );
    if (!partyPoints.has(label)) partyPoints.set(label, []);
    partyPoints.get(label)!.push({ x: pt.x, y: pt.y });
  }
  const cohesion: CohesionRecord[] = [];
  const centroids: Centroid[] = [];
  for (const [label, pts] of partyPoints) {
    if (label === "fraktionslos" || pts.length < 2) continue;
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    const streuung =
      pts.reduce(
        (s, p) => s + Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2),
        0,
      ) / pts.length;
    cohesion.push({ party: label, label, streuung });
    centroids.push({ party: label, cx, cy });
  }
  return { cohesion, centroids };
}

export default function VoteMapPage() {
  const { activePeriodId } = usePeriod();
  const [embeddings, setEmbeddings] = useState<EmbeddingsFile | null>(null);
  const [politicians, setPoliticians] = useState<Politician[]>([]);
  const [cohesion, setCohesion] = useState<CohesionRecord[]>([]);
  const [centroids, setCentroids] = useState<Centroid[]>([]);
  const [votes, setVotes] = useState<VoteRecord[] | null>(null);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [selectedPolIds, setSelectedPolIds] = useState<number[]>([]);
  const [selectedPollIds, setSelectedPollIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingVotes, setLoadingVotes] = useState(false);
  // Chart height — start at 350 (mobile-safe default) and update after mount to avoid SSR/client mismatch
  const [chartHeight, setChartHeight] = useState(350);
  useEffect(() => {
    setChartHeight(window.innerWidth < 768 ? 350 : 600);
  }, []);

  useEffect(() => {
    if (!activePeriodId) return;
    setLoading(true);
    setSelectedPolIds([]);
    setVotes(null);
    Promise.all([
      fetchData<EmbeddingsFile>(
        dataUrl("embeddings_{period}.json", activePeriodId),
      ),
      fetchData<Politician[]>(
        dataUrl("politicians_{period}.json", activePeriodId),
      ),
    ])
      .then(([emb, pols]) => {
        setEmbeddings(emb);
        setPoliticians(pols);
        const { cohesion: c, centroids: cent } = computeCohesionAndCentroids(
          emb.data,
          pols,
        );
        setCohesion(c);
        setCentroids(cent);
        setLoading(false);
      })
      .catch(console.error);
  }, [activePeriodId]);

  const handleSelection = useCallback(
    (ids: number[]) => {
      setSelectedPolIds(ids);
      if (ids.length > 0 && !votes && activePeriodId) {
        setLoadingVotes(true);
        Promise.all([
          fetchData<VoteRecord[]>(
            dataUrl("votes_{period}.json", activePeriodId),
          ),
          fetchData<Poll[]>(dataUrl("polls_{period}.json", activePeriodId)),
        ])
          .then(([v, p]) => {
            setVotes(v);
            setPolls(p);
            setLoadingVotes(false);
          })
          .catch(console.error);
      }
    },
    [votes, activePeriodId],
  );

  return (
    <>
      <div className="mb-8 pl-4 border-l-4" style={{ borderColor: "#4C46D9" }}>
        <p
          className="text-[11px] font-bold tracking-[0.15em] uppercase mb-1"
          style={{ color: "#4C46D9" }}
        >
          KI-Analyse
        </p>
        <h1
          className="text-[28px] font-black tracking-tight leading-tight mb-1"
          style={{ color: "#1E1B5E" }}
        >
          Abstimmungslandkarte
        </h1>
        <p className="text-[14px]" style={{ color: "#9A9790" }}>
          Ein KI-Modell hat das Abstimmungsverhalten aller Abgeordneten in einen
          zweidimensionalen Raum eingebettet. Abgeordnete, die häufig gleich
          abstimmen, landen nah beieinander — unabhängig von Fraktionsgrenzen.
        </p>
      </div>

      {/* Coalition banner */}
      {activePeriodId && GOVERNING_PARTIES[activePeriodId] && (
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <span className="text-[11px] font-bold tracking-[0.12em] uppercase text-[#9A9790]">
            Regierungskoalition
          </span>
          {GOVERNING_PARTIES[activePeriodId].map((party, i) => (
            <span key={party} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-[#C8C5BF] text-[13px]">+</span>}
              <span
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold border"
                style={{
                  background: `${PARTY_COLORS[party] ?? FALLBACK_COLOR}18`,
                  borderColor: `${PARTY_COLORS[party] ?? FALLBACK_COLOR}55`,
                  color:
                    party === "CDU/CSU"
                      ? "#1a1a1a"
                      : (PARTY_COLORS[party] ?? FALLBACK_COLOR),
                }}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: PARTY_COLORS[party] ?? FALLBACK_COLOR }}
                />
                {party}
              </span>
            </span>
          ))}
        </div>
      )}

      {/* Scatter */}
      <div
        className="bg-white rounded-xl border border-[#E3E0DA] p-5 md:p-6 mb-5"
        style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
      >
        <h2
          className="font-extrabold text-[15px] mb-1"
          style={{ color: "#1E1B5E" }}
        >
          Abstimmungslandkarte
        </h2>
        <p className="text-[12px] text-[#9A9790] mb-4">
          Klicken Sie auf einzelne Punkte oder ziehen Sie eine Auswahl, um das
          Abstimmungsverhalten der betreffenden Abgeordneten im Detail zu
          analysieren. Fraktionsnamen im Diagramm sind ebenfalls anklickbar.
        </p>
        {loading ? (
          <ChartSkeleton height={chartHeight} />
        ) : (
          <VoteMapScatter
            embeddings={embeddings!.data}
            politicians={politicians}
            selectedIds={selectedPolIds}
            onSelectionChange={handleSelection}
            height={chartHeight}
          />
        )}
      </div>

      {/* Heatmap */}
      <div
        className="bg-white rounded-xl border border-[#E3E0DA] p-5 md:p-6 mb-5"
        style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
      >
        <h2
          className="font-extrabold text-[15px] mb-1"
          style={{ color: "#1E1B5E" }}
        >
          Abstimmungsverhalten
        </h2>
        <p className="text-[12px] text-[#9A9790] mb-4">
          Die Heatmap zeigt, wie die ausgewählten Abgeordneten bei einzelnen
          Abstimmungen votiert haben. Wählen Sie zunächst Abgeordnete aus der
          Karte oder über die Suche aus.
        </p>

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
          <p className="text-[13px] text-center py-10 text-[#9A9790]">
            Abgeordnete auswählen, um ihre Abstimmungen zu sehen
          </p>
        ) : loadingVotes ? (
          <ChartSkeleton height={300} />
        ) : votes ? (
          <>
            <div className="mb-4">
              <PollFilter
                polls={polls}
                selectedIds={selectedPollIds}
                onChange={setSelectedPollIds}
              />
            </div>
            {/* Vote legend */}
            <div className="flex flex-wrap gap-4 mb-4 text-[12px]">
              {(["yes", "no", "abstain"] as const).map((k) => (
                <span
                  key={k}
                  className="flex items-center gap-1.5 text-[#6B6760]"
                >
                  <span
                    className="w-3 h-3 rounded-sm inline-block flex-shrink-0"
                    style={{
                      background: {
                        yes: "#46962B",
                        no: "#E3000F",
                        abstain: "#F5A623",
                      }[k],
                    }}
                  />
                  {{ yes: "Ja", no: "Nein", abstain: "Enthalten" }[k]}
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

      {/* Cohesion + Party distance matrix — side by side on md+ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
        <div
          className="bg-white rounded-xl border border-[#E3E0DA] p-5 md:p-6"
          style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
        >
          <h2
            className="font-extrabold text-[15px] mb-1"
            style={{ color: "#1E1B5E" }}
          >
            Fraktionsdisziplin
          </h2>
          <p className="text-[12px] text-[#9A9790] mb-4">
            Mittlerer euklidischer Abstand jedes Abgeordneten zum Schwerpunkt
            seiner Fraktion. Ein kurzer Balken bedeutet geschlossenes
            Abstimmungsverhalten.
          </p>
          {loading ? (
            <ChartSkeleton height={250} />
          ) : (
            <CohesionChart cohesion={cohesion} />
          )}
        </div>

        <div
          className="bg-white rounded-xl border border-[#E3E0DA] p-5 md:p-6"
          style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
        >
          <h2
            className="font-extrabold text-[15px] mb-1"
            style={{ color: "#1E1B5E" }}
          >
            Parteiähnlichkeit
          </h2>
          <p className="text-[12px] text-[#9A9790] mb-4">
            Abstände zwischen den Fraktionszentroiden. Dunkel = ähnliches
            Abstimmungsverhalten, hell = größere Unterschiede.
          </p>
          {loading ? (
            <ChartSkeleton height={250} />
          ) : (
            <PartyDistanceMatrix centroids={centroids} />
          )}
        </div>
      </div>

      <Footer />
    </>
  );
}
