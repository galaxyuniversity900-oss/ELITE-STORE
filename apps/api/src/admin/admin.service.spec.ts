import { BadRequestException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
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
});
