import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const siteBase = 'https://galaxyuniversity900-oss.github.io/ELITE-STORE/';
const temp = await mkdtemp(path.join(os.tmpdir(), 'mes-store-seo-'));
const output = path.join(temp, '_site');
try {
  await mkdir(output, { recursive: true });
  await cp(path.join(root, 'index.html'), path.join(output, 'index.html'));
  await cp(path.join(root, 'ELITE.html'), path.join(output, 'ELITE.html'));
  const run = spawnSync(process.execPath, ['scripts/generate-static-seo.mjs', '--output', output, '--site-url', siteBase], {
    cwd: root, encoding: 'utf8', timeout: 30000,
  });
  if (run.status !== 0) throw new Error('SEO generator failed: ' + (run.stderr || run.stdout || run.error));
  const read = (file) => readFile(path.join(output, file), 'utf8');
  const [home, listing, sitemap, robots, productsText, deploy, layout, homepage, accountPage, trackPage] = await Promise.all([
    read('index.html'), read('ELITE.html'), read('sitemap.xml'), read('robots.txt'),
    readFile(path.join(root, 'data/products.json'), 'utf8'),
    readFile(path.join(root, '.github/workflows/deploy.yml'), 'utf8'),
    readFile(path.join(root, 'apps/web/src/app/layout.tsx'), 'utf8'),
    readFile(path.join(root, 'apps/web/src/app/page.tsx'), 'utf8'),
    readFile(path.join(root, 'apps/web/src/app/account/page.tsx'), 'utf8'),
    readFile(path.join(root, 'apps/web/src/app/track/page.tsx'), 'utf8'),
  ]);
  const products = JSON.parse(productsText).products.filter((p) => p && p.active !== false && p.id && p.title);
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.equal(urls.length, products.length + 2, 'Sitemap must include home, catalogue and each active product page');
  assert.equal(new Set(urls).size, urls.length, 'Sitemap URLs must be unique');
  assert.ok(urls.includes(siteBase), 'Homepage canonical must be listed');
  assert.ok(urls.includes(siteBase + 'ELITE.html'), 'Catalogue canonical must be listed');
  assert.match(robots, /User-agent: \*/);
  assert.match(robots, /Disallow: \/data\//);
  assert.match(robots, new RegExp('Sitemap: ' + siteBase.replace(/[.*+?^$|()[\]{}\\]/g, '\\$&') + 'sitemap\\.xml'));
  assert.match(home, /<title>MES STORE/);
  assert.match(home, new RegExp('<link rel="canonical" href="' + siteBase.replace(/[.*+?^$|()[\]{}\\]/g, '\\$&') + '">'));
  assert.match(home, /application\/ld\+json/);
  assert.match(listing, /name="description"/);
  assert.match(listing, /name="robots" content="index,follow/);
  assert.match(listing, /property="og:title"/);
  assert.match(listing, new RegExp('<link rel="canonical" href="' + (siteBase + 'ELITE.html').replace(/[.*+?^$|()[\]{}\\]/g, '\\$&') + '">'));
  const listingSchemaText = listing.match(/<script type="application\/ld\+json" data-mes-seo="true">([\s\S]*?)<\/script>/);
  assert.ok(listingSchemaText, 'Catalogue must contain server-generated JSON-LD');
  const listingSchema = JSON.parse(listingSchemaText[1]);
  assert.equal(listingSchema['@type'], 'CollectionPage');
  assert.equal(listingSchema.mainEntity['@type'], 'ItemList');
  assert.equal(listingSchema.mainEntity.numberOfItems, products.length);
  for (const product of products) {
    const name = String(product.title).normalize('NFKC').toLocaleLowerCase('ar')
      .replace(/[\u064B-\u065F\u0670]/g, '').replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '').slice(0, 70) || 'product';
    const id = String(product.id).toLowerCase().replace(/[^a-z0-9-]/g, '');
    const slug = name + '-' + id;
    const url = new URL('products/' + slug + '/', siteBase).href;
    assert.ok(urls.includes(url), 'Missing sitemap entry for ' + product.id);
    const page = await read('products/' + slug + '/index.html');
    assert.match(page, /name="description"/);
    assert.match(page, /name="robots" content="index,follow/);
    assert.match(page, new RegExp('<link rel="canonical" href="' + url.replace(/[.*+?^$|()[\]{}\\]/g, '\\$&') + '">'));
    const schemas = [...page.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
    const productSchema = schemas.find((schema) => schema['@type'] === 'Product');
    assert.ok(productSchema, 'Product JSON-LD missing for ' + product.id);
    assert.equal(productSchema.sku, product.id);
    assert.ok(schemas.some((schema) => schema['@type'] === 'BreadcrumbList'));
    const shouldHaveOffer = !product.priceNote && Number.isFinite(Number(product.price)) && Number(product.price) > 0;
    assert.equal(Boolean(productSchema.offers), shouldHaveOffer, 'Offer price policy mismatch for ' + product.id);
    if (shouldHaveOffer) {
      assert.equal(productSchema.offers.priceCurrency, 'EGP');
      assert.equal(Number(productSchema.offers.price), Number(product.price));
    }
  }
  assert.match(deploy, /node scripts\/generate-static-seo\.mjs --output _site/);
  assert.doesNotMatch(deploy, /cp index\.html ELITE\.html robots\.txt sitemap\.xml _site\//);
  assert.match(layout, /NEXT_PUBLIC_SITE_URL/);
  const nextRobots = await readFile(path.join(root, 'apps/web/src/app/robots.ts'), 'utf8');
  assert.doesNotMatch(nextRobots, /disallow:.*\\/account|disallow:.*\\/track/, 'Noindex pages must remain crawlable so crawlers can read the noindex directive');
  assert.match(layout, /NEXT_PUBLIC_SITE_URL/);
  assert.match(homepage, /alternates: publicSiteUrl \? \{ canonical: '\/' \}/);
  assert.match(accountPage, /index: false/);
  assert.match(trackPage, /index: false/);
  console.log('SEO verification passed: ' + products.length + ' active products, unique canonicals, Product and BreadcrumbList JSON-LD, CollectionPage/ItemList, robots.txt, ' + urls.length + ' sitemap URLs, Next.js metadata and private-route noindex.');
  console.log(run.stdout.trim());
} finally {
  await rm(temp, { recursive: true, force: true });
}
