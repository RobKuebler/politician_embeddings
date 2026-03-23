"use client";
import { useState, useEffect } from "react";
import { usePeriod } from "@/lib/period-context";
import { fetchData, dataUrl, PartyProfileFile } from "@/lib/data";
import { AgeDistribution } from "@/components/charts/AgeDistribution";
import { GenderChart } from "@/components/charts/GenderChart";
import { DeviationHeatmap } from "@/components/charts/DeviationHeatmap";
import { ChartSkeleton } from "@/components/ui/ChartSkeleton";
import { Footer } from "@/components/ui/Footer";
import { sortParties } from "@/lib/constants";

export default function PartyProfilePage() {
  const { activePeriodId } = usePeriod();
  const [data, setData] = useState<PartyProfileFile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activePeriodId) return;
    setLoading(true);
    fetchData<PartyProfileFile>(
      dataUrl("party_profile_{period}.json", activePeriodId),
    )
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(console.error);
  }, [activePeriodId]);

  const parties = data ? sortParties(data.parties) : [];

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-[#171613] mb-1">
          Parteiprofil
        </h1>
        <p className="text-[14px] text-[#6B6760]">
          Demografische Zusammensetzung der Fraktionen im Vergleich.
        </p>
      </div>

      {loading || !data ? (
        <div className="flex flex-col gap-5">
          <ChartSkeleton height={300} />
          <ChartSkeleton height={300} />
          <ChartSkeleton height={400} />
        </div>
      ) : (
        <div className="flex flex-col gap-5 stagger">
          <section
            className="bg-white rounded-xl border border-[#E3E0DA] p-5 md:p-6"
            style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
          >
            <h2 className="font-semibold text-[15px] text-[#171613] mb-1">
              Altersverteilung
            </h2>
            <p className="text-[12px] text-[#9A9790] mb-4">
              Jeder Punkt entspricht einem Abgeordneten.
            </p>
            <AgeDistribution data={data.age} parties={parties} />
          </section>

          <section
            className="bg-white rounded-xl border border-[#E3E0DA] p-5 md:p-6"
            style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
          >
            <h2 className="font-semibold text-[15px] text-[#171613] mb-4">
              Geschlecht
            </h2>
            <GenderChart data={data.sex} parties={parties} />
          </section>

          <section
            className="bg-white rounded-xl border border-[#E3E0DA] p-5 md:p-6"
            style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
          >
            <h2 className="font-semibold text-[15px] text-[#171613] mb-1">
              Berufe
            </h2>
            <p className="text-[12px] text-[#9A9790] mb-4">
              Blau = überproportional, rot = unterproportional (Abweichung vom
              Bundestag-Durchschnitt).
            </p>
            <DeviationHeatmap pivot={data.occupation} height={500} />
          </section>

          <section
            className="bg-white rounded-xl border border-[#E3E0DA] p-5 md:p-6"
            style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
          >
            <h2 className="font-semibold text-[15px] text-[#171613] mb-1">
              Ausbildung / Studienrichtung
            </h2>
            <p className="text-[12px] text-[#9A9790] mb-4">
              Blau = überproportional, rot = unterproportional.
            </p>
            <DeviationHeatmap pivot={data.education_field} height={400} />
          </section>

          <section
            className="bg-white rounded-xl border border-[#E3E0DA] p-5 md:p-6"
            style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
          >
            <h2 className="font-semibold text-[15px] text-[#171613] mb-1">
              Abschlussniveau
            </h2>
            <DeviationHeatmap pivot={data.education_degree} height={250} />
          </section>
        </div>
      )}
      <Footer />
    </>
  );
}
