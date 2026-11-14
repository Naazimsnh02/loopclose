import type { NextConfig } from 'next';
import { resolve } from 'node:path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Lets a production build run beside a live dev server (NEXT_DIST_DIR=.next-build pnpm build).
  distDir: process.env.NEXT_DIST_DIR || '.next',
  output: 'standalone',
  // Monorepo root, so standalone tracing picks up workspace packages and ignores stray lockfiles elsewhere.
  outputFileTracingRoot: resolve(import.meta.dirname, '../..'),
  transpilePackages: ['@loopclose/shared'],
};

export default nextConfig;
