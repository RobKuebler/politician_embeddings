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
} from "@/components/charts/AusschuessCharts";
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

const META = PAGE_META.find((p) => p.href === "/potential-conflicts")!;

function MethodologyNote() {
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
          Wie werden Interessenkonflikte erkannt?
        </span>
        <span
          className="text-[18px] leading-none select-none"
          style={{
            color: "#7872a8",
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
            Ein Interessenkonflikt wird erkannt, wenn ein Abgeordneter{" "}
            <strong>Nebeneinkommen in einem Themenfeld</strong> erzielt{" "}
            <em>und gleichzeitig</em> Mitglied eines{" "}
            <strong>Ausschusses mit demselben Themenfeld</strong> ist. Die
            Themenfelder stammen direkt aus der API von abgeordnetenwatch (Feld{" "}
            <code className="text-[11px] bg-[#F5F4F0] px-1 rounded">
              field_topics
            </code>
            ), das sowohl Nebentätigkeiten als auch Ausschüsse mit Schlagwörtern
            versieht.
          </p>

          <div
            className="rounded-xl p-3 text-[12px] leading-relaxed"
            style={{ background: "#FDF8F0", color: "#5a556b" }}
          >
            <p className="font-semibold mb-1" style={{ color: "#B8600A" }}>
              Einschränkungen
            </p>
            <ul className="list-disc list-inside flex flex-col gap-1.5">
              <li>
                <strong>
                  Breite Themenfelder können zu Fehlzuordnungen führen.
                </strong>{" "}
                Schlagwörter wie &bdquo;Wirtschaft&ldquo; oder &bdquo;Staat und
                Verwaltung&ldquo; sind sehr weit gefasst und können Treffer
                erzeugen, die keinen echten Interessenkonflikt darstellen – z.
                {"\u00a0"}B. ein Rechtsanwalt im Innenausschuss, der nichts mit
                Innenrecht zu tun hat.
              </li>
              <li>
                <strong>Keine Zeitraumüberschneidung prüfbar.</strong>{" "}
                Ausschussmitgliedschaften enthalten in den Quelldaten keinen
                Zeitraum. Ein Nebeneinkommen aus der ersten Jahreshälfte kann
                daher rechnerisch mit einem Ausschussmandat aus der zweiten
                Jahreshälfte zusammentreffen, ohne dass ein tatsächlicher
                Überschneidungszeitraum existiert.
              </li>
              <li>
                <strong>Einkommen wird pro Ausschuss ausgewiesen.</strong> Sitzt
                ein Abgeordneter in mehreren betroffenen Ausschüssen, wird
                dasselbe Einkommen mehrfach gezeigt – jede Zeile steht für ein
                eigenständiges Mandat.
              </li>
              <li>
                <strong>Nur Nebentätigkeiten mit Themenfeld-Angabe.</strong>{" "}
                Tätigkeiten ohne abgeordnetenwatch-Themenfeld-Tag werden nicht
                erfasst, auch wenn inhaltlich eine Überschneidung bestehen
                könnte.
              </li>
            </ul>
          </div>

          <p className="text-[11px]" style={{ color: "#7872a8" }}>
            Diese Seite zeigt <em>potenzielle</em> Interessenkonflikte auf Basis
            öffentlich gemeldeter Daten. Sie ersetzt keine rechtliche oder
            parlamentarische Bewertung.
          </p>
        </div>
      )}
    </div>
  );
}

export default function AusschussePage() {
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
              Top-Konflikte nach Abgeordneten
            </h2>
            <p className="text-[12px] text-[#7872a8] mb-4">
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
            <p className="text-[12px] text-[#7872a8] mb-4">
              Summiertes Nebeneinkommen je Themenfeld und Fraktion, bei dem eine
              Ausschuss-Überschneidung besteht. Intensivere Färbung bedeutet
              höheres konfliktiertes Einkommen.
            </p>
            <ConflictHeatmap conflicts={data.conflicts} parties={parties} />
          </section>
        </div>
      ) : !loading ? (
        <p className="text-[13px] text-[#7872a8] text-center py-10">
          Keine Interessenkonflikte für diese Wahlperiode gefunden.
        </p>
      ) : null}

      {/* Methodology note */}
      <MethodologyNote />

      <Footer />
    </>
  );
}
