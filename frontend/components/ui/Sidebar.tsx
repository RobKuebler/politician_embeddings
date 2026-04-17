"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/lib/language-context";
import { PeriodSelector } from "./PeriodSelector";
import { Logo } from "./Logo";
import { BundestagSeats } from "./BundestagSeats";
import { NAV_ITEMS } from "@/lib/nav-items";

export function Sidebar() {
  const rawPathname = usePathname();
  // Next.js may return trailing slashes (e.g. "/party-profile/") — strip them for comparison
  const pathname =
    rawPathname !== "/" ? rawPathname.replace(/\/$/, "") : rawPathname;
  const { t, language, setLanguage } = useLanguage();
  return (
    <aside className="hidden md:flex flex-col w-[180px] shrink-0 h-screen sticky top-0 bg-[#1E1B5E]">
      {/* Logo + wordmark — links to start page */}
      <Link
        href="/"
        className="flex items-center gap-2.5 px-3 pt-[14px] pb-[10px] hover:opacity-80 transition-opacity duration-150"
      >
        <div className="w-8 h-8 bg-[#4C46D9] rounded-[9px] flex items-center justify-center shrink-0">
          <Logo size={20} />
        </div>
        <span className="text-[13px] font-black tracking-tight text-white truncate">
          Parlascanned
        </span>
      </Link>

      {/* Period selector */}
      <div className="px-[10px] mb-[10px]">
        <PeriodSelector variant="sidebar" />
      </div>

      {/* Language toggle */}
      <div className="px-[10px] mb-[14px]">
        <div className="flex gap-1">
          {(["de", "en"] as const).map((lang) => (
            <button
              key={lang}
              onClick={() => setLanguage(lang)}
              className={`flex-1 py-1 rounded-md text-[11px] font-bold uppercase transition-colors duration-150 ${
                language === lang
                  ? "bg-white text-[#1E1B5E]"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              {lang}
            </button>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="mx-auto w-10 h-px bg-white/10 mb-[10px]" />

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 px-2 flex-1 overflow-y-auto">
        {NAV_ITEMS.map(({ href, key, icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 outline-none focus:outline-none transition-all duration-150 ${
                active
                  ? "bg-[#4C46D9]"
                  : "opacity-55 hover:opacity-90 hover:bg-white/5"
              }`}
            >
              <span
                className={`shrink-0 ${active ? "text-white" : "text-[#A8A5E0]"}`}
              >
                {icon(active, 20)}
              </span>
              <span
                className={`text-[13px] font-bold truncate ${active ? "text-white" : "text-[#A8A5E0]"}`}
              >
                {t.nav[key]}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Seat distribution widget */}
      <div className="mx-auto w-10 h-px bg-white/10 mb-[10px]" />
      <div className="px-[10px] pb-[14px]">
        <BundestagSeats />
      </div>
    </aside>
  );
}
