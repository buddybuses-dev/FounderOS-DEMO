import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // A pure static export: HTML + assets, no Node server, nothing to 500.
  output: 'export',
  // The page, its components and its libraries all live above this directory —
  // this shell only owns the build target.
  experimental: { externalDir: true },
  webpack: (config) => {
    // Those parent files resolve bare imports (zod, react) relative to their
    // own directory, i.e. the repo root — which a build of this shell alone
    // never installs. Point resolution at this directory's node_modules so the
    // standalone build stands on its own dependencies.
    config.resolve.modules = [path.join(here, 'node_modules'), ...(config.resolve.modules ?? ['node_modules'])];
    return config;
  },
  typescript: {
    // The sources this shell builds live in the repo above it, and the repo
    // type-checks them itself (`npm run typecheck` at the root, in CI and in
    // the test loop). Re-running tsc from here would only re-check the same
    // files with a resolver that cannot see the root's @types — so this turns
    // off the duplicate, not the check.
    ignoreBuildErrors: true,
  },
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
