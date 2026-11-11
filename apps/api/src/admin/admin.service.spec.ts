import { BadRequestException } from '@nestjs/common';
import { OrderStatus, PaymentStatus } from '@prisma/client';
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


describe('AdminService payment reconciliation', () => {
  it('flags amount, currency, paid-order and provider-reference inconsistencies without writes', async () => {
    const payment = {
      id: 'pay-1',
      provider: 'gateway-x',
      providerReference: null,
      status: PaymentStatus.PAID,
      amount: { comparedTo: jest.fn().mockReturnValue(1), toString: () => '120.00' },
      currency: 'USD',
      paidAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      order: {
        id: 'order-1', orderNumber: 'MES-1', status: OrderStatus.PENDING,
        grandTotal: { toString: () => '100.00' }, currency: 'EGP', paymentMethod: 'DEMO_CARD',
      },
    };
    const prisma = {
      payment: {
        findMany: jest.fn().mockReturnValue('findMany-promise'),
        count: jest.fn().mockReturnValue('count-promise'),
      },
      $transaction: jest.fn().mockResolvedValue([[payment], 1]),
    };
    const service = new AdminService(prisma as never);

    const result = await service.reconcilePayments(1, 25, 'gateway-x');

    expect(result.mode).toBe('READ_ONLY');
    expect(result.automatedCorrections).toBe(false);
    expect(result.pageSummary.reviewRequired).toBe(1);
    expect(result.rows[0].issues).toEqual(expect.arrayContaining([
      'AMOUNT_MISMATCH',
      'CURRENCY_MISMATCH',
      'PAID_ORDER_PENDING',
      'PAID_PAYMENT_MISSING_PROVIDER_REFERENCE',
    ]));
    expect(prisma.payment.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { provider: 'gateway-x' },
      skip: 0,
      take: 25,
    }));
    expect(prisma.payment.count).toHaveBeenCalledWith({ where: { provider: 'gateway-x' } });
  });

  it('reports consistent payment and order records', async () => {
    const payment = {
      id: 'pay-2', provider: 'gateway-y', providerReference: 'ref-2', status: PaymentStatus.PAID,
      amount: { comparedTo: jest.fn().mockReturnValue(0), toString: () => '100.00' },
      currency: 'EGP', paidAt: new Date(),
      order: {
        id: 'order-2', orderNumber: 'MES-2', status: OrderStatus.CONFIRMED,
        grandTotal: { toString: () => '100.00' }, currency: 'EGP', paymentMethod: 'DEMO_CARD',
      },
    };
    const prisma = {
      payment: { findMany: jest.fn(), count: jest.fn() },
      $transaction: jest.fn().mockResolvedValue([[payment], 1]),
    };
    const service = new AdminService(prisma as never);
    const result = await service.reconcilePayments();

    expect(result.pageSummary.consistent).toBe(1);
    expect(result.rows[0].reconciliationStatus).toBe('CONSISTENT');
    expect(result.rows[0].issues).toEqual([]);
  });
});
