"use client";
import { usePeriod } from "@/lib/period-context";
import { useEffect, useRef, useState } from "react";

interface PeriodSelectorProps {
  /** "sidebar" = dark pill on navy bg | "light" = white pill on light bg (mobile, default) */
  variant?: "sidebar" | "light";
}

export function PeriodSelector({ variant = "light" }: PeriodSelectorProps) {
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

  if (periods.length <= 1) return null;

  const isSidebar = variant === "sidebar";

  const rawLabel =
    periods.find((p) => p.period_id === activePeriodId)?.label ?? "";
  // Normalize the API dash: "Bundestag 2021 - 2025" → "Bundestag 2021–2025"
  const normalizeLabel = (label: string) => label.replace(/\s*-\s*/g, "–");

  const displayLabel = normalizeLabel(rawLabel);

  return (
    <div className="relative" ref={containerRef}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Wahlperiode auswählen"
        aria-expanded={open}
        className={`w-full flex items-center justify-between gap-1 rounded-lg px-2 py-1.5 outline-none transition-colors duration-150 ${
          isSidebar
            ? "bg-white/10 border border-white/[0.18] hover:bg-white/15"
            : "bg-white border border-[#1E1B5E] hover:bg-[#F0EFF9]"
        }`}
      >
        <span
          className={`text-[11px] font-bold truncate ${
            isSidebar ? "text-white" : "text-[#1E1B5E]"
          }`}
        >
          {displayLabel}
        </span>
        {/* Chevron — rotates when open */}
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke={isSidebar ? "rgba(255,255,255,0.6)" : "#1E1B5E"}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {/* Custom dropdown panel */}
      {open && (
        <div
          className={`absolute z-50 mt-1 rounded-xl overflow-hidden ${
            isSidebar
              ? "left-0 min-w-[160px] bg-[#16134A] border border-white/[0.15] shadow-xl shadow-black/40"
              : "left-0 right-0 bg-white border border-[#E3E0DA] shadow-lg"
          }`}
        >
          {periods.map((p) => {
            const isActive = p.period_id === activePeriodId;
            return (
              <button
                key={p.period_id}
                type="button"
                onClick={() => {
                  setActivePeriodId(p.period_id);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2.5 text-[11px] font-bold outline-none transition-colors duration-100 ${
                  isSidebar
                    ? isActive
                      ? "bg-[#4C46D9] text-white"
                      : "text-white/75 hover:bg-white/10 hover:text-white"
                    : isActive
                      ? "bg-[#F0EFF9] text-[#1E1B5E]"
                      : "text-[#1E1B5E] hover:bg-[#F0EFF9]"
                }`}
              >
                {normalizeLabel(p.label)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
