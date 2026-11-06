import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');
const canonical = 'https://galaxyuniversity900-oss.github.io/ELITE-STORE/ELITE.html';
const [html, index, sitemap, robots, seo, productsText, deploy, ci, layout, accountLayout, trackLayout] = await Promise.all([
  read('ELITE.html'), read('index.html'), read('sitemap.xml'), read('robots.txt'),
  read('assets/js/mes-seo.js'), read('data/products.json'), read('.github/workflows/deploy.yml'),
  read('.github/workflows/ci.yml'), read('apps/web/src/app/layout.tsx'),
  read('apps/web/src/app/account/layout.tsx'), read('apps/web/src/app/track/layout.tsx')
]);
const products = JSON.parse(productsText).products;
assert.match(html, /<title>MES STORE \|/);
assert.match(html, new RegExp('<link rel="canonical" href="' + canonical.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"'));
assert.match(html, /name="description"/);
assert.match(html, /name="robots" content="index,follow/);
assert.match(html, /property="og:title"/);
assert.match(html, /assets\/js\/mes-seo\.js/);
assert.match(html, /id="product-\$\{p\.id\}" data-id="\$\{p\.id\}"/);
assert.match(index, /rel="canonical" href="https:\/\/galaxyuniversity900-oss\.github\.io\/ELITE-STORE\/ELITE\.html"/);
assert.match(sitemap, /<loc>https:\/\/galaxyuniversity900-oss\.github\.io\/ELITE-STORE\/ELITE\.html<\/loc>/);
assert.equal((sitemap.match(/<loc>/g) || []).length, 1, 'Sitemap must contain only the canonical public storefront URL');
assert.match(robots, /Sitemap: https:\/\/galaxyuniversity900-oss\.github\.io\/ELITE-STORE\/sitemap\.xml/);
assert.match(robots, /Disallow: \/\*\?gm-admin=1/);
assert.match(seo, /'@type': 'Product'/);
assert.match(seo, /'@type': 'Offer'/);
assert.match(seo, /'@type': 'ItemList'/);
assert.match(seo, /priceCurrency: 'EGP'/);
assert.doesNotMatch(seo, /AggregateRating|ratingValue|reviewCount|InStock/);
assert.match(deploy, /cp index\.html ELITE\.html robots\.txt sitemap\.xml _site\//);
assert.match(ci, /node --check assets\/js\/mes-seo\.js && node scripts\/verify-seo\.mjs/);
assert.match(layout, /alternates:\s*\{\s*canonical:/);
assert.match(accountLayout, /index:\s*false/);
assert.match(trackLayout, /index:\s*false/);
const active = products.filter(product => product.active !== false);
assert.ok(active.length > 0, 'Expected active products');
assert.equal(new Set(active.map(product => product.id)).size, active.length, 'Product IDs must be unique');
for (const product of active) {
  assert.match(product.id, /^[a-z0-9][a-z0-9_-]{1,48}$/i);
  assert.equal(typeof product.title, 'string');
  assert.equal(typeof product.category, 'string');
}
console.log('SEO verification passed:', active.length, 'active products, canonical metadata, Product/ItemList JSON-LD, robots, sitemap, Next.js noindex routes and GitHub Pages deployment.');
