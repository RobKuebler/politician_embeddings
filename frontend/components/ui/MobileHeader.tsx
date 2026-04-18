"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { PeriodSelector } from "./PeriodSelector";
import { Logo } from "./Logo";
import { BundestagSeats } from "./BundestagSeats";
import { NAV_GROUPS } from "@/lib/nav-items";
import { useLanguage } from "@/lib/language-context";

/** Fixed top header for mobile — shows logo, period selector, and hamburger menu. Hidden on md+. */
export function MobileHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname().replace(/\/$/, "") || "/";
  const { t, language, setLanguage } = useLanguage();

  return (
    <>
      <header className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 h-[68px] bg-[var(--color-navy)]">
        {/* Logo + wordmark — links to start page */}
        <Link
          href="/"
          className="flex items-center gap-2 hover:opacity-80 transition-opacity duration-150"
        >
          <div className="w-8 h-8 bg-[var(--color-purple)] rounded-[9px] flex items-center justify-center shrink-0">
            <Logo size={20} />
          </div>
          <span className="text-[12px] font-black tracking-tight text-white">
            Parlascanned
          </span>
        </Link>

        {/* Right cluster: period selector + hamburger */}
        <div className="flex items-center gap-3">
          <div className="w-[130px]">
            <PeriodSelector variant="sidebar" showLabel={false} />
          </div>

          <button
            onClick={() => setOpen(true)}
            className="w-9 h-9 flex flex-col items-center justify-center gap-[5px] shrink-0 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            aria-label={t.ui.menu_open}
          >
            <span className="block w-[18px] h-[2px] bg-white rounded-full" />
            <span className="block w-[18px] h-[2px] bg-white rounded-full" />
            <span className="block w-[18px] h-[2px] bg-white rounded-full" />
          </button>
        </div>
      </header>

      {/* Backdrop */}
      <div
        aria-hidden="true"
        className={`md:hidden fixed inset-0 z-[60] bg-black/50 transition-opacity duration-300 ${
          open
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setOpen(false)}
      />

      {/* Drawer — slides in from the right */}
      <nav
        aria-modal={open}
        aria-hidden={!open}
        aria-label="Navigation"
        className={`md:hidden fixed top-0 right-0 bottom-0 z-[70] w-[280px] bg-[var(--color-navy)] flex flex-col transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-4 h-[68px] shrink-0">
          <span className="text-[11px] font-bold tracking-[0.14em] uppercase text-white/40">
            {t.ui.nav_label}
          </span>
          <button
            onClick={() => setOpen(false)}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            aria-label={t.ui.menu_close}
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

        {/* Language toggle */}
        <div className="px-4 mb-3">
          <div className="flex gap-1">
            {(["de", "en"] as const).map((lang) => (
              <button
                key={lang}
                onClick={() => setLanguage(lang)}
                className={`flex-1 min-h-[44px] rounded-md text-[12px] font-bold uppercase transition-colors duration-150 ${
                  language === lang
                    ? "bg-white text-[var(--color-navy)]"
                    : "text-white/40 hover:text-white/70"
                }`}
              >
                {lang}
              </button>
            ))}
          </div>
        </div>

        {/* Nav items */}
        <div className="flex flex-col px-3 overflow-y-auto">
          {NAV_GROUPS.map((group, gi) => {
            const groupLabel =
              language === "en" ? group.label.en : group.label.de;
            return (
              <div key={groupLabel}>
                {gi > 0 && (
                  <div
                    className="mx-1 my-2.5"
                    style={{ height: 1, background: "rgba(255,255,255,0.08)" }}
                  />
                )}
                <p
                  className="px-3 mb-1 font-extrabold tracking-[0.20em] uppercase"
                  style={{
                    fontSize: 10,
                    color: group.color,
                    opacity: 0.8,
                    marginTop: gi === 0 ? 0 : 2,
                  }}
                >
                  {groupLabel}
                </p>
                <div className="flex flex-col gap-0.5">
                  {group.items.map(({ href, key, icon }) => {
                    const active = pathname === href;
                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setOpen(false)}
                        className={`flex items-center gap-3 rounded-lg px-3 py-3 transition-all duration-150 ${
                          active
                            ? "bg-[var(--color-purple)]"
                            : "opacity-55 hover:opacity-90 hover:bg-white/5"
                        }`}
                      >
                        <span className="shrink-0 text-white">
                          {icon(active, 22)}
                        </span>
                        <span className="text-[15px] font-bold text-white">
                          {t.nav[key]}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Seat distribution widget */}
        <div className="mx-4 mt-3 mb-2 h-px bg-white/10" />
        <div className="px-4 pb-4">
          <BundestagSeats />
        </div>
      </nav>
    </>
  );
}
