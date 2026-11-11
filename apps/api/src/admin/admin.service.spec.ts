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

  it('records a status event with the authenticated admin actor', async () => {
    const order = { id: 'o2', status: OrderStatus.PENDING, items: [] };
    const tx = {
      order: {
        findUnique: jest.fn().mockResolvedValue(order),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      orderStatusEvent: { create: jest.fn().mockResolvedValue({ id: 'event-1' }) },
    };
    const prisma = { $transaction: jest.fn((work: (client: unknown) => unknown) => work(tx)) };
    const service = new AdminService(prisma as never);

    await service.updateOrderStatus('o2', OrderStatus.CONFIRMED, 'admin-7');

    expect(tx.order.updateMany).toHaveBeenCalledWith({
      where: { id: 'o2', status: OrderStatus.PENDING },
      data: { status: OrderStatus.CONFIRMED },
    });
    expect(tx.orderStatusEvent.create).toHaveBeenCalledWith({
      data: {
        orderId: 'o2',
        fromStatus: OrderStatus.PENDING,
        toStatus: OrderStatus.CONFIRMED,
        actorId: 'admin-7',
      },
    });
  });
});
