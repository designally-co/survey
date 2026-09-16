import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /**
   * A self-contained server in `.next/standalone`, which is what the container
   * image runs (`node server.js`). Without it the image would have to carry
   * the whole dependency tree to start at all.
   */
  output: 'standalone',

  /**
   * PGlite ships its own WASM and Node filesystem layer; bundling it breaks
   * both. Only the local development database uses it — Neon runs through
   * postgres-js.
   */
  serverExternalPackages: ['@electric-sql/pglite'],
};

export default nextConfig;
