import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const products = JSON.parse(readFileSync(new URL('../data/products.json', import.meta.url), 'utf8'));
const lab = readFileSync(new URL('../assets/js/mes-product-image-lab.js', import.meta.url), 'utf8');
const engine = readFileSync(new URL('../assets/js/fabric-ripple.js', import.meta.url), 'utf8');

assert.equal(products.products.length, 22, 'Expected the full 22-product catalogue');
assert.equal(new Set(products.products.map(product => product.id)).size, 22, 'Product IDs must be unique');
assert.ok(products.products.every(product => product.visual?.type && product.visual?.color && product.visual?.accent), 'Every catalogue item must retain its product illustration');

const photoCount = products.products.filter(product =>
  Boolean(product.media?.cover) || (Array.isArray(product.media?.images) && product.media.images.some(Boolean))
).length;

assert.match(lab, /function makeIllustrationImage\(svg\)/, 'SVG illustration fallback must be available');
assert.match(lab, /رسم توضيحي/, 'Illustrations must be visibly labelled as illustrations');
assert.match(lab, /ليس صورة مخزون/, 'The UI must not misrepresent illustrations as stock photography');
assert.match(lab, /function selectedTarget\(\)/, 'The lab must resolve a real photo or SVG illustration');
assert.match(lab, /new window\.FabricRippleEffect\(img, preset\.opts\)/, 'The selected material must be passed to the WebGL engine');
assert.match(lab, /URL\.revokeObjectURL\(objectUrl\)/, 'Temporary SVG object URLs must be released');
assert.match(lab, /stopEffect\(\)/, 'The lab must expose cleanup');
assert.match(engine, /img\.dataset\.fabricRippleActive='true'/, 'The engine must expose confirmed WebGL activation');

const presetCount = (lab.match(/\{ id: '/g) || []).length;
assert.equal(presetCount, 12, 'All 12 material presets must remain available');

console.log('Product image lab structural checks: PASS');
console.log(`Catalogue products: ${products.products.length}`);
console.log(`Products with configured photo media: ${photoCount}`);
console.log('Illustration fallback, truthful labels, WebGL activation and cleanup: PASS');
console.log(`Material presets: ${presetCount}/12`);
