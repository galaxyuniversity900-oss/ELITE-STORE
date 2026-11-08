import type { NextConfig } from 'next';

const cdnOrigin = process.env.PRODUCT_MEDIA_CDN_ORIGIN?.trim();
const remotePatterns: NonNullable<NextConfig['images']>['remotePatterns'] = [];
if (cdnOrigin) {
  const origin = new URL(cdnOrigin);
  if (origin.protocol !== 'https:' || origin.pathname !== '/' || origin.search || origin.hash || origin.username || origin.password) {
    throw new Error('PRODUCT_MEDIA_CDN_ORIGIN must be an HTTPS origin without a path or credentials');
  }
  remotePatterns.push({ protocol: 'https', hostname: origin.hostname, port: origin.port, pathname: '/**' });
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  images: { remotePatterns },
  async headers() {
    return [{
      source: '/media/products/:path*',
      headers: [
        { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
      ],
    }];
  },
};

export default nextConfig;
