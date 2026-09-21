import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Pin the workspace root so a stray lockfile higher up the directory tree is ignored.
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
