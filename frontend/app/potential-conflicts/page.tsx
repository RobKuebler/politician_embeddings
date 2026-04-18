"use client";
import { useState, useEffect } from "react";
import { usePeriod } from "@/lib/period-context";
import {
  fetchPeriodFiles,
  stripSoftHyphen,
  ConflictsFile,
  Politician,
} from "@/lib/data";
import {
  ConflictRankedList,
  ConflictHeatmap,
} from "@/components/charts/AusschussCharts";
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
import { useTranslation } from "@/lib/language-context";

const META = PAGE_META.find((p) => p.href === "/potential-conflicts")!;

function MethodologyNote() {
  const t = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`${CARD_CLASS} mt-5 overflow-hidden`}
      style={{ boxShadow: CARD_SHADOW }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="font-bold text-[13px]" style={{ color: "#1E1B5E" }}>
          {t.potential_conflicts.methodology_title}
        </span>
        <span
          className="text-[18px] leading-none select-none"
          style={{
            color: "#524d8a",
            transform: open ? "rotate(270deg)" : "rotate(90deg)",
            transition: "transform 0.2s",
            display: "inline-block",
          }}
          aria-hidden
        >
          ›
        </span>
      </button>

      {open && (
        <div
          className="px-4 pb-4 flex flex-col gap-3"
          style={{ borderTop: "1px solid #F0EFEB" }}
        >
          <p className="text-[12px] text-[#5a556b] pt-3 leading-relaxed">
            {t.potential_conflicts.methodology_p1}
          </p>

          <div
            className="rounded-xl p-3 text-[12px] leading-relaxed"
            style={{ background: "#FDF8F0", color: "#5a556b" }}
          >
            <p className="font-semibold mb-1" style={{ color: "#B8600A" }}>
              {t.potential_conflicts.methodology_limitations_title}
            </p>
            <ul className="list-disc list-inside flex flex-col gap-1.5">
              <li>{t.potential_conflicts.methodology_l1}</li>
              <li>{t.potential_conflicts.methodology_l2}</li>
              <li>{t.potential_conflicts.methodology_l3}</li>
              <li>{t.potential_conflicts.methodology_l4}</li>
            </ul>
          </div>

          <p className="text-[11px]" style={{ color: "#524d8a" }}>
            {t.potential_conflicts.methodology_footer}
          </p>
        </div>
      )}
    </div>
  );
}

export default function AusschussePage() {
  const t = useTranslation();
  const { activePeriodId } = usePeriod();
  const [data, setData] = useState<ConflictsFile | null>(null);
  const [politicians, setPoliticians] = useState<Politician[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activePeriodId) return;
    setLoading(true);
    setData(null);
    setPoliticians([]);
    fetchPeriodFiles<{
      conflicts: ConflictsFile;
      politicians: Politician[];
    }>(activePeriodId, {
      conflicts: "conflicts.json",
      politicians: "politicians.json",
    })
      .then(({ conflicts, politicians }) => {
        setData({
          ...conflicts,
          conflicts: conflicts.conflicts.map((c) => ({
            ...c,
            party: stripSoftHyphen(c.party),
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

  const totalIncome = data?.stats.total_income ?? 0;
  const displayIncome = useCountUp(totalIncome, !loading && totalIncome > 0);
  const formattedIncome = formatEuroStat(displayIncome);

  // Derive party list from conflicts in PARTY_ORDER
  const parties = data
    ? sortPresentParties(data.conflicts.map((conflict) => conflict.party))
    : [];

  return (
    <>
      <PageHeader color={META.color} {...t.pages.potential_conflicts} />

      {/* Hero card */}
      <div
        className="rounded-xl mb-6 overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, #1E1B5E 0%, #2E2A7A 60%, #3D3499 100%)",
          boxShadow: "0 4px 24px rgba(30,27,94,0.18)",
        }}
      >
        <div className="flex items-center gap-5 p-5 md:p-6">
          {/* Warning icon */}
          <div
            style={{
              flexShrink: 0,
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "#C0392B",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
              lineHeight: 1,
              paddingBottom: 6,
              color: "#fff",
              boxShadow: "0 2px 12px rgba(192,57,43,0.4)",
            }}
            aria-hidden
          >
            ⚠
          </div>

          <div className="min-w-0 flex flex-col gap-4 flex-1">
            {/* Total conflicted income */}
            <div>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.8)",
                  marginBottom: 2,
                }}
              >
                {t.potential_conflicts.hero_income_label}
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
                        color: "rgba(255,255,255,0.85)",
                      }}
                    >
                      €
                    </span>
                  </>
                )}
              </p>
            </div>

            <div style={{ height: 1, background: "rgba(255,255,255,0.1)" }} />

            {/* Affected politicians + committees */}
            {loading ? (
              <span
                style={{
                  display: "inline-block",
                  width: 180,
                  height: 14,
                  borderRadius: 4,
                  background: "rgba(255,255,255,0.12)",
                }}
              />
            ) : data ? (
              <div style={{ display: "flex", gap: 24 }}>
                <div>
                  <p
                    style={{
                      fontSize: 20,
                      fontWeight: 900,
                      color: "#fff",
                      lineHeight: 1.1,
                    }}
                  >
                    {data.stats.affected_politicians}
                  </p>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.75)" }}>
                    {t.potential_conflicts.hero_politicians_label}
                  </p>
                </div>
                <div>
                  <p
                    style={{
                      fontSize: 20,
                      fontWeight: 900,
                      color: "#fff",
                      lineHeight: 1.1,
                    }}
                  >
                    {data.stats.affected_committees}
                  </p>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.75)" }}>
                    {t.potential_conflicts.hero_committees_label}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Red accent stripe */}
        <div
          style={{
            height: 3,
            background:
              "linear-gradient(90deg, #C0392B 0%, #E74C3C 50%, #C0392B 100%)",
          }}
        />
      </div>

      {loading ? (
        <div className="flex flex-col gap-5">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      ) : data && data.conflicts.length > 0 ? (
        <div className="flex flex-col gap-5 stagger">
          {/* Ranked list */}
          <section
            className={`${CARD_CLASS} ${CARD_PADDING}`}
            style={{ boxShadow: CARD_SHADOW }}
          >
            <h2
              className="font-extrabold text-[15px] mb-1"
              style={{ color: "#1E1B5E" }}
            >
              {t.potential_conflicts.ranked_title}
            </h2>
            <p className="text-[12px] text-[#524d8a] mb-4">
              {t.potential_conflicts.ranked_subtitle}
            </p>
            <ConflictRankedList
              conflicts={data.conflicts}
              politicians={politicians}
            />
          </section>

          {/* Heatmap */}
          <section
            className={`${CARD_CLASS} ${CARD_PADDING}`}
            style={{ boxShadow: CARD_SHADOW }}
          >
            <h2
              className="font-extrabold text-[15px] mb-1"
              style={{ color: "#1E1B5E" }}
            >
              {t.potential_conflicts.heatmap_title}
            </h2>
            <p className="text-[12px] text-[#524d8a] mb-4">
              {t.potential_conflicts.heatmap_subtitle}
            </p>
            <ConflictHeatmap conflicts={data.conflicts} parties={parties} />
          </section>
        </div>
      ) : !loading ? (
        <p className="text-[13px] text-[#524d8a] text-center py-10">
          {t.potential_conflicts.no_conflicts}
        </p>
      ) : null}

      {/* Methodology note */}
      <MethodologyNote />

      <Footer />
    </>
  );
}
