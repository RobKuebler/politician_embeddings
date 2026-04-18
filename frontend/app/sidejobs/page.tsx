"use client";
import { useState, useEffect } from "react";
import { usePeriod } from "@/lib/period-context";
import { useTranslation, useLanguage } from "@/lib/language-context";
import {
  fetchPeriodFiles,
  SidejobsFile,
  Politician,
  stripSoftHyphen,
} from "@/lib/data";
import {
  IncomeByCategoryChart,
  TopTopicsChart,
  TopEarnersChart,
  SidejobCoverageByPartyChart,
} from "@/components/charts/SidejobsCharts";
import { ChartSkeleton } from "@/components/ui/ChartSkeleton";
import { Footer } from "@/components/ui/Footer";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  sortPresentParties,
  CARD_CLASS,
  CARD_SHADOW,
  CARD_PADDING,
} from "@/lib/constants";
import { PAGE_META } from "@/lib/page-meta";
import { formatEuroStat } from "@/lib/format";
import { useCountUp } from "@/hooks/useCountUp";

const META = PAGE_META.find((p) => p.href === "/sidejobs")!;

export default function SidejobsPage() {
  const t = useTranslation();
  const { language } = useLanguage();
  const { activePeriodId, periods } = usePeriod();
  const [sjData, setSjData] = useState<SidejobsFile | null>(null);
  const [politicians, setPoliticians] = useState<Politician[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Derive whether the active period is still ongoing from the label end year
  const activePeriod = periods.find((p) => p.wahlperiode === activePeriodId);
  const labelEndYear = activePeriod
    ? parseInt(activePeriod.label.match(/\d{4}$/)?.[0] ?? "0", 10)
    : 0;
  const isPeriodOngoing = labelEndYear > new Date().getFullYear();
  const incomeSubtitle = isPeriodOngoing
    ? t.sidejobs.hero_income_ongoing
    : t.sidejobs.hero_income_closed;

  const totalIncome = sjData
    ? sjData.jobs.reduce((s, j) => s + j.prorated_income, 0)
    : 0;
  const displayIncome = useCountUp(totalIncome, !loading && totalIncome > 0);
  const formattedIncome = formatEuroStat(displayIncome);

  useEffect(() => {
    if (!activePeriodId) return;
    setLoading(true);
    setLoadError(false);
    setSjData(null);
    setPoliticians([]);
    fetchPeriodFiles<{
      sidejobs: SidejobsFile;
      politicians: Politician[];
    }>(activePeriodId, {
      sidejobs: "sidejobs.json",
      politicians: "politicians.json",
    })
      .then(({ sidejobs, politicians }) => {
        setSjData({
          ...sidejobs,
          jobs: sidejobs.jobs.map((job) => ({
            ...job,
            party: stripSoftHyphen(job.party),
          })),
        });
        setPoliticians(politicians);
        setLoading(false);
      })
      .catch(() => {
        setLoadError(true);
        setLoading(false);
      });
  }, [activePeriodId, retryCount]);

  const parties = sjData
    ? sortPresentParties(sjData.jobs.map((job) => job.party))
    : [];

  return (
    <>
      <PageHeader color={META.color} {...t.pages.sidejobs} />

      {loadError && (
        <div className="flex items-center gap-3 mb-4">
          <p style={{ color: "#C04000", fontSize: 13 }}>
            {t.common.error_load}
          </p>
          <button
            onClick={() => setRetryCount((c) => c + 1)}
            className="text-[12px] font-bold underline transition-opacity duration-150 hover:opacity-70"
            style={{ color: "var(--color-navy)" }}
          >
            {t.common.retry}
          </button>
        </div>
      )}

      {/* Hero strip - key stats, editorial layout */}
      <div
        className="rounded-xl mb-6"
        style={{ background: "var(--color-navy)" }}
      >
        <div className="p-5 md:p-6">
          <div className="grid grid-cols-2 gap-x-8 gap-y-1">
            {/* Stat 1: total income */}
            <div>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.5)",
                  marginBottom: 4,
                }}
              >
                {t.sidejobs.hero_total_label}
              </p>
              <p
                style={{
                  fontSize: loading ? 28 : 34,
                  fontWeight: 900,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.1,
                  color: "#fff",
                  fontVariantNumeric: "tabular-nums",
                  transition: "font-size 0.2s",
                }}
              >
                {loading || displayIncome === 0 ? (
                  <span
                    style={{
                      display: "inline-block",
                      width: 140,
                      height: 32,
                      borderRadius: 4,
                      background: "rgba(255,255,255,0.12)",
                      verticalAlign: "middle",
                    }}
                  />
                ) : (
                  <>
                    {formattedIncome}{" "}
                    <span
                      style={{
                        fontWeight: 500,
                        fontSize: "0.6em",
                        color: "rgba(255,255,255,0.6)",
                      }}
                    >
                      €
                    </span>
                  </>
                )}
              </p>
              <p
                style={{
                  fontSize: 12,
                  color: "rgba(255,255,255,0.75)",
                  marginTop: 4,
                }}
              >
                {incomeSubtitle}
              </p>
            </div>

            {/* Stat 2: politicians tracked */}
            <div>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.5)",
                  marginBottom: 4,
                }}
              >
                {t.sidejobs.coverage_title}
              </p>
              {loading ? (
                <span
                  style={{
                    display: "inline-block",
                    width: 80,
                    height: 32,
                    borderRadius: 4,
                    background: "rgba(255,255,255,0.12)",
                    verticalAlign: "middle",
                  }}
                />
              ) : sjData ? (
                <>
                  <p
                    style={{
                      fontSize: 34,
                      fontWeight: 900,
                      letterSpacing: "-0.02em",
                      lineHeight: 1.1,
                      color: "#fff",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {sjData.coverage.total.toLocaleString(language)}
                  </p>
                  <p
                    style={{
                      fontSize: 12,
                      color: "rgba(255,255,255,0.75)",
                      marginTop: 4,
                    }}
                  >
                    {t.sidejobs.hero_coverage
                      .replace(
                        "{pct}",
                        String(
                          Math.round(
                            (sjData.coverage.with_amount /
                              sjData.coverage.total) *
                              100,
                          ),
                        ),
                      )
                      .replace(
                        "{with_amount}",
                        sjData.coverage.with_amount.toLocaleString(language),
                      )
                      .replace(
                        "{total}",
                        sjData.coverage.total.toLocaleString(language),
                      )}
                  </p>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-5">
          <ChartSkeleton />
          <ChartSkeleton />
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      ) : sjData ? (
        <div className="flex flex-col gap-5 stagger">
          {/* Coverage chart: per-party breakdown of Nebenverdienst / keine Angabe / kein Nebenjob */}
          <section
            className={`${CARD_CLASS} ${CARD_PADDING}`}
            style={{ boxShadow: CARD_SHADOW }}
          >
            <h2
              className="font-extrabold text-[15px] mb-1"
              style={{ color: "var(--color-navy)" }}
            >
              {t.sidejobs.coverage_title}
            </h2>
            <p className="text-[12px] text-[var(--color-muted)] mb-4 max-w-prose">
              {t.sidejobs.coverage_subtitle}
            </p>
            <SidejobCoverageByPartyChart
              jobs={sjData.jobs}
              politicians={politicians}
            />
          </section>

          <section
            className={`${CARD_CLASS} ${CARD_PADDING}`}
            style={{ boxShadow: CARD_SHADOW }}
          >
            <h2
              className="font-extrabold text-[15px] mb-1"
              style={{ color: "var(--color-navy)" }}
            >
              {t.sidejobs.income_category_title}
            </h2>
            <p className="text-[12px] text-[var(--color-muted)] mb-4 max-w-prose">
              {t.sidejobs.income_category_subtitle}
            </p>
            <IncomeByCategoryChart jobs={sjData.jobs} parties={parties} />
          </section>

          <section
            className={`${CARD_CLASS} ${CARD_PADDING}`}
            style={{ boxShadow: CARD_SHADOW }}
          >
            <h2
              className="font-extrabold text-[15px] mb-1"
              style={{ color: "var(--color-navy)" }}
            >
              {t.sidejobs.topics_title}
            </h2>
            <p className="text-[12px] text-[var(--color-muted)] mb-4 max-w-prose">
              {t.sidejobs.topics_subtitle}
            </p>
            <TopTopicsChart jobs={sjData.jobs} parties={parties} />
          </section>

          <section
            className={`${CARD_CLASS} ${CARD_PADDING}`}
            style={{ boxShadow: CARD_SHADOW }}
          >
            <h2
              className="font-extrabold text-[15px] mb-1"
              style={{ color: "var(--color-navy)" }}
            >
              {t.sidejobs.top_earners_title}
            </h2>
            <p className="text-[12px] text-[var(--color-muted)] mb-4 max-w-prose">
              {t.sidejobs.top_earners_subtitle}
            </p>
            <TopEarnersChart
              jobs={sjData.jobs}
              politicians={politicians}
              parties={parties}
            />
          </section>
        </div>
      ) : null}
      <Footer />
    </>
  );
}
