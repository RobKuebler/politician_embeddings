'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PeriodSelector } from './PeriodSelector'

const NAV_ITEMS = [
  { href: '/',              label: 'Start',      icon: '🏠' },
  { href: '/vote-map',      label: 'Karte',       icon: '🗺️' },
  { href: '/party-profile', label: 'Parteien',   icon: '📊' },
  { href: '/sidejobs',      label: 'Einkünfte',  icon: '💼' },
]

export function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
      <div className="flex justify-around items-center h-16">
        {NAV_ITEMS.map(({ href, label, icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center justify-center flex-1 h-full min-w-[44px] text-xs transition-colors ${
              pathname === href ? 'text-blue-600 font-medium' : 'text-gray-500'
            }`}
          >
            <span className="text-lg leading-none mb-0.5">{icon}</span>
            {label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
