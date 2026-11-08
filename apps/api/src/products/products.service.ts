import { Injectable } from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type ProductSort = 'newest' | 'price_asc' | 'price_desc';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(page: number, limit: number, category?: string, search?: string, sort: ProductSort = 'newest') {
    const term = search?.trim().slice(0, 100);
    const where: Prisma.ProductWhereInput = {
      status: ProductStatus.ACTIVE,
      ...(category ? { category: { slug: category } } : {}),
      ...(term ? {
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { sku: { contains: term, mode: 'insensitive' } },
          { description: { contains: term, mode: 'insensitive' } },
        ],
      } : {}),
    };
    const orderBy: Prisma.ProductOrderByWithRelationInput = sort === 'price_asc'
      ? { price: 'asc' }
      : sort === 'price_desc'
        ? { price: 'desc' }
        : { createdAt: 'desc' };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: { images: { orderBy: { sortOrder: 'asc' } }, category: true },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);
    return { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  bySlug(slug: string) {
    return this.prisma.product.findFirst({
      where: { slug, status: ProductStatus.ACTIVE },
      include: { images: { orderBy: { sortOrder: 'asc' } }, category: true },
    });
  }
}
