import Link from "next/link";
import { Footer } from "@/components/ui/Footer";

const FEATURES = [
  {
    href: "/vote-map",
    title: "Abstimmungslandkarte",
    description:
      "KI-generierte Karte aller Abgeordneten. Nähe = ähnliches Abstimmungsverhalten.",
    tag: "KI-Analyse",
    iconGradient: "linear-gradient(135deg, #4C46D9 0%, #7B77CC 100%)",
    tagColor: "#4C46D9",
    wide: true,
  },
  {
    href: "/party-profile",
    title: "Parteiprofil",
    description:
      "Altersverteilung, Geschlecht, Berufe und Ausbildung der Fraktionen im Vergleich.",
    tag: "Demografie",
    iconGradient: "linear-gradient(135deg, #16A085 0%, #48CAA3 100%)",
    tagColor: "#16A085",
    wide: false,
  },
  {
    href: "/sidejobs",
    title: "Nebeneinkünfte",
    description:
      "Offengelegte Nebentätigkeiten und Einkünfte nach Partei, Kategorie und Themenfeld.",
    tag: "Transparenz",
    iconGradient: "linear-gradient(135deg, #E67E22 0%, #F39C12 100%)",
    tagColor: "#E67E22",
    wide: false,
  },
];

export default function Home() {
  return (
    <>
      {/* Hero banner */}
      <div
        className="rounded-2xl px-6 py-8 mb-6"
        style={{ background: "#1E1B5E" }}
      >
        <p
          className="text-[11px] font-bold tracking-[0.18em] uppercase mb-3"
          style={{ color: "#7B77CC" }}
        >
          Bundestag · KI-Analyse
        </p>
        <h1
          className="text-4xl md:text-5xl font-black tracking-tight leading-[1.05] mb-3"
          style={{ color: "#FFFFFF" }}
        >
          Parlascanned
        </h1>
        <p className="text-[14px] leading-relaxed" style={{ color: "#AAAAAA" }}>
          Wer stimmt mit wem? Wo verlaufen die echten Trennlinien im Deutschen
          Bundestag?
        </p>
      </div>

      {/* Feature grid: 1 col mobile, 2 col md+ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger">
        {FEATURES.map(
          ({ href, title, description, tag, iconGradient, tagColor, wide }) => (
            <Link
              key={href}
              href={href}
              className={`group flex flex-col bg-white rounded-xl p-4 md:p-5 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 ${
                wide ? "md:col-span-2" : ""
              }`}
              style={{ boxShadow: "0 2px 12px rgba(78,70,217,0.10)" }}
            >
              {/* Icon + tag row */}
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-7 h-7 rounded-lg shrink-0"
                  style={{ background: iconGradient }}
                />
                <span
                  className="text-[11px] font-bold tracking-[0.1em] uppercase"
                  style={{ color: tagColor }}
                >
                  {tag}
                </span>
              </div>

              <h2
                className="font-extrabold text-[15px] leading-snug mb-1.5"
                style={{ color: "#1E1B5E" }}
              >
                {title}
              </h2>
              <p
                className="text-[13px] leading-relaxed flex-1"
                style={{ color: "#6B6760" }}
              >
                {description}
              </p>

              {/* CTA */}
              <div
                className="mt-4 flex items-center gap-1 text-[12px] font-bold"
                style={{ color: tagColor }}
              >
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
          ),
        )}
      </div>

      <Footer />
    </>
  );
}
