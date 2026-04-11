"use client";
import { COLOR_SECONDARY, getPartyShortLabel } from "@/lib/constants";

interface SexRecord {
  party_label: string;
  geschlecht: string;
  count: number;
  pct: number;
}

const MALE_COLOR = "#4E9A8F"; // teal — avoids stereotypical blue/pink pair
const FEMALE_COLOR = "#E8973D"; // amber

export function GenderChart({
  data,
  parties,
}: {
  data: SexRecord[];
  parties: string[];
}) {
  return (
    <div className="flex flex-col gap-3">
      {parties.map((party) => {
        const male = data.find(
          (r) => r.party_label === party && r.geschlecht === "Männlich",
        );
        const female = data.find(
          (r) => r.party_label === party && r.geschlecht === "Weiblich",
        );
        const malePct = Math.round(male?.pct ?? 0);
        const femalePct = Math.round(female?.pct ?? 0);

        return (
          <div key={party} className="flex items-center gap-3">
            {/* Party label */}
            <span
              className="text-[12px] font-medium shrink-0"
              style={{ width: 72, color: COLOR_SECONDARY }}
            >
              {getPartyShortLabel(party)}
            </span>

            {/* Split bar */}
            <div className="flex-1 flex rounded-full overflow-hidden h-[10px]">
              <div style={{ width: `${malePct}%`, background: MALE_COLOR }} />
              <div style={{ flex: 1, background: FEMALE_COLOR }} />
            </div>

            {/* Percentage labels */}
            <span
              className="text-[11px] shrink-0"
              style={{ width: 80, color: COLOR_SECONDARY }}
            >
              {malePct}% / {femalePct}%
            </span>
          </div>
        );
      })}

      {/* Legend */}
      <div className="flex gap-4 mt-1 px-1">
        {[
          { label: "Männlich", color: MALE_COLOR },
          { label: "Weiblich", color: FEMALE_COLOR },
        ].map(({ label, color }) => (
          <span
            key={label}
            className="flex items-center gap-1 text-[11px]"
            style={{ color: COLOR_SECONDARY }}
          >
            <span
              style={{
                display: "inline-block",
                width: 10,
                height: 10,
                borderRadius: 2,
                background: color,
                flexShrink: 0,
              }}
            />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
