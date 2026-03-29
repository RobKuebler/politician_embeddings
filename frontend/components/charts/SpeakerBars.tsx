import { SpeakerRecord } from "@/lib/data";

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
      {speakers.map((s, i) => {
        const pct = (s.wortanzahl_gesamt / max) * 100;
        return (
          <div
            key={`${s.redner_id}-${i}`}
            className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0"
          >
            {/* Rank */}
            <span
              className="text-[11px] tabular-nums w-5 text-right shrink-0"
              style={{ color: "#9A9790" }}
            >
              {i + 1}
            </span>
            {/* Name */}
            <span
              className="text-[13px] flex-1 truncate"
              style={{ color: "#171613" }}
            >
              {s.vorname} {s.nachname}
            </span>
            {/* Bar + count */}
            <div className="flex items-center gap-1.5 shrink-0">
              <div
                className="w-16 rounded-full"
                style={{ height: 6, background: "#F0EEE9" }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${pct}%`,
                    background: partyColor,
                    minWidth: pct > 0 ? 2 : 0,
                  }}
                />
              </div>
              <span
                className="text-[11px] tabular-nums w-8 text-right"
                style={{ color: "#9A9790" }}
              >
                {formatWords(s.wortanzahl_gesamt)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
