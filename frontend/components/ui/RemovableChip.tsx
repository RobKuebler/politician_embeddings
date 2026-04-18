import { FALLBACK_COLOR } from "@/lib/constants";

interface RemovableChipProps {
  label: string;
  onRemove: () => void;
  /** Accessible label for the remove button (e.g. "Entferne Anna Schmidt"). */
  removeLabel: string;
  /** Full text shown as title on hover (for truncated labels). */
  title?: string;
  /** Optional color dot before the label. */
  dotColor?: string;
  /** Extra content after the label (e.g. party badge). */
  suffix?: React.ReactNode;
  testId?: string;
}

/** Chip with × button for removing selected items. Used by PollFilter and PoliticianSearch. */
export function RemovableChip({
  label,
  onRemove,
  removeLabel,
  title,
  dotColor,
  suffix,
  testId,
}: RemovableChipProps) {
  return (
    <span
      data-testid={testId}
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        minHeight: 36,
        gap: 4,
        padding: "6px 8px",
        borderRadius: 12,
        background: "#f0f0f0",
        fontSize: 12,
        color: "#333",
      }}
    >
      {dotColor && (
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: dotColor,
            flexShrink: 0,
          }}
        />
      )}
      {label}
      {suffix}
      <button
        aria-label={removeLabel}
        onClick={onRemove}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "4px 8px",
          fontSize: 13,
          color: FALLBACK_COLOR,
          lineHeight: "1",
          display: "flex",
          alignItems: "center",
        }}
      >
        ×
      </button>
    </span>
  );
}
