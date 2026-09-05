import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './site.css';
import { SITE } from '@/lib/site/content';

// The console is mono end-to-end; the public site pairs that mono (kept for
// labels, codes and eyebrows) with a tight grotesque for display type.
const fontSite = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-site',
  display: 'swap',
});

export const metadata: Metadata = {
  title: `${SITE.brand.name} — ${SITE.brand.tagline}`,
  description: SITE.hero.sub,
  openGraph: {
    title: `${SITE.brand.name} — ${SITE.brand.tagline}`,
    description: SITE.hero.sub,
    type: 'website',
  },
};

/**
 * The public site runs outside the operator shell (see components/AppChrome):
 * its own header, its own palette, its own scroll model. This layout only
 * scopes the stylesheet — the page owns the composition.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <div className={fontSite.variable}>{children}</div>;
}
