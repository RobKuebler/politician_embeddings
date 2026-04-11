"use client";
import { useState, useEffect, useMemo } from "react";
import { usePeriod } from "@/lib/period-context";
import {
  fetchPeriodFiles,
  stripSoftHyphen,
  WordFreqFile,
  SpeechStatsFile,
  SpeakerRecord,
} from "@/lib/data";
import { WordCloud } from "@/components/charts/WordCloud";
import { SpeakerBars } from "@/components/charts/SpeakerBars";
import { ChartSkeleton } from "@/components/ui/ChartSkeleton";
import { Footer } from "@/components/ui/Footer";
import { PageHeader } from "@/components/ui/PageHeader";
import { SpeechShareBars } from "@/components/charts/SpeechShareBars";
import {
  sortParties,
  CARD_CLASS,
  getPartyColor,
  getPartyShortLabel,
} from "@/lib/constants";
import { PAGE_META } from "@/lib/page-meta";

const META = PAGE_META.find((p) => p.href === "/speeches")!;

export default function SpeechesPage() {
  const { activePeriodId } = usePeriod();
  const [wordFreq, setWordFreq] = useState<WordFreqFile | null>(null);
  const [speechStats, setSpeechStats] = useState<SpeechStatsFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [expandedParty, setExpandedParty] = useState<string | null>(null);

  // Close lightbox on Escape
  useEffect(() => {
    if (!expandedParty) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpandedParty(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expandedParty]);

  useEffect(() => {
    if (!activePeriodId) return;
    setLoading(true);
    setUnavailable(false);
    setWordFreq(null);
    setSpeechStats(null);
    fetchPeriodFiles<{
      wordFreq: WordFreqFile;
      speechStats: SpeechStatsFile;
    }>(activePeriodId, {
      wordFreq: "party_word_freq.json",
      speechStats: "party_speech_stats.json",
    })
      .then(({ wordFreq, speechStats }) => {
        setWordFreq(wordFreq);
        setSpeechStats(speechStats);
        setLoading(false);
      })
      .catch(() => {
        setUnavailable(true);
        setLoading(false);
      });
  }, [activePeriodId]);

  // Normalize word freq keys (strip soft-hyphen). Memoized so word arrays keep
  // stable references — prevents WordCloud from re-running layout on every render.
  const normalizedWordFreq = useMemo<WordFreqFile>(() => {
    if (!wordFreq) return {};
    const result: WordFreqFile = {};
    for (const [fraktion, words] of Object.entries(wordFreq)) {
      result[stripSoftHyphen(fraktion)] = words;
    }
    return result;
  }, [wordFreq]);

  // Group speakers by normalized party name
  const speakersByParty: Record<string, SpeakerRecord[]> = {};
  if (speechStats) {
    for (const s of speechStats) {
      const party = stripSoftHyphen(s.fraktion);
      if (!speakersByParty[party]) speakersByParty[party] = [];
      speakersByParty[party].push(s);
    }
  }

  // Total words per party
  const totalWords: Record<string, number> = {};
  for (const [party, speakers] of Object.entries(speakersByParty)) {
    totalWords[party] = speakers.reduce(
      (sum, s) => sum + s.wortanzahl_gesamt,
      0,
    );
  }

  // Parties in canonical order, excluding fraktionslos
  const parties = sortParties(
    Object.keys(normalizedWordFreq).filter((party) => party !== "fraktionslos"),
  );

  // Pre-sliced word arrays per party — stable references so WordCloud memo works.
  const wordSlices = useMemo<Record<string, WordFreqFile[string]>>(() => {
    const result: Record<string, WordFreqFile[string]> = {};
    for (const party of Object.keys(normalizedWordFreq)) {
      result[party] = normalizedWordFreq[party].slice(0, 30);
    }
    return result;
  }, [normalizedWordFreq]);

  return (
    <>
      {/* Page header */}
      <PageHeader {...META} />

      {!loading && speechStats && <SpeechShareBars speechStats={speechStats} />}

      <div className="mt-8">
        {unavailable ? (
          <p className="text-[14px]" style={{ color: "#9A9790" }}>
            Für diese Wahlperiode sind noch keine Rededaten verfügbar.
          </p>
        ) : loading || !wordFreq || !speechStats ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <ChartSkeleton key={i} height={480} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {parties.map((party, i) => {
              const words = wordSlices[party] ?? [];
              const speakers = speakersByParty[party] ?? [];
              const color = getPartyColor(party);
              const total = totalWords[party] ?? 0;

              return (
                <div
                  key={party}
                  className={`${CARD_CLASS} flex flex-col gap-3 p-4`}
                >
                  {/* Card header */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="shrink-0 rounded-full"
                        style={{ width: 4, height: 20, background: color }}
                      />
                      <span
                        className="font-extrabold text-[15px]"
                        style={{ color: "#1E1B5E" }}
                      >
                        {getPartyShortLabel(party)}
                      </span>
                    </div>
                    <span
                      className="text-[12px] tabular-nums shrink-0"
                      style={{ color: "#9A9790" }}
                    >
                      {total.toLocaleString("de")} Wörter
                    </span>
                  </div>

                  {/* Word cloud — click to expand */}
                  <WordCloud
                    words={words}
                    color={color}
                    height={200}
                    onClick={() => setExpandedParty(party)}
                    startDelay={i * 180}
                  />

                  {/* Speaker list */}
                  <div>
                    <p
                      className="text-[11px] font-bold tracking-[0.08em] uppercase mb-1"
                      style={{ color: "#9A9790" }}
                    >
                      Redner nach Wortanzahl
                    </p>
                    <SpeakerBars speakers={speakers} partyColor={color} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Footer />

      {/* Word cloud lightbox */}
      {expandedParty &&
        (() => {
          const allWords = normalizedWordFreq[expandedParty] ?? [];
          const color = getPartyColor(expandedParty);
          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center"
              style={{
                background: "rgba(0,0,0,0.65)",
                backdropFilter: "blur(4px)",
              }}
              onClick={() => setExpandedParty(null)}
            >
              <div
                className={`relative ${CARD_CLASS} flex flex-col`}
                style={{
                  width: "min(90vw, 760px)",
                  maxHeight: "85vh",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-5 pb-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="shrink-0 rounded-full"
                      style={{ width: 4, height: 20, background: color }}
                    />
                    <span
                      className="font-extrabold text-[17px]"
                      style={{ color: "#1E1B5E" }}
                    >
                      {getPartyShortLabel(expandedParty)}
                    </span>
                    <span
                      className="text-[12px] ml-1"
                      style={{ color: "#9A9790" }}
                    >
                      Top {allWords.length} Begriffe
                    </span>
                  </div>
                  <button
                    onClick={() => setExpandedParty(null)}
                    className="text-[20px] leading-none"
                    style={{ color: "#9A9790", lineHeight: 1 }}
                    aria-label="Schließen"
                  >
                    ×
                  </button>
                </div>

                {/* Expanded cloud */}
                <div className="px-4 pb-5">
                  <WordCloud words={allWords} color={color} height={420} />
                </div>
              </div>
            </div>
          );
        })()}
    </>
  );
}
