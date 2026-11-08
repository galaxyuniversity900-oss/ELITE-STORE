import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const widths = [480, 960, 1440];
const formats = [
  { name: 'webp', quality: 82 },
  { name: 'avif', quality: 55 },
];

export async function optimizeProductImage(sourcePath, productId, outputDir) {
  assert.match(productId, /^[a-zA-Z0-9_-]{1,80}$/, 'Invalid product identifier');
  const source = await readFile(sourcePath);
  const variants = [];
  for (const width of widths) {
    for (const format of formats) {
      const { data, info } = await sharp(source)
        .rotate()
        .resize({ width, withoutEnlargement: true })
        [format.name]({ quality: format.quality })
        .toBuffer({ resolveWithObject: true });
      const digest = createHash('sha256').update(data).digest('hex');
      const filename = productId + '-' + width + '-' + digest.slice(0, 12) + '.' + format.name;
      await mkdir(outputDir, { recursive: true });
      await writeFile(path.join(outputDir, filename), data, { flag: 'wx' }).catch(async (error) => {
        if (error.code !== 'EEXIST') throw error;
      });
      variants.push({
        filename,
        format: format.name,
        width: info.width,
        height: info.height,
        bytes: data.length,
        sha256: digest,
      });
    }
  }
  return variants;
}

async function main() {
  if (!process.argv.includes('--build')) {
    console.log('Product media pipeline is ready. Run with --build after approved source photos are added to assets/products/originals using productId__angle.ext naming.');
    return;
  }

  const catalogPath = path.resolve('data/products.json');
  const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
  const originalsDir = path.resolve('assets/products/originals');
  const optimizedDir = path.resolve('assets/products/optimized');
  const webPublicDir = path.resolve('apps/web/public/media/products');
  const files = (await readdir(originalsDir).catch(() => []))
    .filter((file) => /\.(jpe?g|png|webp|tiff|avif)$/i.test(file))
    .sort();

  if (!files.length) {
    const message = 'No approved product source images found; no catalog entries were changed.';
    if (process.env.REQUIRE_PRODUCT_MEDIA === 'true') throw new Error(message);
    console.warn(message);
    return;
  }

  const byId = new Map(catalog.products.map((product) => [product.id, product]));
  const manifest = [];
  for (const file of files) {
    const productId = file.split('__')[0];
    const product = byId.get(productId);
    if (!product || product.active !== true) throw new Error('Media source does not map to an active catalog product: ' + file);
    const sourcePath = path.join(originalsDir, file);
    const variants = await optimizeProductImage(sourcePath, productId, optimizedDir);
    for (const variant of variants) {
      await mkdir(webPublicDir, { recursive: true });
      await copyFile(path.join(optimizedDir, variant.filename), path.join(webPublicDir, variant.filename));
    }
    const webp = variants.filter((variant) => variant.format === 'webp').sort((a, b) => a.width - b.width);
    product.media ??= { cover: '', images: [], videos: [] };
    product.media.cover = 'assets/products/optimized/' + (webp.find((variant) => variant.width >= 960) ?? webp[webp.length - 1]).filename;
    product.media.images = webp.map((variant) => 'assets/products/optimized/' + variant.filename);
    manifest.push({
      productId,
      source: file,
      variants: variants.map((variant) => ({
        ...variant,
        storefrontPath: 'assets/products/optimized/' + variant.filename,
        webPath: '/media/products/' + variant.filename,
      })),
    });
  }

  await writeFile(catalogPath, JSON.stringify(catalog, null, 2) + '\n');
  await mkdir(path.dirname(path.resolve('data/product-media-manifest.json')), { recursive: true });
  await writeFile('data/product-media-manifest.json', JSON.stringify({ version: 1, manifest }, null, 2) + '\n');
  await mkdir(webPublicDir, { recursive: true });
  await writeFile(path.join(webPublicDir, 'manifest.json'), JSON.stringify({ version: 1, manifest }, null, 2) + '\n');
  console.log('Optimized ' + files.length + ' source images for ' + new Set(manifest.map((item) => item.productId)).size + ' products.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  await main();
}
