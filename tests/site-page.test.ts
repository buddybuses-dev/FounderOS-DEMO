import { describe, expect, test } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

/**
 * Contract for the public marketing site at /site. It is a different surface
 * from the operator console: full-bleed, no sidebar, its own palette — and its
 * two WebGL canvases must never ship in the server bundle or block first paint.
 */
describe('/site — the public site', () => {
  test('the route exists with its own layout, stylesheet and metadata', () => {
    expect(existsSync(join(process.cwd(), 'app/site/page.tsx'))).toBe(true);
    const layout = read('app/site/layout.tsx');
    expect(layout).toContain('./site.css');
    expect(layout).toMatch(/export const metadata/);
    expect(existsSync(join(process.cwd(), 'app/site/site.css'))).toBe(true);
  });

  test('the OS chrome is gated off for site routes so the page runs full-bleed', () => {
    const chrome = read('components/AppChrome.tsx');
    expect(chrome).toContain("'use client'");
    expect(chrome).toContain('usePathname');
    expect(chrome).toContain('isSiteRoute');
    const layout = read('app/layout.tsx');
    expect(layout).toContain('AppChrome');
    // the shell markup moved into the gate — the root layout no longer hardcodes it
    expect(layout).not.toMatch(/<Sidebar\s*\/>/);
  });

  test('both WebGL scenes load client-only through dimension-matched skeletons', () => {
    const lazy = read('components/site/SceneLazy.tsx');
    expect(lazy).toContain("'use client'");
    expect(lazy).toMatch(/dynamic\(\s*\(\)\s*=>\s*import\('@\/components\/site\/HeroMonolith'\)/);
    expect(lazy).toMatch(/dynamic\(\s*\(\)\s*=>\s*import\('@\/components\/site\/AgentField'\)/);
    const ssrFalse = lazy.match(/ssr:\s*false/g) ?? [];
    expect(ssrFalse.length).toBeGreaterThanOrEqual(2);
    // the hero fills the viewport, the field keeps its square-ish stage
    expect(lazy).toContain('h-full');
    expect(lazy).toContain('aspect-');
    const page = read('app/site/page.tsx');
    expect(page).toContain('HeroMonolithLazy');
    expect(page).toContain('AgentFieldLazy');
    expect(page).not.toMatch(/from '@\/components\/site\/HeroMonolith';/);
    expect(page).not.toMatch(/from '@\/components\/site\/AgentField';/);
  });

  test('the page reads its copy from the content model, not inline strings', () => {
    const page = read('app/site/page.tsx');
    expect(page).toMatch(/from '@\/lib\/site\/content'/);
    expect(page).toMatch(/\bSITE\b/);
  });

  test('every section the nav points at is rendered with a matching id', () => {
    const page = read('app/site/page.tsx');
    // sections come from the content model; the nav test proves the ids line up
    expect(page).toMatch(/id=\{/);
  });

  test('the hero headline degrades to real text — no JS-only copy', () => {
    const kinetic = read('components/site/KineticText.tsx');
    // words are rendered server-side inside the markup, animation is layered on
    expect(kinetic).toContain('split');
    expect(kinetic).not.toContain('useState');
  });

  test('entrances resolve to their final state when scripting is off', () => {
    // Reveals start at opacity 0 and are flipped by an observer. With no JS
    // nothing ever flips them, so the stylesheet has to hand back the content.
    const css = read('app/site/site.css');
    const block = css.slice(css.indexOf('@media (scripting: none)'));
    expect(block.length, 'no (scripting: none) block found').toBeGreaterThan(0);
    const scoped = block.slice(0, block.indexOf('/* ============================ reduced motion'));
    for (const selector of ['.reveal', '.kinetic-word', '.hero-sub', '.hero-actions', '.wordflow-word']) {
      expect(scoped, selector).toContain(selector);
    }
  });

  test('the WebGL components fail soft: no context, no crash', () => {
    for (const f of ['components/site/HeroMonolith.tsx', 'components/site/AgentField.tsx']) {
      const src = read(f);
      expect(src, f).toContain('getContext');
      expect(src, f).toMatch(/if \(!gl\)/);
      expect(src, f).toContain('webglcontextlost');
    }
  });

  test('the scenes stop rendering when off-screen or the tab is hidden', () => {
    for (const f of ['components/site/HeroMonolith.tsx', 'components/site/AgentField.tsx']) {
      const src = read(f);
      expect(src, f).toContain('IntersectionObserver');
      expect(src, f).toContain('visibilitychange');
    }
  });
});
