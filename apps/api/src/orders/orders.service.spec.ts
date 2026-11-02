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
  it('rejects checkout when no active cart exists', async () => {
    const tx = { cart: { findUnique: jest.fn().mockResolvedValue(null) } };
    const prisma = { $transaction: jest.fn((work: (client: unknown) => unknown) => work(tx)) };
    const service = new OrdersService(prisma as never);

    await expect(service.checkout('session-id', 'checkout-test-0001', input)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects checkout for an empty cart', async () => {
    const tx = {
      cart: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'cart-1',
          status: CartStatus.ACTIVE,
          items: [],
        }),
      },
    };
    const prisma = { $transaction: jest.fn((work: (client: unknown) => unknown) => work(tx)) };
    const service = new OrdersService(prisma as never);

    await expect(service.checkout('session-id', 'checkout-test-0001', input)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates a COD order, reserves tracked stock and converts the cart atomically', async () => {
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
          items: data.items.create,
          payments: data.payments.create,
        })),
      },
    };
    const prisma = {
      $transaction: jest.fn((work: (client: unknown) => unknown) => work(tx)),
    };
    const service = new OrdersService(prisma as never);

    const result = await service.checkout('session-id', 'checkout-test-0001', input);

    expect(result.id).toBe('order-1');
    expect(tx.product.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'product-1', stockQuantity: { gte: 2 } }),
      data: { stockQuantity: { decrement: 2 } },
    }));
    const orderData = tx.order.create.mock.calls[0][0].data;
    expect(orderData.checkoutSessionId).toBe('session-id');
    expect(orderData.idempotencyKey).toBe('checkout-test-0001');
    expect(orderData.subtotal.toString()).toBe('200');
    expect(orderData.grandTotal.toString()).toBe('200');
    expect(orderData.payments.create.provider).toBe('cash_on_delivery');
    expect(tx.cart.update).toHaveBeenCalledWith({
      where: { id: 'cart-1' },
      data: { status: CartStatus.CONVERTED },
    });
  });
});
