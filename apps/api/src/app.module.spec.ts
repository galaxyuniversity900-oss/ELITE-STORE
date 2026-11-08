import { isCommerceSimulationEnabled } from './app.module';

describe('commerce simulation exposure', () => {
  it('keeps simulated payment and courier routes disabled in production by default', () => {
    expect(isCommerceSimulationEnabled({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toBe(false);
  });

  it('allows an explicit production opt-in for isolated testing only', () => {
    expect(isCommerceSimulationEnabled({
      NODE_ENV: 'production',
      ENABLE_COMMERCE_SIMULATION: 'true',
    } as NodeJS.ProcessEnv)).toBe(true);
  });

  it('keeps local development workflows available', () => {
    expect(isCommerceSimulationEnabled({ NODE_ENV: 'development' } as NodeJS.ProcessEnv)).toBe(true);
  });
});
