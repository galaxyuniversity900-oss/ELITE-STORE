import type { MetadataRoute } from 'next';

const siteBase = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://galaxyuniversity900-oss.github.io/ELITE-STORE/').replace(/\/?$/, '/');
const canonicalStoreUrl =
  process.env.NEXT_PUBLIC_CANONICAL_URL ?? new URL('ELITE.html', siteBase).toString();

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: canonicalStoreUrl, priority: 1 }];
}
