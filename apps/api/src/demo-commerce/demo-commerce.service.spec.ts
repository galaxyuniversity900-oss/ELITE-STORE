import { BadRequestException } from '@nestjs/common';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import { DemoCommerceService } from './demo-commerce.service';

describe('DemoCommerceService order lifecycle integration', () => {
  it('records demo payment confirmation in the same transaction as the payment update', async () => {
    const order = {
      id: 'order-1', orderNumber: 'MES-1', customerPhone: '01000000000',
      status: OrderStatus.PENDING, paymentMethod: 'DEMO_CARD', grandTotal: '100.00',
      currency: 'EGP', payments: [],
    };
    const tx = {
      order: {
        findUnique: jest.fn().mockResolvedValue(order),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      payment: { create: jest.fn().mockResolvedValue({ id: 'payment-1', amount: '100.00', currency: 'EGP' }) },
      orderStatusEvent: { create: jest.fn().mockResolvedValue({ id: 'event-1' }) },
    };
    const prisma = {
      order: { findUnique: jest.fn().mockResolvedValue(order) },
      $transaction: jest.fn((work: (client: unknown) => unknown) => work(tx)),
    };
    const service = new DemoCommerceService(prisma as never);

    const result = await service.simulatePayment('MES-1', { phone: '01000000000', outcome: 'success' });

    expect(result.demo).toBe(true);
    expect(tx.order.updateMany).toHaveBeenCalledWith({
      where: { id: 'order-1', status: OrderStatus.PENDING },
      data: { status: OrderStatus.CONFIRMED },
    });
    expect(tx.orderStatusEvent.create).toHaveBeenCalledWith({
      data: {
        orderId: 'order-1',
        fromStatus: OrderStatus.PENDING,
        toStatus: OrderStatus.CONFIRMED,
        reason: 'DEMO_PAYMENT_SIMULATION',
      },
    });
  });

  it('does not allow dispatch to skip the PROCESSING state', async () => {
    const order = {
      id: 'order-2', orderNumber: 'MES-2', customerPhone: '01000000000',
      status: OrderStatus.CONFIRMED, shippingMethod: 'DEMO_STANDARD', shipment: null,
    };
    const prisma = { order: { findUnique: jest.fn().mockResolvedValue(order) } };
    const service = new DemoCommerceService(prisma as never);

    await expect(service.dispatch('MES-2', '01000000000')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('records shipment delivery as a SHIPPED to DELIVERED order transition', async () => {
    const shipment = {
      id: 'shipment-1', orderId: 'order-3', status: 'OUT_FOR_DELIVERY',
      order: { customerPhone: '01000000000', status: OrderStatus.SHIPPED },
    };
    const tx = {
      shipment: { update: jest.fn().mockResolvedValue({ ...shipment, status: 'DELIVERED' }) },
      trackingEvent: { create: jest.fn().mockResolvedValue({ id: 'tracking-1' }) },
      order: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      orderStatusEvent: { create: jest.fn().mockResolvedValue({ id: 'event-2' }) },
    };
    const prisma = {
      shipment: { findUnique: jest.fn().mockResolvedValue(shipment) },
      $transaction: jest.fn((work: (client: unknown) => unknown) => work(tx)),
    };
    const service = new DemoCommerceService(prisma as never);

    await service.updateShipment('MES-TRK-1', {
      phone: '01000000000', status: 'DELIVERED', description: 'Delivered', location: 'Test location',
    });

    expect(tx.order.updateMany).toHaveBeenCalledWith({
      where: { id: 'order-3', status: OrderStatus.SHIPPED },
      data: { status: OrderStatus.DELIVERED },
    });
    expect(tx.orderStatusEvent.create).toHaveBeenCalledWith({
      data: {
        orderId: 'order-3',
        fromStatus: OrderStatus.SHIPPED,
        toStatus: OrderStatus.DELIVERED,
        reason: 'DEMO_SHIPMENT_DELIVERED',
      },
    });
  });
});
