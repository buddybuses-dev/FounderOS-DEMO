/**
 * Type that arrives. Words are split server-side and rendered as real text
 * inside overflow masks — the animation is a CSS transform layered on top, so
 * the copy is present, selectable and indexable even if JS never runs.
 */
export function KineticText({
  text,
  className = '',
  delay = 0,
  step = 0.05,
}: {
  text: string;
  className?: string;
  /** Seconds before the first word lifts. */
  delay?: number;
  /** Seconds between consecutive words. */
  step?: number;
}) {
  const words = text.split(' ').filter(Boolean);
  return (
    <span className={`kinetic ${className}`.trim()}>
      {words.map((word, i) => (
        // The space sits between masks, never inside one: an overflow-hidden
        // inline-block collapses its own trailing whitespace.
        <span key={`${word}-${i}`}>
          <span className="kinetic-mask">
            <span className="kinetic-word" style={{ animationDelay: `${(delay + i * step).toFixed(3)}s` }}>
              {word}
            </span>
          </span>
          {i < words.length - 1 ? ' ' : null}
        </span>
      ))}
    </span>
  );
}
