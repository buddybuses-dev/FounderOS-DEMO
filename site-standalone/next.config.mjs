/** @type {import('next').NextConfig} */
const nextConfig = {
  // A pure static export: HTML + assets, no Node server, nothing to 500.
  output: 'export',
  // The page, its components and its libraries all live above this directory —
  // this shell only owns the build target.
  experimental: { externalDir: true },
  env: {
    // No console is deployed alongside this page, so every "open the console"
    // link has to point somewhere real. Default to the repository (which is
    // how you get a console); override with a real env var to point at a
    // hosted one instead.
    NEXT_PUBLIC_CONSOLE_URL:
      process.env.NEXT_PUBLIC_CONSOLE_URL ?? 'https://github.com/buddybuses-dev/FounderOS-DEMO',
  },
};

export default nextConfig;
