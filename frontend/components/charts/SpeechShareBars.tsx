import { SpeechStatsFile } from "@/lib/data";
import {
  PARTY_COLORS,
  FALLBACK_COLOR,
  CARD_CLASS,
  CARD_SHADOW,
  CARD_PADDING,
} from "@/lib/constants";
import { stripSoftHyphen } from "@/lib/data";
import { HorizontalBarRow } from "@/components/charts/HorizontalBarRow";

interface Props {
  speechStats: SpeechStatsFile;
}

function formatWords(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

/** Horizontal bar chart showing total words per party — summary for the speeches page. */
export function SpeechShareBars({ speechStats }: Props) {
  const totals: Record<string, number> = {};
  for (const s of speechStats) {
    const party = stripSoftHyphen(s.fraktion);
    if (party === "fraktionslos" || party === "Unbekannt") continue;
    totals[party] = (totals[party] ?? 0) + s.wortanzahl_gesamt;
  }

  const sorted = Object.keys(totals).sort((a, b) => totals[b] - totals[a]);
  const max = Math.max(...sorted.map((p) => totals[p]), 1);

  return (
    <section
      className={`${CARD_CLASS} ${CARD_PADDING}`}
      style={{ boxShadow: CARD_SHADOW }}
    >
      <h2
        className="font-extrabold text-[15px] mb-1"
        style={{ color: "#1E1B5E" }}
      >
        Redeanteile
      </h2>
      <p className="text-[12px] text-[#9A9790] mb-4">
        Gesamtzahl der Wörter pro Fraktion in dieser Legislaturperiode.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sorted.map((party) => (
          <HorizontalBarRow
            key={party}
            label={party}
            labelWidth={80}
            value={totals[party]}
            max={max}
            color={PARTY_COLORS[party] ?? FALLBACK_COLOR}
            displayValue={formatWords(totals[party])}
          />
        ))}
      </div>
    </section>
  );
}
