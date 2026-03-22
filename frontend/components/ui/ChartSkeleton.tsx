export function ChartSkeleton({ height = 400 }: { height?: number }) {
  return (
    <div
      className="w-full rounded-xl bg-gray-100 animate-pulse"
      style={{ height }}
      role="status"
      aria-label="Wird geladen…"
    />
  )
}
