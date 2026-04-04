import {
  CARD_CLASS,
  CARD_PADDING,
  CARD_SHADOW,
  FALLBACK_COLOR,
  PARTY_COLORS,
} from "@/lib/constants";
import { HorizontalBarRow } from "@/components/charts/HorizontalBarRow";

interface Props {
  items: { party: string; count: number }[];
  label: string;
  sublabel: string;
}

/** Horizontal bar chart showing count per party — used for motions and keyword search results. */
export function MotionCountBars({ items, label, sublabel }: Props) {
  const sorted = [...items].sort((a, b) => b.count - a.count);
  const max = Math.max(...sorted.map((i) => i.count), 1);

  return (
    <section
      className={`${CARD_CLASS} ${CARD_PADDING}`}
      style={{ boxShadow: CARD_SHADOW }}
    >
      <h2
        className="font-extrabold text-[15px] mb-1"
        style={{ color: "#1E1B5E" }}
      >
        {label}
      </h2>
      <p className="text-[12px] mb-4" style={{ color: "#9A9790" }}>
        {sublabel}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sorted.map(({ party, count }) => (
          <HorizontalBarRow
            key={party}
            label={party}
            labelWidth={80}
            value={count}
            max={max}
            color={PARTY_COLORS[party] ?? FALLBACK_COLOR}
            displayValue={count.toLocaleString("de")}
          />
        ))}
      </div>
    </section>
  );
}
