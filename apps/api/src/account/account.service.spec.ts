import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ConsentType, OrderStatus, ProductStatus } from '@prisma/client';
import { AccountService } from './account.service';

describe('AccountService consent preferences', () => {
  const originalPolicyVersion = process.env.CONSENT_POLICY_VERSION;

  afterEach(() => {
    if (originalPolicyVersion === undefined) delete process.env.CONSENT_POLICY_VERSION;
    else process.env.CONSENT_POLICY_VERSION = originalPolicyVersion;
    jest.restoreAllMocks();
  });

  it('persists a versioned customer decision and keeps revocation as an explicit false value', async () => {
    process.env.CONSENT_POLICY_VERSION = 'policy-2026-11';
    const saved = { consentType: ConsentType.MARKETING_EMAIL, granted: false, policyVersion: 'policy-2026-11' };
    const prisma = { consentPreference: { upsert: jest.fn().mockResolvedValue(saved) } };
    const service = new AccountService(prisma as never);

    const result = await service.setConsent('user-1', {
      consentType: ConsentType.MARKETING_EMAIL,
      granted: false,
    });

    expect(result).toEqual(saved);
    expect(prisma.consentPreference.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId_consentType: { userId: 'user-1', consentType: ConsentType.MARKETING_EMAIL } },
      create: expect.objectContaining({ userId: 'user-1', granted: false, policyVersion: 'policy-2026-11' }),
      update: expect.objectContaining({ granted: false, policyVersion: 'policy-2026-11' }),
    }));
  });

  it('fails closed when the published policy version is not configured', async () => {
    delete process.env.CONSENT_POLICY_VERSION;
    const service = new AccountService({} as never);

    await expect(service.setConsent('user-2', {
      consentType: ConsentType.ANALYTICS,
      granted: true,
    })).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('exports only the authenticated user data with an explicit export format', async () => {
    const data = { id: 'user-3', email: 'customer@example.test', orders: [], addresses: [], consentPreferences: [] };
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue(data) } };
    const service = new AccountService(prisma as never);

    const result = await service.exportPersonalData('user-3');

    expect(result.exportFormat).toBe('MES_STORE_ACCOUNT_JSON_V1');
    expect(result.data).toEqual(data);
    expect(prisma.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'user-3' },
    }));
  });

  it('reuses an existing open erasure request instead of duplicating it', async () => {
    const existing = { id: 'request-1', status: 'PENDING', userId: 'user-4' };
    const tx = {
      dataSubjectRequest: {
        findFirst: jest.fn().mockResolvedValue(existing),
        create: jest.fn(),
      },
    };
    const prisma = { $transaction: jest.fn((work: (client: unknown) => unknown) => work(tx)) };
    const service = new AccountService(prisma as never);

    const result = await service.requestErasure('user-4', 'Please erase my account');

    expect(result).toEqual(existing);
    expect(tx.dataSubjectRequest.create).not.toHaveBeenCalled();
  });

  it('creates a pending erasure request when no open request exists', async () => {
    const created = { id: 'request-2', status: 'PENDING', userId: 'user-5' };
    const tx = {
      dataSubjectRequest: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(created),
      },
    };
    const prisma = { $transaction: jest.fn((work: (client: unknown) => unknown) => work(tx)) };
    const service = new AccountService(prisma as never);

    const result = await service.requestErasure('user-5', 'Delete my profile');

    expect(result).toEqual(created);
    expect(tx.dataSubjectRequest.create).toHaveBeenCalledWith({
      data: { userId: 'user-5', reason: 'Delete my profile' },
    });
  });

  it('allows a customer return request only for their delivered order', async () => {
    const request = { id: 'return-1', orderId: 'order-1', status: 'PENDING', reason: 'Wrong size' };
    const prisma = {
      order: { findFirst: jest.fn().mockResolvedValue({ id: 'order-1', status: OrderStatus.DELIVERED }) },
      returnRequest: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(request),
      },
    };
    const service = new AccountService(prisma as never);

    const result = await service.requestReturn('user-1', 'MES-1', ' Wrong size ');

    expect(result).toEqual(request);
    expect(prisma.order.findFirst).toHaveBeenCalledWith({
      where: { orderNumber: 'MES-1', userId: 'user-1' },
      select: { id: true, status: true },
    });
    expect(prisma.returnRequest.create).toHaveBeenCalledWith(expect.objectContaining({
      data: { userId: 'user-1', orderId: 'order-1', reason: 'Wrong size' },
    }));
  });

  it('rejects return requests for orders that are not delivered', async () => {
    const prisma = {
      order: { findFirst: jest.fn().mockResolvedValue({ id: 'order-2', status: OrderStatus.PROCESSING }) },
      returnRequest: { findUnique: jest.fn(), create: jest.fn() },
    };
    const service = new AccountService(prisma as never);

    await expect(service.requestReturn('user-2', 'MES-2', 'Damaged'))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.returnRequest.create).not.toHaveBeenCalled();
  });

  it('adds an active product to the authenticated customer wishlist idempotently', async () => {
    const item = { id: 'wish-1', userId: 'user-7', productId: 'product-7' };
    const prisma = {
      product: { findFirst: jest.fn().mockResolvedValue({ id: 'product-7' }) },
      wishlistItem: { upsert: jest.fn().mockResolvedValue(item) },
    };
    const service = new AccountService(prisma as never);

    const result = await service.addWishlistItem('user-7', 'product-7');

    expect(result).toEqual(item);
    expect(prisma.product.findFirst).toHaveBeenCalledWith({
      where: { id: 'product-7', status: ProductStatus.ACTIVE },
      select: { id: true },
    });
    expect(prisma.wishlistItem.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId_productId: { userId: 'user-7', productId: 'product-7' } },
      create: { userId: 'user-7', productId: 'product-7' },
      update: {},
    }));
  });

  it("removes only the requested customer's wishlist entry", async () => {
    const prisma = { wishlistItem: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) } };
    const service = new AccountService(prisma as never);

    await expect(service.removeWishlistItem('user-8', 'product-8')).resolves.toEqual({ removed: true });
    expect(prisma.wishlistItem.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-8', productId: 'product-8' },
    });
  });
});
