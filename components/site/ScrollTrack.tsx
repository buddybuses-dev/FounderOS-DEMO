'use client';

/**
 * Publishes its own 0..1 viewport progress as a CSS custom property, so any
 * descendant can be scroll-linked in pure CSS (a drawn line, a widening rule,
 * a fading column) with no per-frame React work.
 */
import { useScrollProgressVar } from '@/components/site/use-site-motion';

export function ScrollTrack({
  children,
  className = '',
  id,
  track = false,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
  /** Marks this element as the scroll driver the WebGL field reads. */
  track?: boolean;
}) {
  const ref = useScrollProgressVar<HTMLElement>();
  return (
    <section ref={ref as never} id={id} className={className} {...(track ? { 'data-scene-track': '' } : {})}>
      {children}
    </section>
  );
}
