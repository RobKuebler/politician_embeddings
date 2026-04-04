import {
  PARTY_COLORS,
  FALLBACK_COLOR,
  CHART_FONT_FAMILY,
  PARTY_ORDER,
} from "@/lib/constants";
import { KommentareData } from "@/lib/data";
import { HorizontalBarRow } from "@/components/charts/HorizontalBarRow";

const SMALL_TYPES = ["Lachen", "Heiterkeit", "Widerspruch"] as const;
type SmallType = (typeof SMALL_TYPES)[number];

// Design tokens shared with HorizontalBarRow
const TRACK_COLOR = "#F0EEE9";
const VALUE_COLOR = "#9A9790";
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
        const color = PARTY_COLORS[row.party] ?? FALLBACK_COLOR;
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
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: color,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: LABEL_COLOR,
                  fontFamily: CHART_FONT_FAMILY,
                }}
              >
                {row.party}
              </span>
            </div>

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
                        opacity: 0.55,
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
 * Uses HorizontalBarRow for the sub-rows so styling is in sync with all other bar charts.
 */
export function SummaryBars({ data }: { data: KommentareData }) {
  const sorted = [...data.summary].sort(
    (a, b) => PARTY_ORDER.indexOf(a.party) - PARTY_ORDER.indexOf(b.party),
  );
  const maxZwischenruf = Math.max(...sorted.map((r) => r.Zwischenruf));
  const maxBeifall = Math.max(...sorted.map((r) => r.Beifall));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {sorted.map((row) => {
        const color = PARTY_COLORS[row.party] ?? FALLBACK_COLOR;
        return (
          <div key={row.party}>
            {/* Party name header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 4,
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: color,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: LABEL_COLOR,
                  fontFamily: CHART_FONT_FAMILY,
                }}
              >
                {row.party}
              </span>
            </div>

            {/* Zwischenrufe and Beifall as HorizontalBarRows */}
            <div
              style={{
                marginLeft: 16,
                display: "flex",
                flexDirection: "column",
                gap: 3,
              }}
            >
              <HorizontalBarRow
                label="Zwischenrufe"
                labelWidth={72}
                value={row.Zwischenruf}
                max={maxZwischenruf}
                color={color}
                displayValue={`${(row.Zwischenruf / 1000).toFixed(0)}k`}
                barHeight={8}
                valueWidth={36}
              />
              <HorizontalBarRow
                label="Beifall"
                labelWidth={72}
                value={row.Beifall}
                max={maxBeifall}
                color={color}
                displayValue={`${(row.Beifall / 1000).toFixed(0)}k`}
                barHeight={8}
                valueWidth={36}
                fillOpacity={0.45}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
