/**
 * Scroll-lit prose: each word carries its index, and the CSS derives its own
 * opacity from the section's scroll progress. The whole effect runs on the
 * compositor from one custom property — no per-word observers, no JS per frame.
 * With JS off (or progress at 0) every word still renders at reading contrast.
 */
export function WordFlow({ text, className = '' }: { text: string; className?: string }) {
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <p className={`wordflow ${className}`.trim()} style={{ ['--n' as string]: words.length }}>
      {words.map((word, i) => (
        <span className="wordflow-word" key={`${word}-${i}`} style={{ ['--i' as string]: i }}>
          {word}{' '}
        </span>
      ))}
    </p>
  );
}
