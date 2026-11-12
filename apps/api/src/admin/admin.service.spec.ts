import { BadRequestException } from '@nestjs/common';
import { ContentStatus, OrderStatus } from '@prisma/client';
import { AdminService } from './admin.service';

describe('AdminService order lifecycle', () => {
  it('rejects an invalid transition before changing the order', async () => {
    const tx = { order: { findUnique: jest.fn().mockResolvedValue({ id: 'o1', status: OrderStatus.PENDING, items: [] }), updateMany: jest.fn() } };
    const prisma = { $transaction: jest.fn((work: (client: unknown) => unknown) => work(tx)) };
    const service = new AdminService(prisma as never);
    await expect(service.updateOrderStatus('o1', OrderStatus.SHIPPED)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.order.updateMany).not.toHaveBeenCalled();
  });

  it('blocks refund status until a payment-provider workflow exists', async () => {
    const service = new AdminService({} as never);
    await expect(service.updateOrderStatus('o1', OrderStatus.REFUNDED)).rejects.toBeInstanceOf(BadRequestException);
  });

describe('AdminService CMS and editorial commerce', () => {
  it('creates a draft content page without publishing it implicitly', async () => {
    const page = { id: 'page-1', slug: 'care-guide', status: ContentStatus.DRAFT };
    const prisma = { contentPage: { create: jest.fn().mockResolvedValue(page) } };
    const service = new AdminService(prisma as never);

    const result = await service.createContentPage({
      slug: ' Care-Guide ', title: 'Care Guide', body: { blocks: [] },
    });

    expect(result).toEqual(page);
    expect(prisma.contentPage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        slug: 'care-guide', title: 'Care Guide', status: ContentStatus.DRAFT, publishedAt: null,
      }),
    });
  });

  it('stamps publication time when creating a published editorial collection', async () => {
    const collection = { id: 'collection-1', status: ContentStatus.PUBLISHED };
    const prisma = { editorialCollection: { create: jest.fn().mockResolvedValue(collection) } };
    const service = new AdminService(prisma as never);

    await service.createEditorialCollection({
      slug: 'summer-edit', title: 'Summer Edit', status: ContentStatus.PUBLISHED,
    });

    expect(prisma.editorialCollection.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        slug: 'summer-edit', status: ContentStatus.PUBLISHED, publishedAt: expect.any(Date),
      }),
    });
  });

  it('adds only active products to editorial collections with idempotent ordering', async () => {
    const item = { id: 'item-1', collectionId: 'collection-1', productId: 'product-1', sortOrder: 2 };
    const prisma = {
      product: { findFirst: jest.fn().mockResolvedValue({ id: 'product-1' }) },
      editorialCollectionItem: { upsert: jest.fn().mockResolvedValue(item) },
    };
    const service = new AdminService(prisma as never);

    const result = await service.addEditorialCollectionItem('collection-1', {
      productId: 'product-1', sortOrder: 2,
    });

    expect(result).toEqual(item);
    expect(prisma.editorialCollectionItem.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { collectionId_productId: { collectionId: 'collection-1', productId: 'product-1' } },
      create: { collectionId: 'collection-1', productId: 'product-1', sortOrder: 2 },
      update: { sortOrder: 2 },
    }));
  });
});
});
