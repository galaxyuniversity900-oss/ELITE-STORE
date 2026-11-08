import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';

function expectRateLimited(action: () => unknown) {
  try {
    action();
    throw new Error('Expected rate limiting to reject the request');
  } catch (error) {
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
  }
}
import { AuthRateLimitGuard } from './auth-rate-limit.guard';

function context(path: string, ip = '203.0.113.10', email = 'buyer@example.test') {
  const response = { setHeader: jest.fn() };
  const request = { path, ip, body: { email }, socket: { remoteAddress: ip } };
  const execution = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;
  return { execution, response };
}

describe('AuthRateLimitGuard', () => {
  let guard: AuthRateLimitGuard;
  let clock: jest.SpyInstance;

  beforeEach(() => {
    guard = new AuthRateLimitGuard();
    clock = jest.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
  });

  afterEach(() => clock.mockRestore());

  it('allows five login attempts for an IP and normalized email, then blocks the sixth', () => {
    const request = context('/api/auth/login', '203.0.113.10', ' BUYER@example.test ');
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(guard.canActivate(request.execution)).toBe(true);
    }
    expectRateLimited(() => guard.canActivate(request.execution));
    expect(request.response.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
  });

  it('applies a broader per-IP login ceiling across different accounts', () => {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const request = context('/api/auth/login', '203.0.113.11', `buyer${attempt}@example.test`);
      expect(guard.canActivate(request.execution)).toBe(true);
    }
    const blocked = context('/api/auth/login', '203.0.113.11', 'another@example.test');
    expectRateLimited(() => guard.canActivate(blocked.execution));
  });

  it('limits registrations to three per IP per hour', () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect(guard.canActivate(context('/api/auth/register').execution)).toBe(true);
    }
    expectRateLimited(() => guard.canActivate(context('/api/auth/register').execution));
  });

  it('resets expired login windows', () => {
    const request = context('/api/auth/login');
    for (let attempt = 0; attempt < 5; attempt += 1) guard.canActivate(request.execution);
    expectRateLimited(() => guard.canActivate(request.execution));
    clock.mockReturnValue(1_800_000_000_000 + 15 * 60 * 1000 + 1);
    expect(guard.canActivate(request.execution)).toBe(true);
  });

  it('does not throttle unrelated authentication-independent routes', () => {
    expect(guard.canActivate(context('/api/products').execution)).toBe(true);
  });
});
