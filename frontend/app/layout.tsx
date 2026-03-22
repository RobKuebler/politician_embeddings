import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Sidebar } from '@/components/ui/Sidebar'
import { BottomNav } from '@/components/ui/BottomNav'
import { PeriodProvider } from '@/lib/period-context'
import { PeriodSelector } from '@/components/ui/PeriodSelector'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Parlascanned',
  description: 'Bundestagsabgeordnete und ihre Abstimmungen',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className={`${inter.className} bg-white text-gray-900`}>
        <PeriodProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            {/* Main content: add bottom padding on mobile to clear the fixed bottom nav */}
            <main className="flex-1 min-w-0 px-4 py-6 md:px-8 pb-20 md:pb-8">
              {/* Mobile period selector — shown above page content, hidden on desktop */}
              <div className="md:hidden mb-4">
                <PeriodSelector />
              </div>
              {children}
            </main>
          </div>
          <BottomNav />
        </PeriodProvider>
      </body>
    </html>
  )
}
