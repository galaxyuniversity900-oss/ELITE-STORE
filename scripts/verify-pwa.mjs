import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const manifest = JSON.parse(await readFile(new URL('../manifest.webmanifest', import.meta.url), 'utf8'));
const serviceWorker = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../ELITE.html', import.meta.url), 'utf8');
const registration = await readFile(new URL('../assets/js/pwa-register.js', import.meta.url), 'utf8');

assert.equal(manifest.start_url, './ELITE.html');
assert.equal(manifest.scope, './');
assert.ok(manifest.icons.some((icon) => icon.src === './assets/pwa-icon.svg'));
assert.match(html, /rel="manifest" href="\.\/manifest\.webmanifest"/);
assert.match(html, /pwa-register\.js/);
assert.match(registration, /navigator\.serviceWorker\.register/);
assert.match(serviceWorker, /request\.method !== 'GET'/);
assert.match(serviceWorker, /\/api\//);
assert.match(serviceWorker, /request\.mode === 'navigate'/);
assert.match(serviceWorker, /offline\.html/);

process.stdout.write('PWA verification passed: manifest, registration, navigation fallback and API cache exclusions.\n');
