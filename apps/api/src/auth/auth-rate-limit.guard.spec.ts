import { TooManyRequestsException } from '@nestjs/common';
import { AuthRateLimitGuard } from './auth-rate-limit.guard';

describe('AuthRateLimitGuard', () => {
  it('allows ten requests per endpoint and IP, then rejects further requests', () => {
    const guard = new AuthRateLimitGuard();
    const request = { path: '/api/auth/login', ip: '192.0.2.10', socket: {} };
    const context = { switchToHttp: () => ({ getRequest: () => request }) } as never;

    for (let index = 0; index < 10; index += 1) {
      expect(guard.canActivate(context)).toBe(true);
    }
    expect(() => guard.canActivate(context)).toThrow(TooManyRequestsException);
  });

  it('keeps endpoint buckets separate', () => {
    const guard = new AuthRateLimitGuard();
    const request = { path: '/api/auth/login', ip: '192.0.2.11', socket: {} };
    const context = { switchToHttp: () => ({ getRequest: () => request }) } as never;
    for (let index = 0; index < 10; index += 1) guard.canActivate(context);
    request.path = '/api/auth/register';
    expect(guard.canActivate(context)).toBe(true);
  });
});
