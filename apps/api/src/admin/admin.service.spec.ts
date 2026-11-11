import { BadRequestException } from '@nestjs/common';
import { OrderStatus, ProductRelationType } from '@prisma/client';
import { AdminService } from './admin.service';

describe('AdminService order lifecycle', () => {
  it('rejects an invalid transition before changing the order', async () => {
    const tx = { order: { findUnique: jest.fn().mockResolvedValue({ id: 'o1', status: OrderStatus.PENDING, items: [] }), updateMany: jest.fn() } };
    const prisma = { $transaction: jest.fn((work: (client: unknown) => unknown) => work(tx)) };
    const service = new AdminService(prisma as never);
    await expect(service.updateOrderStatus('o1', OrderStatus.SHIPPED)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.order.updateMany).not.toHaveBeenCalled();
  });

  it('blocks refund status until a payment-provider workflow exists', async () => {
    const service = new AdminService({} as never);
    await expect(service.updateOrderStatus('o1', OrderStatus.REFUNDED)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('AdminService product variants', () => {
  it('creates a normalized variant with independent stock and price override', async () => {
    const variant = { id: 'variant-1', sku: 'JKT-BLK-M', stockQuantity: 4 };
    const prisma = { productVariant: { create: jest.fn().mockResolvedValue(variant) } };
    const service = new AdminService(prisma as never);

    const result = await service.createProductVariant('product-1', {
      sku: ' JKT-BLK-M ', size: ' M ', color: ' Black ', stockQuantity: 4, priceOverride: 1250,
      attributes: { fit: 'regular' },
    });

    expect(result).toEqual(variant);
    expect(prisma.productVariant.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productId: 'product-1', sku: 'JKT-BLK-M', size: 'M', color: 'Black',
        stockQuantity: 4, isActive: true,
      }),
    });
  });

  it('archives a variant without deleting its historical identity', async () => {
    const prisma = { productVariant: { update: jest.fn().mockResolvedValue({ id: 'variant-2', isActive: false }) } };
    const service = new AdminService(prisma as never);

    await service.archiveProductVariant('variant-2');

    expect(prisma.productVariant.update).toHaveBeenCalledWith({
      where: { id: 'variant-2' }, data: { isActive: false },
    });
  });

describe('AdminService size guides', () => {
  it('creates a category size guide with structured measurements', async () => {
    const guide = { id: 'size-guide-1', categoryId: 'category-1', name: 'Mens tops' };
    const prisma = { sizeGuide: { create: jest.fn().mockResolvedValue(guide) } };
    const service = new AdminService(prisma as never);

    const result = await service.createSizeGuide('category-1', {
      name: ' Mens tops ', measurements: { M: { chest: 102, length: 70 } },
    });

    expect(result).toEqual(guide);
    expect(prisma.sizeGuide.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        categoryId: 'category-1', name: 'Mens tops', measurementUnit: 'cm', isActive: true,
      }),
    });
  });

  it('archives a size guide without deleting the guide record', async () => {
    const prisma = { sizeGuide: { update: jest.fn().mockResolvedValue({ id: 'size-guide-2', isActive: false }) } };
    const service = new AdminService(prisma as never);

    await service.archiveSizeGuide('size-guide-2');

    expect(prisma.sizeGuide.update).toHaveBeenCalledWith({
      where: { id: 'size-guide-2' }, data: { isActive: false },
    });
  });
});

describe('AdminService curated product relations', () => {
  it('rejects self-referencing product relations', async () => {
    const service = new AdminService({} as never);
    await expect(service.createProductRelation('product-1', {
      relatedProductId: 'product-1',
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates a complete-the-look relation only between active products', async () => {
    const relation = { id: 'relation-1', sourceProductId: 'product-1', relatedProductId: 'product-2' };
    const prisma = {
      product: { count: jest.fn().mockResolvedValue(2) },
      productRelation: { create: jest.fn().mockResolvedValue(relation) },
    };
    const service = new AdminService(prisma as never);

    const result = await service.createProductRelation('product-1', { relatedProductId: 'product-2' });

    expect(result).toEqual(relation);
    expect(prisma.productRelation.create).toHaveBeenCalledWith(expect.objectContaining({
      data: {
        sourceProductId: 'product-1',
        relatedProductId: 'product-2',
        relationType: ProductRelationType.COMPLETE_THE_LOOK,
        sortOrder: 0,
      },
    }));
  });
});
});
