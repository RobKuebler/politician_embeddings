import { CohesionRecord } from "@/lib/data";
import { getPartyColor } from "@/lib/constants";
import { HorizontalBarRow } from "@/components/charts/HorizontalBarRow";

interface Props {
  cohesion: CohesionRecord[];
}

export function CohesionChart({ cohesion }: Props) {
  const sorted = [...cohesion].sort((a, b) => b.streuung - a.streuung);
  const max = sorted[0]?.streuung ?? 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {sorted.map((c) => (
        <HorizontalBarRow
          key={c.label}
          label={c.label}
          labelWidth={80}
          value={c.streuung}
          max={max}
          color={getPartyColor(c.party)}
          displayValue={c.streuung.toFixed(3)}
          valueWidth={40}
        />
      ))}
    </div>
  );
}
