import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';

/**
 * The demo payment and courier endpoints mutate order/payment state without a
 * provider signature. They must never be reachable in production.
 */
@Injectable()
export class DemoCommerceGuard implements CanActivate {
  canActivate(_context: ExecutionContext) {
    if (process.env.NODE_ENV === 'production' || process.env.DEMO_COMMERCE_ENABLED !== 'true') {
      throw new NotFoundException('Demo commerce endpoints are disabled');
    }
    return true;
  }
}
