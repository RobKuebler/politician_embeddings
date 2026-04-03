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
import { stripSoftHyphen } from "@/lib/data";

export default function PartyProfilePage() {
  const { activePeriodId } = usePeriod();
  const [data, setData] = useState<PartyProfileFile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activePeriodId) return;
    setLoading(true);
    fetchData<PartyProfileFile>(dataUrl("party_profile.json", activePeriodId))
      .then((d) => {
        const norm = stripSoftHyphen;
        setData({
          ...d,
          parties: d.parties.map(norm),
          age: d.age.map((a) => ({ ...a, party: norm(a.party) })),
          sex: d.sex.map((s) => ({ ...s, party_label: norm(s.party_label) })),
          occupation: {
            ...d.occupation,
            parties: d.occupation.parties.map(norm),
          },
          education_field: {
            ...d.education_field,
            parties: d.education_field.parties.map(norm),
          },
          education_degree: {
            ...d.education_degree,
            parties: d.education_degree.parties.map(norm),
          },
        });
        setLoading(false);
      })
      .catch(console.error);
  }, [activePeriodId]);

  const parties = data ? sortParties(data.parties) : [];

  return (
    <>
      <div className="mb-8 pl-4 border-l-4" style={{ borderColor: "#16A085" }}>
        <p
          className="text-[11px] font-bold tracking-[0.15em] uppercase mb-1"
          style={{ color: "#16A085" }}
        >
          Demografie
        </p>
        <h1
          className="text-[28px] font-black tracking-tight leading-tight mb-1"
          style={{ color: "#1E1B5E" }}
        >
          Parteiprofil
        </h1>
        <p className="text-[14px]" style={{ color: "#9A9790" }}>
          Wer sitzt im Bundestag? Diese Seite vergleicht Altersstruktur,
          Geschlechterverteilung, Berufsfelder und Bildungshintergrund der
          Fraktionen und zeigt, wie sie sich vom Gesamtparlament unterscheiden.
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
            <h2
              className="font-extrabold text-[15px] mb-1"
              style={{ color: "#1E1B5E" }}
            >
              Altersverteilung
            </h2>
            <p className="text-[12px] text-[#9A9790] mb-4">
              Jeder Punkt entspricht einem Abgeordneten. Punkte gleichen Alters
              sind vertikal gestapelt — je mehr Punkte auf einer Position, desto
              mehr Abgeordnete haben exakt dieses Alter. Die Kurve darüber zeigt
              die Altersverteilung als Dichteschätzung. Das Alter bezieht sich
              auf den Beginn der Legislaturperiode.
            </p>
            <AgeDistribution data={data.age} parties={parties} />
          </section>

          <section
            className="bg-white rounded-xl border border-[#E3E0DA] p-5 md:p-6"
            style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
          >
            <h2
              className="font-extrabold text-[15px] mb-1"
              style={{ color: "#1E1B5E" }}
            >
              Geschlecht
            </h2>
            <p className="text-[12px] text-[#9A9790] mb-4">
              Geschlechterverteilung je Fraktion als prozentualer Anteil der
              Gesamtmitglieder.
            </p>
            <GenderChart data={data.sex} parties={parties} />
          </section>

          <section
            className="bg-white rounded-xl border border-[#E3E0DA] p-5 md:p-6"
            style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
          >
            <h2
              className="font-extrabold text-[15px] mb-1"
              style={{ color: "#1E1B5E" }}
            >
              Berufe
            </h2>
            <p className="text-[12px] text-[#9A9790] mb-4">
              Die Heatmap zeigt, wie stark ein Beruf in einer Fraktion über-
              oder unterrepräsentiert ist — gemessen als Abweichung vom
              Bundestag-Durchschnitt in Prozentpunkten. Blau steht für
              überproportional viele Abgeordnete mit diesem Beruf, rot für
              entsprechend wenige. Die Berufsangaben stammen aus der
              Abgeordnetenwatch-Datenbank und entsprechen dem Stand bei
              Ersterfassung. Unter &bdquo;Sonstige Berufe&ldquo; fallen
              insbesondere Abgeordnete, die als Berufsbezeichnung schlicht
              &bdquo;Abgeordneter&ldquo; angegeben haben.
            </p>
            <DeviationHeatmap pivot={data.occupation} height={500} />
          </section>

          <section
            className="bg-white rounded-xl border border-[#E3E0DA] p-5 md:p-6"
            style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
          >
            <h2
              className="font-extrabold text-[15px] mb-1"
              style={{ color: "#1E1B5E" }}
            >
              Ausbildung / Studienrichtung
            </h2>
            <p className="text-[12px] text-[#9A9790] mb-4">
              Studienrichtungen und Ausbildungsbereiche der Abgeordneten im
              Fraktionsvergleich. Blau bedeutet überproportional häufig
              vertreten, rot unterproportional — jeweils gemessen am
              Bundestag-Durchschnitt. Die Angaben stammen aus der
              Abgeordnetenwatch-Datenbank und entsprechen dem Stand bei
              Ersterfassung.
            </p>
            <DeviationHeatmap pivot={data.education_field} height={400} />
          </section>

          <section
            className="bg-white rounded-xl border border-[#E3E0DA] p-5 md:p-6"
            style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
          >
            <h2
              className="font-extrabold text-[15px] mb-1"
              style={{ color: "#1E1B5E" }}
            >
              Abschlussniveau
            </h2>
            <p className="text-[12px] text-[#9A9790] mb-4">
              Höchster Bildungsabschluss der Abgeordneten je Fraktion im
              Vergleich zum Bundestag-Durchschnitt. Die Angaben stammen aus der
              Abgeordnetenwatch-Datenbank und entsprechen dem Stand bei
              Ersterfassung.
            </p>
            <DeviationHeatmap pivot={data.education_degree} height={250} />
          </section>
        </div>
      )}
      <Footer />
    </>
  );
}
