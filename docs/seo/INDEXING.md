# MES STORE SEO and search indexing

## Canonical public URLs

The current public site base is `https://galaxyuniversity900-oss.github.io/ELITE-STORE/`.

- Homepage: the site root.
- Collection: `/ELITE.html`.
- Product details: generated at `/products/<product-slug>/` for each active product in `data/products.json`.

The generated sitemap contains the homepage, collection and active product detail URLs. Do not add account, tracking, admin, API or raw data endpoints to the sitemap.

## What deployment generates

`scripts/generate-static-seo.mjs` runs during GitHub Pages assembly. It creates product detail HTML pages with unique canonical URLs, descriptive titles and descriptions, Open Graph metadata, Product JSON-LD and BreadcrumbList JSON-LD. It also writes the sitemap and robots file using the current active catalogue.

Product offers are emitted only when the catalogue price is usable and is not marked with `priceNote`. Stock status, reviews, ratings, GTIN and manufacturer part numbers are not fabricated. Product images are included only when real media paths exist in the catalogue.

The homepage Organization schema and WhatsApp links are populated from `data/contact.json`. Keep contact data current and verify the public number before deployment.

## Crawl controls

- Public homepage, collection and active product pages are indexable.
- Customer account and order-tracking routes in the Next.js application are marked `noindex`.
- The static robots policy disallows crawling raw `/data/` files.
- The optional garment-motion editor query is not exposed in the sitemap.
- No private customer data or order details are included in structured data.

## Deployment

The GitHub Pages workflow currently deploys from `main`. Commits on the QA branch do not update the public site until the changes are merged and the Pages workflow completes successfully.

The workflow runs the static SEO generator after copying the storefront, catalogue and assets into `_site`. It then publishes the generated product pages, `sitemap.xml` and `robots.txt`.

## Submit the sitemap to Google

1. Confirm the site has deployed and the sitemap is publicly reachable.
2. Open [Google Search Console](https://search.google.com/search-console).
3. Add and verify the exact GitHub Pages property, or the verified custom-domain property if a custom domain is adopted later.
4. Submit `https://galaxyuniversity900-oss.github.io/ELITE-STORE/sitemap.xml` under **Sitemaps**.
5. Use **URL Inspection** on the homepage, collection page and important product URLs. Request indexing when the inspection tool offers that action.
6. Monitor Page indexing, duplicate/canonical reports and Product structured-data reports.

Search Console credentials are not stored in this repository. Sitemap submission and indexing requests therefore remain owner actions. Search engines decide whether and when URLs are indexed; a sitemap or request does not guarantee indexing or ranking.

## Next.js application

The separate `apps/web` application has metadata, canonical, robots and sitemap routes. If it is deployed on another public host, set `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_CANONICAL_URL` to verified public URLs. Do not use localhost, internal API addresses, preview hosts or unverified domains as canonical URLs.
