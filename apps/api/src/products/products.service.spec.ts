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
