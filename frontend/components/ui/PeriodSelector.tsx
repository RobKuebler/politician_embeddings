"use client";
import { usePeriod } from "@/lib/period-context";

interface PeriodSelectorProps {
  /** "sidebar" = dark pill on navy bg | "light" = white pill on light bg (mobile, default) */
  variant?: "sidebar" | "light";
}

export function PeriodSelector({ variant = "light" }: PeriodSelectorProps) {
  const { periods, activePeriodId, setActivePeriodId } = usePeriod();
  if (periods.length <= 1) return null;

  const isSidebar = variant === "sidebar";

  return (
    <div className="relative">
      {/* Styled overlay — purely visual, pointer-events none */}
      <div
        className={`flex items-center justify-between gap-1 rounded-lg px-2 py-1.5 pointer-events-none ${
          isSidebar
            ? "bg-white/10 border border-white/[0.18]"
            : "bg-white border border-[#1E1B5E]"
        }`}
      >
        <span
          className={`text-[11px] font-bold truncate ${
            isSidebar ? "text-white" : "text-[#1E1B5E]"
          }`}
        >
          {periods.find((p) => p.period_id === activePeriodId)?.label ?? ""}
        </span>
        {/* Chevron */}
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke={isSidebar ? "rgba(255,255,255,0.6)" : "#1E1B5E"}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>

      {/* Actual select — covers the overlay, transparent, handles interaction */}
      <select
        value={activePeriodId ?? ""}
        onChange={(e) => setActivePeriodId(Number(e.target.value))}
        aria-label="Wahlperiode auswählen"
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      >
        {periods.map((p) => (
          <option key={p.period_id} value={p.period_id}>
            {p.label}
          </option>
        ))}
      </select>
    </div>
  );
}
