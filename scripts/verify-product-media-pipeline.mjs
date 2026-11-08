import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { optimizeProductImage } from './product-media-pipeline.mjs';

const directory = await mkdtemp(path.join(os.tmpdir(), 'mes-media-pipeline-'));
try {
  const source = path.join(directory, 'fixture.svg');
  const output = path.join(directory, 'optimized');
  await writeFile(source, '<svg width="120" height="160" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="160" fill="#222"/></svg>');
  const variants = await optimizeProductImage(source, 'fixture', output);
  assert.equal(variants.length, 6);
  assert.deepEqual(new Set(variants.map((variant) => variant.format)), new Set(['webp', 'avif']));
  assert.ok(variants.every((variant) => variant.width <= 120 && variant.height > 0 && variant.bytes > 0));
  assert.equal((await readdir(output)).length, 6);
  for (const variant of variants) {
    const metadata = await sharp(path.join(output, variant.filename)).metadata();
    assert.equal(metadata.format, variant.format);
    assert.equal(metadata.width, variant.width);
  }
  console.log('Product media pipeline verification: PASS (responsive WebP/AVIF variants, content hashes)');
} finally {
  await rm(directory, { recursive: true, force: true });
}
