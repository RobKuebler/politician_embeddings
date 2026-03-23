import Link from "next/link";
import { Footer } from "@/components/ui/Footer";

const FEATURES = [
  {
    href: "/vote-map",
    title: "Abstimmungslandkarte",
    description:
      "KI-generierte Karte aller Abgeordneten. Nähe = ähnliches Abstimmungsverhalten.",
    tag: "KI-Analyse",
  },
  {
    href: "/party-profile",
    title: "Parteiprofil",
    description:
      "Altersverteilung, Geschlecht, Berufe und Ausbildung der Fraktionen im Vergleich.",
    tag: "Demografie",
  },
  {
    href: "/sidejobs",
    title: "Nebeneinkünfte",
    description:
      "Offengelegte Nebentätigkeiten und Einkünfte nach Partei, Kategorie und Themenfeld.",
    tag: "Transparenz",
  },
];

export default function Home() {
  return (
    <>
      <div className="max-w-xl py-8 md:py-14 mb-8">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-[#171613] mb-4 leading-[1.1]">
          Parlascanned
        </h1>
        <p className="text-[16px] text-[#6B6760] leading-relaxed">
          Daten und KI-Analyse zum Deutschen Bundestag. Wer stimmt mit wem? Wo
          verlaufen die echten Trennlinien?
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl stagger">
        {FEATURES.map(({ href, title, description, tag }) => (
          <Link
            key={href}
            href={href}
            className="group flex flex-col bg-white rounded-xl p-5 border border-[#E3E0DA] hover:border-[#2347C8]/40 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer"
          >
            <span className="text-[11px] font-bold tracking-[0.1em] uppercase text-[#2347C8] mb-3">
              {tag}
            </span>
            <h2 className="font-bold text-[15px] text-[#171613] mb-2 group-hover:text-[#2347C8] transition-colors duration-150">
              {title}
            </h2>
            <p className="text-[13px] text-[#6B6760] leading-relaxed flex-1">
              {description}
            </p>
            <div className="mt-4 flex items-center gap-1 text-[12px] font-bold text-[#2347C8]">
              Öffnen
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="group-hover:translate-x-0.5 transition-transform duration-150"
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </div>
          </Link>
        ))}
      </div>

      <Footer />
    </>
  );
}
