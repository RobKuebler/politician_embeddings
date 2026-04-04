"use client";
import { useState, useEffect, useMemo } from "react";
import { usePeriod } from "@/lib/period-context";
import {
  fetchData,
  dataUrl,
  stripSoftHyphen,
  MotionsStatsFile,
  MotionsTypData,
  MotionTitle,
  WordFreqEntry,
  SpeakerRecord,
} from "@/lib/data";
import { WordCloud } from "@/components/charts/WordCloud";
import { SpeakerBars } from "@/components/charts/SpeakerBars";
import {
  KeywordTimeline,
  KeywordSeries,
} from "@/components/charts/KeywordTimeline";
import { MotionCountBars } from "@/components/charts/MotionCountBars";
import { ChartSkeleton } from "@/components/ui/ChartSkeleton";
import { Footer } from "@/components/ui/Footer";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  sortParties,
  PARTY_COLORS,
  FALLBACK_COLOR,
  CARD_CLASS,
  CARD_PADDING,
  CARD_SHADOW,
} from "@/lib/constants";
import { PAGE_META } from "@/lib/page-meta";

const META = PAGE_META.find((p) => p.href === "/motions")!;

const TABS = ["Antrag", "Kleine Anfrage", "Große Anfrage"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABELS: Record<Tab, string> = {
  Antrag: "Anträge",
  "Kleine Anfrage": "Kleine Anfragen",
  "Große Anfrage": "Große Anfragen",
};

export default function MotionsPage() {
  const { activePeriodId } = usePeriod();
  const [stats, setStats] = useState<MotionsStatsFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("Antrag");

  // Keyword search
  const [query, setQuery] = useState("");
  const [titles, setTitles] = useState<MotionTitle[] | null>(null);
  const [titlesLoading, setTitlesLoading] = useState(false);

  useEffect(() => {
    if (!activePeriodId) return;
    setLoading(true);
    setUnavailable(false);
    setStats(null);
    setTitles(null);
    setQuery("");
    fetchData<MotionsStatsFile>(dataUrl("motions_stats.json", activePeriodId))
      .then((d) => {
        setStats(d);
        setLoading(false);
      })
      .catch(() => {
        setUnavailable(true);
        setLoading(false);
      });
  }, [activePeriodId]);

  // Lazy-load titles on first keystroke
  function handleQueryChange(q: string) {
    setQuery(q);
    if (q && !titles && !titlesLoading && activePeriodId) {
      setTitlesLoading(true);
      fetchData<MotionTitle[]>(dataUrl("motions_titles.json", activePeriodId))
        .then((d) => {
          setTitles(d);
          setTitlesLoading(false);
        })
        .catch(() => setTitlesLoading(false));
    }
  }

  const typData: MotionsTypData | undefined = stats?.[activeTab];

  // Normalized party list for this tab
  const parties = useMemo(() => {
    if (!typData) return [];
    return sortParties(
      typData.counts_by_party.map((i) => stripSoftHyphen(i.party)),
    );
  }, [typData]);

  // Timeline series — one line per party
  const timelineSeries = useMemo<KeywordSeries[]>(() => {
    if (!typData?.timeline?.series) return [];
    return typData.timeline.series.map((s) => ({
      keyword: stripSoftHyphen(s.party),
      color: PARTY_COLORS[stripSoftHyphen(s.party)] ?? FALLBACK_COLOR,
      counts: s.counts,
    }));
  }, [typData]);

  // Keyword search: count matching titles per party
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !titles) return null;
    const counts: Record<string, number> = {};
    for (const t of titles) {
      if (t.typ !== activeTab) continue;
      if (!t.titel.toLowerCase().includes(q)) continue;
      const party = stripSoftHyphen(t.party);
      counts[party] = (counts[party] ?? 0) + 1;
    }
    return Object.entries(counts)
      .map(([party, count]) => ({ party, count }))
      .sort((a, b) => b.count - a.count);
  }, [query, titles, activeTab]);

  return (
    <>
      <PageHeader {...META} />

      {/* Tab toggle */}
      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="px-4 py-1.5 rounded-full text-[13px] transition-colors"
            style={{
              background: activeTab === tab ? "#1E1B5E" : "#F0EEE9",
              color: activeTab === tab ? "#fff" : "#9A9790",
              fontWeight: activeTab === tab ? 600 : 400,
            }}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {unavailable ? (
        <p className="text-[14px]" style={{ color: "#9A9790" }}>
          Für diese Wahlperiode sind noch keine Drucksachen-Daten verfügbar.
        </p>
      ) : loading || !stats || !typData ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ChartSkeleton height={200} />
          <ChartSkeleton height={200} />
        </div>
      ) : (
        <>
          {/* Row 1: counts + timeline */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <MotionCountBars
              items={typData.counts_by_party.map((i) => ({
                party: stripSoftHyphen(i.party),
                count: i.count,
              }))}
              label="Anzahl pro Fraktion"
              sublabel={`Eingereichte ${TAB_LABELS[activeTab]} in dieser Legislaturperiode.`}
            />

            <section
              className={`${CARD_CLASS} ${CARD_PADDING}`}
              style={{ boxShadow: CARD_SHADOW }}
            >
              <h2
                className="font-extrabold text-[15px] mb-1"
                style={{ color: "#1E1B5E" }}
              >
                Einreichungen pro Monat
              </h2>
              <p className="text-[12px] mb-4" style={{ color: "#9A9790" }}>
                Wann wurden besonders viele {TAB_LABELS[activeTab]} eingereicht?
              </p>
              {typData.timeline.months.length > 0 ? (
                <KeywordTimeline
                  months={typData.timeline.months}
                  totalWords={typData.timeline.months.map(() => 1)}
                  series={timelineSeries}
                  normalized={false}
                />
              ) : (
                <p className="text-[13px]" style={{ color: "#9A9790" }}>
                  Keine Zeitdaten verfügbar.
                </p>
              )}
            </section>
          </div>

          {/* Row 2: party cards (word cloud + top authors) */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-6">
            {parties.map((party) => {
              const color = PARTY_COLORS[party] ?? FALLBACK_COLOR;
              const words: WordFreqEntry[] = (
                typData.word_freq[party] ?? []
              ).slice(0, 30);
              // Reshape to SpeakerRecord[] — wortanzahl_gesamt carries anzahl for bar widths
              const speakers: SpeakerRecord[] = (
                typData.top_authors[party] ?? []
              ).map((a, i) => ({
                fraktion: party,
                redner_id: i,
                vorname: a.vorname,
                nachname: a.nachname,
                anzahl_reden: a.anzahl,
                wortanzahl_gesamt: a.anzahl,
              }));
              const count =
                typData.counts_by_party.find(
                  (c) => stripSoftHyphen(c.party) === party,
                )?.count ?? 0;

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
                        {party}
                      </span>
                    </div>
                    <span
                      className="text-[12px] tabular-nums shrink-0"
                      style={{ color: "#9A9790" }}
                    >
                      {count.toLocaleString("de")}
                    </span>
                  </div>

                  {/* Word cloud from titles */}
                  {words.length > 0 && (
                    <WordCloud words={words} color={color} height={180} />
                  )}

                  {/* Top authors */}
                  {speakers.length > 0 && (
                    <div>
                      <p
                        className="text-[11px] font-bold tracking-[0.08em] uppercase mb-1"
                        style={{ color: "#9A9790" }}
                      >
                        Aktivste Einreicher
                      </p>
                      <SpeakerBars speakers={speakers} partyColor={color} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Row 3: keyword search (lazy-loaded) */}
          <div
            className={`${CARD_CLASS} p-5 md:p-6 mb-6`}
            style={{ boxShadow: CARD_SHADOW }}
          >
            <h2
              className="font-extrabold text-[15px] mb-1"
              style={{ color: "#1E1B5E" }}
            >
              Themen-Suche
            </h2>
            <p className="text-[12px] mb-4" style={{ color: "#9A9790" }}>
              Welche Fraktion hat diesen Begriff wie oft in{" "}
              {TAB_LABELS[activeTab]}-Titeln verwendet?
            </p>
            <input
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder={`Begriff suchen, z.B. migration, klima …`}
              className="w-full border border-[#E3E0DA] rounded-lg px-4 py-2 text-[14px] outline-none focus:border-[#4C46D9] mb-4"
              style={{ color: "#171613" }}
            />
            {titlesLoading && (
              <p className="text-[13px]" style={{ color: "#9A9790" }}>
                Daten werden geladen…
              </p>
            )}
            {searchResults && searchResults.length > 0 && (
              <MotionCountBars
                items={searchResults}
                label={`Treffer für „${query}"`}
                sublabel={`${searchResults
                  .reduce((s, i) => s + i.count, 0)
                  .toLocaleString(
                    "de",
                  )} ${TAB_LABELS[activeTab]} enthalten diesen Begriff.`}
              />
            )}
            {searchResults &&
              searchResults.length === 0 &&
              query.trim() &&
              !titlesLoading && (
                <p className="text-[13px]" style={{ color: "#9A9790" }}>
                  Keine {TAB_LABELS[activeTab]} mit &bdquo;{query}&ldquo;
                  gefunden.
                </p>
              )}
          </div>
        </>
      )}

      <Footer />
    </>
  );
}
