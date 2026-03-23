import type { Metadata } from "next";
import { Syne } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/ui/Sidebar";
import { BottomNav } from "@/components/ui/BottomNav";
import { PeriodProvider } from "@/lib/period-context";
import { PeriodSelector } from "@/components/ui/PeriodSelector";

const syne = Syne({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Parlascanned",
  description: "Bundestagsabgeordnete und ihre Abstimmungen",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body className={`${syne.className} text-[#171613]`}>
        <PeriodProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 min-w-0 px-4 py-6 md:px-8 pb-20 md:pb-10">
              {/* Mobile period selector */}
              <div className="md:hidden mb-4">
                <PeriodSelector />
              </div>
              <div className="fade-up">{children}</div>
            </main>
          </div>
          <BottomNav />
        </PeriodProvider>
      </body>
    </html>
  );
}
