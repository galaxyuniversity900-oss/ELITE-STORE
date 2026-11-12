import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  const prisma = { $queryRaw: jest.fn() };
  let controller: HealthController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new HealthController(prisma as never);
  });

  it('keeps liveness independent of database availability', () => {
    prisma.$queryRaw.mockRejectedValue(new Error('database unavailable'));
    expect(controller.check().status).toBe('ok');
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('reports ready only after a successful database query', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    const result = await controller.readiness();
    expect(result.status).toBe('ready');
    expect(result.checks.postgresql).toBe('ok');
  });

  it('returns 503 when the primary database cannot be queried', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('connection refused'));
    await expect(controller.readiness()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
