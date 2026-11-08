import { ExecutionContext, HttpStatus } from '@nestjs/common';
import { AuthRateLimitGuard } from './auth-rate-limit.guard';

type TestBucket = { count: number; resetAt: number };
function createPrisma() {
  const buckets = new Map<string, TestBucket>();
  const prisma = {
    $queryRawUnsafe: jest.fn(async (_query: string, key: string, nextResetAt: Date) => {
      const now = Date.now();
      const current = buckets.get(key);
      const next = !current || current.resetAt <= now
        ? { count: 1, resetAt: nextResetAt.getTime() }
        : { count: current.count + 1, resetAt: current.resetAt };
      buckets.set(key, next);
      return [{ count: next.count, resetAt: new Date(next.resetAt) }];
    }),
    apiRateLimitBucket: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
  };
  return { prisma, buckets };
}

function context(path: string, ip = '203.0.113.10', email = 'buyer@example.test') {
  const response = { setHeader: jest.fn() };
  const request = { path, ip, body: { email }, socket: { remoteAddress: ip } };
  const execution = {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as unknown as ExecutionContext;
  return { execution, response };
}

async function expectRateLimited(action: () => Promise<unknown>) {
  await expect(action()).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });
}

describe('AuthRateLimitGuard shared PostgreSQL buckets', () => {
  let clock: jest.SpyInstance;
  beforeEach(() => { clock = jest.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000); });
  afterEach(() => clock.mockRestore());

  it('limits login attempts per hashed IP and normalized identity', async () => {
    const { prisma } = createPrisma();
    const guard = new AuthRateLimitGuard(prisma as never);
    const request = context('/api/auth/login', '203.0.113.10', ' BUYER@example.test ');
    for (let attempt = 0; attempt < 5; attempt += 1) expect(await guard.canActivate(request.execution)).toBe(true);
    await expectRateLimited(() => guard.canActivate(request.execution));
    expect(request.response.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
  });

  it('enforces the per-IP login ceiling across different accounts', async () => {
    const { prisma } = createPrisma();
    const guard = new AuthRateLimitGuard(prisma as never);
    for (let attempt = 0; attempt < 30; attempt += 1) {
      expect(await guard.canActivate(context('/api/auth/login', '203.0.113.11', 'buyer' + attempt + '@example.test').execution)).toBe(true);
    }
    await expectRateLimited(() => guard.canActivate(context('/api/auth/login', '203.0.113.11', 'another@example.test').execution));
  });

  it('limits registrations to three per IP per hour', async () => {
    const { prisma } = createPrisma();
    const guard = new AuthRateLimitGuard(prisma as never);
    for (let attempt = 0; attempt < 3; attempt += 1) expect(await guard.canActivate(context('/api/auth/register').execution)).toBe(true);
    await expectRateLimited(() => guard.canActivate(context('/api/auth/register').execution));
  });

  it('shares buckets across separate API guard instances', async () => {
    const { prisma } = createPrisma();
    const firstReplica = new AuthRateLimitGuard(prisma as never);
    const secondReplica = new AuthRateLimitGuard(prisma as never);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const guard = attempt % 2 === 0 ? firstReplica : secondReplica;
      expect(await guard.canActivate(context('/api/auth/login', '203.0.113.12', 'shared@example.test').execution)).toBe(true);
    }
    await expectRateLimited(() => secondReplica.canActivate(context('/api/auth/login', '203.0.113.12', 'shared@example.test').execution));
  });

  it('resets expired database windows', async () => {
    const { prisma } = createPrisma();
    const guard = new AuthRateLimitGuard(prisma as never);
    const request = context('/api/auth/login');
    for (let attempt = 0; attempt < 5; attempt += 1) await guard.canActivate(request.execution);
    await expectRateLimited(() => guard.canActivate(request.execution));
    clock.mockReturnValue(1_800_000_000_000 + 15 * 60 * 1000 + 1);
    expect(await guard.canActivate(request.execution)).toBe(true);
  });

  it('does not throttle unrelated routes', async () => {
    const { prisma } = createPrisma();
    const guard = new AuthRateLimitGuard(prisma as never);
    expect(await guard.canActivate(context('/api/products').execution)).toBe(true);
    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
  });
});
