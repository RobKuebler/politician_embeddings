import { useRef, useState, useEffect } from 'react'

/** Attaches a ResizeObserver to a container div and returns its current pixel width. */
export function useContainerWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    if (!ref.current) return
    setWidth(ref.current.clientWidth)
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])

  return { ref, width }
}
