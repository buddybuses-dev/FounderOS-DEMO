import type { Config } from 'tailwindcss';

// The site uses a handful of Tailwind utilities inside its own components;
// everything else is authored in app/site/site.css. Scan the real sources,
// which live above this directory.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', '../app/site/**/*.{ts,tsx}', '../components/site/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
};

export default config;
