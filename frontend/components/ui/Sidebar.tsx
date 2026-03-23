"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PeriodSelector } from "./PeriodSelector";

const NAV_ITEMS = [
  { href: "/", label: "Übersicht" },
  { href: "/vote-map", label: "Abstimmungslandkarte" },
  { href: "/party-profile", label: "Parteiprofil" },
  { href: "/sidejobs", label: "Nebeneinkünfte" },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex flex-col w-56 shrink-0 h-screen sticky top-0 border-r border-[#E3E0DA] bg-white px-3 py-5 gap-1">
      {/* Brand */}
      <div className="px-3 pt-3 pb-4">
        <span className="text-[13px] font-extrabold tracking-[0.14em] text-[#171613] uppercase">
          Parlascanned
        </span>
        <div className="w-5 h-[2.5px] bg-[#2347C8] mt-1.5 rounded-full mb-3" />
        <p className="text-[11px] font-bold tracking-[0.1em] uppercase text-[#9A9790] mb-1.5">
          Wahlperiode
        </p>
        <PeriodSelector />
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-0.5 flex-1">
        {NAV_ITEMS.map(({ href, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`relative rounded-lg px-3 py-2 text-[13px] transition-colors duration-150 ${
                active
                  ? "bg-[#EEF2FB] font-semibold text-[#2347C8]"
                  : "font-medium text-[#6B6760] hover:bg-[#F4F3F0] hover:text-[#171613]"
              }`}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#2347C8] rounded-r-full" />
              )}
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
