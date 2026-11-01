import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const readJson = path => JSON.parse(readFileSync(new URL('../' + path, import.meta.url), 'utf8'));
const html = readFileSync(new URL('../ELITE.html', import.meta.url), 'utf8');
const catalogue = readJson('data/products.json');
const contact = readJson('data/contact.json');
const discounts = readJson('data/discounts.json');
const sectionIndex = readJson('data/sections/index.json');
const scripts = [...html.matchAll(/<script>([\\s\\S]*?)<\\/script>/g)];
assert.equal(scripts.length, 1, 'Expected one main inline application script');
new vm.Script(scripts[0][1], { filename: 'ELITE.html:inline-script' });

const required = [
  'gm-studio', 'gm-editor-canvas', 'gm-image-upload', 'gm-auto-mask',
  'gm-preview-toggle', 'gm-ai-segment', 'gm-save', 'gm-export', 'gm-import',
  'gmInpaintBackground', 'gmAffineTriangle', 'gmRenderStored',
  'gmApplySavedCards', 'gmMountQuickView', 'product-motion',
  'data/products.json', 'loadStoreCatalog', 'renderProductVisual',
  'renderProductGallery', "categoryFilterGroup.addEventListener('click',", 'sourceUrl',
  'data/contact.json', 'data/discounts.json', 'data/sections/index.json',
  'function storeDiscountForCart()', 'function applyStoreCoupon(code)',
  'storeWhatsAppNumber()', "https://wa.me/' + waNumber",
  'cart-discount-summary', 'STORE_SECTIONS.categories'
];
for (const token of required) assert.ok(html.includes(token), 'Missing integration token: ' + token);

const productIds = [...html.matchAll(/\\{ id: 'mes\\d+'/g)].map(match => match[0]);
assert.equal(productIds.length, 22, 'Expected all 22 original built-in fallback product records');
assert.equal(catalogue.version, 1, 'Unsupported product catalogue version');
assert.equal(catalogue.currency, 'EGP', 'Expected EGP catalogue currency');
assert.equal(catalogue.products.length, 22, 'Expected all 22 original products in the editable catalogue');

const contact = JSON.parse(readFileSync(new URL('../data/contact.json', import.meta.url), 'utf8'));
const discounts = JSON.parse(readFileSync(new URL('../data/discounts.json', import.meta.url), 'utf8'));
const sectionRegistry = JSON.parse(readFileSync(new URL('../data/sections/index.json', import.meta.url), 'utf8'));
assert.equal(contact.version, 1, 'Unsupported contact settings version');
for (const field of ['store_name', 'whatsapp_number', 'phone', 'email', 'address', 'working_hours', 'instagram_url', 'facebook_url', 'tiktok_url', 'footer_note']) {
  assert.ok(Object.hasOwn(contact, field), 'Missing contact field: ' + field);
}
assert.equal(discounts.version, 1, 'Unsupported discount settings version');
assert.ok(Array.isArray(discounts.coupons), 'Missing coupon list');
assert.ok(Array.isArray(discounts.quantity_rules), 'Missing quantity rules');
for (const rule of discounts.quantity_rules) {
  assert.ok(Number.isInteger(rule.min_units) && rule.min_units >= 1, 'Invalid quantity threshold: ' + rule.id);
  assert.ok(['cart', 'product', 'category'].includes(rule.scope), 'Invalid discount scope: ' + rule.id);
  assert.ok(['percentage', 'fixed_amount', 'fixed_price'].includes(rule.type), 'Invalid discount type: ' + rule.id);
  assert.ok(Number.isFinite(rule.value) && rule.value >= 0, 'Invalid discount value: ' + rule.id);
  if (rule.type === 'percentage') assert.ok(rule.value <= 100, 'Percentage discount exceeds 100%: ' + rule.id);
}
assert.ok(sectionRegistry.sections.some(section => section.id === 'offers' && section.file === 'offers.json'), 'Offers section is not registered');
assert.ok(sectionRegistry.sections.some(section => section.id === 'checkout' && section.file === 'checkout.json'), 'Checkout section is not registered');
assert.ok(html.includes("offers: 'interactive-tricks-section'"), 'Offers visibility is not connected');
assert.ok(html.includes("checkout: 'cart-drawer'"), 'Checkout visibility is not connected');
assert.ok(html.includes('store-footer-name'), 'Store name is not connected to the contact file');
assert.ok(html.includes('couponHeadline.textContent'), 'Promotional coupon display is not data-driven');
assert.ok(html.includes('storeDiscountForCart()'), 'Quantity discounts are not connected to cart calculation');

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

assert.equal(contact.version, 1, 'Unsupported contact config version');
for (const field of ['store_name','whatsapp_number','phone','email','address','working_hours','instagram_url','facebook_url','tiktok_url','footer_note']) {
  assert.ok(Object.hasOwn(contact, field), 'Missing contact field: ' + field);
}
assert.equal(discounts.version, 1, 'Unsupported discount config version');
assert.ok(Array.isArray(discounts.coupons), 'Discount coupons must be an array');
assert.ok(Array.isArray(discounts.quantity_rules), 'Quantity rules must be an array');
for (const rule of discounts.quantity_rules) {
  assert.ok(['cart','product','category'].includes(rule.scope), 'Invalid quantity rule scope: ' + rule.id);
  assert.ok(['percentage','fixed_amount','fixed_price'].includes(rule.type), 'Invalid quantity rule type: ' + rule.id);
  assert.ok(Number.isInteger(rule.min_units) && rule.min_units >= 1, 'Invalid minimum units: ' + rule.id);
  assert.ok(Number.isFinite(rule.value) && rule.value >= 0, 'Invalid discount value: ' + rule.id);
}
assert.equal(sectionIndex.version, 1, 'Unsupported section registry version');
for (const section of sectionIndex.sections) {
  const config = readJson('data/sections/' + section.file);
  assert.equal(config.version, 1, 'Unsupported section config version: ' + section.id);
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
console.log('PASS: editable catalogue and all 22 original product records');
console.log('PASS: contact details, WhatsApp checkout and section configuration files');
console.log('PASS: coupon and quantity discount rules');
console.log('PASS: product media, galleries, videos and category filters');
console.log('PASS: motion editor and stale-source protection');
console.log('PASS: cart, wishlist, quick-view and checkout hooks retained');
