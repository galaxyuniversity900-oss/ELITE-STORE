# MES STORE Notification Center — Security Audit

**Audit date:** 2026-11-07  
**Repository:** `galaxyuniversity900-oss/ELITE-STORE`  
**Reviewed branch:** `admin/notification-center`  
**Pull request:** [#5](https://github.com/galaxyuniversity900-oss/ELITE-STORE/pull/5)  
**Scope:** Authentication and authorization, Notification Center API, provider webhooks, notification outbox handling, secret configuration, Docker exposure, and CI security gates.

## Executive result

The source review found security-hardening gaps and applied targeted fixes on this branch. This is **not a production security certification**. CI run #574 on commit `93de099` completed successfully across dependency audit, type-check, tests, application builds, API runtime, Docker Compose validation, full Docker stack startup, API/web/admin readiness, Notification Center route and metrics smoke tests, and existing store security checks. Additional webhook hardening and CI assertions are now committed and require their own latest-head run. Real provider authentication and delivery were not attempted because production credentials were not supplied or fabricated.

## Changes applied in this audit

1. **Authentication throttling**
   - Added an IP- and endpoint-scoped limit of 10 requests per 15-minute window to public login and registration routes.
   - Added a bounded in-memory bucket map to prevent unbounded growth.
   - Added unit tests for limit enforcement and endpoint isolation.
   - Registered the guard in the NestJS authentication module.

2. **Webhook input validation**
   - Meta WhatsApp callbacks now require an entries array, cap entries and status events at 100, validate message IDs, and accept only documented delivery statuses handled by this service: `sent`, `delivered`, `read`, and `failed`.
   - Resend event IDs and provider message IDs are type-checked and length-bounded before persistence.
   - Added negative tests for unsupported Meta statuses, oversized callback batches, malformed timestamps, oversized raw bodies, malformed error metadata, and invalid Resend timestamps.
   - Both provider webhook bodies are capped at 1 MiB; Meta signatures require exactly 64 hexadecimal characters; Resend event IDs, timestamp headers, and signature header lengths are bounded.
   - Existing HMAC/Svix signature verification remains required before event processing.

3. **Admin browser security headers**
   - Added a Content Security Policy to the admin application with `default-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, restricted form/base origins, and explicit image/font/connect sources.
   - Added `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and `Permissions-Policy` headers.
   - The CSP retains `unsafe-inline` for Next.js hydration compatibility; a nonce-based CSP would provide stronger script protection and remains a hardening opportunity.

4. **Dependency audit gate and remediation**
   - Added `npm audit --audit-level=high` to the CI workflow after dependency installation. High and critical dependency advisories fail the workflow.
   - The initial scan reported 31 advisories (11 high). After the first compatibility-preserving upgrades, a subsequent scan reported 27 advisories (5 high); the remaining high findings included `deepmerge-ts` and `multer`.
   - Updated NestJS runtime packages to 11.2.8, Nest CLI to 11.0.24, Nest schematics to 11.1.0, Jest to 30.5.2, Turborepo to 2.11.10, and Prisma / Prisma Client to 6.19.3.
   - Added npm overrides for `deepmerge-ts` 8.0.2 and `multer` 2.5.0, the patched versions for the remaining high advisories observed in the audit output.
   - CI run #574 completed `npm audit --audit-level=high` successfully after these overrides. This confirms no High/Critical advisories in the resolved tree for that run; it does not mean there are zero Low/Moderate advisories.

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
| High before public production launch | A committed npm lockfile is still being generated from the CI-resolved dependency tree. | The latest CI workflow now generates `package-lock.json` and exports it as a workflow artifact for review and commit. Switch the install step to `npm ci` once the artifact is validated and committed. |
| High before live provider operation | No real Meta/Resend secrets or verified sender configuration were available for this audit. | Configure secrets in the deployment secret manager; verify provider webhook URLs and signatures using provider-issued test events. No live send was attempted. |
| Medium | API listens on `0.0.0.0` inside its container. | Keep host bindings loopback-only unless a hardened reverse proxy, TLS, firewall rules, and trusted proxy configuration are in place. |
| Medium | Admin notification views expose recipients, provider IDs, order references, and operational error details to both ADMIN and SUPER_ADMIN roles. | Confirm this data scope is appropriate for every ADMIN user; use narrower permissions and retention controls if operational roles should not see customer contact data. |
| Medium | Rate limiting is not shared across replicas and webhook endpoints do not have a dedicated application-level rate limit. | Enforce request limits and body-size limits at the edge. Preserve provider retries and signature verification. |
| Medium | No automated retention/deletion policy for notification payloads, attempts, and provider event metadata was verified in the reviewed files. | Define retention periods, deletion jobs, and backup expiry in line with applicable privacy requirements. |
| Medium | The admin token is held in sessionStorage and is accessible to same-origin JavaScript; the CSP currently permits inline scripts for Next.js compatibility. | Consider an HttpOnly, Secure, SameSite cookie session with CSRF protection and a nonce-based CSP before higher-risk public deployment. |
| Low / Moderate | The successful high-severity gate does not mean every advisory is gone. npm audit output also identified low-severity `deepmerge` and moderate `glob` / `minimatch` findings in the development/test toolchain. | Keep the tooling off production request paths, avoid merging attacker-controlled object graphs, and monitor for patched transitive releases. |
| Low | Docker images use floating base tags and install dependencies during image build without a committed lockfile. | Pin image digests and use lockfile-based clean installs before production release. |

## CI verification status

CI run #574 on commit `93de099` completed successfully, including `npm audit --audit-level=high`, type-check, automated tests, all application builds, API runtime, Docker Compose validation, full Docker stack startup, API/web/admin readiness, Notification Center metrics route smoke, and the existing photography workflow security check.

The subsequent webhook body/header validation, webhook negative tests, admin response-header assertions, and lockfile-artifact generation are newer commits. Their latest-head CI is **pending** until GitHub Actions completes against the final head SHA. The workflow artifact containing the generated lockfile must be reviewed before committing it and switching to `npm ci`.

## Secret handling

No production secrets were generated, inserted, echoed, or committed. Do not paste provider tokens into source files or chat. Configure `JWT_SECRET`, database/Redis credentials, Meta credentials, Resend credentials, and bootstrap administrator credentials in the production secret manager. Rotate any credential that has ever been committed or exposed.

## Audit conclusion

**Source review:** targeted hardening applied.  
**New tests:** added; earlier guard/webhook tests passed in #574; newest webhook validation tests await latest-head CI.  
**Dependency vulnerability scan:** PASS in #574 for High/Critical threshold; lower severity advisories may remain.  
**Docker/runtime readiness:** PASS in #574.  
**Live provider verification:** not performed; requires genuine provider credentials and a controlled test recipient.  
**Production approval:** withheld until the residual deployment requirements above are addressed and the new CI run passes.
