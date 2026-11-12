import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Process liveness only; deliberately independent of downstream services. */
  @Get()
  check() {
    return {
      status: 'ok',
      service: 'mes-store-api',
      timestamp: new Date().toISOString(),
    };
  }

  /** Readiness requires a successful round-trip to the primary database. */
  @Get('ready')
  async readiness() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ready',
        service: 'mes-store-api',
        checks: { postgresql: 'ok' },
        timestamp: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'not_ready',
        service: 'mes-store-api',
        checks: { postgresql: 'unavailable' },
        timestamp: new Date().toISOString(),
      });
    }
  }
}
