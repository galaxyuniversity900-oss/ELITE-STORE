import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('../ELITE.html', import.meta.url), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
assert.equal(scripts.length, 1, 'Expected one main inline application script');
new vm.Script(scripts[0][1], { filename: 'ELITE.html:inline-script' });

const required = [
  'gm-studio', 'gm-editor-canvas', 'gm-image-upload', 'gm-auto-mask',
  'gm-preview-toggle', 'gm-ai-segment', 'gm-save', 'gm-export', 'gm-import',
  'gmInpaintBackground', 'gmAffineTriangle', 'gmRenderStored',
  'gmApplySavedCards', 'gmMountQuickView', 'product-motion'
];
for (const token of required) assert.ok(html.includes(token), 'Missing integration token: ' + token);

const productIds = [...html.matchAll(/\{ id: 'mes\d+'/g)].map(m => m[0]);
assert.equal(productIds.length, 22, 'Expected all 22 original product records');
for (const token of ['add-to-cart-btn', 'wish-btn', 'quick-view-btn', 'cart-drawer', 'optimistic-checkout-btn']) {
  assert.ok(html.includes(token), 'Original store behavior missing: ' + token);
}
for (const profile of ['jacket:', 'hoodie:', 'shirt:', 'tshirt:', 'trousers:', 'dress:', 'generic:']) {
  assert.ok(html.includes(profile), 'Missing garment motion profile: ' + profile);
}
assert.ok(html.includes("get('gm-admin')==='1'"), 'Admin editor query switch missing');
console.log('PASS: inline JavaScript syntax');
console.log('PASS: Garment Motion Engine controls and renderer');
console.log('PASS: all 22 original product records retained');
console.log('PASS: cart, wishlist, quick-view and checkout hooks retained');
