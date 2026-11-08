import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import axe from 'axe-core';

const port = 3100;
const origin = 'http://127.0.0.1:' + port;
const server = spawn('npm', ['run', 'start', '--workspace=@mes-store/web', '--', '--hostname', '127.0.0.1', '--port', String(port)], {
  stdio: 'ignore',
  env: { ...process.env, PORT: String(port) },
});
let browser;
const failures = [];
try {
  let ready = false;
  for (let attempt = 0; attempt < 45; attempt += 1) {
    if (server.exitCode !== null) throw new Error('Next.js web server exited before becoming ready');
    try {
      const response = await fetch(origin);
      if (response.ok) { ready = true; break; }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  assert.ok(ready, 'Next.js web server did not become ready within 45 seconds');
  browser = await chromium.launch({ headless: true });

  const routes = ['/', '/account', '/track'];
  const viewports = [
    { name: 'mobile-rtl', width: 390, height: 844 },
    { name: 'desktop-rtl', width: 1440, height: 960 },
  ];
  await mkdir('test-results/accessibility', { recursive: true });

  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
    for (const route of routes) {
      const response = await page.goto(origin + route, { waitUntil: 'domcontentloaded' });
      assert.ok(response && response.status() < 400, route + ' failed to load');
      const documentInfo = await page.evaluate(() => ({
        lang: document.documentElement.lang,
        dir: document.documentElement.dir,
        width: document.documentElement.scrollWidth,
        viewport: window.innerWidth,
      }));
      assert.equal(documentInfo.lang, 'ar', route + ' must declare Arabic document language');
      assert.equal(documentInfo.dir, 'rtl', route + ' must declare RTL document direction');
      if (viewport.name === 'mobile-rtl' && documentInfo.width > documentInfo.viewport + 2) {
        failures.push(route + ' has horizontal overflow at mobile width (' + documentInfo.width + ' > ' + documentInfo.viewport + ')');
      }

      await page.addScriptTag({ content: axe.source });
      const result = await page.evaluate(async () => window.axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
      }));
      for (const violation of result.violations) {
        const targets = violation.nodes.slice(0, 5).map((node) => node.target.join(' ')).join('; ');
        failures.push(viewport.name + ' ' + route + ': ' + violation.id + ' (' + violation.impact + ') ' + targets);
      }
      if (route === '/' && viewport.name === 'mobile-rtl') {
        await page.screenshot({ path: 'test-results/accessibility/mobile-rtl.png', fullPage: true });
      }
    }
    await page.close();
  }
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}

if (failures.length) {
  console.error('Accessibility/mobile RTL audit failed:');
  for (const failure of failures) console.error('- ' + failure);
  process.exit(1);
}
console.log('Accessibility and mobile RTL smoke audit: PASS (3 routes × 2 viewports)');
