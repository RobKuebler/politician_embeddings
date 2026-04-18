import { FILTER_ACCENT } from "@/lib/constants";

interface FilterChipProps {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}

/** Toggle chip for filter presets (e.g. "Alle", "Unterschiedlich"). */
export function FilterChip({
  label,
  count,
  active,
  onClick,
  disabled,
  title,
}: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={!disabled && !active ? onClick : undefined}
      disabled={disabled || active}
      title={title}
      aria-label={title}
      aria-pressed={active}
      style={{
        appearance: "none",
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "11px 14px",
        borderRadius: 6,
        background: active ? FILTER_ACCENT : "transparent",
        border: `1.5px solid ${active ? FILTER_ACCENT : "var(--color-chip-border)"}`,
        fontSize: 12,
        fontWeight: 500,
        color: active ? "#fff" : "var(--color-chip-text)",
        cursor: !disabled && !active ? "pointer" : "default",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {label}
      <span
        style={{
          color: active ? "#ffffff" : "var(--color-chip-count)",
          fontSize: 11,
          fontWeight: 400,
        }}
      >
        ({count})
      </span>
    </button>
  );
}
