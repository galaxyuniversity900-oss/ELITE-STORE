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
      inventoryReservation: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
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

  it('releases active reservations exactly once when an order is cancelled', async () => {
    const order = { id: 'o3', status: OrderStatus.PROCESSING, items: [{ productId: 'p3', quantity: 2 }] };
    const reservation = { id: 'r3', productId: 'p3', quantity: 2 };
    const tx = {
      order: {
        findUnique: jest.fn().mockResolvedValue(order),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn(),
      },
      inventoryReservation: {
        findMany: jest.fn().mockResolvedValue([reservation]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      product: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      orderStatusEvent: { create: jest.fn().mockResolvedValue({ id: 'event-3' }) },
    };
    const prisma = { $transaction: jest.fn((work: (client: unknown) => unknown) => work(tx)) };
    const service = new AdminService(prisma as never);

    await service.updateOrderStatus('o3', OrderStatus.CANCELLED, 'admin-9');

    expect(tx.product.updateMany).toHaveBeenCalledWith({
      where: { id: 'p3', stockQuantity: { not: null } },
      data: { stockQuantity: { increment: 2 } },
    });
    expect(tx.inventoryReservation.updateMany).toHaveBeenCalledWith({
      where: { orderId: 'o3', status: 'ACTIVE' },
      data: expect.objectContaining({ status: 'RELEASED', releasedAt: expect.any(Date) }),
    });
  });
});
