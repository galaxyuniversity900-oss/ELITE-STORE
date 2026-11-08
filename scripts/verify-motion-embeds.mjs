import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..');
const read = (file) => readFileSync(new URL(file, import.meta.url), 'utf8');
const config = JSON.parse(read('../data/motion-embeds.json'));
const html = read('../ELITE.html');
const runtime = read('../assets/js/mes-motion-embed.js');
const css = read('../assets/css/mes-motion-embed.css');
const docs = read('../docs/POWERPOINT-MOTION-EMBEDS.md');

assert.equal(config.version, 1, 'Motion config version must be 1');
assert.ok(Array.isArray(config.items), 'Motion config items must be an array');
assert.ok(html.includes('./assets/js/mes-motion-embed.js'), 'Storefront must load the motion runtime');
assert.ok(html.includes('./assets/css/mes-motion-embed.css'), 'Storefront must load motion styles');
assert.ok(runtime.includes("prefers-reduced-motion: reduce"), 'Runtime must respect reduced-motion preferences');
assert.ok(runtime.includes("url.origin !== location.origin"), 'Runtime must reject cross-origin media');
assert.ok(css.includes('.mes-motion-embed'), 'Motion embed styles must exist');
assert.ok(docs.includes('Create a Video'), 'PowerPoint export instructions must exist');
assert.ok(runtime.includes('const workerCount = Math.min(3, config.items.length)'), 'Motion entries must mount with bounded concurrency for mobile performance');
assert.ok(runtime.includes('await Promise.allSettled(Array.from({ length: workerCount }, () => worker()))'), 'Motion workers must settle independently');
assert.ok(runtime.includes('Entry failed independently:'), 'A failed entry must not stop other motion entries');
assert.ok(runtime.includes('if (!selector || !source || !allowed.includes(item.type))'), 'Invalid sources must be rejected before URL parsing');

function resolveRepositoryAsset(url, label) {
  const decodedPath = decodeURIComponent(url.pathname);
  const relativePath = decodedPath.replace(/^\/+/, '');
  const assetPath = path.resolve(root, relativePath);
  const relative = path.relative(root, assetPath);
  assert.ok(
    relative && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative),
    label + ' must stay inside the repository',
  );
  return assetPath;
}

const extensions = {
  video: ['mp4', 'webm'], gif: ['gif'], webp: ['webp'], svg: ['svg'], lottie: ['json']
};
const ids = new Set();
for (const item of config.items) {
  assert.ok(item && typeof item === 'object', 'Each motion entry must be an object');
  assert.equal(typeof item.id, 'string');
  assert.ok(item.id.trim(), 'Motion entry id cannot be empty');
  assert.ok(!ids.has(item.id), 'Motion entry ids must be unique');
  ids.add(item.id);
  assert.ok(typeof item.target === 'string' && item.target.trim(), 'Motion entry target is required');
  assert.ok(Object.hasOwn(extensions, item.type), 'Unsupported motion media type: ' + item.type);
  assert.equal(typeof item.src, 'string');
  const parsed = new URL(item.src, 'https://mes-store.invalid/');
  assert.equal(parsed.origin, 'https://mes-store.invalid', 'Motion source must be a relative same-origin path');
  const ext = parsed.pathname.split('.').pop().toLowerCase();
  assert.ok(extensions[item.type].includes(ext), 'File extension does not match motion type: ' + item.id);
  const assetPath = resolveRepositoryAsset(parsed, 'Motion asset');
  if (item.enabled !== false) assert.ok(existsSync(assetPath), 'Enabled motion asset is missing: ' + item.src);
  if (item.poster) {
    const posterUrl = new URL(item.poster, 'https://mes-store.invalid/');
    assert.equal(posterUrl.origin, 'https://mes-store.invalid', 'Poster must be same-origin');
    const posterPath = resolveRepositoryAsset(posterUrl, 'Poster');
    if (item.enabled !== false) assert.ok(existsSync(posterPath), 'Enabled motion poster is missing: ' + item.poster);
  }
}
console.log('PowerPoint motion embed verification: OK (' + config.items.length + ' configured entries)');
