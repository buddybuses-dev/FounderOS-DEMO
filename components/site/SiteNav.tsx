'use client';

/**
 * The site header: condenses once the hero is behind you, tracks which section
 * you are reading, and carries a hairline scroll-progress rule along its
 * bottom edge. The progress rule is a CSS variable written from a rAF — never
 * React state, so scrolling costs no renders.
 */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { SITE, sectionIds } from '@/lib/site/content';
import { clamp01 } from '@/lib/site/motion';
import { usePrefersReducedMotion } from '@/components/site/use-site-motion';

export function SiteNav() {
  const headerRef = useRef<HTMLElement | null>(null);
  const [condensed, setCondensed] = useState(false);
  const [active, setActive] = useState<string>('hero');
  const reduced = usePrefersReducedMotion();

  // Anchor navigation glides rather than jumps — unless the visitor has asked
  // the OS for less motion, in which case it jumps and that is correct.
  const jumpTo = (event: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    const target = document.getElementById(href.slice(1));
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    history.replaceState(null, '', href);
  };

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    let raf = 0;

    const measure = () => {
      raf = 0;
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      const p = clamp01(max <= 0 ? 0 : window.scrollY / max);
      header.style.setProperty('--scroll-progress', p.toFixed(4));
      setCondensed(window.scrollY > window.innerHeight * 0.6);
    };
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const sections = sectionIds()
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (!sections.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: [0, 0.25, 0.5, 1] },
    );
    for (const el of sections) io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <header ref={headerRef} className="site-header" data-condensed={condensed ? 'true' : 'false'}>
      <div className="site-header-inner">
        <a className="site-wordmark" href="#hero" onClick={(e) => jumpTo(e, '#hero')}>
          <span className="site-glyph" aria-hidden="true" />
          {SITE.brand.wordmark}
        </a>

        <nav className="site-nav" aria-label="Sections">
          {SITE.nav.map((link) => (
            <a
              key={link.href}
              href={link.href}
              data-active={active === link.href.slice(1) ? 'true' : 'false'}
              onClick={(e) => jumpTo(e, link.href)}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <Link className="site-header-cta" href={SITE.hero.primary.href}>
          {SITE.hero.primary.label}
          <span aria-hidden="true">→</span>
        </Link>
      </div>
      <span className="site-header-rule" aria-hidden="true" />
    </header>
  );
}
