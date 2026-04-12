import {
  CHART_FONT_FAMILY,
  PARTY_ORDER,
  getPartyColor,
  getPartyShortLabel,
} from "@/lib/constants";
import { KommentareData } from "@/lib/data";
import { GroupedPartyBars } from "@/components/charts/GroupedPartyBars";

const SMALL_TYPES = ["Lachen", "Heiterkeit", "Widerspruch"] as const;
type SmallType = (typeof SMALL_TYPES)[number];

// Design tokens used in SummarySmall
const TRACK_COLOR = "#eeedf8";
const VALUE_COLOR = "#7872a8";
const LABEL_COLOR = "#171613";

/**
 * Compact grid showing the rarer reaction types (Lachen, Heiterkeit, Widerspruch)
 * with each column independently scaled — values are too small to share an axis
 * with Beifall/Zwischenruf.
 */
export function SummarySmall({ data }: { data: KommentareData }) {
  const sorted = [...data.summary].sort(
    (a, b) => PARTY_ORDER.indexOf(a.party) - PARTY_ORDER.indexOf(b.party),
  );

  const maxByType = Object.fromEntries(
    SMALL_TYPES.map((t) => [t, Math.max(...sorted.map((r) => r[t]))]),
  ) as Record<SmallType, number>;

  return (
    <div>
      <div style={{ borderTop: "1px solid #F0EDE8", margin: "14px 0 12px" }} />
      <p
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: VALUE_COLOR,
          letterSpacing: "0.10em",
          textTransform: "uppercase",
          marginBottom: 10,
          fontFamily: CHART_FONT_FAMILY,
        }}
      >
        Seltenere Reaktionen
      </p>

      {/* Column headers */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "88px 1fr 1fr 1fr",
          gap: "0 10px",
          marginBottom: 6,
        }}
      >
        <div />
        {SMALL_TYPES.map((t) => (
          <span
            key={t}
            style={{
              fontSize: 10,
              color: VALUE_COLOR,
              fontWeight: 700,
              fontFamily: CHART_FONT_FAMILY,
              textTransform: "uppercase",
              letterSpacing: "0.07em",
            }}
          >
            {t}
          </span>
        ))}
      </div>

      {/* Rows per party */}
      {sorted.map((row) => {
        const color = getPartyColor(row.party);
        return (
          <div
            key={row.party}
            style={{
              display: "grid",
              gridTemplateColumns: "88px 1fr 1fr 1fr",
              gap: "0 10px",
              marginBottom: 6,
              alignItems: "center",
            }}
          >
            {/* Party label */}
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: LABEL_COLOR,
                fontFamily: CHART_FONT_FAMILY,
              }}
            >
              {getPartyShortLabel(row.party)}
            </span>

            {/* Mini bar + value per type */}
            {SMALL_TYPES.map((t) => {
              const val = row[t];
              const pct = (val / maxByType[t]) * 100;
              return (
                <div
                  key={t}
                  style={{ display: "flex", alignItems: "center", gap: 5 }}
                >
                  <div
                    style={{
                      flex: 1,
                      background: TRACK_COLOR,
                      borderRadius: 2,
                      height: 6,
                    }}
                  >
                    <div
                      style={{
                        width: `${pct}%`,
                        height: "100%",
                        background: color,
                        borderRadius: 2,
                      }}
                    />
                  </div>
                  <span
                    style={
                      {
                        fontSize: 11,
                        color: VALUE_COLOR,
                        width: 26,
                        textAlign: "right",
                        fontFamily: CHART_FONT_FAMILY,
                        fontVariantNumeric: "tabular-nums",
                      } as React.CSSProperties
                    }
                  >
                    {val}
                  </span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Horizontal bar chart for Zwischenrufe and Beifall per party.
 * Reaction type is the section header; one bar per party below.
 */
export function SummaryBars({ data }: { data: KommentareData }) {
  const sorted = [...data.summary].sort(
    (a, b) => PARTY_ORDER.indexOf(a.party) - PARTY_ORDER.indexOf(b.party),
  );
  const parties = sorted.map((r) => r.party);

  const sections = [
    {
      label: "Zwischenrufe",
      partyValues: Object.fromEntries(
        sorted.map((r) => [r.party, r.Zwischenruf]),
      ),
      formatValue: (v: number) => `${(v / 1000).toFixed(0)}k`,
      valueWidth: 36,
    },
    {
      label: "Beifall",
      partyValues: Object.fromEntries(sorted.map((r) => [r.party, r.Beifall])),
      formatValue: (v: number) => `${(v / 1000).toFixed(0)}k`,
      valueWidth: 36,
    },
  ];

  return (
    <GroupedPartyBars sections={sections} parties={parties} barHeight={8} />
  );
}
