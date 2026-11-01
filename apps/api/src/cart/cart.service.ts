import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CartStatus, ProductStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async get(sessionId: string) {
    const cart = await this.prisma.cart.findUnique({
      where: { sessionId },
      include: {
        items: {
          include: { product: { include: { images: { orderBy: { sortOrder: 'asc' } } } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!cart || cart.status !== CartStatus.ACTIVE) {
      return { sessionId, status: CartStatus.ACTIVE, items: [] };
    }
    return cart;
  }

  async addItem(sessionId: string, productId: string, quantity: number) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, status: ProductStatus.ACTIVE },
    });
    if (!product) throw new NotFoundException('Product not found');
    const cart = await this.prisma.cart.upsert({
      where: { sessionId },
      update: { status: CartStatus.ACTIVE },
      create: { sessionId, status: CartStatus.ACTIVE },
    });
    const existing = await this.prisma.cartItem.findUnique({
      where: { cartId_productId: { cartId: cart.id, productId } },
    });
    const nextQuantity = (existing?.quantity ?? 0) + quantity;
    if (nextQuantity > product.stockQuantity) {
      throw new BadRequestException('Requested quantity exceeds available stock');
    }
    if (existing) {
      await this.prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: nextQuantity, unitPrice: product.price },
      });
    } else {
      await this.prisma.cartItem.create({
        data: { cartId: cart.id, productId, quantity, unitPrice: product.price },
      });
    }
    return this.get(sessionId);
  }

  async updateQuantity(sessionId: string, itemId: string, quantity: number) {
    const cart = await this.prisma.cart.findUnique({ where: { sessionId } });
    if (!cart || cart.status !== CartStatus.ACTIVE) throw new NotFoundException('Cart not found');
    const item = await this.prisma.cartItem.findFirst({
      where: { id: itemId, cartId: cart.id },
      include: { product: true },
    });
    if (!item) throw new NotFoundException('Cart item not found');
    if (quantity > item.product.stockQuantity) {
      throw new BadRequestException('Requested quantity exceeds available stock');
    }
    await this.prisma.cartItem.update({ where: { id: itemId }, data: { quantity } });
    return this.get(sessionId);
  }

  async removeItem(sessionId: string, itemId: string) {
    const cart = await this.prisma.cart.findUnique({ where: { sessionId } });
    if (!cart || cart.status !== CartStatus.ACTIVE) throw new NotFoundException('Cart not found');
    const result = await this.prisma.cartItem.deleteMany({ where: { id: itemId, cartId: cart.id } });
    if (!result.count) throw new NotFoundException('Cart item not found');
    return this.get(sessionId);
  }
}
