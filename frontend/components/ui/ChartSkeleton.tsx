export function ChartSkeleton({ height = 400 }: { height?: number }) {
  return (
    <div
      className="w-full rounded-xl skeleton-shimmer"
      style={{ height }}
      role="status"
      aria-label="Wird geladen…"
    />
  );
}
