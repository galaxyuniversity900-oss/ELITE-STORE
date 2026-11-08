export function parseCorsOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const production = env.NODE_ENV === 'production';
  const configured = env.CORS_ORIGINS?.trim();
  if (production && !configured) {
    throw new Error('CORS_ORIGINS must be explicitly configured in production');
  }
  const values = (configured || 'http://localhost:3000,http://localhost:3001')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (!values.length) throw new Error('CORS_ORIGINS must contain at least one origin');

  const origins = values.map((value) => {
    if (value === '*' || value === 'null') throw new Error('Wildcard and null CORS origins are forbidden');
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      throw new Error('CORS_ORIGINS entries must be absolute origins');
    }
    if (parsed.origin !== value || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) {
      throw new Error('CORS_ORIGINS entries must contain only scheme, host and optional port');
    }
    if (production && parsed.protocol !== 'https:') {
      throw new Error('Production CORS origins must use HTTPS');
    }
    return parsed.origin;
  });
  return [...new Set(origins)];
}
