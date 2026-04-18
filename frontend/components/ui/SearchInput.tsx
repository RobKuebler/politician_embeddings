import { FILTER_ACCENT, FILTER_BORDER, FILTER_BG_INPUT } from "@/lib/constants";

interface SearchInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onFocus?: () => void;
  placeholder: string;
  ariaLabel?: string;
}

/** Styled search input with magnifying glass icon. Used by PollFilter and PoliticianSearch. */
export function SearchInput({
  value,
  onChange,
  onKeyDown,
  onFocus,
  placeholder,
  ariaLabel,
}: SearchInputProps) {
  return (
    <div
      className="focus-within:ring-2 focus-within:ring-[#4C46D9] focus-within:ring-offset-1 rounded-lg"
      style={{ position: "relative", flex: 1 }}
    >
      {/* Search icon */}
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#888"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          position: "absolute",
          left: 10,
          top: "50%",
          transform: "translateY(-50%)",
          pointerEvents: "none",
        }}
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "7px 10px 7px 30px",
          borderRadius: 8,
          border: `1px solid ${FILTER_BORDER}`,
          fontSize: 13,
          outline: "none",
          background: FILTER_BG_INPUT,
          color: "#333",
          transition: "border-color 0.15s, box-shadow 0.15s",
        }}
        onFocus={(e) => {
          e.target.style.borderColor = FILTER_ACCENT;
          e.target.style.boxShadow = `0 0 0 3px ${FILTER_ACCENT}22`;
          onFocus?.();
        }}
        onBlur={(e) => {
          e.target.style.borderColor = FILTER_BORDER;
          e.target.style.boxShadow = "none";
        }}
      />
    </div>
  );
}
