import { fileURLToPath } from 'node:url';
import path from 'node:path';

const appDir = path.dirname(fileURLToPath(import.meta.url));
const productionApiTarget = 'https://socialflowapi-production.up.railway.app';

function resolveApiProxyTarget() {
  const configured = (
    process.env.API_PROXY_TARGET ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? ''
  ).trim().replace(/^['"]|['"]$/g, '');
  const fallback = process.env.NODE_ENV === 'production' ? productionApiTarget : 'http://localhost:4000';

  try {
    const target = new URL(configured || fallback);
    if (!['http:', 'https:'].includes(target.protocol) || !target.hostname) {
      throw new Error('Invalid API proxy protocol.');
    }
    target.pathname = target.pathname.replace(/\/api\/?$/, '');
    target.search = '';
    target.hash = '';
    return target.toString().replace(/\/$/, '');
  } catch {
    return fallback;
  }
}

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
    const apiProxyTarget = resolveApiProxyTarget();

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
