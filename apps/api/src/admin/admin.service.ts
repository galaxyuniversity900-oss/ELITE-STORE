import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ContentStatus, OrderStatus, Prisma, ProductStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContentPageDto, CreateEditorialCollectionDto, CreateProductDto, EditorialCollectionItemDto, UpdateContentPageDto, UpdateEditorialCollectionDto, UpdateProductDto } from './admin.dto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}


  listContentPages() {
    return this.prisma.contentPage.findMany({ orderBy: { updatedAt: 'desc' } });
  }

  createContentPage(input: CreateContentPageDto) {
    const status = input.status ?? ContentStatus.DRAFT;
    return this.prisma.contentPage.create({
      data: {
        slug: input.slug.trim().toLowerCase(),
        title: input.title.trim(),
        excerpt: input.excerpt,
        body: input.body as Prisma.InputJsonValue,
        heroImageUrl: input.heroImageUrl,
        seoTitle: input.seoTitle,
        seoDescription: input.seoDescription,
        status,
        publishedAt: status === ContentStatus.PUBLISHED ? new Date() : null,
      },
    });
  }

  async updateContentPage(id: string, input: UpdateContentPageDto) {
    const existing = await this.prisma.contentPage.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Content page not found');
    const data: Prisma.ContentPageUpdateInput = {};
    if (input.slug !== undefined) data.slug = input.slug.trim().toLowerCase();
    if (input.title !== undefined) data.title = input.title.trim();
    if (input.excerpt !== undefined) data.excerpt = input.excerpt;
    if (input.body !== undefined) data.body = input.body as Prisma.InputJsonValue;
    if (input.heroImageUrl !== undefined) data.heroImageUrl = input.heroImageUrl;
    if (input.seoTitle !== undefined) data.seoTitle = input.seoTitle;
    if (input.seoDescription !== undefined) data.seoDescription = input.seoDescription;
    if (input.status !== undefined) {
      data.status = input.status;
      data.publishedAt = input.status === ContentStatus.PUBLISHED
        ? existing.publishedAt ?? new Date()
        : null;
    }
    return this.prisma.contentPage.update({ where: { id }, data });
  }

  listEditorialCollections() {
    return this.prisma.editorialCollection.findMany({
      include: { items: { include: { product: { include: { images: { orderBy: { sortOrder: 'asc' } } } } }, orderBy: { sortOrder: 'asc' } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  createEditorialCollection(input: CreateEditorialCollectionDto) {
    const status = input.status ?? ContentStatus.DRAFT;
    return this.prisma.editorialCollection.create({
      data: {
        slug: input.slug.trim().toLowerCase(),
        title: input.title.trim(),
        description: input.description,
        body: input.body as Prisma.InputJsonValue | undefined,
        heroImageUrl: input.heroImageUrl,
        seoTitle: input.seoTitle,
        seoDescription: input.seoDescription,
        status,
        publishedAt: status === ContentStatus.PUBLISHED ? new Date() : null,
      },
    });
  }

  async updateEditorialCollection(id: string, input: UpdateEditorialCollectionDto) {
    const existing = await this.prisma.editorialCollection.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Editorial collection not found');
    const data: Prisma.EditorialCollectionUpdateInput = {};
    if (input.slug !== undefined) data.slug = input.slug.trim().toLowerCase();
    if (input.title !== undefined) data.title = input.title.trim();
    if (input.description !== undefined) data.description = input.description;
    if (input.body !== undefined) data.body = input.body as Prisma.InputJsonValue;
    if (input.heroImageUrl !== undefined) data.heroImageUrl = input.heroImageUrl;
    if (input.seoTitle !== undefined) data.seoTitle = input.seoTitle;
    if (input.seoDescription !== undefined) data.seoDescription = input.seoDescription;
    if (input.status !== undefined) {
      data.status = input.status;
      data.publishedAt = input.status === ContentStatus.PUBLISHED
        ? existing.publishedAt ?? new Date()
        : null;
    }
    return this.prisma.editorialCollection.update({ where: { id }, data });
  }

  async addEditorialCollectionItem(collectionId: string, input: EditorialCollectionItemDto) {
    const product = await this.prisma.product.findFirst({
      where: { id: input.productId, status: ProductStatus.ACTIVE },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Active product not found');
    return this.prisma.editorialCollectionItem.upsert({
      where: { collectionId_productId: { collectionId, productId: input.productId } },
      create: { collectionId, productId: input.productId, sortOrder: input.sortOrder ?? 0 },
      update: { sortOrder: input.sortOrder ?? 0 },
      include: { product: { include: { images: { orderBy: { sortOrder: 'asc' } } } } },
    });
  }

  async removeEditorialCollectionItem(collectionId: string, productId: string) {
    const result = await this.prisma.editorialCollectionItem.deleteMany({ where: { collectionId, productId } });
    return { removed: result.count === 1 };
  }

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
