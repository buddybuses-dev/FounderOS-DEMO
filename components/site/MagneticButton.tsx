'use client';

/**
 * A call to action that leans toward the cursor before it is clicked. The pull
 * is damped and capped, so it reads as weight rather than as a toy — and it is
 * a real anchor underneath, with a real focus ring.
 */
import { useEffect, useRef } from 'react';
import { damp } from '@/lib/site/motion';
import { usePrefersReducedMotion } from '@/components/site/use-site-motion';

const PULL = 14; // px of travel at the edge of the field
const FIELD = 1.6; // multiples of the button's own size

export function MagneticButton({
  href,
  children,
  variant = 'solid',
  external = false,
}: {
  href: string;
  children: React.ReactNode;
  variant?: 'solid' | 'ghost';
  external?: boolean;
}) {
  const ref = useRef<HTMLAnchorElement | null>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;
    const state = { x: 0, y: 0, tx: 0, ty: 0 };
    let raf = 0;
    let last = 0;

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = (e.clientX - cx) / (r.width * FIELD);
      const dy = (e.clientY - cy) / (r.height * FIELD);
      const inField = Math.abs(dx) < 1 && Math.abs(dy) < 1;
      state.tx = inField ? dx * PULL : 0;
      state.ty = inField ? dy * PULL : 0;
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      state.x = damp(state.x, state.tx, 9, dt);
      state.y = damp(state.y, state.ty, 9, dt);
      el.style.setProperty('--mag-x', `${state.x.toFixed(2)}px`);
      el.style.setProperty('--mag-y', `${state.y.toFixed(2)}px`);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
    };
  }, [reduced]);

  return (
    <a
      ref={ref}
      href={href}
      className="magnetic"
      data-variant={variant}
      {...(external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
    >
      <span className="magnetic-label">{children}</span>
      <span className="magnetic-fill" aria-hidden="true" />
    </a>
  );
}
