import { describe, expect, test } from 'vitest';
import {
  SITE,
  SITE_PATH,
  isSiteRoute,
  SiteContentSchema,
  sectionIds,
} from '@/lib/site/content';

describe('site content model', () => {
  test('the whole content tree validates against its schema', () => {
    expect(() => SiteContentSchema.parse(SITE)).not.toThrow();
  });

  test('section ids are unique — anchors cannot collide', () => {
    const ids = sectionIds();
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every nav link points at a section that exists on the page', () => {
    const ids = new Set(sectionIds());
    for (const link of SITE.nav) {
      expect(link.href.startsWith('#'), `${link.label} should be an in-page anchor`).toBe(true);
      expect(ids.has(link.href.slice(1)), `${link.label} → ${link.href}`).toBe(true);
    }
  });

  test('the five pillars are the five pillars', () => {
    expect(SITE.pillars).toHaveLength(5);
    expect(SITE.pillars.map((p) => p.name)).toEqual([
      'Sales',
      'Marketing',
      'Tech',
      'Finance',
      'Comms',
    ]);
    for (const p of SITE.pillars) {
      expect(p.agents.length, p.name).toBeGreaterThanOrEqual(2);
    }
  });

  test('module cards each carry a route that really exists in this app', async () => {
    const { existsSync } = await import('node:fs');
    const { join } = await import('node:path');
    for (const m of SITE.modules) {
      const rel = m.route === '/' ? 'app/page.tsx' : `app/${m.route.replace(/^\//, '')}/page.tsx`;
      expect(existsSync(join(process.cwd(), rel)), `${m.title} → ${m.route}`).toBe(true);
    }
  });

  test('metrics are display strings with a label, so no fake precision leaks in', () => {
    expect(SITE.metrics.length).toBeGreaterThanOrEqual(3);
    for (const m of SITE.metrics) {
      expect(m.label.length).toBeGreaterThan(0);
      expect(Number.isFinite(m.value)).toBe(true);
    }
  });

  test('the manifesto is written as words so it can be lit one at a time', () => {
    expect(SITE.manifesto.body.split(/\s+/).length).toBeGreaterThan(20);
  });

  test('SITE_PATH is the public site root and isSiteRoute recognizes it and its children', () => {
    expect(SITE_PATH).toBe('/site');
    expect(isSiteRoute('/site')).toBe(true);
    expect(isSiteRoute('/site/pricing')).toBe(true);
    expect(isSiteRoute('/')).toBe(false);
    expect(isSiteRoute('/sites')).toBe(false);
    expect(isSiteRoute(null)).toBe(false);
  });
});

describe('console links survive a standalone deploy', () => {
  test('isExternal recognizes links that leave the site', async () => {
    const { isExternal } = await import('@/lib/site/content');
    expect(isExternal('https://example.com')).toBe(true);
    expect(isExternal('mailto:a@b.c')).toBe(true);
    expect(isExternal('/agents')).toBe(false);
    expect(isExternal('#manifesto')).toBe(false);
  });

  test('with no override, console routes are used as written (same-origin app)', async () => {
    const prev = process.env.NEXT_PUBLIC_CONSOLE_URL;
    delete process.env.NEXT_PUBLIC_CONSOLE_URL;
    const { consoleHref } = await import('@/lib/site/content');
    expect(consoleHref('/agents')).toBe('/agents');
    expect(consoleHref('/')).toBe('/');
    if (prev !== undefined) process.env.NEXT_PUBLIC_CONSOLE_URL = prev;
  });

  test('with an override, every console route points at the real console — never a dead route', async () => {
    const prev = process.env.NEXT_PUBLIC_CONSOLE_URL;
    process.env.NEXT_PUBLIC_CONSOLE_URL = 'https://example.com/console/';
    const { consoleHref } = await import('@/lib/site/content');
    expect(consoleHref('/agents')).toBe('https://example.com/console');
    expect(consoleHref('/')).toBe('https://example.com/console');
    // external links are never rewritten
    expect(consoleHref('https://www.thefounderos.com')).toBe('https://www.thefounderos.com');
    if (prev === undefined) delete process.env.NEXT_PUBLIC_CONSOLE_URL;
    else process.env.NEXT_PUBLIC_CONSOLE_URL = prev;
  });
});
