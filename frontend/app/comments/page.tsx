"use client";
import { useEffect, useState } from "react";
import { usePeriod } from "@/lib/period-context";
import { useTranslation } from "@/lib/language-context";
import { fetchPeriodData, KommentareData } from "@/lib/data";
import { CARD_SHADOW } from "@/lib/constants";
import { PAGE_META } from "@/lib/page-meta";
import { ChartSkeleton } from "@/components/ui/ChartSkeleton";
import ApplauseChord from "@/components/charts/ApplauseChord";
import KommentareHeatmap from "@/components/charts/KommentareHeatmap";
import { SummaryBars, SummarySmall } from "@/components/charts/KommentareBars";
import { Footer } from "@/components/ui/Footer";
import { PageHeader } from "@/components/ui/PageHeader";

const META = PAGE_META.find((p) => p.href === "/comments")!;

function Section({
  title,
  subtitle,
  children,
  flex,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  flex?: string;
}) {
  return (
    <div
      style={{
        background: "white",
        borderRadius: "0.75rem",
        border: "1px solid #dddaf0",
        padding: "20px 20px 24px",
        boxShadow: CARD_SHADOW,
        ...(flex ? { flex, minWidth: 0 } : { marginBottom: 16 }),
      }}
    >
      <p
        style={{
          fontSize: "var(--t-title)",
          fontWeight: 800,
          color: "#171613",
          marginBottom: subtitle ? 4 : 16,
        }}
      >
        {title}
      </p>
      {subtitle && (
        <p
          style={{
            fontSize: "var(--t-small)",
            color: "#7872a8",
            marginBottom: 16,
          }}
        >
          {subtitle}
        </p>
      )}
      {children}
    </div>
  );
}

export default function CommentsPage() {
  const t = useTranslation();
  const { activePeriodId } = usePeriod();
  const [data, setData] = useState<KommentareData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!activePeriodId) return;
    setData(null);
    setError(false);
    fetchPeriodData<KommentareData>("kommentare.json", activePeriodId)
      .then(setData)
      .catch(() => setError(true));
  }, [activePeriodId]);

  return (
    <>
      <PageHeader color={META.color} {...t.pages.comments} />

      {error && (
        <p style={{ color: "#EA580C", fontSize: 13, marginBottom: 16 }}>
          {t.comments.error}
        </p>
      )}

      {/* Summary */}
      <Section
        title={t.comments.summary_title}
        subtitle={t.comments.summary_subtitle}
      >
        {data ? (
          <>
            <SummaryBars data={data} />
            <SummarySmall data={data} />
          </>
        ) : (
          <ChartSkeleton height={320} />
        )}
      </Section>

      <Section
        title={t.comments.applause_title}
        subtitle={t.comments.applause_subtitle}
      >
        {data ? <ApplauseChord data={data} /> : <ChartSkeleton height={380} />}
      </Section>

      <Section
        title={t.comments.reactions_title}
        subtitle={t.comments.reactions_subtitle}
      >
        {data ? (
          <KommentareHeatmap data={data} />
        ) : (
          <ChartSkeleton height={320} />
        )}
      </Section>

      <Footer />
    </>
  );
}
