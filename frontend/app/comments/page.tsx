"use client";
import { useEffect, useState } from "react";
import { usePeriod } from "@/lib/period-context";
import { fetchData, dataUrl, KommentareData } from "@/lib/data";
import {
  PARTY_COLORS,
  FALLBACK_COLOR,
  CHART_FONT_FAMILY,
  PARTY_ORDER,
} from "@/lib/constants";
import { ChartSkeleton } from "@/components/ui/ChartSkeleton";
import ApplauseChord from "@/components/charts/ApplauseChord";
import KommentareHeatmap from "@/components/charts/KommentareHeatmap";
import { Footer } from "@/components/ui/Footer";
import { PageHeader } from "@/components/ui/PageHeader";

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
        borderRadius: 16,
        padding: "20px 20px 24px",
        boxShadow: "0 2px 12px rgba(78,70,217,0.08)",
        ...(flex ? { flex, minWidth: 0 } : { marginBottom: 16 }),
      }}
    >
      <p
        style={{
          fontSize: 15,
          fontWeight: 800,
          color: "#171613",
          marginBottom: subtitle ? 4 : 16,
        }}
      >
        {title}
      </p>
      {subtitle && (
        <p style={{ fontSize: 12, color: "#9A9790", marginBottom: 16 }}>
          {subtitle}
        </p>
      )}
      {children}
    </div>
  );
}

const SMALL_TYPES = ["Lachen", "Heiterkeit", "Widerspruch"] as const;
type SmallType = (typeof SMALL_TYPES)[number];

/**
 * Compact grid showing the rarer reaction types (Lachen, Heiterkeit, Widerspruch)
 * with each column independently scaled — values are too small to share an axis
 * with Beifall/Zwischenruf.
 */
function SummarySmall({ data }: { data: KommentareData }) {
  const sorted = [...data.summary].sort(
    (a, b) => PARTY_ORDER.indexOf(a.party) - PARTY_ORDER.indexOf(b.party),
  );

  const maxByType = Object.fromEntries(
    SMALL_TYPES.map((t) => [t, Math.max(...sorted.map((r) => r[t]))]),
  ) as Record<SmallType, number>;

  return (
    <div>
      <div style={{ borderTop: "1px solid #F0EDE8", margin: "14px 0 12px" }} />
      <p
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: "#9A9790",
          letterSpacing: "0.10em",
          textTransform: "uppercase",
          marginBottom: 10,
          fontFamily: CHART_FONT_FAMILY,
        }}
      >
        Seltenere Reaktionen
      </p>

      {/* Column headers */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "88px 1fr 1fr 1fr",
          gap: "0 10px",
          marginBottom: 6,
        }}
      >
        <div />
        {SMALL_TYPES.map((t) => (
          <span
            key={t}
            style={{
              fontSize: 9,
              color: "#9A9790",
              fontWeight: 700,
              fontFamily: CHART_FONT_FAMILY,
              textTransform: "uppercase",
              letterSpacing: "0.07em",
            }}
          >
            {t}
          </span>
        ))}
      </div>

      {/* Rows per party */}
      {sorted.map((row) => {
        const color = PARTY_COLORS[row.party] ?? FALLBACK_COLOR;
        return (
          <div
            key={row.party}
            style={{
              display: "grid",
              gridTemplateColumns: "88px 1fr 1fr 1fr",
              gap: "0 10px",
              marginBottom: 6,
              alignItems: "center",
            }}
          >
            {/* Party label */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: color,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#171613",
                  fontFamily: CHART_FONT_FAMILY,
                }}
              >
                {row.party}
              </span>
            </div>

            {/* Mini bar + value per type */}
            {SMALL_TYPES.map((t) => {
              const val = row[t];
              const pct = (val / maxByType[t]) * 100;
              return (
                <div
                  key={t}
                  style={{ display: "flex", alignItems: "center", gap: 5 }}
                >
                  <div
                    style={{
                      flex: 1,
                      background: "#F3F2F0",
                      borderRadius: 2,
                      height: 6,
                    }}
                  >
                    <div
                      style={{
                        width: `${pct}%`,
                        height: "100%",
                        background: color,
                        opacity: 0.55,
                        borderRadius: 2,
                      }}
                    />
                  </div>
                  <span
                    style={
                      {
                        fontSize: 9,
                        color: "#6B6760",
                        width: 26,
                        textAlign: "right",
                        fontFamily: CHART_FONT_FAMILY,
                        tabularNums: true,
                      } as React.CSSProperties
                    }
                  >
                    {val}
                  </span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/** Horizontal summary bar chart (no D3 — pure CSS for simplicity) */
function SummaryBars({ data }: { data: KommentareData }) {
  const sorted = [...data.summary].sort(
    (a, b) => PARTY_ORDER.indexOf(a.party) - PARTY_ORDER.indexOf(b.party),
  );
  const maxZwischenruf = Math.max(...sorted.map((r) => r.Zwischenruf));
  const maxBeifall = Math.max(...sorted.map((r) => r.Beifall));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {sorted.map((row) => {
        const color = PARTY_COLORS[row.party] ?? FALLBACK_COLOR;
        return (
          <div key={row.party}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 3,
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: color,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#171613",
                  minWidth: 72,
                  fontFamily: CHART_FONT_FAMILY,
                }}
              >
                {row.party}
              </span>
            </div>
            {/* Zwischenrufe bar */}
            <div style={{ marginLeft: 16, marginBottom: 2 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span
                  style={{
                    fontSize: 9,
                    color: "#9A9790",
                    width: 58,
                    fontFamily: CHART_FONT_FAMILY,
                  }}
                >
                  Zwischenrufe
                </span>
                <div
                  style={{
                    flex: 1,
                    background: "#F3F2F0",
                    borderRadius: 2,
                    height: 8,
                  }}
                >
                  <div
                    style={{
                      width: `${(row.Zwischenruf / maxZwischenruf) * 100}%`,
                      height: "100%",
                      background: color,
                      borderRadius: 2,
                    }}
                  />
                </div>
                <span
                  style={{
                    fontSize: 9,
                    color: "#6B6760",
                    width: 36,
                    textAlign: "right",
                    fontFamily: CHART_FONT_FAMILY,
                  }}
                >
                  {(row.Zwischenruf / 1000).toFixed(0)}k
                </span>
              </div>
            </div>
            {/* Beifall bar */}
            <div style={{ marginLeft: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    fontSize: 9,
                    color: "#9A9790",
                    width: 58,
                    fontFamily: CHART_FONT_FAMILY,
                  }}
                >
                  Beifall
                </span>
                <div
                  style={{
                    flex: 1,
                    background: "#F3F2F0",
                    borderRadius: 2,
                    height: 8,
                  }}
                >
                  <div
                    style={{
                      width: `${(row.Beifall / maxBeifall) * 100}%`,
                      height: "100%",
                      background: color,
                      opacity: 0.45,
                      borderRadius: 2,
                    }}
                  />
                </div>
                <span
                  style={{
                    fontSize: 9,
                    color: "#6B6760",
                    width: 36,
                    textAlign: "right",
                    fontFamily: CHART_FONT_FAMILY,
                  }}
                >
                  {(row.Beifall / 1000).toFixed(0)}k
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function CommentsPage() {
  const { activePeriodId } = usePeriod();
  const [data, setData] = useState<KommentareData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!activePeriodId) return;
    setData(null);
    setError(false);
    fetchData<KommentareData>(dataUrl("kommentare.json", activePeriodId))
      .then(setData)
      .catch(() => setError(true));
  }, [activePeriodId]);

  return (
    <>
      <PageHeader
        color="#E74C3C"
        label="Plenardynamik"
        title="Wer stört wen?"
        description="Jede Unterbrechung im Plenum — Zwischenrufe, Lachen, Applaus — ist im Stenografischen Bericht festgehalten. Diese Analyse zeigt, welche Partei wie oft und bei wessen Reden reagiert."
      />

      {error && (
        <p style={{ color: "#EA580C", fontSize: 13, marginBottom: 16 }}>
          Fehler beim Laden der Daten.
        </p>
      )}

      {/* Summary */}
      <Section
        title="Gesamtübersicht"
        subtitle="Reaktionen nach Partei — jede Skala unabhängig"
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
        title="Beifall-Netzwerk"
        subtitle="Bögen = Applaus-Volumen. Bänder = Austausch zwischen Parteien."
      >
        {data ? <ApplauseChord data={data} /> : <ChartSkeleton height={380} />}
      </Section>

      <Section
        title="Reaktionen im Detail"
        subtitle="Zeile = handelnde Partei · Spalte = Redner-Partei"
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
