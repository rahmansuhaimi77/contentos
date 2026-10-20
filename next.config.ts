import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Poster fonts are read from disk at runtime; make sure Vercel ships them with the function.
  outputFileTracingIncludes: {
    '/api/poster': ['./lib/poster/fonts/**'],
  },
  async redirects() {
    return [
      {
        source: '/',
        destination: '/overview',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
