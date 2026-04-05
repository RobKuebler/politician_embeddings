"use client";
import { useState, useEffect, useRef } from "react";
import { usePeriod } from "@/lib/period-context";
import {
  fetchData,
  dataUrl,
  stripSoftHyphen,
  ConflictsFile,
  Politician,
} from "@/lib/data";
import {
  ConflictRankedList,
  ConflictHeatmap,
} from "@/components/charts/AusschuessCharts";
import { ChartSkeleton } from "@/components/ui/ChartSkeleton";
import { Footer } from "@/components/ui/Footer";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  PARTY_ORDER,
  CARD_CLASS,
  CARD_SHADOW,
  CARD_PADDING,
} from "@/lib/constants";
import { PAGE_META } from "@/lib/page-meta";

const META = PAGE_META.find((p) => p.href === "/potential-conflicts")!;

/** Animates a number from 0 to `target` over ~1.2 s using easeOutExpo. */
function useCountUp(target: number, active: boolean) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active || target === 0) return;
    let cancelled = false;
    const duration = 1200;
    const start = performance.now();
    const tick = (now: number) => {
      if (cancelled) return;
      const t = Math.min((now - start) / duration, 1);
      const ease = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      setDisplay(Math.round(ease * target));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, active]);

  return display;
}

export default function AusschussePage() {
  const { activePeriodId } = usePeriod();
  const [data, setData] = useState<ConflictsFile | null>(null);
  const [politicians, setPoliticians] = useState<Politician[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activePeriodId) return;
    setLoading(true);
    Promise.all([
      fetchData<ConflictsFile>(dataUrl("conflicts.json", activePeriodId)),
      fetchData<Politician[]>(dataUrl("politicians.json", activePeriodId)),
    ])
      .then(([conflicts, pols]) => {
        setData({
          ...conflicts,
          conflicts: conflicts.conflicts.map((c) => ({
            ...c,
            party: stripSoftHyphen(c.party),
          })),
        });
        setPoliticians(pols);
        setLoading(false);
      })
      .catch(console.error);
  }, [activePeriodId]);

  const totalIncome = data?.stats.total_income ?? 0;
  const displayIncome = useCountUp(totalIncome, !loading && totalIncome > 0);
  const formattedIncome =
    displayIncome >= 1_000_000
      ? `${(displayIncome / 1_000_000).toLocaleString("de", {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })} Mio.`
      : displayIncome.toLocaleString("de");

  // Derive party list from conflicts in PARTY_ORDER
  const present = data
    ? new Set(data.conflicts.map((c) => c.party))
    : new Set<string>();
  const parties = data
    ? [
        ...PARTY_ORDER.filter((p) => present.has(p)),
        ...Array.from(present)
          .filter((p) => !PARTY_ORDER.includes(p))
          .sort(),
      ]
    : [];

  return (
    <>
      <PageHeader {...META} />

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
                  color: "rgba(255,255,255,0.5)",
                  marginBottom: 2,
                }}
              >
                Konfliktiertes Nebeneinkommen gesamt
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
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
                    Abgeordnete betroffen
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
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
                    Ausschüsse betroffen
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
              Top-Konflikte nach Abgeordnetem
            </h2>
            <p className="text-[12px] text-[#9A9790] mb-4">
              Abgeordnete mit Nebeneinkommen in einem Themenfeld, das ihr
              Ausschuss verantwortet. Sitzt ein Abgeordneter in mehreren
              betroffenen Ausschüssen, wird das Einkommen mehrfach gezählt, weil
              jedes Mandat einen eigenständigen Interessenkonflikt darstellt.
              Sortiert nach Gesamtbetrag.
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
              Konflikte nach Thema & Fraktion
            </h2>
            <p className="text-[12px] text-[#9A9790] mb-4">
              Summiertes Nebeneinkommen je Themenfeld und Fraktion, bei dem eine
              Ausschuss-Überschneidung besteht. Intensivere Färbung bedeutet
              höheres konfliktiertes Einkommen.
            </p>
            <ConflictHeatmap conflicts={data.conflicts} parties={parties} />
          </section>
        </div>
      ) : !loading ? (
        <p className="text-[13px] text-[#9A9790] text-center py-10">
          Keine Interessenkonflikte für diese Wahlperiode gefunden.
        </p>
      ) : null}

      <Footer />
    </>
  );
}
