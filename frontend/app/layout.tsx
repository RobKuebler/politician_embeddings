import type { Metadata } from "next";
import { Libre_Franklin } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/ui/Sidebar";
import { MobileHeader } from "@/components/ui/MobileHeader";
import { PeriodProvider } from "@/lib/period-context";
import { LanguageProvider } from "@/lib/language-context";
import { LangSync } from "@/components/ui/LangSync";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const libreFranklin = Libre_Franklin({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Parlascanned",
  description: "Bundestagsabgeordnete und ihre Abstimmungen",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body className={`${libreFranklin.className} text-[#171613]`}>
        <LanguageProvider>
          <LangSync />
          <PeriodProvider>
            <div className="flex min-h-screen">
              <Sidebar />
              <main className="flex-1 min-w-0 px-4 pt-[76px] py-6 md:pt-6 md:px-8 md:pb-10">
                <div className="fade-up">{children}</div>
              </main>
            </div>
            <MobileHeader />
          </PeriodProvider>
        </LanguageProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
