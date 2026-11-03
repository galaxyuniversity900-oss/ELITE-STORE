import { Injectable } from '@nestjs/common';
import { ProductStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(page: number, limit: number, category?: string) {
    const where = {
      status: ProductStatus.ACTIVE,
      ...(category ? { category: { slug: category } } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: { images: { orderBy: { sortOrder: 'asc' } }, category: true },
        orderBy: { createdAt: 'desc' },
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
