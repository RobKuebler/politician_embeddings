"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "@/lib/language-context";
import { usePeriod } from "@/lib/period-context";
import {
  fetchPeriodData,
  KeywordTimelineFile,
  KeywordTimelinePartiesFile,
} from "@/lib/data";
import {
  KeywordTimeline,
  KeywordSeries,
} from "@/components/charts/KeywordTimeline";
import { ChartSkeleton } from "@/components/ui/ChartSkeleton";
import { Footer } from "@/components/ui/Footer";
import { ToggleGroup } from "@/components/ui/ToggleGroup";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  CARD_CLASS,
  CARD_SHADOW,
  getPartyColor,
  getPartyShortLabel,
} from "@/lib/constants";
import { PAGE_META } from "@/lib/page-meta";

const META = PAGE_META.find((p) => p.href === "/trends")!;

// Fixed color palette for active keyword chips (max 6 simultaneous keywords)
const KEYWORD_COLORS = [
  "#E67E22",
  "#2980B9",
  "#27AE60",
  "#8E44AD",
  "#C0392B",
  "#16A085",
];

const MAX_KEYWORDS = 6;

interface ActiveKeyword {
  keyword: string;
  color: string;
}

export default function ThemenTrendsPage() {
  const t = useTranslation();
  const { activePeriodId } = usePeriod();
  const [data, setData] = useState<KeywordTimelineFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  // ── Chart A: keyword search state ────────────────────────────────────────
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [activeKeywords, setActiveKeywords] = useState<ActiveKeyword[]>([]);
  const [normalized, setNormalized] = useState(true);
  const [notFoundMsg, setNotFoundMsg] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Party data (lazy-loaded on first party interaction) ───────────────────
  const [partyData, setPartyData] = useState<KeywordTimelinePartiesFile | null>(
    null,
  );
  const [partyDataLoading, setPartyDataLoading] = useState(false);

  // ── Chart B: party comparison state ──────────────────────────────────────
  const [compQuery, setCompQuery] = useState("");
  const [compSuggestions, setCompSuggestions] = useState<string[]>([]);
  const [compKeyword, setCompKeyword] = useState<string | null>(null);
  const [compNotFound, setCompNotFound] = useState("");
  const [hiddenParties, setHiddenParties] = useState<Set<string>>(new Set());
  const compInputRef = useRef<HTMLInputElement>(null);

  // Load main timeline data when period changes
  useEffect(() => {
    if (!activePeriodId) return;
    setLoading(true);
    setUnavailable(false);
    setActiveKeywords([]);
    setPartyData(null);
    setCompKeyword(null);
    setCompQuery("");
    fetchPeriodData<KeywordTimelineFile>(
      "keyword_timeline.json",
      activePeriodId,
    )
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        setUnavailable(true);
        setLoading(false);
      });
  }, [activePeriodId]);

  // Lazy-load party data — called on first party interaction
  function ensurePartyData() {
    if (partyData || partyDataLoading || !activePeriodId) return;
    setPartyDataLoading(true);
    fetchPeriodData<KeywordTimelinePartiesFile>(
      "keyword_timeline_parties.json",
      activePeriodId,
    )
      .then((d) => {
        setPartyData(d);
        setPartyDataLoading(false);
      })
      .catch(() => setPartyDataLoading(false));
  }

  // Build sorted term list once for autocomplete
  const termList = useMemo(
    () => (data ? Object.keys(data.terms).sort() : []),
    [data],
  );

  // Autocomplete for Chart A keyword search
  useEffect(() => {
    if (!query.trim() || !data) {
      setSuggestions([]);
      return;
    }
    const q = query.trim().toLowerCase();
    const activeSet = new Set(activeKeywords.map((k) => k.keyword));
    setSuggestions(
      termList
        .filter((term) => term.startsWith(q) && !activeSet.has(term))
        .slice(0, 8),
    );
  }, [query, termList, data, activeKeywords]);

  // Autocomplete for Chart B keyword search
  useEffect(() => {
    if (!compQuery.trim() || !data) {
      setCompSuggestions([]);
      return;
    }
    const q = compQuery.trim().toLowerCase();
    setCompSuggestions(
      termList.filter((term) => term.startsWith(q)).slice(0, 8),
    );
  }, [compQuery, termList, data]);

  const usedColors = new Set(activeKeywords.map((k) => k.color));
  const nextColor =
    KEYWORD_COLORS.find((c) => !usedColors.has(c)) ?? KEYWORD_COLORS[0];

  function addKeyword(term: string) {
    const normalized = term.trim().toLowerCase();
    if (!normalized || !data) return;
    if (activeKeywords.some((k) => k.keyword === normalized)) {
      setQuery("");
      setSuggestions([]);
      setNotFoundMsg("");
      return;
    }
    if (activeKeywords.length >= MAX_KEYWORDS) {
      setQuery("");
      setSuggestions([]);
      setNotFoundMsg("");
      return;
    }
    if (!(normalized in data.terms)) {
      setNotFoundMsg(t.trends.not_found.replace("{term}", normalized));
      setSuggestions([]);
      return;
    }
    setNotFoundMsg("");
    setActiveKeywords((prev) => [
      ...prev,
      { keyword: normalized, color: nextColor },
    ]);
    setQuery("");
    setSuggestions([]);
  }

  function removeKeyword(keyword: string) {
    setActiveKeywords((prev) => prev.filter((k) => k.keyword !== keyword));
  }

  function addCompKeyword(term: string) {
    const normalized = term.trim().toLowerCase();
    if (!normalized || !data) return;
    if (!(normalized in data.terms)) {
      setCompNotFound(t.trends.not_found.replace("{term}", normalized));
      setCompSuggestions([]);
      return;
    }
    setCompNotFound("");
    setCompKeyword(normalized);
    setCompQuery(normalized);
    setHiddenParties(new Set());
    setCompSuggestions([]);
    ensurePartyData();
  }

  // Chart A: series
  const series: KeywordSeries[] = useMemo(() => {
    if (!data) return [];
    return activeKeywords.map((k) => ({
      keyword: k.keyword,
      color: k.color,
      counts: data.terms[k.keyword] ?? [],
    }));
  }, [data, activeKeywords]);

  // Chart B: one series per party for the selected comparison keyword
  const compSeries: KeywordSeries[] = useMemo(() => {
    if (!partyData || !compKeyword) return [];
    return partyData.parties.map((party) => ({
      keyword: getPartyShortLabel(party),
      color: getPartyColor(party),
      counts: partyData.by_party[compKeyword]?.[party] ?? [],
    }));
  }, [partyData, compKeyword]);

  // Chart B: per-party word counts for independent normalization
  const compSeriesWords: number[][] | undefined = useMemo(() => {
    if (!partyData || !compKeyword) return undefined;
    return partyData.parties.map((party) => partyData.party_words[party] ?? []);
  }, [partyData, compKeyword]);

  // True when the selected comparison keyword has party breakdown data
  const compHasPartyData = useMemo(
    () => !compKeyword || !partyData || compKeyword in partyData.by_party,
    [partyData, compKeyword],
  );

  return (
    <>
      <PageHeader color={META.color} {...t.pages.trends} />

      {unavailable ? (
        <p className="text-[14px]" style={{ color: "#524d8a" }}>
          {t.trends.no_data}
        </p>
      ) : loading ? (
        <ChartSkeleton height={360} />
      ) : (
        <div className="flex flex-col gap-5">
          {/* Shared normalization toggle — applies to both charts */}
          <ToggleGroup
            options={[
              { value: "per1000", label: t.trends.toggle_per_1000 },
              { value: "absolute", label: t.trends.toggle_absolute },
            ]}
            value={normalized ? "per1000" : "absolute"}
            onChange={(v) => setNormalized(v === "per1000")}
          />

          {/* ── Chart A: Keyword-Suche mit Partei-Filter ── */}
          <div
            className={`${CARD_CLASS} p-5 md:p-6 flex flex-col gap-5`}
            style={{ boxShadow: CARD_SHADOW }}
          >
            {/* Search + chips */}
            <div className="flex flex-col gap-3">
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setNotFoundMsg("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addKeyword(query);
                  }}
                  placeholder={
                    activeKeywords.length >= MAX_KEYWORDS
                      ? ""
                      : t.trends.search_placeholder_a
                  }
                  className="w-full border border-[#dddaf0] rounded-lg px-4 py-2 text-[14px] outline-none focus:border-[#2980B9]"
                  style={{ color: "#171613" }}
                  disabled={activeKeywords.length >= MAX_KEYWORDS}
                />
                {suggestions.length > 0 && (
                  <ul
                    className="absolute z-10 bg-white border border-[#dddaf0] rounded-lg mt-1 w-full overflow-hidden"
                    style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                  >
                    {suggestions.map((s) => (
                      <li
                        key={s}
                        className="px-4 py-2 text-[13px] cursor-pointer hover:bg-[#f0eef9]"
                        style={{ color: "#171613" }}
                        onMouseDown={() => addKeyword(s)}
                      >
                        {s}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {notFoundMsg && (
                <p className="text-[12px]" style={{ color: "#524d8a" }}>
                  {notFoundMsg}
                </p>
              )}

              {/* Active keyword chips */}
              {activeKeywords.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {activeKeywords.map((k) => (
                    <span
                      key={k.keyword}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-medium"
                      style={{
                        background: k.color + "20",
                        color: k.color,
                        border: `1px solid ${k.color}40`,
                      }}
                    >
                      {k.keyword}
                      <button
                        onClick={() => removeKeyword(k.keyword)}
                        className="leading-none hover:opacity-70"
                        aria-label={t.trends.remove_keyword_label.replace(
                          "{keyword}",
                          k.keyword,
                        )}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Chart A or empty state */}
            {series.length === 0 ? (
              <p
                className="text-[14px] text-center py-16"
                style={{ color: "#524d8a" }}
              >
                {t.trends.empty_a}
              </p>
            ) : (
              <KeywordTimeline
                months={data!.meta.months}
                totalWords={data!.meta.total_words_per_month}
                series={series}
                normalized={normalized}
              />
            )}
          </div>

          {/* ── Chart B: Partei-Vergleich für einen Begriff ── */}
          <div
            className={`${CARD_CLASS} p-5 md:p-6 flex flex-col gap-5`}
            style={{ boxShadow: CARD_SHADOW }}
          >
            <div className="flex flex-col gap-1">
              <h2
                className="text-[15px] font-semibold"
                style={{ color: "#171613" }}
              >
                {t.trends.party_comparison_title}
              </h2>
              <p className="text-[13px]" style={{ color: "#524d8a" }}>
                {t.trends.party_comparison_subtitle}
              </p>
            </div>

            {/* Chart B keyword search */}
            <div className="flex flex-col gap-2">
              <div className="relative">
                <input
                  ref={compInputRef}
                  type="text"
                  value={compQuery}
                  onChange={(e) => {
                    setCompQuery(e.target.value);
                    setCompKeyword(null);
                    setCompNotFound("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addCompKeyword(compQuery);
                  }}
                  placeholder={t.trends.search_placeholder_b}
                  className="w-full border border-[#dddaf0] rounded-lg px-4 py-2 text-[14px] outline-none focus:border-[#2980B9]"
                  style={{ color: "#171613" }}
                />
                {compSuggestions.length > 0 && (
                  <ul
                    className="absolute z-10 bg-white border border-[#dddaf0] rounded-lg mt-1 w-full overflow-hidden"
                    style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                  >
                    {compSuggestions.map((s) => (
                      <li
                        key={s}
                        className="px-4 py-2 text-[13px] cursor-pointer hover:bg-[#f0eef9]"
                        style={{ color: "#171613" }}
                        onMouseDown={() => addCompKeyword(s)}
                      >
                        {s}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {compNotFound && (
                <p className="text-[12px]" style={{ color: "#524d8a" }}>
                  {compNotFound}
                </p>
              )}
            </div>

            {/* Chart B content */}
            {partyDataLoading ? (
              <ChartSkeleton height={280} />
            ) : !compKeyword ? (
              <p
                className="text-[14px] text-center py-16"
                style={{ color: "#524d8a" }}
              >
                {t.trends.empty_b}
              </p>
            ) : !compHasPartyData ? (
              <p
                className="text-[14px] text-center py-12"
                style={{ color: "#524d8a" }}
              >
                {t.trends.too_rare}
              </p>
            ) : compSeries.length === 0 ? (
              <p
                className="text-[14px] text-center py-12"
                style={{ color: "#524d8a" }}
              >
                {t.trends.no_party_data}
              </p>
            ) : (
              <>
                {/* Party color legend — click to show/hide */}
                <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                  {compSeries.map((s) => {
                    const hidden = hiddenParties.has(s.keyword);
                    return (
                      <button
                        key={s.keyword}
                        onClick={() =>
                          setHiddenParties((prev) => {
                            const next = new Set(prev);
                            if (next.has(s.keyword)) next.delete(s.keyword);
                            else next.add(s.keyword);
                            return next;
                          })
                        }
                        className="flex items-center gap-1.5 text-[12px] transition-opacity"
                        style={{ opacity: hidden ? 0.35 : 1 }}
                        aria-pressed={!hidden}
                        title={
                          hidden
                            ? t.trends.show_hint.replace("{label}", s.keyword)
                            : t.trends.hide_hint.replace("{label}", s.keyword)
                        }
                      >
                        <span
                          style={{
                            display: "inline-block",
                            width: 14,
                            height: 3,
                            borderRadius: 2,
                            background: hidden ? "#524d8a" : s.color,
                          }}
                        />
                        <span style={{ color: hidden ? "#524d8a" : "#171613" }}>
                          {s.keyword}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <KeywordTimeline
                  months={data!.meta.months}
                  totalWords={data!.meta.total_words_per_month}
                  series={compSeries.filter(
                    (s) => !hiddenParties.has(s.keyword),
                  )}
                  normalized={normalized}
                  seriesWords={compSeriesWords?.filter(
                    (_, i) => !hiddenParties.has(compSeries[i].keyword),
                  )}
                />
              </>
            )}
          </div>
        </div>
      )}

      <Footer />
    </>
  );
}
