"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { usePeriod } from "@/lib/period-context";
import {
  fetchPeriodFiles,
  stripSoftHyphen,
  EmbeddingsFile,
  Politician,
  VoteRecord,
  Poll,
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
  PARTY_PILL_ACCENT_COLORS,
  VOTE_META,
  CARD_CLASS,
  CARD_SHADOW,
  CARD_PADDING,
  getPartyColor,
  getPartyShortLabel,
} from "@/lib/constants";
import { PAGE_META } from "@/lib/page-meta";
import {
  computeCohesionRecords,
  findDivergentPollIds,
  normalizeSelection,
} from "@/lib/vote-map";

const META = PAGE_META.find((p) => p.href === "/vote-map")!;

export default function VoteMapPage() {
  const { activePeriodId } = usePeriod();
  const [embeddings, setEmbeddings] = useState<EmbeddingsFile | null>(null);
  const [politicians, setPoliticians] = useState<Politician[]>([]);
  const [cohesion, setCohesion] = useState<
    ReturnType<typeof computeCohesionRecords>
  >([]);
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
    if (!votes) return undefined;
    return findDivergentPollIds(votes, polls, effectivePolIds, {
      ignoreNoShow: false,
    });
  }, [votes, polls, effectivePolIds]);

  // Like divergentPollIds, but no_show is ignored — only actual votes (yes/no/abstain) are compared.
  const divergentPresentPollIds = useMemo<number[] | undefined>(() => {
    if (!votes) return undefined;
    return findDivergentPollIds(votes, polls, effectivePolIds, {
      ignoreNoShow: true,
    });
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
    setEmbeddings(null);
    setPoliticians([]);
    setCohesion([]);
    setSelectedPolIds([]);
    setSelectedParties([]);
    setSelectedPollIds([]);
    setVotes(null);
    setPolls([]);
    fetchPeriodFiles<{
      embeddings: EmbeddingsFile;
      politicians: Politician[];
    }>(activePeriodId, {
      embeddings: "embeddings.json",
      politicians: "politicians.json",
    })
      .then(({ embeddings, politicians }) => {
        setEmbeddings(embeddings);
        setPoliticians(politicians);
        setCohesion(computeCohesionRecords(embeddings.data, politicians));
        setLoading(false);
      })
      .catch((error) => {
        console.error(error);
        setLoading(false);
      });
  }, [activePeriodId]);

  // Loads vote data if not yet loaded. No-op if already loaded or no period.
  const loadVotesIfNeeded = useCallback(() => {
    if (votes || !activePeriodId) return;
    setLoadingVotes(true);
    fetchPeriodFiles<{
      votes: VoteRecord[];
      polls: Poll[];
    }>(activePeriodId, {
      votes: "votes.json",
      polls: "polls.json",
    })
      .then(({ votes, polls }) => {
        setVotes(votes);
        setPolls(polls);
        setLoadingVotes(false);
      })
      .catch((error) => {
        console.error(error);
        setLoadingVotes(false);
      });
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
      <PageHeader {...META} />

      {/* Coalition banner */}
      {activePeriodId && GOVERNING_PARTIES[activePeriodId] && (
        <div className="flex flex-col gap-2 mb-5 sm:flex-row sm:items-center">
          <span className="text-[11px] font-bold tracking-[0.12em] uppercase text-[#7872a8]">
            Regierungskoalition
          </span>
          <div className="flex items-center gap-1.5">
            {GOVERNING_PARTIES[activePeriodId].map((party, i) => (
              <span key={party} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-[#7872a8] text-[13px]">+</span>}
                <span
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold border"
                  style={{
                    background: `${getPartyColor(party)}18`,
                    borderColor: `${PARTY_PILL_ACCENT_COLORS[party] ?? getPartyColor(party)}55`,
                    color:
                      PARTY_PILL_ACCENT_COLORS[party] ?? getPartyColor(party),
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{
                      background: getPartyColor(party),
                    }}
                  />
                  {getPartyShortLabel(party)}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Scatter */}
      <div
        className={`${CARD_CLASS} ${CARD_PADDING} mb-5`}
        style={{ boxShadow: CARD_SHADOW }}
      >
        <h2
          className="font-extrabold text-[15px] mb-1"
          style={{ color: "#1E1B5E" }}
        >
          Abstimmungslandkarte
        </h2>
        <p className="text-[12px] text-[#7872a8] mb-4">
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
        className={`${CARD_CLASS} ${CARD_PADDING} mb-5`}
        style={{ boxShadow: CARD_SHADOW }}
      >
        <h2
          className="font-extrabold text-[15px] mb-1"
          style={{ color: "#1E1B5E" }}
        >
          Abstimmungsverhalten
        </h2>
        <p className="text-[12px] text-[#7872a8] mb-4">
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
          <p className="text-[13px] text-center py-10 text-[#7872a8]">
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
                  className="flex items-center gap-1.5 text-[#5a556b]"
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
        className={`${CARD_CLASS} ${CARD_PADDING} mb-5`}
        style={{ boxShadow: CARD_SHADOW }}
      >
        <h2
          className="font-extrabold text-[15px] mb-1"
          style={{ color: "#1E1B5E" }}
        >
          Fraktionsdisziplin
        </h2>
        <p className="text-[12px] text-[#7872a8] mb-4">
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
