"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  {
    href: "/",
    label: "Start",
    icon: (active: boolean) => (
      <svg
        width="20"
        height="20"
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
    label: "Karte",
    icon: (active: boolean) => (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="currentColor"
        stroke="none"
      >
        <circle cx="5.5" cy="8" r={active ? 2 : 1.6} />
        <circle cx="14" cy="5" r={active ? 2 : 1.6} />
        <circle cx="19" cy="12.5" r={active ? 2 : 1.6} />
        <circle cx="8.5" cy="16" r={active ? 2 : 1.6} />
        <circle cx="16.5" cy="18.5" r={active ? 2 : 1.6} />
      </svg>
    ),
  },
  {
    href: "/party-profile",
    label: "Parteien",
    icon: (active: boolean) => (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="12" width="4" height="9" rx="1" />
        <rect x="10" y="7" width="4" height="14" rx="1" />
        <rect x="17" y="3" width="4" height="18" rx="1" />
      </svg>
    ),
  },
  {
    href: "/sidejobs",
    label: "Einkünfte",
    icon: (active: boolean) => (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
        <line x1="12" y1="12" x2="12" y2="16" />
        <line x1="10" y1="14" x2="14" y2="14" />
      </svg>
    ),
  },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-[#E3E0DA] z-50">
      <div className="flex justify-around items-center h-16">
        {NAV_ITEMS.map(({ href, label, icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center flex-1 h-full gap-1 text-[10px] font-semibold tracking-wide transition-colors duration-150 ${
                active ? "text-[#2347C8]" : "text-[#9A9790]"
              }`}
            >
              {icon(active)}
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
