"use client";
import { useState, useEffect } from "react";
import { usePeriod } from "@/lib/period-context";
import { fetchData, dataUrl, SidejobsFile, Politician } from "@/lib/data";
import {
  IncomeByPartyChart,
  IncomeByCategoryChart,
  TopTopicsChart,
  TopEarnersChart,
  SidejobCoverageByPartyChart,
} from "@/components/charts/SidejobsCharts";
import { ChartSkeleton } from "@/components/ui/ChartSkeleton";
import { Footer } from "@/components/ui/Footer";
import { PARTY_ORDER } from "@/lib/constants";

export default function SidejobsPage() {
  const { activePeriodId } = usePeriod();
  const [sjData, setSjData] = useState<SidejobsFile | null>(null);
  const [politicians, setPoliticians] = useState<Politician[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activePeriodId) return;
    setLoading(true);
    Promise.all([
      fetchData<SidejobsFile>(
        dataUrl("sidejobs_{period}.json", activePeriodId),
      ),
      fetchData<Politician[]>(
        dataUrl("politicians_{period}.json", activePeriodId),
      ),
    ])
      .then(([sj, pols]) => {
        setSjData(sj);
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
      <div className="mb-8 pl-4 border-l-4" style={{ borderColor: "#E67E22" }}>
        <p
          className="text-[11px] font-bold tracking-[0.15em] uppercase mb-1"
          style={{ color: "#E67E22" }}
        >
          Transparenz
        </p>
        <h1
          className="text-[28px] font-black tracking-tight leading-tight mb-1"
          style={{ color: "#1E1B5E" }}
        >
          Nebeneinkünfte
        </h1>
        <p className="text-[14px]" style={{ color: "#9A9790" }}>
          Offengelegte Nebentätigkeiten und Einkünfte nach Partei, Kategorie und
          Themenfeld.
        </p>
      </div>

      {/* Coverage info */}
      {sjData && (
        <div className="rounded-xl bg-[#EEF2FB] border border-[#2347C8]/20 px-4 py-3 text-[13px] text-[#2347C8] mb-6">
          <strong className="font-bold">
            {sjData.coverage.total - sjData.coverage.with_amount} von{" "}
            {sjData.coverage.total}
          </strong>{" "}
          Nebentätigkeiten (
          {Math.round(
            (1 - sjData.coverage.with_amount / sjData.coverage.total) * 100,
          )}{" "}
          %) haben keine Betragsangabe und fließen nicht in die
          Einkommens-Auswertungen ein.
        </div>
      )}

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
              Anteil je Fraktion. Als Nebenverdienst gilt jedes gemeldete
              Einkommen ab 1.000 €/Monat (gesetzliche Meldepflicht-Stufe 1, §
              44a AbgG).
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
              Monatliche und jährliche Zahlungen werden auf die Periodendauer
              hochgerechnet.
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
              Kategorien der Bundestagsverwaltung, gestapelt nach Partei.
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
              Top-15 Themenfelder nach Gesamteinkommen. Ein Job kann mehreren
              Themen zugeordnet sein.
            </p>
            <TopTopicsChart jobs={sjData.jobs} parties={parties} />
          </section>

          <section
            className="bg-white rounded-xl border border-[#E3E0DA] p-5 md:p-6"
            style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
          >
            <h2
              className="font-extrabold text-[15px] mb-4"
              style={{ color: "#1E1B5E" }}
            >
              Top-Verdiener
            </h2>
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
