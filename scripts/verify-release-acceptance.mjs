import { readFileSync } from 'node:fs';

const failures = [];
const warnings = [];
const read = (path) => {
  try { return readFileSync(path, 'utf8'); }
  catch { failures.push('Missing required file: ' + path); return ''; }
};
const productsText = read('data/products.json');
const contactText = read('data/contact.json');
const storefront = read('ELITE.html');
const sitemap = read('sitemap.xml');
const robots = read('robots.txt');

let products;
let contact;
try { products = JSON.parse(productsText); } catch { failures.push('data/products.json is invalid JSON'); }
try { contact = JSON.parse(contactText); } catch { failures.push('data/contact.json is invalid JSON'); }

if (products && Array.isArray(products.products)) {
  const active = products.products.filter((product) => product.active === true);
  for (const product of active) {
    const media = product.media ?? {};
    const hasMedia = Boolean(media.cover) || (Array.isArray(media.images) && media.images.some(Boolean));
    if (!hasMedia) failures.push('Active product has no approved image: ' + (product.id || 'unknown'));
  }
  console.log('Active products checked: ' + active.length);
} else {
  failures.push('Product catalog must contain a products array');
}

if (contact) {
  for (const field of ['store_name', 'whatsapp_number', 'email', 'address', 'working_hours']) {
    if (typeof contact[field] !== 'string' || !contact[field].trim()) failures.push('Missing public contact field: ' + field);
  }
}

if (!/<link\s+rel=["']canonical["']\s+href=["']https:\/\//i.test(storefront)) failures.push('Storefront canonical HTTPS URL is missing');
if (!/<meta\s+name=["']description["']/i.test(storefront)) failures.push('Storefront meta description is missing');
if (!/<script\s+type=["']application\/ld\+json["']/i.test(storefront)) warnings.push('Storefront structured data was not detected');
if (!/<urlset[\s>]/i.test(sitemap)) failures.push('A valid sitemap.xml is required');
if (!/Sitemap:\s*https:\/\//i.test(robots)) failures.push('robots.txt must publish the HTTPS sitemap URL');

if (process.env.RELEASE_MODE === 'production') {
  for (const [name, min] of [['JWT_SECRET', 32], ['POSTGRES_PASSWORD', 24], ['REDIS_PASSWORD', 24]]) {
    if (!process.env[name] || process.env[name].length < min) failures.push('Production secret is missing or too short: ' + name);
  }
  const origins = (process.env.CORS_ORIGINS ?? '').split(',').map((value) => value.trim()).filter(Boolean);
  if (!origins.length || origins.some((value) => {
    try { return new URL(value).protocol !== 'https:' || new URL(value).origin !== value; }
    catch { return true; }
  })) failures.push('Production CORS_ORIGINS must contain only explicit HTTPS origins');
  if (process.env.ENABLE_COMMERCE_SIMULATION === 'true') failures.push('Commerce simulation must never be enabled in production');
  for (const name of ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_APP_SECRET', 'WHATSAPP_WEBHOOK_VERIFY_TOKEN', 'RESEND_API_KEY']) {
    if (!process.env[name]) failures.push('Required production provider secret is missing: ' + name);
  }
  if (!process.env.PAYMENT_PROVIDER || !process.env.COURIER_PROVIDER) {
    failures.push('Real payment and courier providers must be selected and contract-tested');
  }
}

for (const warning of warnings) console.warn('WARNING: ' + warning);
if (failures.length) {
  console.error('RELEASE BLOCKED (' + failures.length + ' blockers):');
  for (const failure of failures) console.error('- ' + failure);
  process.exit(1);
}
console.log('Release acceptance: PASS');
