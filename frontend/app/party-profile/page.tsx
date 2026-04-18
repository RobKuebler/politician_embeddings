"use client";
import { useState, useEffect } from "react";
import { usePeriod } from "@/lib/period-context";
import { fetchPeriodData, PartyProfileFile, stripSoftHyphen } from "@/lib/data";
import { AgeDistribution } from "@/components/charts/AgeDistribution";
import { GenderChart } from "@/components/charts/GenderChart";
import { DeviationHeatmap } from "@/components/charts/DeviationHeatmap";
import { ChartSkeleton } from "@/components/ui/ChartSkeleton";
import { Footer } from "@/components/ui/Footer";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  sortParties,
  NO_FACTION_LABEL,
  CARD_CLASS,
  CARD_SHADOW,
  CARD_PADDING,
} from "@/lib/constants";
import { PAGE_META } from "@/lib/page-meta";
import { useTranslation } from "@/lib/language-context";

const META = PAGE_META.find((p) => p.href === "/party-profile")!;

export default function PartyProfilePage() {
  const t = useTranslation();
  const { activePeriodId } = usePeriod();
  const [data, setData] = useState<PartyProfileFile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activePeriodId) return;
    setLoading(true);
    setData(null);
    fetchPeriodData<PartyProfileFile>("party_profile.json", activePeriodId)
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
      .catch((error) => {
        console.error(error);
        setLoading(false);
      });
  }, [activePeriodId]);

  const parties = data
    ? sortParties(data.parties.filter((p) => p !== NO_FACTION_LABEL))
    : [];

  return (
    <>
      <PageHeader color={META.color} {...t.pages.party_profile} />

      {loading || !data ? (
        <div className="flex flex-col gap-5">
          <ChartSkeleton height={300} />
          <ChartSkeleton height={300} />
          <ChartSkeleton height={400} />
        </div>
      ) : (
        <div className="flex flex-col gap-5 stagger">
          <section
            className={`${CARD_CLASS} ${CARD_PADDING}`}
            style={{ boxShadow: CARD_SHADOW }}
          >
            <h2
              className="font-extrabold text-[15px] mb-1"
              style={{ color: "#1E1B5E" }}
            >
              {t.party_profile.age_title}
            </h2>
            <p className="text-[12px] text-[#524d8a] mb-4">
              {t.party_profile.age_subtitle}
            </p>
            <AgeDistribution data={data.age} parties={parties} />
          </section>

          <section
            className={`${CARD_CLASS} ${CARD_PADDING}`}
            style={{ boxShadow: CARD_SHADOW }}
          >
            <h2
              className="font-extrabold text-[15px] mb-1"
              style={{ color: "#1E1B5E" }}
            >
              {t.party_profile.gender_title}
            </h2>
            <p className="text-[12px] text-[#524d8a] mb-4">
              {t.party_profile.gender_subtitle}
            </p>
            <GenderChart data={data.sex} parties={parties} />
          </section>

          <section
            className={`${CARD_CLASS} ${CARD_PADDING}`}
            style={{ boxShadow: CARD_SHADOW }}
          >
            <h2
              className="font-extrabold text-[15px] mb-1"
              style={{ color: "#1E1B5E" }}
            >
              {t.party_profile.occupation_title}
            </h2>
            <p className="text-[12px] text-[#524d8a] mb-4">
              {t.party_profile.occupation_subtitle}
            </p>
            <DeviationHeatmap
              pivot={data.occupation}
              rowLabel={(cat) => t.party_profile.occupation_labels[cat] ?? cat}
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
              {t.party_profile.education_field_title}
            </h2>
            <p className="text-[12px] text-[#524d8a] mb-4">
              {t.party_profile.education_field_subtitle}
            </p>
            <DeviationHeatmap
              pivot={data.education_field}
              rowLabel={(cat) =>
                t.party_profile.education_field_labels[cat] ?? cat
              }
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
              {t.party_profile.education_degree_title}
            </h2>
            <p className="text-[12px] text-[#524d8a] mb-4">
              {t.party_profile.education_degree_subtitle}
            </p>
            <DeviationHeatmap
              pivot={data.education_degree}
              rowLabel={(cat) =>
                t.party_profile.education_degree_labels[cat] ?? cat
              }
            />
          </section>
        </div>
      )}
      <Footer />
    </>
  );
}
