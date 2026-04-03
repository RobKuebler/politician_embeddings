/** Shared page header with colored left border, category label, title, and description. */
export function PageHeader({
  color,
  label,
  title,
  description,
}: {
  color: string;
  label: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-8 pl-4 border-l-4" style={{ borderColor: color }}>
      <p
        className="text-[11px] font-bold tracking-[0.15em] uppercase mb-1"
        style={{ color }}
      >
        {label}
      </p>
      <h1
        className="text-[28px] font-black tracking-tight leading-tight mb-1"
        style={{ color: "#1E1B5E" }}
      >
        {title}
      </h1>
      <p className="text-[14px]" style={{ color: "#9A9790" }}>
        {description}
      </p>
    </div>
  );
}
