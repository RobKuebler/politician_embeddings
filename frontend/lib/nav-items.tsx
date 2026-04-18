/**
 * Central nav item config shared by Sidebar and MobileHeader drawer.
 * Icons accept (active, size) so both nav components use the exact same paths.
 *
 * NAV_GROUPS is the primary export — groups with label, color, and items.
 * NAV_ITEMS is a flat backwards-compatible export for components that don't need grouping.
 */

import type { NavKey } from "@/lib/i18n/types";

export interface NavItem {
  href: string;
  key: NavKey;
  icon: (active: boolean, size?: number) => React.ReactElement;
}

export interface NavGroup {
  label: Record<"de" | "en", string>;
  color: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: { de: "Gesetzgebung", en: "Legislative" },
    color: "#a8a5f0",
    items: [
      {
        href: "/vote-map",
        key: "vote_map",
        icon: (active, size = 24) => (
          <svg
            width={size}
            height={size}
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
        href: "/motions",
        key: "motions",
        icon: (active, size = 24) => (
          <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={active ? 2.2 : 1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        ),
      },
      {
        href: "/speeches",
        key: "speeches",
        icon: (active, size = 24) => (
          <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={active ? 2.2 : 1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        ),
      },
    ],
  },
  {
    label: { de: "Parteien", en: "Parties" },
    color: "#5bbdb5",
    items: [
      {
        href: "/comments",
        key: "comments",
        icon: (active, size = 24) => (
          <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={active ? 2.2 : 1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M17 6.1H3" />
            <path d="M21 12.1H3" />
            <path d="M15.1 18H3" />
          </svg>
        ),
      },
      {
        href: "/party-profile",
        key: "party_profile",
        icon: (active, size = 24) => (
          <svg
            width={size}
            height={size}
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
        href: "/trends",
        key: "trends",
        icon: (active, size = 24) => (
          <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={active ? 2.2 : 1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        ),
      },
    ],
  },
  {
    label: { de: "Transparenz", en: "Transparency" },
    color: "#f0a83c",
    items: [
      {
        href: "/sidejobs",
        key: "sidejobs",
        icon: (active, size = 24) => (
          <svg
            width={size}
            height={size}
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
      {
        href: "/potential-conflicts",
        key: "potential_conflicts",
        icon: (active, size = 24) => (
          <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={active ? 2.2 : 1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
        ),
      },
    ],
  },
];

// Flat list — backwards compatible for components that don't need group metadata
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);
