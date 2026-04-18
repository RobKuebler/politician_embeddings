/** Shared pill-style toggle/segmented control used throughout the dashboard. */
export function ToggleGroup<T extends string>({
  options,
  value,
  onChange,
  label = "Filter options",
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  /** Accessible label describing what the toggle group controls. */
  label?: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            className="px-4 min-h-[44px] flex items-center justify-center rounded-full text-[12px] transition-colors cursor-pointer"
            style={{
              background: active ? "var(--color-navy)" : "#fff",
              border: active
                ? "1px solid var(--color-navy)"
                : "1px solid var(--color-lavender)",
              color: active ? "#fff" : "var(--color-muted)",
              fontWeight: active ? 600 : 400,
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
