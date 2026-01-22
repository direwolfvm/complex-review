/** @type {import('next').NextConfig} */
const nextConfig = {
  // Output standalone build for Docker deployment
  output: 'standalone',

  // Allow embedding HedgeDoc in iframes if configured
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
