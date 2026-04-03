import { SpeechStatsFile } from "@/lib/data";
import { PARTY_COLORS, FALLBACK_COLOR, sortParties } from "@/lib/constants";
import { stripSoftHyphen } from "@/lib/data";

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
  // Aggregate total words per party
  const totals: Record<string, number> = {};
  for (const s of speechStats) {
    const party = stripSoftHyphen(s.fraktion);
    if (party === "fraktionslos" || party === "Unbekannt") continue;
    totals[party] = (totals[party] ?? 0) + s.wortanzahl_gesamt;
  }

  const sorted = sortParties(Object.keys(totals)).sort(
    (a, b) => totals[b] - totals[a],
  );
  const max = Math.max(...sorted.map((p) => totals[p]), 1);

  return (
    <section
      className="bg-white rounded-xl border border-[#E3E0DA] p-5 md:p-6"
      style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
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
      <div className="flex flex-col gap-2">
        {sorted.map((party) => {
          const count = totals[party];
          const pct = (count / max) * 100;
          const color = PARTY_COLORS[party] ?? FALLBACK_COLOR;
          return (
            <div key={party} className="flex items-center gap-3">
              <span
                className="text-[13px] w-20 shrink-0 truncate"
                style={{ color: "#171613" }}
              >
                {party}
              </span>
              <div
                className="flex-1 rounded-full"
                style={{ height: 8, background: "#F0EEE9" }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${pct}%`,
                    background: color,
                    minWidth: pct > 0 ? 3 : 0,
                  }}
                />
              </div>
              <span
                className="text-[11px] tabular-nums w-10 text-right shrink-0"
                style={{ color: "#9A9790" }}
              >
                {formatWords(count)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
