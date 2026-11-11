import { NotFoundException } from '@nestjs/common';
import { ContentStatus } from '@prisma/client';
import { ContentService } from './content.service';

describe('ContentService public visibility', () => {
  it('does not return draft content pages publicly', async () => {
    const prisma = { contentPage: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new ContentService(prisma as never);

    await expect(service.page('draft-page')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.contentPage.findFirst).toHaveBeenCalledWith({
      where: {
        slug: 'draft-page',
        status: ContentStatus.PUBLISHED,
        publishedAt: { not: null, lte: expect.any(Date) },
      },
    });
  });

  it('returns only published editorial collections with active products', async () => {
    const collection = { id: 'collection-1', slug: 'summer-edit', items: [] };
    const prisma = { editorialCollection: { findFirst: jest.fn().mockResolvedValue(collection) } };
    const service = new ContentService(prisma as never);

    await expect(service.collection('summer-edit')).resolves.toEqual(collection);
    expect(prisma.editorialCollection.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ slug: 'summer-edit', status: ContentStatus.PUBLISHED }),
      include: expect.objectContaining({
        items: expect.objectContaining({ where: { product: { status: 'ACTIVE' } } }),
      }),
    }));
  });
});
