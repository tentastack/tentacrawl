import type { NextConfig } from 'next';
import { moduleTranspilePackages } from './src/generated/transpile-packages';

const nextConfig: NextConfig = {
  transpilePackages: ['@tentacrawl/ui', ...moduleTranspilePackages],
  serverExternalPackages: ['@tentacrawl/core'],
};

export default nextConfig;
