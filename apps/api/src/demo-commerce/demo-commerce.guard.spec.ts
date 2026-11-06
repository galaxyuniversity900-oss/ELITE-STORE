import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { DemoCommerceGuard } from './demo-commerce.guard';

describe('DemoCommerceGuard', () => {
  const context = {} as ExecutionContext;
  const previousNodeEnv = process.env.NODE_ENV;
  const previousEnabled = process.env.DEMO_COMMERCE_ENABLED;

  afterEach(() => {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousEnabled === undefined) delete process.env.DEMO_COMMERCE_ENABLED;
    else process.env.DEMO_COMMERCE_ENABLED = previousEnabled;
  });

  it('blocks demo mutation endpoints in production even when explicitly enabled', () => {
    process.env.NODE_ENV = 'production';
    process.env.DEMO_COMMERCE_ENABLED = 'true';
    expect(() => new DemoCommerceGuard().canActivate(context)).toThrow(NotFoundException);
  });

  it('blocks demo endpoints unless the non-production opt-in is explicit', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.DEMO_COMMERCE_ENABLED;
    expect(() => new DemoCommerceGuard().canActivate(context)).toThrow(NotFoundException);
  });

  it('allows demo endpoints only in a non-production environment with explicit opt-in', () => {
    process.env.NODE_ENV = 'test';
    process.env.DEMO_COMMERCE_ENABLED = 'true';
    expect(new DemoCommerceGuard().canActivate(context)).toBe(true);
  });
});
