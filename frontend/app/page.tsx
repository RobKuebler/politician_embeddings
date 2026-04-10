"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Footer } from "@/components/ui/Footer";
import { usePeriod } from "@/lib/period-context";
import {
  fetchPeriodFiles,
  stripSoftHyphen,
  Politician,
  SidejobsFile,
  Poll,
} from "@/lib/data";
import { CARD_CLASS, CARD_SHADOW } from "@/lib/constants";
import { PAGE_META } from "@/lib/page-meta";
import { NAV_ITEMS } from "@/lib/nav-items";

export default function Home() {
  const { activePeriodId, periods } = usePeriod();
  const activePeriod = periods.find((p) => p.wahlperiode === activePeriodId);

  type Stats = {
    politicians: number;
    parties: number;
    polls: number;
    sidejobs: number;
  } | null;
  const [stats, setStats] = useState<Stats>(null);

  useEffect(() => {
    if (!activePeriodId) return;
    setStats(null);
    fetchPeriodFiles<{
      politicians: Politician[];
      sidejobs: SidejobsFile;
      polls: Poll[];
    }>(activePeriodId, {
      politicians: "politicians.json",
      sidejobs: "sidejobs.json",
      polls: "polls.json",
    })
      .then(({ politicians, sidejobs, polls }) => {
        setStats({
          politicians: politicians.length,
          parties: new Set(
            politicians
              .map((politician) => stripSoftHyphen(politician.party))
              .filter((party) => party !== "fraktionslos"),
          ).size,
          polls: polls.length,
          sidejobs: sidejobs.coverage.total,
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
          {activePeriod.wahlperiode}. Legislaturperiode
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

      {/* Feature grid: auto-generated from PAGE_META */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger">
        {PAGE_META.map(({ href, color, label, title, description, wide }) => {
          const navItem = NAV_ITEMS.find((n) => n.href === href);
          return (
            <Link
              key={href}
              href={href}
              className={`group flex flex-col ${CARD_CLASS} p-4 md:p-5 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 ${
                wide ? "md:col-span-2" : ""
              }`}
              style={{ boxShadow: CARD_SHADOW }}
            >
              {/* Icon + eyebrow row */}
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center"
                  style={{ background: color, color: "white" }}
                >
                  {navItem?.icon(false, 15)}
                </div>
                <span
                  className="text-[11px] font-bold tracking-[0.1em] uppercase"
                  style={{ color }}
                >
                  {label}
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
                style={{ color }}
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
          );
        })}
      </div>

      <Footer />
    </>
  );
}
