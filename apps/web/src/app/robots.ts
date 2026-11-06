import type { MetadataRoute } from 'next';

const siteBase = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://galaxyuniversity900-oss.github.io/ELITE-STORE/').replace(/\/?$/, '/');

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/'],
    },
    sitemap: new URL('sitemap.xml', siteBase).toString(),
  };
}
