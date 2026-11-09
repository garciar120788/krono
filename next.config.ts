import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Genera un servidor autónomo (.next/standalone) ideal para Docker.
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  // pg se usa solo en el servidor; no se empaqueta para el navegador.
  serverExternalPackages: ['pg'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
