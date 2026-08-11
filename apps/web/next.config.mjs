import { fileURLToPath } from 'node:url';
import path from 'node:path';

const appDir = path.dirname(fileURLToPath(import.meta.url));
const productionApiTarget = 'https://socialflowapi-production.up.railway.app';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep generated output away from the stale OneDrive-managed .next directory.
  distDir: '.next-build',
  // ESLint runs separately in the workspace checks. Skipping it here keeps
  // Vercel builds independent from root-only development dependencies.
  eslint: {
    ignoreDuringBuilds: true,
  },
  typedRoutes: true,
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
  },
  async rewrites() {
    const apiProxyTarget =
      process.env.NODE_ENV === 'production' ? productionApiTarget : 'http://localhost:4000';

    return [
      {
        source: '/api/:path*',
        destination: `${apiProxyTarget.replace(/\/$/, '')}/api/:path*`,
      },
    ];
  },
  webpack(config) {
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      '@': path.join(appDir, 'src'),
    };

    return config;
  },
};

export default nextConfig;
