import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const catalog = JSON.parse(readFileSync(new URL('../data/products.json', import.meta.url), 'utf8'));
assert.ok(catalog && typeof catalog === 'object', 'Catalog must be an object');
assert.ok(typeof catalog.currency === 'string' && /^[A-Z]{3}$/.test(catalog.currency), 'Currency must be a 3-letter code');
assert.ok(Array.isArray(catalog.products), 'products must be an array');

const ids = new Set();
const warnings = [];
for (const [index, product] of catalog.products.entries()) {
  const label = product?.id || `row ${index + 1}`;
  assert.ok(product && typeof product === 'object', `${label}: product must be an object`);
  assert.ok(typeof product.id === 'string' && product.id.trim(), `${label}: id is required`);
  assert.ok(!ids.has(product.id), `${label}: duplicate product id`);
  ids.add(product.id);
  assert.ok(typeof product.title === 'string' && product.title.trim(), `${label}: title is required`);
  assert.ok(typeof product.category === 'string' && product.category.trim(), `${label}: category is required`);
  assert.ok(Number.isFinite(product.price) && product.price > 0, `${label}: price must be positive`);
  assert.ok(typeof product.active === 'boolean', `${label}: active must be boolean`);
  assert.ok(product.visual && typeof product.visual === 'object', `${label}: visual metadata is required`);
  assert.ok(product.media && typeof product.media === 'object', `${label}: media metadata is required`);
  assert.ok(Array.isArray(product.media.images), `${label}: media.images must be an array`);
  assert.ok(Array.isArray(product.media.videos), `${label}: media.videos must be an array`);
  const media = [product.media.cover, ...product.media.images, ...product.media.videos].filter(Boolean);
  for (const source of media) {
    assert.ok(typeof source === 'string' && source.trim(), `${label}: media source must be non-empty`);
    assert.ok(/^(https:\/\/|\/|\.\/)/i.test(source), `${label}: media source must be HTTPS or site-relative`);
  }
  if (product.active && media.length === 0) warnings.push(`${label}: active product has no real media`);
}
console.log(`Product catalog validation: PASS (${catalog.products.length} products, ${ids.size} unique IDs)`);
if (warnings.length) {
  console.warn(`Media readiness warnings (${warnings.length}):`);
  for (const warning of warnings) console.warn(`- ${warning}`);
}
