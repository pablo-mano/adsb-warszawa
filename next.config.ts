import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/',
        headers: [
          {
            key: 'Referrer-Policy',
            value: 'no-referrer',
          },
        ],
      },
      {
        source: '/:path*',
        headers: [
          {
            key: 'Referrer-Policy',
            value: 'no-referrer',
          },
        ],
      },
      {
        source: '/atc-sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },
      {
        source: '/api/aircraft',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=2',
          },
          {
            key: 'CDN-Cache-Control',
            value: 'public, s-maxage=2',
          },
          {
            key: 'Vercel-CDN-Cache-Control',
            value: 'public, s-maxage=2',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
