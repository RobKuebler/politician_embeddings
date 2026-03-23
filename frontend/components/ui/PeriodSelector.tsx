"use client";
import { usePeriod } from "@/lib/period-context";

export function PeriodSelector() {
  const { periods, activePeriodId, setActivePeriodId } = usePeriod();
  if (periods.length <= 1) return null;
  return (
    <div className="relative">
      <select
        value={activePeriodId ?? ""}
        onChange={(e) => setActivePeriodId(Number(e.target.value))}
        className="w-full text-[13px] rounded-lg border border-[#E3E0DA] bg-white px-3 py-2 pr-8 text-[#171613] focus:outline-none focus:ring-2 focus:ring-[#2347C8]/20 focus:border-[#2347C8] transition-colors duration-150 cursor-pointer appearance-none"
      >
        {periods.map((p) => (
          <option key={p.period_id} value={p.period_id}>
            {p.label}
          </option>
        ))}
      </select>
      {/* Custom chevron */}
      <svg
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9A9790]"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
}
