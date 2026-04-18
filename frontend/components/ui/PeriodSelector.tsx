"use client";
import { usePeriod } from "@/lib/period-context";
import { useTranslation } from "@/lib/language-context";
import { useEffect, useRef, useState } from "react";

interface PeriodSelectorProps {
  /** "sidebar" = dark pill on navy bg | "light" = white pill on light bg (mobile, default) */
  variant?: "sidebar" | "light";
  /** Hide the "Bundestag" label above the button (e.g. when shown externally) */
  showLabel?: boolean;
}

export function PeriodSelector({
  variant = "light",
  showLabel = true,
}: PeriodSelectorProps) {
  const { periods, activePeriodId, setActivePeriodId } = usePeriod();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click — must be before early return (Rules of Hooks)
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const t = useTranslation();

  if (periods.length <= 1) return null;

  const isSidebar = variant === "sidebar";

  // "Bundestag 2021 - 2025" → "2021–2025"
  const yearsOnly = (label: string) => {
    const m = label.match(/(\d{4})\s*[-–]\s*(\d{4})/);
    return m ? `${m[1]}–${m[2]}` : label;
  };

  const activeYears = yearsOnly(
    periods.find((p) => p.wahlperiode === activePeriodId)?.label ?? "",
  );

  return (
    <div className="relative" ref={containerRef}>
      {/* Label above */}
      {showLabel && (
        <p
          className={`text-[10px] font-bold tracking-[0.12em] uppercase mb-1 ${
            isSidebar ? "text-white/40" : "text-[var(--color-navy)]/50"
          }`}
        >
          {t.common.period_label}
        </p>
      )}

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t.common.period_aria}
        aria-expanded={open}
        className={`w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 focus-visible:ring-2 focus-visible:ring-[var(--color-purple)] focus-visible:ring-offset-1 transition-colors duration-150 ${
          isSidebar
            ? "bg-white/10 border border-white/[0.18] hover:bg-white/15"
            : "bg-white border border-[var(--color-navy)] hover:bg-[#F0EFF9]"
        }`}
      >
        <span
          className={`text-[14px] font-bold tabular-nums truncate ${
            isSidebar ? "text-white" : "text-[var(--color-navy)]"
          }`}
        >
          {activeYears}
        </span>
        {/* Chevron — rotates when open */}
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke={isSidebar ? "rgba(255,255,255,0.6)" : "var(--color-navy)"}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {/* Backdrop — mobile only: dims content below header when dropdown is open */}
      {open && !isSidebar && (
        <div
          className="md:hidden fixed top-[68px] inset-x-0 bottom-0 z-[49] bg-black/20"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Custom dropdown panel */}
      {open && (
        <div
          className={`absolute z-50 mt-1 rounded-xl overflow-hidden ${
            isSidebar
              ? "left-0 min-w-[140px] bg-[#16134A] border border-white/[0.15] shadow-xl shadow-black/40"
              : "left-0 right-0 bg-white border border-[var(--color-lavender)] shadow-lg"
          }`}
        >
          {periods.map((p) => {
            const isActive = p.wahlperiode === activePeriodId;
            return (
              <button
                key={p.wahlperiode}
                type="button"
                onClick={() => {
                  setActivePeriodId(p.wahlperiode);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2.5 text-[13px] font-bold tabular-nums focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-purple)] transition-colors duration-100 ${
                  isSidebar
                    ? isActive
                      ? "bg-[var(--color-purple)] text-white"
                      : "text-white/75 hover:bg-white/10 hover:text-white"
                    : isActive
                      ? "bg-[#F0EFF9] text-[var(--color-navy)]"
                      : "text-[var(--color-navy)] hover:bg-[#F0EFF9]"
                }`}
              >
                {yearsOnly(p.label)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
