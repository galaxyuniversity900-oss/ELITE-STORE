import { Injectable, NotFoundException } from '@nestjs/common';
import { ContentStatus, ProductStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ContentService {
  constructor(private readonly prisma: PrismaService) {}

  async page(slug: string) {
    const page = await this.prisma.contentPage.findFirst({
      where: { slug, status: ContentStatus.PUBLISHED, publishedAt: { not: null, lte: new Date() } },
    });
    if (!page) throw new NotFoundException('Content page not found');
    return page;
  }

  async collection(slug: string) {
    const collection = await this.prisma.editorialCollection.findFirst({
      where: { slug, status: ContentStatus.PUBLISHED, publishedAt: { not: null, lte: new Date() } },
      include: {
        items: {
          where: { product: { status: ProductStatus.ACTIVE } },
          include: { product: { include: { images: { orderBy: { sortOrder: 'asc' } }, category: true } } },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    if (!collection) throw new NotFoundException('Editorial collection not found');
    return collection;
  }
}
