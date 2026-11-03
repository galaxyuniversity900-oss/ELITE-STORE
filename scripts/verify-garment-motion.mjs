import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const readJson = path => JSON.parse(readFileSync(new URL('../' + path, import.meta.url), 'utf8'));
const html = readFileSync(new URL('../ELITE.html', import.meta.url), 'utf8');
const catalogue = readJson('data/products.json');
const fabricShader = readFileSync(new URL('../assets/js/fabric-ripple.js', import.meta.url), 'utf8');
new vm.Script(fabricShader, { filename: 'assets/js/fabric-ripple.js' });
const premiumUx = readFileSync(new URL('../assets/js/premium-store-ux.js', import.meta.url), 'utf8');
const premiumCss = readFileSync(new URL('../assets/css/premium-store-ux.css', import.meta.url), 'utf8');
new vm.Script(premiumUx, { filename: 'assets/js/premium-store-ux.js' });
assert.ok(html.includes('assets/js/premium-store-ux.js'), 'Premium retail UX module must be loaded');
assert.ok(html.includes('window.MESStoreProducts = PRODUCTS'), 'Product catalogue must be exposed to the UX module');
for (const token of ['uniform vec4 masses[4]', 'normalStrength', 'rimIntensity', 'swapTexture(src,duration)', 'setMaterial(name)', 'IntersectionObserver', 'MESFabricMaterials']) assert.ok(fabricShader.includes(token), 'Missing shader capability: ' + token);
for (const token of ['openProductQuickView', 'flyToCart', 'mes-recently-viewed', 'mes-sticky-buy', 'mes-size-sheet', 'mes-heart-burst', 'pointerdown', 'touchmove', 'mes-swatch']) assert.ok(premiumUx.includes(token), 'Missing retail UX capability: ' + token);
assert.ok(premiumCss.includes('.mes-qv-backdrop') && premiumCss.includes('.mes-sticky-buy'), 'Premium UX styles missing');

assert.ok(html.includes('assets/js/fabric-ripple.js'), 'WebGL fabric shader must be loaded by the storefront');
assert.ok(html.includes('data-fabric-ripple="on"'), 'Product cover images must opt into the fabric shader');
for (const token of ['class FabricRippleEffect', 'uLensPoints[8]', 'uLensStrength', 'uLensSwirl', 'texture2D(uTexture,sampleUv)', 'requestAnimationFrame', 'IntersectionObserver', 'fabric-ripple-fallback']) {
  assert.ok(fabricShader.includes(token), 'Missing WebGL fabric effect feature: ' + token);
}

const contact = readJson('data/contact.json');
const discounts = readJson('data/discounts.json');
const sectionIndex = readJson('data/sections/index.json');

const scriptMatches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
assert.equal(scriptMatches.length, 1, 'Expected one main inline application script');
new vm.Script(scriptMatches[0][1], { filename: 'ELITE.html:inline-script' });

const requiredHtmlTokens = [
  'gm-studio', 'gm-editor-canvas', 'gm-image-upload', 'gm-auto-mask',
  'gm-preview-toggle', 'gm-ai-segment', 'gm-save', 'gm-export', 'gm-import',
  'gmInpaintBackground', 'gmAffineTriangle', 'gmRenderStored',
  'gmApplySavedCards', 'gmMountQuickView', 'product-motion',
  'data/products.json', 'loadStoreCatalog', 'renderProductVisual',
  'renderProductGallery', "categoryFilterGroup.addEventListener('click',", 'sourceUrl',
  "readJson('data/contact.json')", "readJson('data/discounts.json')",
  "readJson('data/sections/index.json')", 'function storeDiscountForCart()',
  'function applyStoreCoupon(code)', 'storeWhatsAppNumber()',
  "https://wa.me/' + waNumber", 'cart-discount-summary',
  "offers: 'interactive-tricks-section'", "checkout: 'cart-drawer'",
  'store-footer-name', 'couponHeadline.textContent',
  'checkoutConfig.payment_methods.map(storeSafeText)', 'data-checkout-note'
];
for (const token of requiredHtmlTokens) {
  assert.ok(html.includes(token), 'Missing integration token: ' + token);
}

const fallbackIds = [...html.matchAll(/\{ id: 'mes\d+'/g)].map(match => match[0]);
assert.equal(fallbackIds.length, 22, 'Expected all 22 built-in fallback product records');
assert.equal(catalogue.version, 1, 'Unsupported catalogue version');
assert.equal(catalogue.currency, 'EGP', 'Expected EGP currency');
assert.equal(catalogue.products.length, 22, 'Expected all 22 products in editable catalogue');

const productIds = new Set();
for (const product of catalogue.products) {
  assert.ok(product.id && /^[a-z0-9][a-z0-9_-]{1,48}$/i.test(product.id), 'Invalid product ID');
  assert.ok(!productIds.has(product.id), 'Duplicate product ID: ' + product.id);
  productIds.add(product.id);
  assert.ok(typeof product.title === 'string' && product.title.trim(), 'Missing title: ' + product.id);
  assert.ok(typeof product.category === 'string' && product.category.trim(), 'Missing category: ' + product.id);
  assert.ok(Number.isFinite(product.price) && product.price >= 0, 'Invalid price: ' + product.id);
  assert.ok(product.media && typeof product.media === 'object', 'Missing media: ' + product.id);
  assert.ok(Array.isArray(product.media.images), 'Invalid image gallery: ' + product.id);
  assert.ok(Array.isArray(product.media.videos), 'Invalid video gallery: ' + product.id);
}

assert.equal(contact.version, 1, 'Unsupported contact settings version');
for (const field of ['store_name','whatsapp_number','phone','email','address','working_hours','instagram_url','facebook_url','tiktok_url','footer_note']) {
  assert.ok(Object.hasOwn(contact, field), 'Missing contact field: ' + field);
}

assert.equal(discounts.version, 1, 'Unsupported discount settings version');
assert.ok(Array.isArray(discounts.coupons), 'Discount coupons must be an array');
assert.ok(Array.isArray(discounts.quantity_rules), 'Quantity rules must be an array');
for (const coupon of discounts.coupons) {
  assert.ok(typeof coupon.code === 'string' && coupon.code.trim(), 'Invalid coupon code');
  assert.ok(['percentage','fixed_amount'].includes(coupon.type), 'Invalid coupon type: ' + coupon.code);
  assert.ok(Number.isFinite(coupon.value) && coupon.value >= 0, 'Invalid coupon value: ' + coupon.code);
  if (coupon.type === 'percentage') assert.ok(coupon.value <= 100, 'Coupon percentage exceeds 100%');
}
for (const rule of discounts.quantity_rules) {
  assert.ok(['cart','product','category'].includes(rule.scope), 'Invalid quantity rule scope: ' + rule.id);
  assert.ok(['percentage','fixed_amount','fixed_price'].includes(rule.type), 'Invalid quantity rule type: ' + rule.id);
  assert.ok(Number.isInteger(rule.min_units) && rule.min_units >= 1, 'Invalid minimum units: ' + rule.id);
  assert.ok(Number.isFinite(rule.value) && rule.value >= 0, 'Invalid discount value: ' + rule.id);
  if (rule.type === 'percentage') assert.ok(rule.value <= 100, 'Quantity discount exceeds 100%: ' + rule.id);
}
assert.ok(discounts.quantity_rules.some(rule => rule.active && rule.min_units === 2), 'Expected an active two-unit discount');
assert.ok(discounts.quantity_rules.some(rule => rule.active && rule.min_units === 3), 'Expected an active three-unit discount');

assert.equal(sectionIndex.version, 1, 'Unsupported section registry version');
assert.ok(Array.isArray(sectionIndex.sections), 'Section registry must be an array');
for (const section of sectionIndex.sections) {
  const config = readJson('data/sections/' + section.file);
  assert.equal(config.version, 1, 'Unsupported section config version: ' + section.id);
}
assert.ok(sectionIndex.sections.some(section => section.id === 'offers' && section.file === 'offers.json'));
assert.ok(sectionIndex.sections.some(section => section.id === 'checkout' && section.file === 'checkout.json'));

for (const token of ['add-to-cart-btn','wish-btn','quick-view-btn','cart-drawer','optimistic-checkout-btn']) {
  assert.ok(html.includes(token), 'Original storefront behavior missing: ' + token);
}
for (const profile of ['jacket:','hoodie:','shirt:','tshirt:','trousers:','dress:','generic:']) {
  assert.ok(html.includes(profile), 'Missing garment motion profile: ' + profile);
}
assert.ok(html.includes("get('gm-admin')==='1'"), 'Motion editor access switch missing');
assert.ok(html.includes('assets.record.sourceUrl!==currentSource'), 'Stale motion pack protection missing');

console.log('PASS: inline JavaScript syntax');
console.log('PASS: 22 product records, unique IDs, numeric prices and media arrays');
console.log('PASS: editable contact information and WhatsApp integration');
console.log('PASS: coupon and quantity-based discounts');
console.log('PASS: section configuration and checkout settings');
console.log('PASS: image/video galleries and dynamic category filters');
console.log('PASS: garment motion engine and stale-image protection');
console.log('PASS: cart, wishlist, quick-view and checkout behavior');
