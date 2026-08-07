import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: false,
  },
  turbopack: {
    // Pinned because a lockfile above this directory otherwise wins the root inference.
    root: fileURLToPath(new URL('.', import.meta.url)),
  },
};

export default nextConfig;
