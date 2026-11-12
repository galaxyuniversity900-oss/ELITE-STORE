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

describe('AdminService commerce insights', () => {
  it('returns aggregated order and product metrics without customer identifiers', async () => {
    const prisma = {
      order: {
        count: jest.fn().mockReturnValue('orders-query'),
        groupBy: jest.fn().mockReturnValue('revenue-query'),
      },
      orderItem: { groupBy: jest.fn().mockReturnValue('products-query') },
      $transaction: jest.fn().mockResolvedValue([
        12,
        [{ status: OrderStatus.CONFIRMED, currency: 'EGP', _count: { _all: 10 }, _sum: { grandTotal: { toString: () => '15000.00' } } }],
        [{ sku: 'JKT-1', productName: 'Jacket', _sum: { quantity: 7, lineTotal: { toString: () => '8750.00' } } }],
      ]),
    };
    const service = new AdminService(prisma as never);

    const result = await service.commerceInsights('2026-10-01', '2026-10-31');

    expect(result.orderCount).toBe(12);
    expect(result.revenueByStatusAndCurrency[0].grossOrderValue).toBe('15000.00');
    expect(result.topProducts[0].units).toBe(7);
    expect(result.privacy).toBe('AGGREGATED_NO_CUSTOMER_IDENTIFIERS');
    expect(prisma.orderItem.groupBy).toHaveBeenCalledWith(expect.objectContaining({
      by: ['sku', 'productName'],
      orderBy: { _sum: { lineTotal: 'desc' } },
      take: 10,
    }));
  });

  it('rejects invalid or excessively long analytics ranges', async () => {
    const prisma = { $transaction: jest.fn() };
    const service = new AdminService(prisma as never);

    await expect(service.commerceInsights('not-a-date', '2026-10-31'))
      .rejects.toBeInstanceOf(BadRequestException);
    await expect(service.commerceInsights('2024-01-01', '2026-10-31'))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
});
