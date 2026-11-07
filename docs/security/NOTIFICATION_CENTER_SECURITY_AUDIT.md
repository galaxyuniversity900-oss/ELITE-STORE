# MES STORE Notification Center — Security Audit

**Audit date:** 2026-11-07  
**Repository:** `galaxyuniversity900-oss/ELITE-STORE`  
**Reviewed branch:** `admin/notification-center`  
**Pull request:** [#5](https://github.com/galaxyuniversity900-oss/ELITE-STORE/pull/5)  
**Scope:** Authentication and authorization, Notification Center API, provider webhooks, notification outbox handling, secret configuration, Docker exposure, and CI security gates.

## Executive result

The source review found security-hardening gaps and applied targeted fixes on this branch. This is **not a production security certification**. The latest CI run observed before these changes passed, but the new commits require a fresh CI run. Real provider authentication and delivery were not attempted because production credentials were not supplied or fabricated.

## Changes applied in this audit

1. **Authentication throttling**
   - Added an IP- and endpoint-scoped limit of 10 requests per 15-minute window to public login and registration routes.
   - Added a bounded in-memory bucket map to prevent unbounded growth.
   - Added unit tests for limit enforcement and endpoint isolation.
   - Registered the guard in the NestJS authentication module.

2. **Webhook input validation**
   - Meta WhatsApp callbacks now require an entries array, cap entries and status events at 100, validate message IDs, and accept only documented delivery statuses handled by this service: `sent`, `delivered`, `read`, and `failed`.
   - Resend event IDs and provider message IDs are type-checked and length-bounded before persistence.
   - Added negative tests for unsupported Meta statuses and oversized callback batches.
   - Existing HMAC/Svix signature verification remains required before event processing.

3. **Dependency audit gate**
   - Added `npm audit --audit-level=high` to the CI workflow after dependency installation. High and critical dependency advisories now fail the workflow instead of being silently skipped.

## Verified controls observed in source

- Notification admin controller uses both `AuthGuard` and `RolesGuard`, and restricts access to `ADMIN` and `SUPER_ADMIN`.
- The auth service verifies signed HMAC access tokens, enforces expiry, reloads the user from the database, and rejects inactive accounts. Authorization uses the current database role rather than trusting the token role.
- Password hashes use Node.js `scrypt` with per-password random salts and timing-safe comparison.
- Access tokens expire after 15 minutes.
- Meta webhook signatures use HMAC-SHA256 and timing-safe comparison.
- Resend webhook signatures validate the Svix timestamp within a five-minute window and use timing-safe comparison.
- Webhook raw request bodies are enabled in NestJS so signatures are calculated over the original bytes.
- Helmet is enabled for the API; CORS uses an explicit configured origin list.
- Notification provider secrets are environment-driven. `.env.example` contains blank or replacement-only values, not live provider credentials.
- The previously hardcoded WhatsApp recipient fallback was removed; the recipient must be configured explicitly.
- Docker Compose binds published service ports to loopback by default and requires database, Redis, and JWT secrets.

## Residual risks and deployment requirements

| Priority | Finding | Status / required action |
|---|---|---|
| High before multi-replica exposure | The new authentication rate limiter is process-local. | Keep it as defence-in-depth and configure a shared API gateway/WAF/Redis-backed limit before running multiple API replicas. |
| High before public production launch | No dependency lockfile was present on the reviewed branch. | Commit a reviewed npm lockfile and use `npm ci` for reproducible dependency resolution. The new audit gate checks the dependency tree resolved by CI but does not replace lockfile integrity. |
| High before live provider operation | No real Meta/Resend secrets or verified sender configuration were available for this audit. | Configure secrets in the deployment secret manager; verify provider webhook URLs and signatures using provider-issued test events. No live send was attempted. |
| Medium | API listens on `0.0.0.0` inside its container. | Keep host bindings loopback-only unless a hardened reverse proxy, TLS, firewall rules, and trusted proxy configuration are in place. |
| Medium | Admin notification views expose recipients, provider IDs, order references, and operational error details to both ADMIN and SUPER_ADMIN roles. | Confirm this data scope is appropriate for every ADMIN user; use narrower permissions and retention controls if operational roles should not see customer contact data. |
| Medium | Rate limiting is not shared across replicas and webhook endpoints do not have a dedicated application-level rate limit. | Enforce request limits and body-size limits at the edge. Preserve provider retries and signature verification. |
| Medium | No automated retention/deletion policy for notification payloads, attempts, and provider event metadata was verified in the reviewed files. | Define retention periods, deletion jobs, and backup expiry in line with applicable privacy requirements. |
| Low | Docker images use floating base tags and install dependencies during image build without a committed lockfile. | Pin image digests and use lockfile-based clean installs before production release. |

## CI verification status

The last completed run observed **before the audit commits** was run #531 and passed its then-current steps, including type-check, automated tests, application builds, Docker Compose validation/startup, API readiness, and the Notification Center route/metrics smoke tests.

The audit commits add new guard and webhook tests plus the dependency audit step. Their result remains **pending until GitHub Actions runs against the new head SHA**. Do not treat the earlier run as proof that these new changes passed.

## Secret handling

No production secrets were generated, inserted, echoed, or committed. Do not paste provider tokens into source files or chat. Configure `JWT_SECRET`, database/Redis credentials, Meta credentials, Resend credentials, and bootstrap administrator credentials in the production secret manager. Rotate any credential that has ever been committed or exposed.

## Audit conclusion

**Source review:** targeted hardening applied.  
**New tests:** added; awaiting CI execution.  
**Dependency vulnerability scan:** added as a CI gate; awaiting execution.  
**Live provider verification:** not performed; requires genuine provider credentials and a controlled test recipient.  
**Production approval:** withheld until the residual deployment requirements above are addressed and the new CI run passes.
