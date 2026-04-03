"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { PeriodSelector } from "./PeriodSelector";
import { Logo } from "./Logo";
import { NAV_ITEMS } from "@/lib/nav-items";

/** Fixed top header for mobile — shows logo, period selector, and hamburger menu. Hidden on md+. */
export function MobileHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname().replace(/\/$/, "") || "/";

  return (
    <>
      <header className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 h-[68px] bg-[#1E1B5E]">
        {/* Logo */}
        <div className="w-8 h-8 bg-[#4C46D9] rounded-[9px] flex items-center justify-center shrink-0">
          <Logo size={20} />
        </div>

        {/* Right cluster: period selector + hamburger */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-white/40 shrink-0">
              Bundestag
            </p>
            <div className="w-[130px]">
              <PeriodSelector variant="sidebar" showLabel={false} />
            </div>
          </div>

          <button
            onClick={() => setOpen(true)}
            className="w-9 h-9 flex flex-col items-center justify-center gap-[5px] shrink-0 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Menü öffnen"
          >
            <span className="block w-[18px] h-[2px] bg-white rounded-full" />
            <span className="block w-[18px] h-[2px] bg-white rounded-full" />
            <span className="block w-[18px] h-[2px] bg-white rounded-full" />
          </button>
        </div>
      </header>

      {/* Backdrop */}
      <div
        className={`md:hidden fixed inset-0 z-[60] bg-black/50 transition-opacity duration-300 ${
          open
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setOpen(false)}
      />

      {/* Drawer — slides in from the right */}
      <nav
        className={`md:hidden fixed top-0 right-0 bottom-0 z-[70] w-[280px] bg-[#1E1B5E] flex flex-col transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-4 h-[68px] shrink-0">
          <span className="text-[11px] font-bold tracking-[0.14em] uppercase text-white/40">
            Navigation
          </span>
          <button
            onClick={() => setOpen(false)}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Menü schließen"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="h-px bg-white/10 mx-4 mb-2" />

        {/* Nav items */}
        <div className="flex flex-col gap-0.5 px-3 overflow-y-auto">
          {NAV_ITEMS.map(({ href, label, icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-3 transition-all duration-150 ${
                  active
                    ? "bg-[#4C46D9]"
                    : "opacity-55 hover:opacity-90 hover:bg-white/5"
                }`}
              >
                <span className="shrink-0 text-white">{icon(active, 22)}</span>
                <span className="text-[15px] font-bold text-white">
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
