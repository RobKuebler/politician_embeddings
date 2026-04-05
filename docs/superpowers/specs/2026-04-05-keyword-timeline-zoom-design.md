# KeywordTimeline — X-Axis Zoom Design

**Date:** 2026-04-05  
**Status:** Approved

## Summary

Add x-axis-only zoom/pan to the `KeywordTimeline` chart component. The y-axis always shows the full data range. Works via scroll + drag on desktop and pinch + touch-drag on mobile. A "Reset" button appears when zoomed in.

## Scope

Single file change: `frontend/components/charts/KeywordTimeline.tsx`.  
No new files, no new components. There is exactly one line chart in the codebase (used in `motions/page.tsx` and `trends/page.tsx`), so the change is automatically applied everywhere.

## Interaction

| Input | Effect |
|---|---|
| Scroll wheel | Zoom in/out, centered on cursor |
| Click + drag | Pan left/right |
| Pinch (touch) | Zoom in/out |
| Touch drag | Pan left/right |
| Reset button click | Animate back to full view (300ms) |

## Constraints

- X-axis only: zoom transform applied to `xScale` only; `yScale` is never touched.
- Pan is clamped to the data extent — cannot pan past the first or last data point.
- Zoom scale range: 1× (full view) to 20× (roughly 1–2 months visible at most).
- `touch-action: none` on the overlay rect so pinch zoom does not conflict with page scroll.

## Implementation Details

### D3 Zoom Setup

```
const zoom = d3.zoom<SVGRectElement, unknown>()
  .scaleExtent([1, 20])
  .translateExtent([[0, 0], [innerW, innerH]])  // clamp pan to data bounds
  .extent([[0, 0], [innerW, innerH]])
  .filter((event) => {
    // allow all pointer/touch events, block right-click
    return !event.button;
  })
  .on("zoom", onZoom);
```

The y-axis is kept static by only calling `rescaleX` in the handler — never `rescaleY`. The `translateExtent` prevents panning past the data left/right edges.

### Zoom Handler

On each zoom event:
1. Derive the rescaled x-scale: `xScaleZoomed = event.transform.rescaleX(xScale)`.
2. Redraw the x-axis using the rescaled scale.
3. Redraw all lines using the rescaled scale.
4. Move the crosshair to its current position using the rescaled scale.
5. Call `setIsZoomed(event.transform.k !== 1 || event.transform.x !== 0)` to show/hide the Reset button (object identity comparison with `d3.zoomIdentity` does not work after user interaction).

The y-axis and grid lines are **not** redrawn on zoom — they remain static.

### Reset Button

- React `useState<boolean> isZoomed` — toggled inside the zoom handler.
- Positioned absolutely in the top-right corner of the chart container (`position: absolute; top: 8px; right: 8px`).
- The overlay rect must be stored in a `useRef<SVGRectElement>(null)` so the Reset button can reference it.
- On click: `d3.select(overlayRef.current).transition().duration(300).call(zoom.transform, d3.zoomIdentity)`.
- Styled to match the existing chart aesthetic (small, neutral, no border-radius tokens needed — use `pill` shape).

### Touch Support

`d3.zoom()` natively handles `touchstart`, `touchmove`, `touchend` for pinch and drag.  
Apply `touch-action: none` to the SVG overlay rect via inline style or attribute to prevent the browser's native scroll from intercepting the gesture.

### Crosshair Compatibility

The existing crosshair bisect logic receives the zoomed xScale instead of the base xScale. No structural change — the bisect still works on the same `dates` array; the only difference is that `xScale.invert(mx)` now maps pixel positions to dates correctly within the zoomed window.

## Testing

- Scroll zoom: zooming in keeps the cursor date centered.
- Pan: cannot pan past the first or last data point.
- Reset: button is hidden at identity, appears on zoom, returns to full view on click.
- Mobile: pinch zoom and touch-drag work; page does not scroll during interaction.
- Tooltip: crosshair snaps to correct data point after zooming in.
- y-axis: unchanged at all zoom levels.
