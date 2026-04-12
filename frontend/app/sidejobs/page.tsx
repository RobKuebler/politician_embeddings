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

  // Derive whether the active period is still ongoing from the label end year
  const activePeriod = periods.find((p) => p.wahlperiode === activePeriodId);
  const labelEndYear = activePeriod
    ? parseInt(activePeriod.label.match(/\d{4}$/)?.[0] ?? "0", 10)
    : 0;
  const isPeriodOngoing = labelEndYear > new Date().getFullYear();
  const incomeSubtitle = isPeriodOngoing ? t.sidejobs.hero_income_ongoing : t.sidejobs.hero_income_closed;

  const totalIncome = sjData
    ? sjData.jobs.reduce((s, j) => s + j.prorated_income, 0)
    : 0;
  const displayIncome = useCountUp(totalIncome, !loading && totalIncome > 0);
  const formattedIncome = formatEuroStat(displayIncome);

  useEffect(() => {
    if (!activePeriodId) return;
    setLoading(true);
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
      .catch((error) => {
        console.error(error);
        setLoading(false);
      });
  }, [activePeriodId]);

  const parties = sjData
    ? sortPresentParties(sjData.jobs.map((job) => job.party))
    : [];

  return (
    <>
      <PageHeader color={META.color} {...t.pages.sidejobs} />

      {/* Hero card — total income */}
      <div
        className="rounded-xl mb-6 overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, #1E1B5E 0%, #2E2A7A 60%, #3D3499 100%)",
          boxShadow: "0 4px 24px rgba(30,27,94,0.18)",
        }}
      >
        <div className="flex items-center gap-5 p-5 md:p-6">
          {/* Money-bag illustration */}
          <div
            style={{
              flexShrink: 0,
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "#E67E22",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 40,
              fontWeight: 900,
              color: "#fff",
              fontFamily: "serif",
              boxShadow: "0 2px 12px rgba(230,126,34,0.4)",
            }}
            aria-hidden
          >
            €
          </div>

          {/* Stats */}
          <div className="min-w-0 flex flex-col gap-4 flex-1">
            {/* Stat 1: total income */}
            <div>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.5)",
                  marginBottom: 2,
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
                  color: "#FFFFFF",
                  fontVariantNumeric: "tabular-nums",
                  transition: "font-size 0.2s",
                }}
              >
                {loading ? (
                  <span
                    style={{
                      display: "inline-block",
                      width: 160,
                      height: 32,
                      borderRadius: 6,
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
                  color: "rgba(255,255,255,0.45)",
                  marginTop: 2,
                }}
              >
                {incomeSubtitle}
              </p>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: "rgba(255,255,255,0.1)" }} />

            {/* Stat 2: coverage */}
            {loading ? (
              <span
                style={{
                  display: "inline-block",
                  width: 140,
                  height: 14,
                  borderRadius: 4,
                  background: "rgba(255,255,255,0.12)",
                }}
              />
            ) : sjData ? (
              <p
                style={{
                  fontSize: 13,
                  color: "rgba(255,255,255,0.45)",
                  lineHeight: 1.4,
                }}
              >
                {t.sidejobs.hero_coverage
                  .replace("{pct}", String(Math.round((sjData.coverage.with_amount / sjData.coverage.total) * 100)))
                  .replace("{with_amount}", sjData.coverage.with_amount.toLocaleString(language))
                  .replace("{total}", sjData.coverage.total.toLocaleString(language))}
              </p>
            ) : null}
          </div>
        </div>

        {/* Decorative stripe at bottom */}
        <div
          style={{
            height: 3,
            background:
              "linear-gradient(90deg, #E67E22 0%, #F39C12 50%, #E67E22 100%)",
          }}
        />
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
              style={{ color: "#1E1B5E" }}
            >
              {t.sidejobs.coverage_title}
            </h2>
            <p className="text-[12px] text-[#7872a8] mb-4">
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
              style={{ color: "#1E1B5E" }}
            >
              {t.sidejobs.income_category_title}
            </h2>
            <p className="text-[12px] text-[#7872a8] mb-4">
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
              style={{ color: "#1E1B5E" }}
            >
              {t.sidejobs.topics_title}
            </h2>
            <p className="text-[12px] text-[#7872a8] mb-4">
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
              style={{ color: "#1E1B5E" }}
            >
              {t.sidejobs.top_earners_title}
            </h2>
            <p className="text-[12px] text-[#7872a8] mb-4">
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
