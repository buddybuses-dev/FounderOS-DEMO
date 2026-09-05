'use client';

/**
 * Client-side motion primitives shared by the site's animated components.
 * Kept out of the .tsx files so every component honors the same
 * `prefers-reduced-motion` contract from one place.
 */
import { useEffect, useRef, useState } from 'react';
import { clamp01 } from '@/lib/site/motion';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** Live — a visitor can flip the OS setting without reloading the page. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(REDUCED_MOTION_QUERY);
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return reduced;
}

/** Non-reactive read for use inside a render loop (no re-render on change). */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/**
 * Fires once when the element first crosses into view. Reveals are one-way:
 * re-animating on scroll-back is the difference between "crafted" and "busy".
 */
export function useRevealed<T extends Element>(rootMargin = '0px 0px -12% 0px') {
  const ref = useRef<T | null>(null);
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setRevealed(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setRevealed(true);
          io.disconnect();
        }
      },
      { rootMargin, threshold: 0.08 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);
  return { ref, revealed };
}

/**
 * 0..1 progress of an element through the viewport, written to a CSS custom
 * property instead of React state — scroll-linked values must never cause a
 * render. Returns the ref to attach.
 */
export function useScrollProgressVar<T extends HTMLElement>(property = '--p') {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const span = rect.height + vh;
      const p = clamp01(span === 0 ? 0 : (vh - rect.top) / span);
      el.style.setProperty(property, p.toFixed(4));
    };
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [property]);
  return ref;
}
