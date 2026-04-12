import { useRef, useState, useEffect, type CSSProperties } from "react";

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
  /** Opacity of the bar fill — use to visually de-emphasise a secondary metric (e.g. Beifall vs Zwischenrufe). */
  fillOpacity?: number;
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
  fillOpacity,
  style,
}: HorizontalBarRowProps) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  const labelRef = useRef<HTMLSpanElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  // Measure truncation after render and on resize
  useEffect(() => {
    function measure() {
      if (labelRef.current) {
        setIsTruncated(
          labelRef.current.scrollWidth > labelRef.current.offsetWidth,
        );
      }
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [label, labelWidth]);

  // Clear any pending auto-hide timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    };
  }, []);

  function handleMouseEnter() {
    if (!isTruncated) return;
    setShowTooltip(true);
  }

  function handleMouseLeave() {
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    setShowTooltip(false);
  }

  function handleClick() {
    if (!isTruncated) return;
    setShowTooltip(true);
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setShowTooltip(false), 2000);
  }

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 12,
        ...style,
      }}
    >
      {rank !== undefined && (
        <span
          style={{
            fontSize: 11,
            width: 16,
            textAlign: "right",
            flexShrink: 0,
            color: "#7872a8",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {rank}
        </span>
      )}
      <span
        ref={labelRef}
        data-testid="bar-label"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        style={{
          width: labelWidth,
          flexShrink: 0,
          fontSize: 13,
          color: "#171613",
          lineHeight: 1.3,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          cursor: isTruncated ? "default" : undefined,
        }}
      >
        {label}
      </span>
      {showTooltip && (
        <div
          role="tooltip"
          style={{
            position: "absolute",
            bottom: "calc(100% + 4px)",
            left: 0,
            maxWidth: 220,
            whiteSpace: "normal",
            background: "rgba(0,0,0,0.78)",
            color: "#fff",
            borderRadius: 6,
            padding: "4px 8px",
            fontSize: 12,
            zIndex: 10,
            pointerEvents: "none",
          }}
        >
          {label}
        </div>
      )}
      <div
        style={{
          flex: 1,
          borderRadius: 9999,
          background: "#eeedf8",
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
            opacity: fillOpacity,
          }}
        />
      </div>
      <span
        style={{
          fontSize: 11,
          width: valueWidth,
          textAlign: "right",
          flexShrink: 0,
          color: "#7872a8",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {displayValue}
      </span>
    </div>
  );
}
