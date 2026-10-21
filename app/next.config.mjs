/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow embedding HedgeDoc in iframes if configured
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value:
              "frame-src 'self' https://hedgedoc-wiz2ttea4a-uk.a.run.app https://hedgedoc-650621702399.us-east4.run.app",
          },
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
