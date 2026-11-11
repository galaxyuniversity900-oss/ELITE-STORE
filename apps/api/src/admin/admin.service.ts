import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma, ProductStatus, UserRole } from '@prisma/client';
import { CreateProductVariantDto, UpdateProductVariantDto } from './admin.dto';
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


  listProductVariants(productId: string) {
    return this.prisma.productVariant.findMany({
      where: { productId },
      orderBy: [{ isActive: 'desc' }, { size: 'asc' }, { color: 'asc' }],
    });
  }

  createProductVariant(productId: string, input: CreateProductVariantDto) {
    return this.prisma.productVariant.create({
      data: {
        productId,
        sku: input.sku.trim(),
        size: input.size?.trim(),
        color: input.color?.trim(),
        attributes: input.attributes as Prisma.InputJsonValue | undefined,
        priceOverride: input.priceOverride === undefined ? undefined : new Prisma.Decimal(input.priceOverride),
        stockQuantity: input.stockQuantity,
        isActive: input.isActive ?? true,
      },
    });
  }

  async updateProductVariant(id: string, input: UpdateProductVariantDto) {
    const data: Prisma.ProductVariantUpdateInput = {};
    if (input.sku !== undefined) data.sku = input.sku.trim();
    if (input.size !== undefined) data.size = input.size;
    if (input.color !== undefined) data.color = input.color;
    if (input.attributes !== undefined) data.attributes = input.attributes as Prisma.InputJsonValue;
    if (input.priceOverride !== undefined) data.priceOverride = input.priceOverride === null ? null : new Prisma.Decimal(input.priceOverride);
    if (input.stockQuantity !== undefined) data.stockQuantity = input.stockQuantity;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    try {
      return await this.prisma.productVariant.update({ where: { id }, data });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') throw new NotFoundException('Product variant not found');
      throw error;
    }
  }

  async archiveProductVariant(id: string) {
    return this.updateProductVariant(id, { isActive: false });
  }

  async archiveProduct(id: string) {
    return this.updateProduct(id, { status: ProductStatus.ARCHIVED });
  }

  listOrders(page = 1, limit = 50) {
    return this.prisma.order.findMany({
      include: { items: true, payments: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async updateOrderStatus(id: string, next: OrderStatus) {
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
      return tx.order.findUnique({ where: { id }, include: { items: true, payments: true } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
