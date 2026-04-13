"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { usePeriod } from "@/lib/period-context";
import {
  fetchData,
  dataUrl,
  stripSoftHyphen,
  MotionsStatsFile,
  MotionsTypData,
  MotionTitle,
  MotionAuthor,
  WordFreqEntry,
  SpeakerRecord,
} from "@/lib/data";
import { WordCloud } from "@/components/charts/WordCloud";
import { SpeakerBars } from "@/components/charts/SpeakerBars";
import { ToggleGroup } from "@/components/ui/ToggleGroup";
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
  CARD_CLASS,
  CARD_PADDING,
  CARD_SHADOW,
  getPartyColor,
  getPartyShortLabel,
} from "@/lib/constants";
import { PAGE_META } from "@/lib/page-meta";
import { useTranslation, useLanguage } from "@/lib/language-context";

const META = PAGE_META.find((p) => p.href === "/motions")!;

const TABS = ["Antrag", "Kleine Anfrage", "Große Anfrage"] as const;
type Tab = (typeof TABS)[number];

export default function MotionsPage() {
  const t = useTranslation();
  const { language } = useLanguage();
  const TAB_LABELS: Record<Tab, string> = {
    Antrag: t.motions.tab_motion,
    "Kleine Anfrage": t.motions.tab_small_inquiry,
    "Große Anfrage": t.motions.tab_large_inquiry,
  };
  const { activePeriodId } = usePeriod();
  const [stats, setStats] = useState<MotionsStatsFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("Antrag");

  // Keyword search
  const [query, setQuery] = useState("");
  const [titles, setTitles] = useState<MotionTitle[] | null>(null);
  const [titlesLoading, setTitlesLoading] = useState(false);

  // Tracks the latest activePeriodId so in-flight fetches can detect stale results
  const activePeriodRef = useRef(activePeriodId);
  useEffect(() => {
    activePeriodRef.current = activePeriodId;
  }, [activePeriodId]);

  useEffect(() => {
    if (!activePeriodId) return;
    setLoading(true);
    setUnavailable(false);
    setStats(null);
    setTitles(null);
    setTitlesLoading(false);
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
      const periodAtCallTime = activePeriodId;
      fetchData<MotionTitle[]>(dataUrl("motions_titles.json", activePeriodId))
        .then((d) => {
          // Discard result if the period changed while the fetch was in-flight
          if (activePeriodRef.current !== periodAtCallTime) return;
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

  // Pre-sliced word arrays — stable references so WordCloud memo works and
  // layouts don't restart on every parent render (same pattern as speeches page).
  // Keys are normalized via stripSoftHyphen so they match the canonical party names
  // produced by sortParties (which also normalizes aliases like "Grüne" → canonical).
  const wordSlices = useMemo<Record<string, WordFreqEntry[]>>(() => {
    if (!typData) return {};
    const result: Record<string, WordFreqEntry[]> = {};
    for (const [party, words] of Object.entries(typData.word_freq)) {
      result[stripSoftHyphen(party)] = words.slice(0, 30);
    }
    return result;
  }, [typData]);

  // Top authors keyed by normalized party name — parallel normalization to wordSlices.
  const topAuthors = useMemo<Record<string, MotionAuthor[]>>(() => {
    if (!typData) return {};
    const result: Record<string, MotionAuthor[]> = {};
    for (const [party, authors] of Object.entries(typData.top_authors)) {
      result[stripSoftHyphen(party)] = authors;
    }
    return result;
  }, [typData]);

  // Timeline series — one line per party
  const timelineSeries = useMemo<KeywordSeries[]>(() => {
    if (!typData?.timeline?.series) return [];
    return typData.timeline.series.map((s) => ({
      keyword: stripSoftHyphen(s.party),
      color: getPartyColor(s.party),
      counts: s.counts,
    }));
  }, [typData]);

  // totalWords is required by KeywordTimeline but only used when normalized=true.
  // Motions counts are absolute, never normalized.
  const dummyTotalWords = useMemo(
    () => (typData?.timeline.months ?? []).map(() => 1),
    [typData],
  );

  // Keyword search: count matching titles per party, and collect the actual titles
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !titles) return null;
    const byParty: Record<string, string[]> = {};
    for (const entry of titles) {
      if (entry.typ !== activeTab) continue;
      if (!entry.titel.toLowerCase().includes(q)) continue;
      const party = stripSoftHyphen(entry.party);
      if (!byParty[party]) byParty[party] = [];
      byParty[party].push(entry.titel);
    }
    return Object.entries(byParty)
      .map(([party, matched]) => ({ party, count: matched.length, matched }))
      .sort((a, b) => b.count - a.count);
  }, [query, titles, activeTab]);

  return (
    <>
      <PageHeader color={META.color} {...t.pages.motions} />

      {/* Tab toggle */}
      <div className="mb-6">
        <ToggleGroup
          options={TABS.map((tab) => ({ value: tab, label: TAB_LABELS[tab] }))}
          value={activeTab}
          onChange={setActiveTab}
        />
      </div>

      {unavailable ? (
        <p className="text-[14px]" style={{ color: "#7872a8" }}>
          {t.motions.no_data}
        </p>
      ) : loading || !stats || !typData ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ChartSkeleton height={200} />
          <ChartSkeleton height={200} />
        </div>
      ) : (
        <>
          {/* Row 1: counts + timeline */}
          <div className="flex flex-col gap-6 mb-6">
            <MotionCountBars
              items={typData.counts_by_party.map((i) => ({
                party: stripSoftHyphen(i.party),
                count: i.count,
              }))}
              label={t.motions.count_label}
              sublabel={t.motions.count_sublabel.replace(
                "{tab}",
                TAB_LABELS[activeTab],
              )}
            />

            <section
              className={`${CARD_CLASS} ${CARD_PADDING}`}
              style={{ boxShadow: CARD_SHADOW }}
            >
              <h2
                className="font-extrabold text-[15px] mb-1"
                style={{ color: "#1E1B5E" }}
              >
                {t.motions.timeline_title}
              </h2>
              <p className="text-[12px] mb-4" style={{ color: "#7872a8" }}>
                {t.motions.timeline_subtitle.replace(
                  "{tab}",
                  TAB_LABELS[activeTab],
                )}
              </p>
              {typData.timeline.months.length > 0 ? (
                <KeywordTimeline
                  months={typData.timeline.months}
                  totalWords={dummyTotalWords}
                  series={timelineSeries}
                  normalized={false}
                />
              ) : (
                <p className="text-[13px]" style={{ color: "#7872a8" }}>
                  {t.motions.no_time_data}
                </p>
              )}
            </section>
          </div>

          {/* Row 2: party cards (word cloud + top authors) */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-6">
            {parties.map((party, i) => {
              const color = getPartyColor(party);
              const words: WordFreqEntry[] = wordSlices[party] ?? [];
              // Reshape to SpeakerRecord[] — wortanzahl_gesamt carries anzahl for bar widths
              const speakers: SpeakerRecord[] = (topAuthors[party] ?? []).map(
                (a, i) => ({
                  fraktion: party,
                  redner_id: i,
                  vorname: a.vorname,
                  nachname: a.nachname,
                  anzahl_reden: a.anzahl,
                  wortanzahl_gesamt: a.anzahl,
                }),
              );
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
                        {getPartyShortLabel(party)}
                      </span>
                    </div>
                    <span
                      className="text-[12px] tabular-nums shrink-0"
                      style={{ color: "#7872a8" }}
                    >
                      {count.toLocaleString(language)}
                    </span>
                  </div>

                  {/* Word cloud from titles */}
                  {words.length > 0 && (
                    <WordCloud
                      words={words}
                      color={color}
                      height={180}
                      startDelay={i * 180}
                    />
                  )}

                  {/* Top authors */}
                  {speakers.length > 0 && (
                    <div>
                      <p
                        className="text-[11px] font-bold tracking-[0.08em] uppercase mb-1"
                        style={{ color: "#7872a8" }}
                      >
                        {t.motions.top_authors}
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
              {t.motions.search_title}
            </h2>
            <p className="text-[12px] mb-4" style={{ color: "#7872a8" }}>
              {t.motions.search_subtitle.replace(
                "{tab}",
                TAB_LABELS[activeTab],
              )}
            </p>
            <input
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder={t.motions.search_placeholder}
              className="w-full border border-[#dddaf0] rounded-lg px-4 py-2 text-[14px] outline-none focus:border-[#4C46D9] mb-4"
              style={{ color: "#171613" }}
            />
            {titlesLoading && (
              <p className="text-[13px]" style={{ color: "#7872a8" }}>
                {t.motions.search_loading}
              </p>
            )}
            {searchResults && searchResults.length > 0 && (
              <>
                <MotionCountBars
                  items={searchResults}
                  label={`${t.motions.hits_for} „${query}"`}
                  sublabel={t.motions.hits_sublabel
                    .replace(
                      "{count}",
                      searchResults
                        .reduce((s, i) => s + i.count, 0)
                        .toLocaleString(language),
                    )
                    .replace("{tab}", TAB_LABELS[activeTab])}
                />

                {/* Title list grouped by party */}
                <div className="mt-5 flex flex-col gap-4">
                  {searchResults.map(({ party, count, matched }) => {
                    const color = getPartyColor(party);
                    return (
                      <div key={party}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <div
                            className="shrink-0 rounded-full"
                            style={{ width: 4, height: 16, background: color }}
                          />
                          <span
                            className="font-bold text-[13px]"
                            style={{ color: "#1E1B5E" }}
                          >
                            {party}
                          </span>
                          <span
                            className="text-[12px] tabular-nums"
                            style={{ color: "#7872a8" }}
                          >
                            {count.toLocaleString(language)}
                          </span>
                        </div>
                        <ul className="pl-3">
                          {matched.map((title, i) => (
                            <li
                              key={i}
                              className="text-[13px] leading-snug py-1.5"
                              style={{
                                color: "#171613",
                                borderBottom:
                                  i < matched.length - 1
                                    ? "1px solid #eeedf8"
                                    : "none",
                              }}
                            >
                              {title}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            {searchResults &&
              searchResults.length === 0 &&
              query.trim() &&
              !titlesLoading && (
                <p className="text-[13px]" style={{ color: "#7872a8" }}>
                  {t.motions.no_results
                    .replace("{tab}", TAB_LABELS[activeTab])
                    .replace("{query}", query)}
                </p>
              )}
          </div>
        </>
      )}

      <Footer />
    </>
  );
}
