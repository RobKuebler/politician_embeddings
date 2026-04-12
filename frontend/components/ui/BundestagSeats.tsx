"use client";
import { usePeriod } from "@/lib/period-context";
import { BUNDESTAG_SEATS, getTotalSeats, PartySeats } from "@/lib/seats";
import { useTranslation } from "@/lib/language-context";

// Hemicycle-specific colors tuned for the dark navy sidebar (#1E1B5E).
// Keyed by the short party names used in seats.ts — not the canonical PARTY_COLORS keys.
// Brand colors that are near-black or blinding yellow are replaced with sidebar-safe equivalents.
const HEMICYCLE_COLORS: Record<string, string> = {
  "CDU/CSU": "#D0D0D0", // brand #2a2a2a near-black → bright silver
  SPD: "#E3000F",
  AfD: "#009EE0",
  Grüne: "#54C929", // brand #46962B → brightened for dark bg
  "Die Linke": "#FF69B4",
  BSW: "#A860DC", // brand #722EA5 → lightened purple
  FDP: "#C8A800", // brand #FFED00 → dark gold (~4.5:1 on navy)
  fraktionslos: "#666666",
};

// Shorter display labels for narrow legend chips
const SHORT_LABEL: Record<string, string> = {
  "Die Linke": "Linke",
};

function dotColor(party: string): string {
  return HEMICYCLE_COLORS[party] ?? "#888888";
}

function partyLabel(party: string): string {
  return SHORT_LABEL[party] ?? party;
}

interface Dot {
  x: number;
  y: number;
  color: string;
}

/** Compute all dot positions sorted into wedge-shaped party blocs. */
function buildDots(parties: PartySeats[]): Dot[] {
  // Build color array first so total is derived from parties, not a separate argument.
  const colors: string[] = [];
  for (const p of parties)
    for (let i = 0; i < p.seats; i++) colors.push(dotColor(p.party));
  const total = colors.length;

  // Hemicycle geometry
  const cx = 250,
    cy = 262;
  const startR = 68,
    rowSpacing = 9;
  const dotR = 3.2,
    dotGap = 1.4;
  const dotSpacing = dotR * 2 + dotGap;

  // Step 1: generate positions with angle for each concentric row (inside → out)
  const raw: { theta: number; x: number; y: number }[] = [];
  let r = startR,
    remaining = total;
  while (remaining > 0) {
    const cap = Math.floor((Math.PI * r) / dotSpacing);
    const n = Math.min(cap, remaining);
    for (let i = 0; i < n; i++) {
      const theta = n > 1 ? Math.PI * (1 - i / (n - 1)) : Math.PI / 2;
      raw.push({
        theta,
        x: cx + r * Math.cos(theta),
        y: cy - r * Math.sin(theta),
      });
    }
    remaining -= n;
    r += rowSpacing;
  }

  // Step 2: sort left→right (descending θ: π = left, 0 = right)
  raw.sort((a, b) => b.theta - a.theta);

  // Step 3: assign colors sequentially → each party occupies a contiguous angular wedge
  return raw.map((pos, i) => ({ x: pos.x, y: pos.y, color: colors[i] }));
}

export function BundestagSeats() {
  const t = useTranslation();
  const { activePeriodId } = usePeriod();
  if (activePeriodId === null) return null;

  const parties = BUNDESTAG_SEATS[activePeriodId];
  if (!parties) return null;

  const total = getTotalSeats(activePeriodId); // used for the eyebrow label only
  const dots = buildDots(parties);

  return (
    <div className="px-[2px]">
      {/* Eyebrow */}
      <p className="text-[8px] font-bold tracking-[0.12em] uppercase text-white/30 text-center mb-[5px]">
        {t.ui.seat_distribution.replace("{total}", String(total))}
      </p>

      {/* Hemicycle SVG */}
      <svg
        viewBox="0 0 500 268"
        width="100%"
        aria-label={t.ui.seat_distribution_aria}
      >
        {dots.map((d, i) => (
          <circle
            key={i}
            cx={d.x.toFixed(2)}
            cy={d.y.toFixed(2)}
            r={3.2}
            fill={d.color}
          />
        ))}
        {/* Baseline */}
        <line
          x1="48"
          y1="262"
          x2="452"
          y2="262"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="1"
        />
      </svg>

      {/* Legend — dot + party short name + seat count (excluding fraktionslos) */}
      <div className="flex flex-wrap gap-x-[8px] gap-y-[4px] justify-center mt-[6px]">
        {parties
          .filter((p) => p.party !== "fraktionslos")
          .map((p) => (
            <div key={p.party} className="flex items-center gap-[4px]">
              <div
                className="w-[6px] h-[6px] rounded-full shrink-0"
                style={{ background: dotColor(p.party) }}
              />
              <span className="text-[8px] font-medium text-white/65 leading-none">
                {partyLabel(p.party)}
              </span>
              <span className="text-[8px] font-bold text-white/35 leading-none">
                {p.seats}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}
