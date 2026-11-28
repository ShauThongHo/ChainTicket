import { useEffect, useRef, useState } from "react";

/** Smoothly counts up spendable balance on increases over 450ms using cubic ease-out. */
export function useAnimatedCents(address: string | undefined, spendableCents: number | undefined) {
  const [displayCents, setDisplayCents] = useState<number>(spendableCents ?? 0);
  const prevCentsRef = useRef<number | null>(spendableCents ?? null);

  useEffect(() => {
    const next = spendableCents ?? 0;
    const prev = prevCentsRef.current;
    prevCentsRef.current = address ? next : null;
    if (!address || prev === null || next <= prev) {
      setDisplayCents(next);
      return;
    }
    let start: number | null = null;
    let rafId = 0;
    const duration = 450;
    function step(ts: number) {
      if (start === null) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setDisplayCents(Math.round(prev! + (next - prev!) * ease));
      if (p < 1) {
        rafId = requestAnimationFrame(step);
      }
    }
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [address, spendableCents]);

  return displayCents;
}
