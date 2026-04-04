import { SpeakerRecord } from "@/lib/data";
import { HorizontalBarRow } from "@/components/charts/HorizontalBarRow";

interface Props {
  speakers: SpeakerRecord[];
  partyColor: string;
}

function formatWords(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

export function SpeakerBars({ speakers, partyColor }: Props) {
  const max = speakers[0]?.wortanzahl_gesamt ?? 1;

  return (
    <div className="overflow-y-auto" style={{ height: 220 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {speakers.map((s, i) => (
          <HorizontalBarRow
            key={`${s.redner_id}-${i}`}
            label={`${s.vorname} ${s.nachname}`}
            labelWidth={120}
            value={s.wortanzahl_gesamt}
            max={max}
            color={partyColor}
            displayValue={formatWords(s.wortanzahl_gesamt)}
            barHeight={6}
            valueWidth={36}
            rank={i + 1}
          />
        ))}
      </div>
    </div>
  );
}
