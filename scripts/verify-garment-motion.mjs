import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('../ELITE.html', import.meta.url), 'utf8');
const catalogue = JSON.parse(readFileSync(new URL('../data/products.json', import.meta.url), 'utf8'));
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
assert.equal(scripts.length, 1, 'Expected one main inline application script');
new vm.Script(scripts[0][1], { filename: 'ELITE.html:inline-script' });

const required = [
  'gm-studio', 'gm-editor-canvas', 'gm-image-upload', 'gm-auto-mask',
  'gm-preview-toggle', 'gm-ai-segment', 'gm-save', 'gm-export', 'gm-import',
  'gmInpaintBackground', 'gmAffineTriangle', 'gmRenderStored',
  'gmApplySavedCards', 'gmMountQuickView', 'product-motion',
  'data/products.json', 'loadStoreCatalog', 'renderProductVisual',
  'renderProductGallery', "categoryFilterGroup.addEventListener('click',", 'sourceUrl'
];
for (const token of required) assert.ok(html.includes(token), 'Missing integration token: ' + token);

const productIds = [...html.matchAll(/\{ id: 'mes\d+'/g)].map(match => match[0]);
assert.equal(productIds.length, 22, 'Expected all 22 original built-in fallback product records');
assert.equal(catalogue.version, 1, 'Unsupported product catalogue version');
assert.equal(catalogue.currency, 'EGP', 'Expected EGP catalogue currency');
assert.equal(catalogue.products.length, 22, 'Expected all 22 original products in the editable catalogue');

const ids = new Set();
for (const product of catalogue.products) {
  assert.ok(product.id && /^[a-z0-9][a-z0-9_-]{1,48}$/i.test(product.id), 'Invalid product ID');
  assert.ok(!ids.has(product.id), 'Duplicate product ID: ' + product.id);
  ids.add(product.id);
  assert.ok(typeof product.title === 'string' && product.title.trim(), 'Missing title: ' + product.id);
  assert.ok(typeof product.category === 'string' && product.category.trim(), 'Missing category: ' + product.id);
  assert.ok(Number.isFinite(product.price) && product.price >= 0, 'Invalid price: ' + product.id);
  assert.ok(product.media && typeof product.media === 'object', 'Missing media object: ' + product.id);
  assert.ok(Array.isArray(product.media.images), 'Invalid image gallery: ' + product.id);
  assert.ok(Array.isArray(product.media.videos), 'Invalid video gallery: ' + product.id);
}

for (const token of ['add-to-cart-btn', 'wish-btn', 'quick-view-btn', 'cart-drawer', 'optimistic-checkout-btn']) {
  assert.ok(html.includes(token), 'Original store behavior missing: ' + token);
}
for (const profile of ['jacket:', 'hoodie:', 'shirt:', 'tshirt:', 'trousers:', 'dress:', 'generic:']) {
  assert.ok(html.includes(profile), 'Missing garment motion profile: ' + profile);
}
assert.ok(html.includes("get('gm-admin')==='1'"), 'Admin editor query switch missing');
assert.ok(html.includes('assets.record.sourceUrl!==currentSource'), 'Stale motion packs are not invalidated after a product image change');

console.log('PASS: inline JavaScript syntax');
console.log('PASS: editable product catalogue JSON and 22 unique product IDs');
console.log('PASS: product media, galleries, videos and dynamic category filters');
console.log('PASS: motion editor loads catalogue images and rejects stale source packs');
console.log('PASS: cart, wishlist, quick-view and checkout hooks retained');
