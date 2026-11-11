import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CartStatus, Prisma, ProductStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationOutboxService } from '../notifications/notification-outbox.service';
import { CheckoutDto } from './orders.dto';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationOutboxService,
  ) {}

  async checkout(sessionId: string, idempotencyKey: string, input: CheckoutDto, userId?: string) {
    if (!/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) {
      throw new BadRequestException('A valid Idempotency-Key header (8-128 safe characters) is required');
    }

    try {
      const outcome = await this.prisma.$transaction(async (tx) => {
        const previousOrder = await tx.order.findUnique({
          where: {
            checkoutSessionId_idempotencyKey: {
              checkoutSessionId: sessionId,
              idempotencyKey,
            },
          },
          include: { items: true, payments: true },
        });
        if (previousOrder) return { order: previousOrder, created: false };

        const cart = await tx.cart.findUnique({
          where: { sessionId },
          include: { items: { include: { product: true }, orderBy: { createdAt: 'asc' } } },
        });
        if (!cart || cart.status !== CartStatus.ACTIVE) {
          throw new NotFoundException('Active cart not found');
        }
        if (cart.items.length === 0) {
          throw new BadRequestException('Cannot checkout an empty cart');
        }

        let subtotal = new Prisma.Decimal(0);
        const orderItems: Array<{
          productId: string;
          productName: string;
          sku: string;
          quantity: number;
          unitPrice: Prisma.Decimal;
          lineTotal: Prisma.Decimal;
        }> = [];

        for (const item of cart.items) {
          const product = item.product;
          if (product.status !== ProductStatus.ACTIVE) {
            throw new BadRequestException(`Product "${product.name}" is no longer available`);
          }

          if (product.stockQuantity !== null) {
            const reserved = await tx.product.updateMany({
              where: {
                id: product.id,
                status: ProductStatus.ACTIVE,
                stockQuantity: { gte: item.quantity },
              },
              data: { stockQuantity: { decrement: item.quantity } },
            });
            if (reserved.count !== 1) {
              throw new BadRequestException(`Insufficient stock for "${product.name}"`);
            }
          }

          const unitPrice = new Prisma.Decimal(product.price);
          const lineTotal = unitPrice.mul(item.quantity);
          subtotal = subtotal.add(lineTotal);
          orderItems.push({
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            quantity: item.quantity,
            unitPrice,
            lineTotal,
          });
        }

        // Fixed demo rates are server-calculated and clearly labelled as simulations.
        const shippingMethod = input.shippingMethod ?? 'DEMO_STANDARD';
        const shippingFees: Record<string, number> = { DEMO_STANDARD: 45, DEMO_EXPRESS: 75, DEMO_PICKUP: 0 };
        const shippingTotal = new Prisma.Decimal(shippingFees[shippingMethod] ?? 45);
        let promotion: { id: string; code: string; type: 'PERCENTAGE' | 'FIXED'; value: Prisma.Decimal; minSubtotal: Prisma.Decimal; maxDiscount: Prisma.Decimal | null; usageCount: number; usageLimit: number | null; startsAt: Date | null; expiresAt: Date | null; isActive: boolean } | null = null;
        let discountTotal = new Prisma.Decimal(0);
        const promotionCode = input.promotionCode?.trim().toUpperCase();
        if (promotionCode) {
          promotion = await tx.promotion.findUnique({ where: { code: promotionCode } });
          const now = new Date();
          if (!promotion || !promotion.isActive
            || (promotion.startsAt && promotion.startsAt > now)
            || (promotion.expiresAt && promotion.expiresAt <= now)
            || subtotal.lessThan(promotion.minSubtotal)
            || (promotion.usageLimit !== null && promotion.usageCount >= promotion.usageLimit)) {
            throw new BadRequestException('Promotion code is invalid, inactive, expired, or not eligible for this cart');
          }
          discountTotal = promotion.type === 'PERCENTAGE'
            ? subtotal.mul(promotion.value).div(100).toDecimalPlaces(2)
            : new Prisma.Decimal(promotion.value);
          if (promotion.maxDiscount && discountTotal.greaterThan(promotion.maxDiscount)) {
            discountTotal = new Prisma.Decimal(promotion.maxDiscount);
          }
          if (discountTotal.greaterThan(subtotal)) discountTotal = subtotal;
        }
        const grandTotal = subtotal.add(shippingTotal).sub(discountTotal);
        const orderNumber = `MES-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;

        const order = await tx.order.create({
          data: {
            orderNumber,
            checkoutSessionId: sessionId,
            idempotencyKey,
            userId,
            status: 'PENDING',
            subtotal,
            discountTotal,
            shippingTotal,
            grandTotal,
            currency: 'EGP',
            paymentMethod: input.paymentMethod ?? 'CASH_ON_DELIVERY',
            shippingMethod,
            customerName: input.recipient,
            customerEmail: input.email,
            customerPhone: input.phone,
            shippingAddress: {
              recipient: input.recipient,
              phone: input.phone,
              country: 'Egypt',
              city: input.city,
              area: input.area ?? null,
              street: input.street,
              building: input.building ?? null,
              apartment: input.apartment ?? null,
            },
            notes: input.notes,
            items: { create: orderItems },
            payments: {
              create: {
                provider: (input.paymentMethod ?? 'CASH_ON_DELIVERY') === 'CASH_ON_DELIVERY' ? 'cash_on_delivery' : 'demo_gateway',
                status: 'PENDING',
                amount: grandTotal,
                currency: 'EGP',
              },
            },
          },
          include: { items: true, payments: true },
        });

        if (promotion) {
          const claimed = await tx.promotion.updateMany({
            where: {
              id: promotion.id,
              isActive: true,
              usageCount: promotion.usageCount,
            },
            data: { usageCount: { increment: 1 } },
          });
          if (claimed.count !== 1) {
            throw new BadRequestException('Promotion usage changed concurrently; retry checkout');
          }
          await tx.promotionRedemption.create({
            data: { promotionId: promotion.id, orderId: order.id, discountAmount: discountTotal },
          });
        }

        // Order + WhatsApp + email outbox rows commit or roll back together.
        await this.notifications.enqueueOrderCreated(tx, order);

        await tx.cart.update({
          where: { id: cart.id },
          data: { status: CartStatus.CONVERTED, ...(userId ? { userId } : {}) },
        });

        return { order, created: true };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return {
        ...outcome.order,
        storeNotification: {
          sent: false,
          queued: outcome.created,
          reason: outcome.created ? 'queued' : 'duplicate_checkout',
        },
      };
    } catch (error) {
      // A concurrent retry can win the unique-key race. Return its committed order.
      if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code)) {
        const existing = await this.prisma.order.findUnique({
          where: {
            checkoutSessionId_idempotencyKey: {
              checkoutSessionId: sessionId,
              idempotencyKey,
            },
          },
          include: { items: true, payments: true },
        });
        if (existing) return { ...existing, storeNotification: { sent: false, queued: false, reason: 'duplicate_checkout' } };
      }
      throw error;
    }
  }
}
