import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/api/aircraft',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=2',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
