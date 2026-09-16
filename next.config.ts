import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /**
   * A self-contained server in `.next/standalone`, which is what the container
   * image runs (`node server.js`). Without it the image would have to carry
   * the whole dependency tree to start at all.
   *
   * NEVER ON VERCEL. Vercel does its own tracing and packaging, and a build
   * that also writes the standalone output dies on
   * `ENOENT .next/next-server.js.nft.json` — which is how the first deploy
   * after this setting landed failed. Vercel is kept as a rollback and then as
   * an internal clone (docs/deploy-nas.md §8a), so its builds have to keep
   * working; it does not need the standalone output, because it never runs the
   * container image.
   */
  output: process.env.VERCEL ? undefined : 'standalone',

  /**
   * PGlite ships its own WASM and Node filesystem layer; bundling it breaks
   * both. Only the local development database uses it — Neon runs through
   * postgres-js.
   */
  serverExternalPackages: ['@electric-sql/pglite'],
};

export default nextConfig;
