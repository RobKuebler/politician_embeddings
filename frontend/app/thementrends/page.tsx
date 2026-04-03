"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { usePeriod } from "@/lib/period-context";
import { fetchData, dataUrl, KeywordTimelineFile } from "@/lib/data";
import {
  KeywordTimeline,
  KeywordSeries,
} from "@/components/charts/KeywordTimeline";
import { ChartSkeleton } from "@/components/ui/ChartSkeleton";
import { Footer } from "@/components/ui/Footer";
import { PageHeader } from "@/components/ui/PageHeader";

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
  const { activePeriodId } = usePeriod();
  const [data, setData] = useState<KeywordTimelineFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [activeKeywords, setActiveKeywords] = useState<ActiveKeyword[]>([]);
  const [normalized, setNormalized] = useState(true);
  const [notFoundMsg, setNotFoundMsg] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!activePeriodId) return;
    setLoading(true);
    setUnavailable(false);
    setActiveKeywords([]);
    fetchData<KeywordTimelineFile>(
      dataUrl("keyword_timeline.json", activePeriodId),
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

  // Build sorted term list once for autocomplete
  const termList = useMemo(
    () => (data ? Object.keys(data.terms).sort() : []),
    [data],
  );

  // Update autocomplete suggestions as query changes
  useEffect(() => {
    if (!query.trim() || !data) {
      setSuggestions([]);
      return;
    }
    const q = query.trim().toLowerCase();
    setSuggestions(termList.filter((t) => t.startsWith(q)).slice(0, 8));
  }, [query, termList, data]);

  const usedColors = new Set(activeKeywords.map((k) => k.color));
  const nextColor =
    KEYWORD_COLORS.find((c) => !usedColors.has(c)) ?? KEYWORD_COLORS[0];

  function addKeyword(term: string) {
    const normalizedTerm = term.trim().toLowerCase();
    if (!normalizedTerm || !data) return;
    if (activeKeywords.some((k) => k.keyword === normalizedTerm)) {
      setQuery("");
      setSuggestions([]);
      setNotFoundMsg("");
      return;
    }
    if (activeKeywords.length >= MAX_KEYWORDS) {
      setQuery("");
      setSuggestions([]);
      return;
    }
    if (!(normalizedTerm in data.terms)) {
      setNotFoundMsg(
        `„${normalizedTerm}" kommt nicht häufig genug vor oder ist nicht im Index.`,
      );
      setSuggestions([]);
      return;
    }
    setNotFoundMsg("");
    setActiveKeywords((prev) => [
      ...prev,
      { keyword: normalizedTerm, color: nextColor },
    ]);
    setQuery("");
    setSuggestions([]);
  }

  function removeKeyword(keyword: string) {
    setActiveKeywords((prev) => prev.filter((k) => k.keyword !== keyword));
  }

  const series: KeywordSeries[] = useMemo(
    () =>
      data
        ? activeKeywords.map((k) => ({
            keyword: k.keyword,
            color: k.color,
            counts: data.terms[k.keyword] ?? [],
          }))
        : [],
    [data, activeKeywords],
  );

  return (
    <>
      <PageHeader
        color="#2980B9"
        label="Zeitverlauf"
        title="Wann wurde worüber gesprochen?"
        description="Verfolge, wie oft ein Begriff in Plenardebatten erwähnt wurde — und wann Themen politisch heiß wurden."
      />

      {unavailable ? (
        <p className="text-[14px]" style={{ color: "#9A9790" }}>
          Für diese Wahlperiode sind noch keine Verlaufsdaten verfügbar.
        </p>
      ) : loading ? (
        <ChartSkeleton height={360} />
      ) : (
        <div
          className="bg-white rounded-xl border border-[#E3E0DA] p-5 md:p-6 flex flex-col gap-5"
          style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
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
                placeholder="Begriff suchen, z.B. migration, ukraine …"
                className="w-full border border-[#E3E0DA] rounded-lg px-4 py-2 text-[14px] outline-none focus:border-[#2980B9]"
                style={{ color: "#171613" }}
                disabled={activeKeywords.length >= MAX_KEYWORDS}
              />
              {suggestions.length > 0 && (
                <ul
                  className="absolute z-10 bg-white border border-[#E3E0DA] rounded-lg mt-1 w-full overflow-hidden"
                  style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                >
                  {suggestions.map((s) => (
                    <li
                      key={s}
                      className="px-4 py-2 text-[13px] cursor-pointer hover:bg-[#F7F5F0]"
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
              <p className="text-[12px]" style={{ color: "#9A9790" }}>
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
                      aria-label={`${k.keyword} entfernen`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Toggle absolute / normalized */}
          <div className="flex justify-end gap-1">
            {(["Pro 1.000 Wörter", "Absolut"] as const).map((label) => {
              const isNorm = label === "Pro 1.000 Wörter";
              const active = normalized === isNorm;
              return (
                <button
                  key={label}
                  onClick={() => setNormalized(isNorm)}
                  className="px-3 py-1 rounded-full text-[12px] transition-colors"
                  style={{
                    background: active ? "#1E1B5E" : "#F0EEE9",
                    color: active ? "#fff" : "#9A9790",
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Chart or empty state */}
          {series.length === 0 ? (
            <p
              className="text-[14px] text-center py-16"
              style={{ color: "#9A9790" }}
            >
              Gib einen Begriff ein um seinen Verlauf im Plenum zu sehen.
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
      )}

      <Footer />
    </>
  );
}
