import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@tentacrawl/ui', '@tentacrawl/scraper', '@tentacrawl/crawler'],
  serverExternalPackages: ['@tentacrawl/core'],
};

export default nextConfig;
