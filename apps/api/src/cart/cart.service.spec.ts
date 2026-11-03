import { BadRequestException } from '@nestjs/common';
import { CartService } from './cart.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CartService quantity limits', () => {
  const sessionId = '11111111-1111-4111-8111-111111111111';
  const productId = 'product-1';

  function setup(existingQuantity: number) {
    const prisma = {
      product: {
        findFirst: jest.fn().mockResolvedValue({
          id: productId,
          status: 'ACTIVE',
          stockQuantity: 100,
          price: '125.00',
        }),
      },
      cart: {
        upsert: jest.fn().mockResolvedValue({
          id: 'cart-1',
          sessionId,
          status: 'ACTIVE',
        }),
        findUnique: jest.fn().mockResolvedValue({
          id: 'cart-1',
          sessionId,
          status: 'ACTIVE',
          items: [],
        }),
      },
      cartItem: {
        findUnique: jest.fn().mockResolvedValue(
          existingQuantity > 0 ? { id: 'item-1', quantity: existingQuantity } : null,
        ),
        update: jest.fn().mockResolvedValue({ id: 'item-1' }),
        create: jest.fn().mockResolvedValue({ id: 'item-1' }),
      },
    };
    return {
      service: new CartService(prisma as unknown as PrismaService),
      prisma,
    };
  }

  it('rejects an add that would push the combined line above 20 units', async () => {
    const { service, prisma } = setup(19);

    await expect(service.addItem(sessionId, productId, 2)).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.cartItem.update).not.toHaveBeenCalled();
    expect(prisma.cartItem.create).not.toHaveBeenCalled();
  });

  it('allows a combined line quantity of exactly 20 units', async () => {
    const { service, prisma } = setup(19);

    await expect(service.addItem(sessionId, productId, 1)).resolves.toMatchObject({
      sessionId,
      status: 'ACTIVE',
    });

    expect(prisma.cartItem.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: { quantity: 20, unitPrice: '125.00' },
    });
  });
});
