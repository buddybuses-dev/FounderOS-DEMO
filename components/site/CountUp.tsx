'use client';

/**
 * A number that counts to its value the first time it is seen, then stops.
 * Eased rather than linear — a linear counter reads like a loading spinner.
 */
import { useEffect, useRef } from 'react';
import { easeOutExpo, clamp01 } from '@/lib/site/motion';
import { usePrefersReducedMotion, useRevealed } from '@/components/site/use-site-motion';

const DURATION_MS = 1400;

export function CountUp({
  value,
  prefix = '',
  suffix = '',
  className = '',
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const { ref, revealed } = useRevealed<HTMLSpanElement>();
  const outRef = useRef<HTMLSpanElement | null>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const node = outRef.current;
    if (!node) return;
    if (!revealed || reduced) {
      node.textContent = String(value);
      return;
    }
    let raf = 0;
    let start = 0;
    const frame = (now: number) => {
      if (!start) start = now;
      const p = clamp01((now - start) / DURATION_MS);
      node.textContent = String(Math.round(easeOutExpo(p) * value));
      if (p < 1) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [revealed, value, reduced]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {/* Server-rendered with the final value: no JS, no blank metric. */}
      <span ref={outRef}>{value}</span>
      {suffix}
    </span>
  );
}
