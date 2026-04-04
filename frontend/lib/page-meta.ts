/**
 * Single source of truth for page metadata.
 * Used by PageHeader on each page AND to auto-generate dashboard feature cards.
 * Always edit here — never inline the same data in a page file.
 */

export interface PageMeta {
  href: string;
  /** Accent color — drives PageHeader border and dashboard icon background. */
  color: string;
  /** Eyebrow label shown above the title. */
  label: string;
  title: string;
  description: string;
  /** If true, the dashboard card spans both columns on md+. */
  wide?: boolean;
}

export const PAGE_META: PageMeta[] = [
  {
    href: "/vote-map",
    color: "#4C46D9",
    label: "Abstimmungsverhalten",
    title: "Wer stimmt mit wem?",
    description:
      "Ein KI-Modell hat das Abstimmungsverhalten aller Abgeordneten in einen zweidimensionalen Raum eingebettet. Abgeordnete, die häufig gleich abstimmen, landen nah beieinander, unabhängig von Fraktionsgrenzen.",
    wide: true,
  },
  {
    href: "/party-profile",
    color: "#16A085",
    label: "Demografie",
    title: "Wer sitzt im Bundestag?",
    description:
      "Altersstruktur, Geschlechterverteilung, Berufsfelder und Bildungshintergrund im Vergleich: So unterscheiden sich die Fraktionen voneinander und vom Gesamtparlament.",
  },
  {
    href: "/sidejobs",
    color: "#E67E22",
    label: "Transparenz",
    title: "Wer verdient noch dazu?",
    description:
      "Bundestagsabgeordnete sind gesetzlich verpflichtet, entgeltliche Nebentätigkeiten ab 1.000 € monatlich zu melden (§ 44a AbgG). Diese Auswertung zeigt, in welchen Parteien, Branchen und Themenfeldern Nebeneinkünfte besonders verbreitet sind.",
  },
  {
    href: "/comments",
    color: "#E74C3C",
    label: "Plenardynamik",
    title: "Wer reagiert auf wen?",
    description:
      "Jede Unterbrechung im Plenum, Zwischenrufe, Lachen, Applaus, ist im Stenografischen Bericht festgehalten. Diese Analyse zeigt, welche Partei wie oft und bei wessen Reden reagiert.",
  },
  {
    href: "/speeches",
    color: "#9B59B6",
    label: "Wortanalyse",
    title: "Wer redet worüber?",
    description:
      "Welche Themen prägen jede Fraktion im Plenum? Wordclouds der Begriffe, die jede Partei besonders prägen, und die redeaktivsten Abgeordneten im direkten Vergleich.",
  },
  {
    href: "/trends",
    color: "#4A5C8C",
    label: "Zeitverlauf",
    title: "Wann wurde welches Thema heiß?",
    description:
      "Verfolge, wie oft ein Begriff in Plenardebatten erwähnt wurde, und wann Themen politisch heiß wurden.",
    wide: true,
  },
];
