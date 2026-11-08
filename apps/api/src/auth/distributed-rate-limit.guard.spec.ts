import { HttpException } from '@nestjs/common';
import { DistributedRateLimitGuard } from './distributed-rate-limit.guard';

describe('DistributedRateLimitGuard', () => {
  const originalJwtSecret = process.env.JWT_SECRET;

  beforeAll(() => {
    process.env.JWT_SECRET = 'unit-test-secret-with-at-least-32-characters';
  });

  afterAll(() => {
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwtSecret;
  });
  const makeContext = (request: any, response = { setHeader: jest.fn() }) => ({
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  }) as never;

  it('uses a shared atomic bucket and allows requests within the configured window', async () => {
    const prisma = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ count: 10, expiresAt: new Date(Date.now() + 60_000) }]),
      $executeRawUnsafe: jest.fn(),
    };
    const guard = new DistributedRateLimitGuard(prisma as never);
    const request = {
      method: 'POST',
      baseUrl: '/api/auth',
      route: { path: '/login' },
      path: '/api/auth/login',
      ip: '203.0.113.10',
      socket: { remoteAddress: '203.0.113.10' },
    };
    await expect(guard.canActivate(makeContext(request))).resolves.toBe(true);
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledTimes(1);
  });

  it('returns HTTP 429 and Retry-After after the login limit is exceeded', async () => {
    const prisma = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ count: 11, expiresAt: new Date(Date.now() + 60_000) }]),
      $executeRawUnsafe: jest.fn(),
    };
    const guard = new DistributedRateLimitGuard(prisma as never);
    const response = { setHeader: jest.fn() };
    const request = {
      method: 'POST',
      baseUrl: '/api/auth',
      route: { path: '/login' },
      path: '/api/auth/login',
      ip: '203.0.113.11',
      socket: { remoteAddress: '203.0.113.11' },
    };
    await expect(guard.canActivate(makeContext(request, response))).rejects.toBeInstanceOf(HttpException);
    expect(response.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
  });

  it('does not consume a bucket for unrelated routes', async () => {
    const prisma = { $queryRawUnsafe: jest.fn(), $executeRawUnsafe: jest.fn() };
    const guard = new DistributedRateLimitGuard(prisma as never);
    const request = {
      method: 'GET',
      baseUrl: '/api/products',
      route: { path: '/' },
      path: '/api/products',
      ip: '203.0.113.12',
      socket: { remoteAddress: '203.0.113.12' },
    };
    await expect(guard.canActivate(makeContext(request))).resolves.toBe(true);
    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
  });
});
