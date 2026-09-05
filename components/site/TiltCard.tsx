'use client';

/**
 * A card that sits in real 3D: pointer position drives a perspective rotation,
 * a specular sheen tracks the light, and inner layers translate on their own Z
 * so the content has genuine parallax rather than a flat tilt.
 *
 * The transform is written straight to the node inside a rAF — scroll- and
 * pointer-linked values must never round-trip through React state.
 */
import { useEffect, useRef } from 'react';
import { damp } from '@/lib/site/motion';
import { pointerToNdc } from '@/lib/site/gl';
import { usePrefersReducedMotion } from '@/components/site/use-site-motion';

const MAX_TILT = 9; // degrees — past ~10 it reads as a gimmick

export function TiltCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;

    const state = { x: 0, y: 0, tx: 0, ty: 0, hover: 0, hoverTarget: 0 };
    let raf = 0;
    let last = 0;

    const onMove = (e: PointerEvent) => {
      const ndc = pointerToNdc(e.clientX, e.clientY, el.getBoundingClientRect());
      state.tx = Math.max(-1, Math.min(1, ndc.x));
      state.ty = Math.max(-1, Math.min(1, ndc.y));
    };
    const onEnter = () => {
      state.hoverTarget = 1;
    };
    const onLeave = () => {
      state.hoverTarget = 0;
      state.tx = 0;
      state.ty = 0;
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      state.x = damp(state.x, state.tx, 7, dt);
      state.y = damp(state.y, state.ty, 7, dt);
      state.hover = damp(state.hover, state.hoverTarget, 8, dt);
      el.style.setProperty('--tilt-x', `${(state.y * MAX_TILT).toFixed(3)}deg`);
      el.style.setProperty('--tilt-y', `${(state.x * MAX_TILT).toFixed(3)}deg`);
      el.style.setProperty('--sheen-x', `${(50 + state.x * 45).toFixed(2)}%`);
      el.style.setProperty('--sheen-y', `${(50 - state.y * 45).toFixed(2)}%`);
      el.style.setProperty('--hover', state.hover.toFixed(4));
    };

    el.addEventListener('pointerenter', onEnter);
    el.addEventListener('pointerleave', onLeave);
    el.addEventListener('pointermove', onMove);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('pointerenter', onEnter);
      el.removeEventListener('pointerleave', onLeave);
      el.removeEventListener('pointermove', onMove);
    };
  }, [reduced]);

  return (
    <div ref={ref} className={`tilt ${className}`.trim()}>
      <div className="tilt-inner">
        {children}
        <span className="tilt-sheen" aria-hidden="true" />
        <span className="tilt-edge" aria-hidden="true" />
      </div>
    </div>
  );
}
