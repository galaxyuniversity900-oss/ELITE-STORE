# Authentication abuse protection

The API applies a process-local fixed-window guard to public authentication endpoints:

- Login: 5 attempts per 15 minutes for an IP/email pair, plus 30 attempts per IP in the same window.
- Registration: 3 attempts per IP per hour.
- Blocked requests receive HTTP 429 and a `Retry-After` header.
- Login email values are normalized and hashed before being used in in-memory bucket keys.
- The guard uses the connection IP exposed by the server and deliberately does not trust arbitrary `X-Forwarded-For` headers.

## Deployment boundary

This guard is a useful single-process abuse barrier, not a distributed rate limiter or a substitute for edge protection. Its counters reset when the API process restarts and are not shared between replicas. Before public production exposure:

1. Enforce equivalent or stricter limits at the trusted reverse proxy/API gateway.
2. If multiple API replicas are deployed, use a shared atomic store such as Redis for cross-replica limits.
3. Configure trusted proxy hops explicitly at the hosting layer; do not blindly trust client-supplied forwarding headers.
4. Monitor 429 rates without logging passwords, access tokens, or raw authentication payloads.
5. Keep account recovery and human support available so legitimate customers are not permanently locked out.

The guard does not prove identity, prevent distributed credential stuffing by itself, or replace MFA, verified email, secure sessions, or incident monitoring.
