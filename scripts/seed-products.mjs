import { PrismaClient, ProductStatus } from '@prisma/client';
import { readFile } from 'node:fs/promises';

const prisma = new PrismaClient();

function categorySlug(value) {
  return `category-${Buffer.from(String(value ?? 'general'), 'utf8').toString('hex')}`;
}

async function main() {
  const source = JSON.parse(await readFile(new URL('../data/products.json', import.meta.url), 'utf8'));
  const products = Array.isArray(source.products) ? source.products : [];
  let imported = 0;

  for (const item of products) {
    if (!item.id || !item.title || !Number.isFinite(Number(item.price))) continue;
    const categoryName = String(item.category || 'عام');
    const category = await prisma.category.upsert({
      where: { slug: categorySlug(categoryName) },
      update: { name: categoryName, isActive: true },
      create: { name: categoryName, slug: categorySlug(categoryName) },
    });

    const media = item.media ?? {};
    const imageUrls = [...new Set([
      ...(media.cover ? [media.cover] : []),
      ...(Array.isArray(media.images) ? media.images : []),
    ].filter((url) => typeof url === 'string' && url.length > 0))];

    const data = {
      sku: String(item.id).toUpperCase(),
      name: String(item.title),
      slug: String(item.id).toLowerCase(),
      description: item.desc ? String(item.desc) : null,
      price: String(Number(item.price)),
      stockQuantity: Number.isInteger(item.stockQuantity) && item.stockQuantity >= 0 ? item.stockQuantity : null,
      currency: source.currency || 'EGP',
      status: item.active === false ? ProductStatus.ARCHIVED : ProductStatus.ACTIVE,
      categoryId: category.id,
    };

    await prisma.product.upsert({
      where: { id: String(item.id) },
      create: {
        id: String(item.id),
        ...data,
        images: {
          create: imageUrls.map((url, index) => ({
            url,
            sortOrder: index,
            isPrimary: index === 0,
          })),
        },
      },
      update: {
        ...data,
        images: {
          deleteMany: {},
          create: imageUrls.map((url, index) => ({
            url,
            sortOrder: index,
            isPrimary: index === 0,
          })),
        },
      },
    });
    imported += 1;
  }

  console.log(`Imported or updated ${imported} products from data/products.json`);
}

main()
  .catch((error) => {
    console.error('Product seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
