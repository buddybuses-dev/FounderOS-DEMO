'use client';

/**
 * A soft light that follows the cursor across the page, lagging slightly
 * behind it. Fine pointers only — on touch there is no cursor to light, and
 * running the loop would just cost battery.
 */
import { useEffect, useRef } from 'react';
import { damp } from '@/lib/site/motion';
import { usePrefersReducedMotion } from '@/components/site/use-site-motion';

export function CursorLight() {
  const ref = useRef<HTMLDivElement | null>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;
    if (!window.matchMedia('(pointer: fine)').matches) return;

    const state = { x: window.innerWidth / 2, y: window.innerHeight / 2, tx: 0, ty: 0, on: 0, onTarget: 0 };
    state.tx = state.x;
    state.ty = state.y;
    let raf = 0;
    let last = 0;

    const onMove = (e: PointerEvent) => {
      state.tx = e.clientX;
      state.ty = e.clientY;
      state.onTarget = 1;
    };
    const onLeave = () => {
      state.onTarget = 0;
    };
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      state.x = damp(state.x, state.tx, 7, dt);
      state.y = damp(state.y, state.ty, 7, dt);
      state.on = damp(state.on, state.onTarget, 4, dt);
      el.style.setProperty('--cursor-x', `${state.x.toFixed(1)}px`);
      el.style.setProperty('--cursor-y', `${state.y.toFixed(1)}px`);
      el.style.setProperty('--cursor-on', state.on.toFixed(3));
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
    };
  }, [reduced]);

  return <div ref={ref} className="cursor-light" aria-hidden="true" />;
}
