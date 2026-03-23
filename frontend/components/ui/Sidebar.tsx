"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PeriodSelector } from "./PeriodSelector";

const NAV_ITEMS = [
  {
    href: "/",
    label: "Start",
    icon: (active: boolean) => (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z" />
        <path d="M9 21V12h6v9" />
      </svg>
    ),
  },
  {
    href: "/vote-map",
    label: "Abstimmungen",
    icon: (active: boolean) => (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="m8 12 3 3 5-5" />
      </svg>
    ),
  },
  {
    href: "/party-profile",
    label: "Parteiprofil",
    icon: (active: boolean) => (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="9" cy="7" r="4" />
        <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        <path d="M21 21v-2a4 4 0 0 0-3-3.85" />
      </svg>
    ),
  },
  {
    href: "/sidejobs",
    label: "Nebeneinkünfte",
    icon: (active: boolean) => (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <circle cx="12" cy="12" r="3" />
        <path d="M6 12h.01M18 12h.01" />
      </svg>
    ),
  },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex flex-col w-[120px] shrink-0 h-screen sticky top-0 bg-[#1E1B5E]">
      {/* Logo */}
      <div className="flex justify-center pt-[14px] pb-[10px]">
        <div className="w-9 h-9 bg-[#4C46D9] rounded-[9px] flex items-center justify-center">
          <span className="text-white font-black text-sm">P</span>
        </div>
      </div>

      {/* Period selector */}
      <div className="px-[10px] mb-[14px]">
        <PeriodSelector variant="sidebar" />
      </div>

      {/* Divider */}
      <div className="mx-auto w-10 h-px bg-white/10 mb-[10px]" />

      {/* Nav */}
      <nav className="flex flex-col gap-1 px-2 flex-1">
        {NAV_ITEMS.map(({ href, label, icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-1 rounded-lg px-1.5 py-2 transition-opacity duration-150 ${
                active ? "bg-[#4C46D9]" : "opacity-55 hover:opacity-85"
              }`}
            >
              <span className={active ? "text-white" : "text-[#A8A5E0]"}>
                {icon(active)}
              </span>
              <span
                className={`text-[9px] font-bold tracking-wide ${active ? "text-white" : "text-[#A8A5E0]"}`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
