'use client';

/**
 * The five pillars arranged around a real cylinder in 3D: each face is rotated
 * to its own angle and pushed out along Z, so the ring has genuine depth —
 * faces at the back are further away, not just smaller.
 *
 * It rotates on its own, yields to a drag, and keeps whatever velocity the
 * drag left it with. Keyboard users get explicit prev/next controls and the
 * whole list stays readable as a column under reduced motion.
 */
import { useEffect, useRef, useState } from 'react';
import type { SiteContent } from '@/lib/site/content';
import { damp } from '@/lib/site/motion';
import { usePrefersReducedMotion } from '@/components/site/use-site-motion';

type Pillar = SiteContent['pillars'][number];

const RADIUS = 460; // px — how far each face sits from the axis
const AUTO_SPEED = 5.5; // degrees per second

export function PillarCarousel({ pillars }: { pillars: Pillar[] }) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const ringRef = useRef<HTMLDivElement | null>(null);
  const reduced = usePrefersReducedMotion();
  const [active, setActive] = useState(0);
  const step = 360 / pillars.length;
  const targetRef = useRef(0);

  useEffect(() => {
    const ring = ringRef.current;
    const stage = stageRef.current;
    if (!ring || !stage) return;

    const state = { angle: 0, velocity: 0, dragging: false, lastX: 0, auto: !reduced };
    let raf = 0;
    let last = 0;
    let pointerId: number | null = null;

    const onDown = (e: PointerEvent) => {
      pointerId = e.pointerId;
      state.dragging = true;
      state.lastX = e.clientX;
      state.velocity = 0;
      stage.setPointerCapture(e.pointerId);
      stage.classList.add('dragging');
    };
    const onMove = (e: PointerEvent) => {
      if (!state.dragging) return;
      const dx = e.clientX - state.lastX;
      state.lastX = e.clientX;
      state.angle += dx * 0.28;
      state.velocity = dx * 0.28;
      targetRef.current = state.angle;
    };
    const onUp = () => {
      if (!state.dragging) return;
      state.dragging = false;
      if (pointerId !== null && stage.hasPointerCapture(pointerId)) stage.releasePointerCapture(pointerId);
      pointerId = null;
      stage.classList.remove('dragging');
      // Settle onto the nearest face rather than stopping mid-gap.
      const snapped = Math.round((state.angle + state.velocity * 6) / step) * step;
      targetRef.current = snapped;
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;

      if (!state.dragging) {
        if (state.auto) targetRef.current -= AUTO_SPEED * dt;
        state.angle = damp(state.angle, targetRef.current, 5.5, dt);
      }
      ring.style.transform = `translateZ(${-RADIUS}px) rotateY(${state.angle.toFixed(3)}deg)`;

      // Which face is currently pointing at the viewer.
      const index = ((Math.round(-state.angle / step) % pillars.length) + pillars.length) % pillars.length;
      setActive((prev) => (prev === index ? prev : index));
    };

    if (reduced) {
      ring.style.transform = `translateZ(${-RADIUS}px) rotateY(0deg)`;
    } else {
      stage.addEventListener('pointerdown', onDown);
      stage.addEventListener('pointermove', onMove);
      stage.addEventListener('pointerup', onUp);
      stage.addEventListener('pointercancel', onUp);
      raf = requestAnimationFrame(frame);
    }

    return () => {
      cancelAnimationFrame(raf);
      stage.removeEventListener('pointerdown', onDown);
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerup', onUp);
      stage.removeEventListener('pointercancel', onUp);
    };
  }, [pillars.length, reduced, step]);

  const nudge = (dir: number) => {
    targetRef.current -= dir * step;
    setActive((prev) => (prev + dir + pillars.length) % pillars.length);
  };

  return (
    <div className="carousel">
      <div className="carousel-stage" ref={stageRef}>
        <div className="carousel-ring" ref={ringRef}>
          {pillars.map((pillar, i) => (
            <article
              className="pillar-face"
              key={pillar.code}
              data-active={i === active ? 'true' : 'false'}
              style={{ transform: `rotateY(${i * step}deg) translateZ(${RADIUS}px)` }}
            >
              <header className="pillar-head">
                <span className="pillar-code">{pillar.code}</span>
                <h3 className="pillar-name">{pillar.name}</h3>
              </header>
              <p className="pillar-brief">{pillar.brief}</p>
              <ul className="pillar-agents">
                {pillar.agents.map((agent) => (
                  <li key={agent}>{agent}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>

      <div className="carousel-controls">
        <button type="button" className="carousel-btn" onClick={() => nudge(-1)} aria-label="Previous pillar">
          ←
        </button>
        <ol className="carousel-dots">
          {pillars.map((pillar, i) => (
            <li key={pillar.code}>
              <button
                type="button"
                data-active={i === active ? 'true' : 'false'}
                onClick={() => nudge(i - active)}
                aria-label={pillar.name}
                aria-current={i === active ? 'true' : undefined}
              >
                <span>{pillar.name}</span>
              </button>
            </li>
          ))}
        </ol>
        <button type="button" className="carousel-btn" onClick={() => nudge(1)} aria-label="Next pillar">
          →
        </button>
      </div>
    </div>
  );
}
