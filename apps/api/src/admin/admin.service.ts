import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, PaymentStatus, Prisma, ProductStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto, UpdateProductDto } from './admin.dto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const [products, orders, pendingOrders, customers] = await this.prisma.$transaction([
      this.prisma.product.count({ where: { status: ProductStatus.ACTIVE } }),
      this.prisma.order.count(),
      this.prisma.order.count({ where: { status: OrderStatus.PENDING } }),
      this.prisma.user.count({ where: { role: UserRole.CUSTOMER } }),
    ]);
    return { products, orders, pendingOrders, customers };
  }

  listProducts(page = 1, limit = 50) {
    return this.prisma.product.findMany({
      include: { category: true, images: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  createProduct(input: CreateProductDto) {
    const data: Prisma.ProductUncheckedCreateInput = {
      name: input.name.trim(),
      sku: input.sku.trim(),
      slug: input.slug.trim().toLowerCase(),
      description: input.description,
      price: new Prisma.Decimal(input.price),
      compareAtPrice: input.compareAtPrice === undefined ? undefined : new Prisma.Decimal(input.compareAtPrice),
      stockQuantity: input.stockQuantity,
      status: input.status ?? ProductStatus.DRAFT,
      categoryId: input.categoryId,
    };
    return this.prisma.product.create({ data, include: { category: true, images: true } });
  }

  async updateProduct(id: string, input: UpdateProductDto) {
    const data: Prisma.ProductUncheckedUpdateInput = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.sku !== undefined) data.sku = input.sku.trim();
    if (input.slug !== undefined) data.slug = input.slug.trim().toLowerCase();
    if (input.description !== undefined) data.description = input.description;
    if (input.price !== undefined) data.price = new Prisma.Decimal(input.price);
    if (input.compareAtPrice !== undefined) data.compareAtPrice = input.compareAtPrice === null ? null : new Prisma.Decimal(input.compareAtPrice);
    if (input.stockQuantity !== undefined) data.stockQuantity = input.stockQuantity;
    if (input.status !== undefined) data.status = input.status;
    if (input.categoryId !== undefined) data.categoryId = input.categoryId;
    try {
      return await this.prisma.product.update({ where: { id }, data, include: { category: true, images: true } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') throw new NotFoundException('Product not found');
      throw error;
    }
  }

  async archiveProduct(id: string) {
    return this.updateProduct(id, { status: ProductStatus.ARCHIVED });
  }


  async reconcilePayments(page = 1, limit = 50, provider?: string) {
    const where: Prisma.PaymentWhereInput = provider ? { provider } : {};
    const [payments, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        include: {
          order: { select: { id: true, orderNumber: true, status: true, grandTotal: true, currency: true, paymentMethod: true } },
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.payment.count({ where }),
    ]);

    const rows = payments.map((payment) => {
      const issues: string[] = [];
      if (payment.amount.comparedTo(payment.order.grandTotal) !== 0) issues.push('AMOUNT_MISMATCH');
      if (payment.currency !== payment.order.currency) issues.push('CURRENCY_MISMATCH');
      if (payment.status === PaymentStatus.PAID && payment.order.status === OrderStatus.PENDING) issues.push('PAID_ORDER_PENDING');
      if (payment.status === PaymentStatus.REFUNDED && payment.order.status !== OrderStatus.REFUNDED) issues.push('REFUND_ORDER_STATE_MISMATCH');
      if (payment.status === PaymentStatus.PAID && !payment.providerReference) issues.push('PAID_PAYMENT_MISSING_PROVIDER_REFERENCE');
      if (payment.order.paymentMethod === 'CASH_ON_DELIVERY' && payment.status === PaymentStatus.PAID) issues.push('COD_MARKED_PAID');
      return {
        paymentId: payment.id,
        provider: payment.provider,
        providerReference: payment.providerReference,
        paymentStatus: payment.status,
        amount: payment.amount.toString(),
        currency: payment.currency,
        paidAt: payment.paidAt,
        order: {
          id: payment.order.id,
          orderNumber: payment.order.orderNumber,
          status: payment.order.status,
          total: payment.order.grandTotal.toString(),
          currency: payment.order.currency,
          paymentMethod: payment.order.paymentMethod,
        },
        issues,
        reconciliationStatus: issues.length ? 'REVIEW_REQUIRED' : 'CONSISTENT',
      };
    });
    const pageSummary = {
      inspected: rows.length,
      consistent: rows.filter((row) => row.issues.length === 0).length,
      reviewRequired: rows.filter((row) => row.issues.length > 0).length,
    };
    return { mode: 'READ_ONLY', automatedCorrections: false, page, limit, total, pageSummary, rows };
  }

  listOrders(page = 1, limit = 50) {
    return this.prisma.order.findMany({
      include: { items: true, payments: true, statusEvents: { orderBy: { createdAt: 'desc' } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async updateOrderStatus(id: string, next: OrderStatus, actorId?: string) {
    if (next === OrderStatus.REFUNDED) throw new BadRequestException('Refunds require a verified payment-provider workflow');
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id }, include: { items: true } });
      if (!order) throw new NotFoundException('Order not found');
      if (order.status === next) return order;
      const transitions: Record<string, OrderStatus[]> = {
        PENDING: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
        CONFIRMED: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
        PROCESSING: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
        SHIPPED: [OrderStatus.DELIVERED],
        DELIVERED: [],
        CANCELLED: [],
        REFUNDED: [],
      };
      if (!transitions[order.status]?.includes(next)) {
        throw new BadRequestException(`Invalid order transition: ${order.status} -> ${next}`);
      }
      const changed = await tx.order.updateMany({ where: { id, status: order.status }, data: { status: next } });
      if (changed.count !== 1) throw new ConflictException('Order changed concurrently; reload and retry');
      if (next === OrderStatus.CANCELLED) {
        for (const item of order.items) {
          if (item.productId) {
            await tx.product.updateMany({
              where: { id: item.productId, stockQuantity: { not: null } },
              data: { stockQuantity: { increment: item.quantity } },
            });
          }
        }
      }
      await tx.orderStatusEvent.create({
        data: { orderId: id, fromStatus: order.status, toStatus: next, actorId },
      });
      return tx.order.findUnique({ where: { id }, include: { items: true, payments: true } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
