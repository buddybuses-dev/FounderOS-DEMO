import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import '@/app/site/site.css';
import { SITE } from '@/lib/site/content';

// The same pairing the site uses inside the app: a tight grotesque for display
// type, JetBrains Mono for labels, codes and eyebrows.
const fontSite = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-site', display: 'swap' });
const fontMono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
  title: `${SITE.brand.name} — ${SITE.brand.tagline}`,
  description: SITE.hero.sub,
  openGraph: {
    title: `${SITE.brand.name} — ${SITE.brand.tagline}`,
    description: SITE.hero.sub,
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fontSite.variable} ${fontMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
