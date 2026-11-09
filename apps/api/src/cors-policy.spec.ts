import { parseCorsOrigins } from './cors-policy';

describe('parseCorsOrigins', () => {
  it('uses localhost origins only outside production when not configured', () => {
    expect(parseCorsOrigins({ NODE_ENV: 'test' })).toEqual([
      'http://localhost:3000',
      'http://localhost:3001',
    ]);
  });

  it('requires an explicit production allowlist', () => {
    expect(() => parseCorsOrigins({ NODE_ENV: 'production' })).toThrow('must be explicitly configured');
  });

  it('rejects wildcard and null origins', () => {
    expect(() => parseCorsOrigins({ NODE_ENV: 'production', CORS_ORIGINS: '*' })).toThrow('forbidden');
    expect(() => parseCorsOrigins({ NODE_ENV: 'production', CORS_ORIGINS: 'null' })).toThrow('forbidden');
  });

  it('rejects insecure and non-origin production URLs', () => {
    expect(() => parseCorsOrigins({ NODE_ENV: 'production', CORS_ORIGINS: 'http://shop.example.com' })).toThrow('HTTPS');
    expect(() => parseCorsOrigins({ NODE_ENV: 'production', CORS_ORIGINS: 'https://shop.example.com/admin' })).toThrow('only scheme');
  });

  it('deduplicates valid HTTPS origins', () => {
    expect(parseCorsOrigins({
      NODE_ENV: 'production',
      CORS_ORIGINS: 'https://shop.example.com,https://admin.example.com,https://shop.example.com',
    })).toEqual(['https://shop.example.com', 'https://admin.example.com']);
  });
});
