import { ProductsService } from './products.service';

describe('ProductsService', () => {
  it('returns an empty paginated result when the catalogue is empty', async () => {
    const prisma = {
      product: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
    };
    const service = new ProductsService(prisma as never);
    await expect(service.list(1, 24)).resolves.toEqual({
      items: [],
      pagination: { page: 1, limit: 24, total: 0, pages: 0 },
    });
    expect(prisma.product.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.product.count).toHaveBeenCalledTimes(1);
  });
});


describe('ProductsService search and filtering', () => {
  it('combines active status, category and bounded case-insensitive text search', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const prisma = { product: { findMany, count }, $transaction: jest.fn((queries) => Promise.all(queries)) };
    const service = new ProductsService(prisma as never);
    await service.list(2, 12, 'jackets', '  Leather  ');
    const where = findMany.mock.calls[0][0].where;
    expect(where.status).toBe('ACTIVE');
    expect(where.category).toEqual({ slug: 'jackets' });
    expect(where.OR).toEqual([
      { name: { contains: 'Leather', mode: 'insensitive' } },
      { sku: { contains: 'Leather', mode: 'insensitive' } },
      { description: { contains: 'Leather', mode: 'insensitive' } },
    ]);
    expect(findMany.mock.calls[0][0].skip).toBe(12);
    expect(findMany.mock.calls[0][0].take).toBe(12);
  });

  it('supports allowlisted price sorting', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const prisma = { product: { findMany, count }, $transaction: jest.fn((queries) => Promise.all(queries)) };
    const service = new ProductsService(prisma as never);
    await service.list(1, 24, undefined, undefined, 'price_asc');
    expect(findMany.mock.calls[0][0].orderBy).toEqual({ price: 'asc' });
  });

  it('bounds the search term to 100 characters', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const prisma = { product: { findMany, count }, $transaction: jest.fn((queries) => Promise.all(queries)) };
    const service = new ProductsService(prisma as never);
    await service.list(1, 24, undefined, 'x'.repeat(200));
    expect(findMany.mock.calls[0][0].where.OR[0].name.contains).toHaveLength(100);
  });
});
