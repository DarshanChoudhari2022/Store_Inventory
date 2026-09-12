import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_BUILD_DIR || '.next',
  poweredByHeader: false,
  async rewrites() {
    return process.env.RETAIL_TEST_PROXY === '1' && process.env.NODE_ENV === 'development'
      ? [{ source: '/rest/v1/rpc/:name', destination: 'http://127.0.0.1:4174/rest/v1/rpc/:name' }]
      : [];
  },
  turbopack: {
    root: process.cwd(),
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(self), geolocation=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
