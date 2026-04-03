"use client";
import { useState, useEffect, useRef } from "react";
import { usePeriod } from "@/lib/period-context";
import {
  fetchData,
  dataUrl,
  SidejobsFile,
  Politician,
  stripSoftHyphen,
} from "@/lib/data";
import {
  IncomeByPartyChart,
  IncomeByCategoryChart,
  TopTopicsChart,
  TopEarnersChart,
  SidejobCoverageByPartyChart,
} from "@/components/charts/SidejobsCharts";
import { ChartSkeleton } from "@/components/ui/ChartSkeleton";
import { Footer } from "@/components/ui/Footer";
import { PageHeader } from "@/components/ui/PageHeader";
import { PARTY_ORDER } from "@/lib/constants";

/** Animates a number from 0 to `target` over ~1.2 s using easeOutExpo. */
function useCountUp(target: number, active: boolean) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active || target === 0) return;
    const duration = 1200;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      // easeOutExpo
      const ease = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      setDisplay(Math.round(ease * target));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, active]);

  return display;
}

export default function SidejobsPage() {
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
  const incomeSubtitle = isPeriodOngoing
    ? "Zahlungen in der laufenden Legislaturperiode bis jetzt"
    : "Zahlungen in der gesamten Legislaturperiode";

  const totalIncome = sjData
    ? sjData.jobs.reduce((s, j) => s + j.prorated_income, 0)
    : 0;
  const displayIncome = useCountUp(totalIncome, !loading && totalIncome > 0);
  // Format as "X,X Mio." once above 1M, otherwise plain thousands
  const formattedIncome =
    displayIncome >= 1_000_000
      ? `${(displayIncome / 1_000_000).toLocaleString("de", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Mio.`
      : displayIncome.toLocaleString("de");

  useEffect(() => {
    if (!activePeriodId) return;
    setLoading(true);
    Promise.all([
      fetchData<SidejobsFile>(dataUrl("sidejobs.json", activePeriodId)),
      fetchData<Politician[]>(dataUrl("politicians.json", activePeriodId)),
    ])
      .then(([sj, pols]) => {
        setSjData({
          ...sj,
          jobs: sj.jobs.map((j) => ({ ...j, party: stripSoftHyphen(j.party) })),
        });
        setPoliticians(pols);
        setLoading(false);
      })
      .catch(console.error);
  }, [activePeriodId]);

  const present = sjData
    ? new Set(sjData.jobs.map((j) => j.party))
    : new Set<string>();
  const parties = sjData
    ? [
        ...PARTY_ORDER.filter((p) => present.has(p)),
        ...Array.from(present)
          .filter((p) => !PARTY_ORDER.includes(p))
          .sort(),
      ]
    : [];

  return (
    <>
      <PageHeader
        color="#E67E22"
        label="Transparenz"
        title="Wer verdient noch dazu?"
        description="Bundestagsabgeordnete sind gesetzlich verpflichtet, entgeltliche Nebentätigkeiten ab 1.000 € monatlich zu melden (§ 44a AbgG). Diese Auswertung basiert auf den öffentlich zugänglichen Meldungen und zeigt, in welchen Parteien, Branchen und Themenfeldern Nebeneinkünfte besonders verbreitet sind."
      />

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
                Gesamtes Nebeneinkommen
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
                Nur bei{" "}
                <span
                  style={{ fontWeight: 700, color: "rgba(255,255,255,0.75)" }}
                >
                  {Math.round(
                    (sjData.coverage.with_amount / sjData.coverage.total) * 100,
                  )}{" "}
                  %
                </span>{" "}
                der Nebentätigkeiten (
                {sjData.coverage.with_amount.toLocaleString("de")} von{" "}
                {sjData.coverage.total.toLocaleString("de")}) wurde ein Betrag
                angegeben.
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
            className="bg-white rounded-xl border border-[#E3E0DA] p-5 md:p-6"
            style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
          >
            <h2
              className="font-extrabold text-[15px] mb-1"
              style={{ color: "#1E1B5E" }}
            >
              Abgeordnete mit Nebenverdienst
            </h2>
            <p className="text-[12px] text-[#9A9790] mb-4">
              Anteil der Abgeordneten je Fraktion, die mindestens eine
              meldepflichtige Nebentätigkeit ausüben. Als Nebenverdienst gilt
              ein gemeldetes Einkommen ab 1.000 € monatlich (§ 44a AbgG, Stufe
              1). Abgeordnete mit gemeldeter Tätigkeit ohne Einkommensangabe
              werden gesondert ausgewiesen.
            </p>
            <SidejobCoverageByPartyChart
              jobs={sjData.jobs}
              politicians={politicians}
            />
          </section>

          <section
            className="bg-white rounded-xl border border-[#E3E0DA] p-5 md:p-6"
            style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
          >
            <h2
              className="font-extrabold text-[15px] mb-1"
              style={{ color: "#1E1B5E" }}
            >
              Einkommen nach Partei
            </h2>
            <p className="text-[12px] text-[#9A9790] mb-4">
              Hochgerechnetes Gesamteinkommen aller Nebentätigkeiten je
              Fraktion. Monatliche Zahlungen werden auf die gesamte
              Legislaturperiode hochgerechnet, jährliche entsprechend anteilig.
              Der Durchschnittswert pro Abgeordnetem mit Nebenverdienst ist
              separat ausgewiesen.
            </p>
            <IncomeByPartyChart
              jobs={sjData.jobs}
              parties={parties}
              politicians={politicians}
            />
          </section>

          <section
            className="bg-white rounded-xl border border-[#E3E0DA] p-5 md:p-6"
            style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
          >
            <h2
              className="font-extrabold text-[15px] mb-1"
              style={{ color: "#1E1B5E" }}
            >
              Einkommen nach Kategorie
            </h2>
            <p className="text-[12px] text-[#9A9790] mb-4">
              Aufteilung der Nebeneinkünfte nach den offiziellen Kategorien der
              Bundestagsverwaltung. Die Balken sind nach Fraktionszugehörigkeit
              eingefärbt, sodass erkennbar ist, welche Partei in welchem Bereich
              besonders aktiv ist.
            </p>
            <IncomeByCategoryChart jobs={sjData.jobs} parties={parties} />
          </section>

          <section
            className="bg-white rounded-xl border border-[#E3E0DA] p-5 md:p-6"
            style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
          >
            <h2
              className="font-extrabold text-[15px] mb-1"
              style={{ color: "#1E1B5E" }}
            >
              Themenfelder der Nebentätigkeiten
            </h2>
            <p className="text-[12px] text-[#9A9790] mb-4">
              Die 15 Themenfelder mit dem höchsten ausgewiesenen
              Gesamteinkommen. Die Kategorisierung basiert auf KI-gestützter
              Analyse der Tätigkeitsbeschreibungen. Da ein Job mehreren
              Themenfeldern zugeordnet sein kann, überschneiden sich die Summen.
            </p>
            <TopTopicsChart jobs={sjData.jobs} parties={parties} />
          </section>

          <section
            className="bg-white rounded-xl border border-[#E3E0DA] p-5 md:p-6"
            style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
          >
            <h2
              className="font-extrabold text-[15px] mb-1"
              style={{ color: "#1E1B5E" }}
            >
              Top-Verdiener
            </h2>
            <p className="text-[12px] text-[#9A9790] mb-4">
              Die Abgeordneten mit dem höchsten hochgerechneten Nebeneinkommen
              in der gewählten Legislaturperiode.
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
