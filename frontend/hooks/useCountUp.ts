import { useEffect, useRef, useState } from "react";

/** Animates a number from 0 to `target` over ~1.2 s using easeOutExpo. */
export function useCountUp(target: number, active: boolean) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active || target === 0) return;
    setDisplay(0);
    let cancelled = false;
    const duration = 1200;
    const start = performance.now();
    const tick = (now: number) => {
      if (cancelled) return;
      const t = Math.min((now - start) / duration, 1);
      const ease = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      setDisplay(Math.round(ease * target));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, active]);

  return display;
}
