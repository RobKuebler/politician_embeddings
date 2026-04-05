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
      "Jeder Punkt ist ein Abgeordneter. Wer oft gleich abstimmt, landet nah beieinander, egal welcher Fraktion er angehört. So entstehen Muster, die Fraktionsgrenzen überschreiten.",
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
      "Abgeordnete müssen bezahlte Nebentätigkeiten ab 1.000 € monatlich öffentlich melden. Diese Auswertung zeigt, in welchen Parteien, Branchen und Themenfeldern solche Einkünfte besonders verbreitet sind.",
  },
  {
    href: "/ausschuesse",
    color: "#c0392b",
    label: "Transparenz",
    title: "Wer verdient im eigenen Ausschuss?",
    description:
      "Abgeordnete, die in einem parlamentarischen Ausschuss sitzen und gleichzeitig in demselben Themenfeld Geld verdienen — eine Analyse möglicher Interessenkonflikte.",
  },
  {
    href: "/comments",
    color: "#E74C3C",
    label: "Plenardynamik",
    title: "Wer reagiert auf wen?",
    description:
      "Zwischenrufe, Lachen, Applaus: Jede Reaktion im Bundestag wird protokolliert. Diese Analyse zeigt, welche Partei wie oft und bei wessen Reden reagiert.",
  },
  {
    href: "/speeches",
    color: "#9B59B6",
    label: "Wortanalyse",
    title: "Wer redet worüber?",
    description:
      "Welche Begriffe fallen bei einer Partei besonders häufig? Wordclouds zeigen die typische Sprache jeder Fraktion, dazu die redeaktivsten Abgeordneten im Vergleich.",
  },
  {
    href: "/trends",
    color: "#4A5C8C",
    label: "Zeitverlauf",
    title: "Wann wurde welches Thema heiß?",
    description:
      "Verfolge, wie oft ein Begriff in Plenardebatten erwähnt wurde, und erkenne, wann ein Thema plötzlich an Fahrt aufnahm.",
    wide: true,
  },
  {
    href: "/motions",
    color: "#2563EB",
    label: "Parlamentarische Initiative",
    title: "Wer fordert was?",
    description:
      "Anträge und Anfragen der Fraktionen im Vergleich — nach Themen, Volumen und aktivsten Einreichern.",
  },
];
