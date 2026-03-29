"use client";
import { useState, useEffect } from "react";
import { usePeriod } from "@/lib/period-context";
import {
  fetchData,
  dataUrl,
  stripSoftHyphen,
  WordFreqFile,
  SpeechStatsFile,
  SpeakerRecord,
} from "@/lib/data";
import { WordCloud } from "@/components/charts/WordCloud";
import { SpeakerBars } from "@/components/charts/SpeakerBars";
import { ChartSkeleton } from "@/components/ui/ChartSkeleton";
import { Footer } from "@/components/ui/Footer";
import { sortParties, PARTY_COLORS, FALLBACK_COLOR } from "@/lib/constants";

export default function SpeechesPage() {
  const { activePeriodId } = usePeriod();
  const [wordFreq, setWordFreq] = useState<WordFreqFile | null>(null);
  const [speechStats, setSpeechStats] = useState<SpeechStatsFile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activePeriodId) return;
    setLoading(true);
    Promise.all([
      fetchData<WordFreqFile>(
        dataUrl("party_word_freq_{period}.json", activePeriodId),
      ),
      fetchData<SpeechStatsFile>(
        dataUrl("party_speech_stats_{period}.json", activePeriodId),
      ),
    ])
      .then(([wf, ss]) => {
        setWordFreq(wf);
        setSpeechStats(ss);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [activePeriodId]);

  // Normalize word freq keys (strip soft-hyphen)
  const normalizedWordFreq: WordFreqFile = {};
  if (wordFreq) {
    for (const [fraktion, words] of Object.entries(wordFreq)) {
      normalizedWordFreq[stripSoftHyphen(fraktion)] = words;
    }
  }

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
    Object.keys(normalizedWordFreq).filter((p) => p !== "fraktionslos"),
  );

  return (
    <>
      {/* Page header */}
      <div className="mb-8 pl-4 border-l-4" style={{ borderColor: "#9B59B6" }}>
        <p
          className="text-[11px] font-bold tracking-[0.15em] uppercase mb-1"
          style={{ color: "#9B59B6" }}
        >
          Plenardebatten
        </p>
        <h1
          className="text-[28px] font-black tracking-tight leading-tight mb-1"
          style={{ color: "#1E1B5E" }}
        >
          Speeches
        </h1>
        <p className="text-[14px]" style={{ color: "#9A9790" }}>
          Welche Themen prägen jede Fraktion im Plenum? TF-IDF-Wordclouds der
          parteispezifischen Begriffe und die redeaktivsten Abgeordneten.
        </p>
      </div>

      {loading || !wordFreq || !speechStats ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <ChartSkeleton key={i} height={480} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {parties.map((party) => {
            const words = (normalizedWordFreq[party] ?? []).slice(0, 30);
            const speakers = speakersByParty[party] ?? [];
            const color = PARTY_COLORS[party] ?? FALLBACK_COLOR;
            const total = totalWords[party] ?? 0;

            return (
              <div
                key={party}
                className="bg-white border border-gray-100 flex flex-col gap-3 p-4"
                style={{ borderRadius: 20 }}
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
                      {party}
                    </span>
                  </div>
                  <span
                    className="text-[12px] tabular-nums shrink-0"
                    style={{ color: "#9A9790" }}
                  >
                    {total.toLocaleString("de")} Wörter
                  </span>
                </div>

                {/* Word cloud */}
                <WordCloud words={words} color={color} height={200} />

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

      <Footer />
    </>
  );
}
