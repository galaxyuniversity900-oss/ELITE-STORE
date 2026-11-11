import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CartStatus, Prisma, ProductStatus } from '@prisma/client';
import { CheckoutDto } from './orders.dto';
import { OrdersService } from './orders.service';

const input: CheckoutDto = {
  recipient: 'Test Customer',
  phone: '+201000000000',
  city: 'Cairo',
  street: 'Test Street 1',
};

describe('OrdersService', () => {
  let notifications: { enqueueOrderCreated: jest.Mock };

  beforeEach(() => {
    notifications = { enqueueOrderCreated: jest.fn().mockResolvedValue({ count: 2 }) };
  });

  it('rejects checkout when no active cart exists', async () => {
    const tx = {
      order: { findUnique: jest.fn().mockResolvedValue(null) },
      cart: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const prisma = { $transaction: jest.fn((work: (client: unknown) => unknown) => work(tx)) };
    const service = new OrdersService(prisma as never, notifications as never);

    await expect(service.checkout('session-id', 'checkout-test-0001', input)).rejects.toBeInstanceOf(NotFoundException);
    expect(notifications.enqueueOrderCreated).not.toHaveBeenCalled();
  });

  it('rejects checkout for an empty cart', async () => {
    const tx = {
      order: { findUnique: jest.fn().mockResolvedValue(null) },
      cart: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'cart-1',
          status: CartStatus.ACTIVE,
          items: [],
        }),
      },
    };
    const prisma = { $transaction: jest.fn((work: (client: unknown) => unknown) => work(tx)) };
    const service = new OrdersService(prisma as never, notifications as never);

    await expect(service.checkout('session-id', 'checkout-test-0001', input)).rejects.toBeInstanceOf(BadRequestException);
    expect(notifications.enqueueOrderCreated).not.toHaveBeenCalled();
  });

  it('creates the order and enqueues notifications inside the same transaction', async () => {
    const tx = {
      cart: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'cart-1',
          status: CartStatus.ACTIVE,
          items: [{
            productId: 'product-1',
            quantity: 2,
            product: {
              id: 'product-1',
              name: 'Classic Shirt',
              sku: 'SHIRT-001',
              status: ProductStatus.ACTIVE,
              stockQuantity: 5,
              price: new Prisma.Decimal('100.00'),
            },
          }],
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      product: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      order: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({
          id: 'order-1',
          orderNumber: data.orderNumber,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          grandTotal: data.grandTotal,
          currency: data.currency,
          shippingAddress: data.shippingAddress,
          items: data.items.create,
          payments: data.payments.create,
        })),
      },
    };
    const prisma = {
      $transaction: jest.fn((work: (client: unknown) => unknown) => work(tx)),
    };
    const service = new OrdersService(prisma as never, notifications as never);

    const result = await service.checkout('session-id', 'checkout-test-0001', input);

    expect(result.id).toBe('order-1');
    expect(result.storeNotification).toEqual({ sent: false, queued: true, reason: 'queued' });
    expect(tx.product.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'product-1', stockQuantity: { gte: 2 } }),
      data: { stockQuantity: { decrement: 2 } },
    }));
    const orderData = tx.order.create.mock.calls[0][0].data;
    expect(orderData.checkoutSessionId).toBe('session-id');
    expect(orderData.idempotencyKey).toBe('checkout-test-0001');
    expect(orderData.subtotal.toString()).toBe('200');
    expect(orderData.shippingTotal.toString()).toBe('45');
    expect(orderData.grandTotal.toString()).toBe('245');
    expect(orderData.payments.create.provider).toBe('cash_on_delivery');
    expect(notifications.enqueueOrderCreated).toHaveBeenCalledTimes(1);
    expect(notifications.enqueueOrderCreated).toHaveBeenCalledWith(tx, expect.objectContaining({
      id: 'order-1',
      orderNumber: expect.any(String),
    }));
    expect(tx.cart.update).toHaveBeenCalledWith({
      where: { id: 'cart-1' },
      data: { status: CartStatus.CONVERTED },
    });
  });

  it('reuses the order when checkout is retried with the same key and does not enqueue again', async () => {
    const previous = { id: 'order-existing', items: [], payments: [] };
    const tx = { order: { findUnique: jest.fn().mockResolvedValue(previous) } };
    const prisma = { $transaction: jest.fn((work: (client: unknown) => unknown) => work(tx)) };
    const service = new OrdersService(prisma as never, notifications as never);

    await expect(service.checkout('session-id', 'retry-test-0001', input)).resolves.toEqual({
      ...previous,
      storeNotification: { sent: false, queued: false, reason: 'duplicate_checkout' },
    });
    expect(tx.order.findUnique).toHaveBeenCalledTimes(1);
    expect(notifications.enqueueOrderCreated).not.toHaveBeenCalled();
  });

  it('applies a capped percentage promotion and redeems it atomically with checkout', async () => {
    const promotion = {
      id: 'promo-1', code: 'SAVE10', type: 'PERCENTAGE',
      value: new Prisma.Decimal('10.00'), minSubtotal: new Prisma.Decimal('100.00'),
      maxDiscount: new Prisma.Decimal('15.00'), usageCount: 0, usageLimit: 10,
      startsAt: null, expiresAt: null, isActive: true,
    };
    const tx = {
      order: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({
          id: 'order-promo', orderNumber: data.orderNumber, items: data.items.create, payments: data.payments.create,
        })),
      },
      cart: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'cart-promo', status: CartStatus.ACTIVE,
          items: [{
            productId: 'product-promo', quantity: 2,
            product: {
              id: 'product-promo', name: 'Classic Shirt', sku: 'SHIRT-PROMO',
              status: ProductStatus.ACTIVE, stockQuantity: 5, price: new Prisma.Decimal('100.00'),
            },
          }],
        }),
        update: jest.fn(),
      },
      product: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      promotion: {
        findUnique: jest.fn().mockResolvedValue(promotion),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      promotionRedemption: { create: jest.fn().mockResolvedValue({ id: 'redemption-1' }) },
    };
    const prisma = { $transaction: jest.fn((work: (client: unknown) => unknown) => work(tx)) };
    const service = new OrdersService(prisma as never, notifications as never);

    await service.checkout('session-promo', 'promotion-test-0001', {
      ...input, promotionCode: ' save10 ',
    });

    const orderData = tx.order.create.mock.calls[0][0].data;
    expect(orderData.discountTotal.toString()).toBe('15');
    expect(orderData.grandTotal.toString()).toBe('230');
    expect(tx.promotion.updateMany).toHaveBeenCalledWith({
      where: { id: 'promo-1', isActive: true, usageCount: 0 },
      data: { usageCount: { increment: 1 } },
    });
    expect(tx.promotionRedemption.create).toHaveBeenCalledWith({
      data: { promotionId: 'promo-1', orderId: 'order-promo', discountAmount: expect.any(Prisma.Decimal) },
    });
  });

  it('rejects expired or exhausted promotion codes before creating an order', async () => {
    const promotion = {
      id: 'promo-expired', code: 'OLD', type: 'FIXED',
      value: new Prisma.Decimal('20'), minSubtotal: new Prisma.Decimal('0'),
      maxDiscount: null, usageCount: 5, usageLimit: 5,
      startsAt: null, expiresAt: null, isActive: true,
    };
    const tx = {
      order: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() },
      cart: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'cart-expired', status: CartStatus.ACTIVE,
          items: [{
            productId: 'product-expired', quantity: 1,
            product: {
              id: 'product-expired', name: 'Shirt', sku: 'SHIRT-OLD',
              status: ProductStatus.ACTIVE, stockQuantity: 5, price: new Prisma.Decimal('100'),
            },
          }],
        }),
      },
      product: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      promotion: { findUnique: jest.fn().mockResolvedValue(promotion) },
    };
    const prisma = { $transaction: jest.fn((work: (client: unknown) => unknown) => work(tx)) };
    const service = new OrdersService(prisma as never, notifications as never);

    await expect(service.checkout('session-old', 'promotion-test-0002', {
      ...input, promotionCode: 'OLD',
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.order.create).not.toHaveBeenCalled();
    expect(notifications.enqueueOrderCreated).not.toHaveBeenCalled();
  });
});
