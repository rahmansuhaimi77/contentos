import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: '/',
        destination: '/overview',
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/tech-rilex',
        destination: '/generated/tech-rilex-commercial-v3/index.html',
      },
      {
        source: '/tech-rilex/:slug',
        destination: '/generated/tech-rilex-commercial-v3/index.html?phone=:slug',
      },
    ];
  },
};

export default nextConfig;
