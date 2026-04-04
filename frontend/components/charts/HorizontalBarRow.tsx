import type { CSSProperties } from "react";

/** Single horizontal bar row: [rank?] [label] [====track====] [value] */
export interface HorizontalBarRowProps {
  label: string;
  /** Width in px of the label column. Caller decides based on data (80 for parties, 120 for names, 90 for sub-labels). */
  labelWidth: number;
  value: number;
  max: number;
  color: string;
  displayValue: string;
  barHeight?: number;
  /** Width in px of the value column on the right. */
  valueWidth?: number;
  /** Optional rank number shown to the left of the label. */
  rank?: number;
  /** Extra styles applied to the root div — use `{ flex: 1 }` when inside a flex-row wrapper. */
  style?: CSSProperties;
}

export function HorizontalBarRow({
  label,
  labelWidth,
  value,
  max,
  color,
  displayValue,
  barHeight = 8,
  valueWidth = 40,
  rank,
  style,
}: HorizontalBarRowProps) {
  const pct = max > 0 ? (value / max) * 100 : 0;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, ...style }}>
      {rank !== undefined && (
        <span
          style={{
            fontSize: 11,
            width: 16,
            textAlign: "right",
            flexShrink: 0,
            color: "#9A9790",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {rank}
        </span>
      )}
      <span
        style={{
          width: labelWidth,
          flexShrink: 0,
          fontSize: 13,
          color: "#171613",
          lineHeight: 1.3,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
      <div
        style={{
          flex: 1,
          borderRadius: 9999,
          background: "#F0EEE9",
          height: barHeight,
        }}
      >
        <div
          data-testid="bar-fill"
          style={{
            width: `${pct}%`,
            height: "100%",
            borderRadius: 9999,
            background: color,
            minWidth: pct > 0 ? 2 : 0,
          }}
        />
      </div>
      <span
        style={{
          fontSize: 11,
          width: valueWidth,
          textAlign: "right",
          flexShrink: 0,
          color: "#9A9790",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {displayValue}
      </span>
    </div>
  );
}
