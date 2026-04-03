"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
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
import { VoteHeatmap } from "@/components/charts/VoteHeatmap";
import { CohesionChart } from "@/components/charts/CohesionChart";
import { PoliticianSearch } from "@/components/charts/PoliticianSearch";
import { PollFilter } from "@/components/charts/PollFilter";
import { ChartSkeleton } from "@/components/ui/ChartSkeleton";
import { Footer } from "@/components/ui/Footer";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  GOVERNING_PARTIES,
  PARTY_COLORS,
  FALLBACK_COLOR,
  VOTE_META,
} from "@/lib/constants";

/** Computes per-party cohesion (mean distance to centroid) and centroid positions. */
function computeCohesion(
  points: EmbeddingPoint[],
  politicians: Politician[],
): CohesionRecord[] {
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
  }
  return cohesion;
}

/**
 * Collapses individual politician selections into party pills when all members of a party
 * are selected. Returns the normalized state with redundant individual IDs removed.
 */
function normalizeSelection(
  polIds: number[],
  parties: string[],
  politicians: Politician[],
): { polIds: number[]; parties: string[] } {
  const partyMembers = new Map<string, number[]>();
  for (const p of politicians) {
    const party = stripSoftHyphen(p.party);
    if (!partyMembers.has(party)) partyMembers.set(party, []);
    partyMembers.get(party)!.push(p.politician_id);
  }
  const polIdSet = new Set(polIds);
  const resultParties = [...parties];
  let resultPolIds = [...polIds];
  for (const [party, members] of partyMembers) {
    if (resultParties.includes(party)) continue;
    if (members.length > 1 && members.every((id) => polIdSet.has(id))) {
      resultParties.push(party);
      const memberSet = new Set(members);
      resultPolIds = resultPolIds.filter((id) => !memberSet.has(id));
    }
  }
  return { polIds: resultPolIds, parties: resultParties };
}

export default function VoteMapPage() {
  const { activePeriodId } = usePeriod();
  const [embeddings, setEmbeddings] = useState<EmbeddingsFile | null>(null);
  const [politicians, setPoliticians] = useState<Politician[]>([]);
  const [cohesion, setCohesion] = useState<CohesionRecord[]>([]);
  const [votes, setVotes] = useState<VoteRecord[] | null>(null);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [selectedPolIds, setSelectedPolIds] = useState<number[]>([]);
  const [selectedParties, setSelectedParties] = useState<string[]>([]);
  const [selectedPollIds, setSelectedPollIds] = useState<number[]>([]);

  // Expand party selections into politician IDs and merge with individual selections.
  const effectivePolIds = useMemo(() => {
    if (selectedParties.length === 0) return selectedPolIds;
    const partySet = new Set(selectedParties);
    const partyMemberIds = politicians
      .filter((p) => partySet.has(stripSoftHyphen(p.party)))
      .map((p) => p.politician_id);
    return [...new Set([...selectedPolIds, ...partyMemberIds])];
  }, [selectedPolIds, selectedParties, politicians]);

  // Polls where the selected politicians voted differently from each other.
  // Only computed when 2+ politicians are selected and vote data is loaded.
  const divergentPollIds = useMemo<number[] | undefined>(() => {
    if (!votes || effectivePolIds.length < 2) return undefined;
    // Build vote lookup: politician_id → poll_id → answer
    const voteIndex = new Map<number, Map<number, string>>();
    for (const v of votes) {
      if (!voteIndex.has(v.politician_id))
        voteIndex.set(v.politician_id, new Map());
      voteIndex.get(v.politician_id)!.set(v.poll_id, v.answer);
    }
    return polls
      .filter((p) => {
        const answers = new Set<string>();
        for (const polId of effectivePolIds) {
          answers.add(voteIndex.get(polId)?.get(p.poll_id) ?? "no_show");
        }
        return answers.size > 1;
      })
      .map((p) => p.poll_id);
  }, [votes, polls, effectivePolIds]);

  // Like divergentPollIds, but no_show is ignored — only actual votes (yes/no/abstain) are compared.
  const divergentPresentPollIds = useMemo<number[] | undefined>(() => {
    if (!votes || effectivePolIds.length < 2) return undefined;
    const voteIndex = new Map<number, Map<number, string>>();
    for (const v of votes) {
      if (!voteIndex.has(v.politician_id))
        voteIndex.set(v.politician_id, new Map());
      voteIndex.get(v.politician_id)!.set(v.poll_id, v.answer);
    }
    return polls
      .filter((p) => {
        const answers = new Set<string>();
        for (const polId of effectivePolIds) {
          const answer = voteIndex.get(polId)?.get(p.poll_id);
          if (answer && answer !== "no_show") answers.add(answer);
        }
        return answers.size > 1;
      })
      .map((p) => p.poll_id);
  }, [votes, polls, effectivePolIds]);

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
    setSelectedParties([]);
    setVotes(null);
    Promise.all([
      fetchData<EmbeddingsFile>(dataUrl("embeddings.json", activePeriodId)),
      fetchData<Politician[]>(dataUrl("politicians.json", activePeriodId)),
    ])
      .then(([emb, pols]) => {
        setEmbeddings(emb);
        setPoliticians(pols);
        setCohesion(computeCohesion(emb.data, pols));
        setLoading(false);
      })
      .catch(console.error);
  }, [activePeriodId]);

  // Loads vote data if not yet loaded. No-op if already loaded or no period.
  const loadVotesIfNeeded = useCallback(() => {
    if (votes || !activePeriodId) return;
    setLoadingVotes(true);
    Promise.all([
      fetchData<VoteRecord[]>(dataUrl("votes.json", activePeriodId)),
      fetchData<Poll[]>(dataUrl("polls.json", activePeriodId)),
    ])
      .then(([v, p]) => {
        setVotes(v);
        setPolls(p);
        setLoadingVotes(false);
      })
      .catch(console.error);
  }, [votes, activePeriodId]);

  const handleSelection = useCallback(
    (newEffectiveIds: number[]) => {
      const newIdSet = new Set(newEffectiveIds);
      let nextParties = [...selectedParties];
      const expandedMembers: number[] = [];

      // For each active party pill, check if a member was removed from the selection.
      // If so, expand the pill into individual chips for the remaining members.
      for (const party of selectedParties) {
        const members = politicians
          .filter((p) => stripSoftHyphen(p.party) === party)
          .map((p) => p.politician_id);
        if (!members.every((id) => newIdSet.has(id))) {
          nextParties = nextParties.filter((p) => p !== party);
          members
            .filter((id) => newIdSet.has(id))
            .forEach((id) => expandedMembers.push(id));
        }
      }

      // Combine expanded members with non-pill-member IDs from the new selection.
      const pillMemberIds = new Set(
        politicians
          .filter((p) => nextParties.includes(stripSoftHyphen(p.party)))
          .map((p) => p.politician_id),
      );
      const merged = [
        ...new Set([
          ...newEffectiveIds.filter((id) => !pillMemberIds.has(id)),
          ...expandedMembers,
        ]),
      ];

      // Auto-collapse: if all members of any party are now individually selected, make a pill.
      const { polIds, parties } = normalizeSelection(
        merged,
        nextParties,
        politicians,
      );
      setSelectedPolIds(polIds);
      setSelectedParties(parties);
      if (newEffectiveIds.length > 0) loadVotesIfNeeded();
    },
    [loadVotesIfNeeded, selectedParties, politicians],
  );

  const handlePartyToggle = useCallback(
    (party: string) => {
      setSelectedParties((prev) =>
        prev.includes(party)
          ? prev.filter((p) => p !== party)
          : [...prev, party],
      );
      // When adding a party, remove any individual chips that are members of it.
      setSelectedPolIds((prev) => {
        const partyMemberIds = new Set(
          politicians
            .filter((p) => stripSoftHyphen(p.party) === party)
            .map((p) => p.politician_id),
        );
        return prev.filter((id) => !partyMemberIds.has(id));
      });
      loadVotesIfNeeded();
    },
    [loadVotesIfNeeded, politicians],
  );

  /** Update individual politician selection from the search bar (party pills stay untouched). */
  const handleSearchSelection = useCallback(
    (ids: number[]) => {
      setSelectedPolIds(ids);
      if (ids.length > 0) loadVotesIfNeeded();
    },
    [loadVotesIfNeeded],
  );

  const handleClearAll = useCallback(() => {
    setSelectedPolIds([]);
    setSelectedParties([]);
  }, []);

  return (
    <>
      <PageHeader
        color="#4C46D9"
        label="Abstimmungsverhalten"
        title="Wer stimmt mit wem?"
        description="Ein KI-Modell hat das Abstimmungsverhalten aller Abgeordneten in einen zweidimensionalen Raum eingebettet. Abgeordnete, die häufig gleich abstimmen, landen nah beieinander — unabhängig von Fraktionsgrenzen."
      />

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
            selectedIds={effectivePolIds}
            onSelectionChange={handleSelection}
            onPartyToggle={handlePartyToggle}
            onClearAll={handleClearAll}
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
              onSelectionChange={handleSearchSelection}
              selectedParties={selectedParties}
              onPartyRemove={(party) =>
                setSelectedParties((prev) => prev.filter((p) => p !== party))
              }
              onClearAll={handleClearAll}
            />
          </div>
        )}

        {!effectivePolIds.length ? (
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
                divergentPollIds={divergentPollIds}
                divergentPresentPollIds={divergentPresentPollIds}
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
                      background: VOTE_META[k].color,
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
              selectedPolIds={effectivePolIds}
              selectedPollIds={selectedPollIds}
            />
          </>
        ) : null}
      </div>

      {/* Cohesion */}
      <div
        className="bg-white rounded-xl border border-[#E3E0DA] p-5 md:p-6 mb-5"
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

      <Footer />
    </>
  );
}
