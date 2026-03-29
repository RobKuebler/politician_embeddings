"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Footer } from "@/components/ui/Footer";
import { usePeriod } from "@/lib/period-context";
import {
  fetchData,
  dataUrl,
  stripSoftHyphen,
  Politician,
  SidejobsFile,
  Poll,
} from "@/lib/data";

const FEATURES = [
  {
    href: "/vote-map",
    title: "Abstimmungslandkarte",
    description:
      "Ein KI-Modell hat das Abstimmungsverhalten aller Abgeordneten in einen zweidimensionalen Raum übersetzt. Je näher zwei Punkte beieinanderliegen, desto ähnlicher haben die Abgeordneten historisch abgestimmt — unabhängig von Fraktionsgrenzen.",
    tag: "KI-Analyse",
    iconGradient: "linear-gradient(135deg, #4C46D9 0%, #7B77CC 100%)",
    tagColor: "#4C46D9",
    wide: true,
    icon: (
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="m8 12 3 3 5-5" />
      </svg>
    ),
  },
  {
    href: "/party-profile",
    title: "Parteiprofil",
    description:
      "Wie alt ist der Bundestag, wie divers sind die Fraktionen, und welche Berufsbilder prägen das Parlament? Demografische Kennzahlen aller Fraktionen im direkten Vergleich.",
    tag: "Demografie",
    iconGradient: "linear-gradient(135deg, #16A085 0%, #48CAA3 100%)",
    tagColor: "#16A085",
    wide: false,
    icon: (
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="9" cy="7" r="4" />
        <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        <path d="M21 21v-2a4 4 0 0 0-3-3.85" />
      </svg>
    ),
  },
  {
    href: "/sidejobs",
    title: "Nebeneinkünfte",
    description:
      "Abgeordnete sind gesetzlich verpflichtet, Nebentätigkeiten ab einem bestimmten Einkommen zu melden. Diese Analyse zeigt, welche Parteien, Branchen und Themenfelder dabei dominieren.",
    tag: "Transparenz",
    iconGradient: "linear-gradient(135deg, #E67E22 0%, #F39C12 100%)",
    tagColor: "#E67E22",
    wide: false,
    icon: (
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <circle cx="12" cy="12" r="3" />
        <path d="M6 12h.01M18 12h.01" />
      </svg>
    ),
  },
  {
    href: "/speeches",
    title: "Speeches",
    description:
      "Welche Themen prägen jede Fraktion im Plenum? TF-IDF-Wordclouds der parteispezifischen Begriffe und die redeaktivsten Abgeordneten im direkten Vergleich.",
    tag: "Plenardebatten",
    iconGradient: "linear-gradient(135deg, #9B59B6 0%, #C39BD3 100%)",
    tagColor: "#9B59B6",
    wide: false,
    icon: (
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
];

export default function Home() {
  const { activePeriodId, periods } = usePeriod();
  const activePeriod = periods.find((p) => p.period_id === activePeriodId);

  type Stats = {
    politicians: number;
    parties: number;
    polls: number;
    sidejobs: number;
  } | null;
  const [stats, setStats] = useState<Stats>(null);

  useEffect(() => {
    if (!activePeriodId) return;
    Promise.all([
      fetchData<Politician[]>(
        dataUrl("politicians_{period}.json", activePeriodId),
      ),
      fetchData<SidejobsFile>(
        dataUrl("sidejobs_{period}.json", activePeriodId),
      ),
      fetchData<Poll[]>(dataUrl("polls_{period}.json", activePeriodId)),
    ])
      .then(([pols, sj, polls]) => {
        setStats({
          politicians: pols.length,
          parties: new Set(pols.map((p) => stripSoftHyphen(p.party))).size,
          polls: polls.length,
          sidejobs: sj.coverage.total,
        });
      })
      .catch(console.error);
  }, [activePeriodId]);

  return (
    <>
      {/* Hero banner */}
      <div
        className="rounded-2xl px-6 py-8 mb-6"
        style={{ background: "#1E1B5E" }}
      >
        <p
          className="text-[11px] font-bold tracking-[0.18em] uppercase mb-3"
          style={{ color: "#7B77CC" }}
        >
          Bundestag · KI-Analyse
        </p>
        <h1
          className="text-4xl md:text-5xl font-black tracking-tight leading-[1.05] mb-3"
          style={{ color: "#FFFFFF" }}
        >
          Parlascanned
        </h1>
        <p
          className="text-[14px] leading-relaxed"
          style={{ color: "rgba(255,255,255,0.6)" }}
        >
          Parlascanned macht die Arbeit des Deutschen Bundestags transparent.
          Wie ähnlich stimmen Abgeordnete ab? Wie unterscheiden sich die
          Fraktionen demografisch? Und wer verdient neben dem Mandat?
        </p>
      </div>

      {/* Stat strip header */}
      {activePeriod && (
        <p
          className="text-[11px] font-bold tracking-[0.14em] uppercase mb-2"
          style={{ color: "#9A9790" }}
        >
          {activePeriod.bundestag_number}. Legislaturperiode
        </p>
      )}

      {/* Stat strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[#E3E0DA] rounded-xl overflow-hidden mb-6">
        {[
          { value: stats?.politicians, label: "Abgeordnete" },
          { value: stats?.parties, label: "Fraktionen" },
          { value: stats?.polls, label: "Abstimmungen" },
          { value: stats?.sidejobs, label: "Nebentätigkeiten" },
        ].map(({ value, label }) => (
          <div
            key={label}
            className="bg-white flex flex-col items-center justify-center py-4 px-3 text-center"
          >
            <span
              className="text-[22px] font-black tabular-nums leading-none mb-1"
              style={{ color: "#1E1B5E" }}
            >
              {value !== undefined && value !== null ? (
                value.toLocaleString("de")
              ) : (
                <span
                  style={{
                    display: "inline-block",
                    width: 48,
                    height: 22,
                    borderRadius: 4,
                    background: "#E8E7E2",
                  }}
                />
              )}
            </span>
            <span
              className="text-[11px] font-semibold uppercase tracking-[0.08em]"
              style={{ color: "#9A9790" }}
            >
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* Feature grid: 1 col mobile, 2 col md+ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger">
        {FEATURES.map(
          ({
            href,
            title,
            description,
            tag,
            iconGradient,
            tagColor,
            wide,
            icon,
          }) => (
            <Link
              key={href}
              href={href}
              className={`group flex flex-col bg-white rounded-xl p-4 md:p-5 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 ${
                wide ? "md:col-span-2" : ""
              }`}
              style={{ boxShadow: "0 2px 12px rgba(78,70,217,0.10)" }}
            >
              {/* Icon + tag row */}
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center"
                  style={{ background: iconGradient }}
                >
                  {icon}
                </div>
                <span
                  className="text-[11px] font-bold tracking-[0.1em] uppercase"
                  style={{ color: tagColor }}
                >
                  {tag}
                </span>
              </div>

              <h2
                className="font-extrabold text-[15px] leading-snug mb-1.5"
                style={{ color: "#1E1B5E" }}
              >
                {title}
              </h2>

              <p
                className="text-[13px] leading-relaxed flex-1"
                style={{ color: "#6B6760" }}
              >
                {description}
              </p>

              {/* CTA */}
              <div
                className="mt-4 flex items-center gap-1 text-[12px] font-bold"
                style={{ color: tagColor }}
              >
                Öffnen
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="group-hover:translate-x-0.5 transition-transform duration-150"
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </div>
            </Link>
          ),
        )}
      </div>

      <Footer />
    </>
  );
}
