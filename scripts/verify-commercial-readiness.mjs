import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));
const html = read('ELITE.html');
const products = json('data/products.json');
const contact = json('data/contact.json');
const discounts = json('data/discounts.json');
const demoGuide = read('docs/commerce/DEMO_COMMERCE_GUIDE.md');
const policy = read('docs/commerce/COMMERCE_RULES.md');

const inlineScripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
assert.equal(inlineScripts.length, 1, 'Expected one inline storefront application script');
new vm.Script(inlineScripts[0][1], { filename: 'ELITE.html:inline-script' });

const checkoutStart = html.indexOf("document.getElementById('optimistic-checkout-btn').addEventListener('click'");
const checkoutEnd = html.indexOf('// 7. CATEGORY FILTERS', checkoutStart);
assert.ok(checkoutStart >= 0 && checkoutEnd > checkoutStart, 'Checkout handler boundaries missing');
const checkout = html.slice(checkoutStart, checkoutEnd);
for (const token of [
  'if (!cartItems.length)',
  'name.length < 2',
  'phoneDigits.length < 8',
  'phoneDigits.length > 15',
  'addr.length < 8',
  'preview.replaceChildren()',
  'row.textContent',
  'waNumber',
  'بانتظار تأكيد المتجر',
  'الإجمالي التقديري قبل تأكيد المتجر',
  "rel = 'noopener noreferrer'"
]) assert.ok(checkout.includes(token), 'Missing checkout safety control: ' + token);
assert.ok(!checkout.includes('preview.innerHTML'), 'Customer checkout data must never be injected through innerHTML');
assert.ok(!checkout.includes('عميل MES المميز') && !checkout.includes('010XXXXXXXX') && !checkout.includes('القاهرة - الدفع عند الاستلام'), 'Checkout must not invent customer details');
assert.ok(html.includes('هذا المنتج غير متاح للطلب حتى يعتمد المتجر سعره النهائي.'), 'Unpriced products must be blocked from cart');
assert.ok(html.includes('const useCoupon = couponCandidate > quantityDiscount.amount'), 'Discounts must not stack implicitly');
for (const id of ['wa-customer-name','wa-customer-phone','wa-customer-address']) {
  const tag = html.match(new RegExp('<input[^>]*id="' + id + '"[^>]*>'));
  assert.ok(tag && /required/.test(tag[0]), 'Required customer field missing: ' + id);
}
assert.equal(products.currency, 'EGP', 'Store currency must be explicit');
assert.ok(Array.isArray(products.products) && products.products.length > 0, 'Product catalogue is empty');
assert.equal(new Set(products.products.map(p => p.id)).size, products.products.length, 'Product IDs must be unique');
for (const p of products.products) {
  assert.ok(Number.isFinite(p.price) && p.price >= 0, 'Invalid product price: ' + p.id);
  assert.ok(p.media && Array.isArray(p.media.images) && Array.isArray(p.media.videos), 'Invalid product media shape: ' + p.id);
}
assert.ok(contact && typeof contact.whatsapp_number === 'string', 'WhatsApp contact setting missing');
assert.ok(Array.isArray(discounts.coupons) && Array.isArray(discounts.quantity_rules), 'Discount configuration invalid');
assert.ok(demoGuide.includes('simulations only') && demoGuide.includes('never contacts a bank'), 'Demo payment boundary must be documented');
assert.ok(policy.includes('server/database are authoritative') && policy.includes('Release gates'), 'Commerce policy missing financial and release gates');

console.log('PASS: storefront inline JavaScript parses');
console.log('PASS: checkout requires a non-empty cart and valid customer details');
console.log('PASS: checkout preview uses text nodes and avoids customer-data HTML injection');
console.log('PASS: no placeholder customer identity or address is generated');
console.log('PASS: unpriced products cannot enter the cart');
console.log('PASS: coupon and quantity discounts do not stack implicitly');
console.log('PASS: catalogue, contact and promotion configuration are structurally valid');

const blockers = [];
const wa = contact.whatsapp_number.replace(/[^0-9]/g, '');
if (wa.length < 8 || wa.length > 15) blockers.push('Set and verify the store WhatsApp number in data/contact.json.');
const photographed = products.products.filter(p => p.media?.cover || p.media?.images?.length);
if (!photographed.length) blockers.push('Add real, correctly licensed product photos; current catalogue has no configured product photography.');
else if (photographed.length < products.products.length) blockers.push('Add real product photos for every sellable product (' + photographed.length + '/' + products.products.length + ' currently have media).');
const unpriced = products.products.filter(p => p.priceNote);
if (unpriced.length) blockers.push('Resolve price confirmation for: ' + unpriced.map(p => p.id).join(', ') + '.');
if (discounts.coupons.some(x => x.active) || discounts.quantity_rules.some(x => x.active)) blockers.push('Owner must approve active coupon and quantity-discount rules, dates, eligibility and non-stacking behavior.');
blockers.push('Configure and deploy the production API, database, HTTPS, rate limiting, monitoring and tested backups before taking customer data.');
blockers.push('Replace demo payment/shipping simulations with verified providers, or explicitly operate an owner-confirmed cash-on-delivery/WhatsApp pilot with published delivery, return and privacy policies.');
blockers.push('Run browser-based mobile/desktop critical-path, accessibility, security and live deployment smoke tests on the exact release commit.');

console.log('');
console.log(blockers.length ? 'PRE-LAUNCH BLOCKERS (' + blockers.length + '):' : 'PRE-LAUNCH CONFIGURATION: no blockers detected');
blockers.forEach((item, index) => console.log((index + 1) + '. ' + item));
if (process.env.STRICT_COMMERCIAL === '1' && blockers.length) process.exitCode = 2;
