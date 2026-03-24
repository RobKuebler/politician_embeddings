"use client";
import { PeriodSelector } from "./PeriodSelector";

/** Fixed top header for mobile — shows logo + period selector. Hidden on md+. */
export function MobileHeader() {
  return (
    <header className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 h-[68px] bg-[#1E1B5E]">
      {/* Logo */}
      <div className="w-8 h-8 bg-[#4C46D9] rounded-[9px] flex items-center justify-center shrink-0">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="10.5" cy="10.5" r="7" stroke="white" strokeWidth="1.8" />
          <line
            x1="16"
            y1="16"
            x2="20.5"
            y2="20.5"
            stroke="white"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <circle cx="7.5" cy="11.5" r="1.6" fill="white" />
          <circle cx="10.5" cy="8" r="1.6" fill="white" />
          <circle cx="13.5" cy="11.5" r="1.6" fill="white" />
        </svg>
      </div>

      {/* Period selector — label left, dropdown right */}
      <div className="flex items-center gap-2">
        <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-white/40 shrink-0">
          Bundestag
        </p>
        <div className="w-[130px]">
          <PeriodSelector variant="sidebar" showLabel={false} />
        </div>
      </div>
    </header>
  );
}
