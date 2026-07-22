import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.31.150'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'maps.geoapify.com' },
      { protocol: 'https', hostname: 'api.geoapify.com' },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.API_URL || 'http://127.0.0.1:8000'}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
