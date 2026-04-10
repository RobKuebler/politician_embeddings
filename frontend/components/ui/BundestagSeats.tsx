"use client";
import { usePeriod } from "@/lib/period-context";
import { BUNDESTAG_SEATS, getTotalSeats, PartySeats } from "@/lib/seats";
import { PARTY_COLORS } from "@/lib/constants";

// CDU/CSU's brand color (#2a2a2a) is near-black and invisible on the dark
// navy sidebar. Use a lightened substitute for the hemicycle dots only.
const DOT_COLOR_OVERRIDES: Record<string, string> = {
  "CDU/CSU": "#c0c0c0",
};

function dotColor(party: string): string {
  return DOT_COLOR_OVERRIDES[party] ?? PARTY_COLORS[party] ?? "#888888";
}

interface Dot {
  x: number;
  y: number;
  color: string;
}

/** Compute all dot positions sorted into wedge-shaped party blocs. */
function buildDots(parties: PartySeats[], total: number): Dot[] {
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

  // Step 3: assign party colors sequentially → each party occupies a contiguous angular wedge
  const colors: string[] = [];
  for (const p of parties)
    for (let i = 0; i < p.seats; i++) colors.push(dotColor(p.party));

  return raw.map((pos, i) => ({ x: pos.x, y: pos.y, color: colors[i] }));
}

export function BundestagSeats() {
  const { activePeriodId } = usePeriod();
  if (activePeriodId === null) return null;

  const parties = BUNDESTAG_SEATS[activePeriodId];
  if (!parties) return null;

  const total = getTotalSeats(activePeriodId);
  const dots = buildDots(parties, total);

  return (
    <div className="px-[2px]">
      {/* Eyebrow */}
      <p className="text-[8px] font-bold tracking-[0.12em] uppercase text-white/30 text-center mb-[5px]">
        Sitzverteilung · {total}
      </p>

      {/* Hemicycle SVG */}
      <svg
        viewBox="0 0 500 268"
        width="100%"
        aria-label="Bundestag Sitzverteilung"
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

      {/* Mini legend — one dot + seat count per party (excluding fraktionslos) */}
      <div className="flex flex-wrap gap-x-[6px] gap-y-[3px] justify-center mt-[5px]">
        {parties
          .filter((p) => p.party !== "fraktionslos")
          .map((p) => (
            <div key={p.party} className="flex items-center gap-[3px]">
              <div
                className="w-[6px] h-[6px] rounded-full shrink-0"
                style={{ background: dotColor(p.party) }}
              />
              <span className="text-[8px] font-semibold text-white/50">
                {p.seats}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}
