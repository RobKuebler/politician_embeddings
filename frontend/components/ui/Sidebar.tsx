'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PeriodSelector } from './PeriodSelector'

const NAV_ITEMS = [
  { href: '/',               label: 'Start' },
  { href: '/vote-map',       label: 'Abstimmungslandkarte' },
  { href: '/party-profile',  label: 'Parteiprofil' },
  { href: '/sidejobs',       label: 'Nebeneinkünfte' },
]

export function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="hidden md:flex flex-col w-56 shrink-0 h-screen sticky top-0 border-r border-gray-100 bg-white px-4 py-6 gap-2">
      <span className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2 px-2">
        Parlascanned
      </span>
      <nav className="flex flex-col gap-1 flex-1">
        {NAV_ITEMS.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`rounded-lg px-3 py-2 text-sm transition-colors ${
              pathname === href
                ? 'bg-gray-100 font-medium text-gray-900'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto">
        <p className="text-xs text-gray-400 mb-2 px-2">Wahlperiode</p>
        <PeriodSelector />
      </div>
    </aside>
  )
}
