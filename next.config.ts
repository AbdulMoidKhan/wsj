import type {NextConfig} from 'next';
import redirects from './data/redirects.json';

const isExport = process.env.GITHUB_PAGES === 'true' || Boolean(process.env.NEXT_PUBLIC_BASE_PATH);
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? (isExport ? '/wsj' : '');
const apiUrl = process.env.API_URL || 'http://localhost:4000/api';
const apiOrigin = new URL(apiUrl).origin;
const publicApi = process.env.NEXT_PUBLIC_API_URL?.startsWith('http') ? new URL(process.env.NEXT_PUBLIC_API_URL) : new URL(apiOrigin);

const config: NextConfig = {
  ...(isExport ? { output: 'export', basePath } : {}),
  distDir: process.env.NEXT_DIST_DIR || '.next',
  trailingSlash: true,
  images: isExport
    ? {
        loader: 'custom',
        loaderFile: './lib/image-loader.ts',
      }
    : {
        formats: ['image/avif', 'image/webp'],
        remotePatterns: [
          {
            protocol: publicApi.protocol.replace(':', '') as 'http' | 'https',
            hostname: publicApi.hostname,
            port: publicApi.port,
            pathname: '/uploads/**',
          },
          {
            protocol: 'https',
            hostname: 'chicagolandpodcaststudio.com',
          },
          {
            protocol: 'https',
            hostname: 'pub-e4b4ffee7e0747098f49cc9765932cee.r2.dev',
          },
          {
            protocol: 'https',
            hostname: '*.r2.dev',
          },
        ],
      },
  turbopack: { rules: { '*.css': { loaders: ['@tailwindcss/turbopack'], as: '*.css' } } },
  ...(!isExport
    ? {
        async rewrites() {
          return [
            { source: '/api/:path*', destination: apiUrl + '/:path*' },
            { source: '/uploads/:path*', destination: apiOrigin + '/uploads/:path*' },
          ];
        },
        async redirects() {
          return (redirects as { source: string; destination: string }[]).map((r) => ({ ...r, statusCode: 301 }));
        },
        async headers() {
          return [
            {
              source: '/:path*',
              headers: [
                { key: 'X-Content-Type-Options', value: 'nosniff' },
                { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
                { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
              ],
            },
          ];
        },
      }
    : {}),
};

export default config;
 