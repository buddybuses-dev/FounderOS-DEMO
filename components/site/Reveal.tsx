'use client';

/**
 * One-way entrance: the wrapper flips `data-revealed` the first time it crosses
 * into view and the CSS does the rest. Re-animating on scroll-back is the
 * difference between a crafted page and a busy one.
 */
import { useRevealed } from '@/components/site/use-site-motion';

export function Reveal({
  children,
  className = '',
  delay = 0,
  as: Tag = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  /** Seconds of stagger, for cascading a list. */
  delay?: number;
  as?: 'div' | 'li' | 'section' | 'span';
}) {
  const { ref, revealed } = useRevealed<HTMLDivElement>();
  return (
    <Tag
      ref={ref as never}
      className={`reveal ${className}`.trim()}
      data-revealed={revealed ? 'true' : 'false'}
      style={delay ? ({ transitionDelay: `${delay}s` } as React.CSSProperties) : undefined}
    >
      {children}
    </Tag>
  );
}
