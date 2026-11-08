# ELITE-STORE Security Review and Remediation

**Review scope:** Orders, payment state transitions, webhooks, notifications, admin authorization, secrets, privacy, and deployment controls.

**Review baseline:** `notifications/provider-production-readiness` as inspected on 2026-11-06.  
**Remediation branch:** `security/commerce-webhook-admin-hardening`.

## Confirmed findings and remediation

| Area | Finding | Severity | Action |
|---|---|---:|---|
| Payment / demo commerce | Public demo payment, dispatch, and shipment-status endpoints mutate persisted commerce state using only order/tracking identifiers plus a phone number. | High | Added a deny-by-default guard. All demo commerce endpoints return not-found in production; non-production requires explicit `DEMO_COMMERCE_ENABLED=true`. |
| Notifications / distributed workers | Delivery attempt status was updated to success/failure independently of whether the worker still owned the outbox lease. | High | Outbox ownership update now occurs first in the same transaction. Attempt is marked SUCCEEDED/FAILED only when the lock token still owns the row; otherwise it is ABANDONED with a reason. |
| Privacy / notifications | Successfully delivered outbox rows retained recipient and full customer/address payload indefinitely. | Medium | Successful delivery now clears recipient and payload while retaining delivery metadata and provider message ID for webhook correlation. |
| CI coverage | Existing workflow branch filters did not include the provider-readiness branch as a PR target, so security PRs against it could miss the workflow. | Medium | Added the provider-readiness branch to PR triggers and the security branch to push triggers. |

## Controls inspected

- **Checkout:** server derives prices from current product records, reserves finite stock in the database transaction, validates idempotency keys, and commits order plus notification outbox atomically.
- **Payment:** the inspected implementation exposes simulated payment methods only; no real payment gateway integration or verified provider webhook is present. Do not represent demo card/wallet outcomes as real payment authorization or capture.
- **Admin:** admin controllers use bearer authentication plus role checks. Both ADMIN and SUPER_ADMIN currently have access to the same admin controller operations; no fine-grained permission matrix was found in the inspected controller.
- **Meta WhatsApp webhook:** HMAC SHA-256 over raw request bytes is checked with constant-time comparison.
- **Resend webhook:** Svix signature, timestamp tolerance, and event deduplication are implemented. Confirm the configured webhook secret is the provider's current signing secret.
- **Secrets:** `JWT_SECRET` is required at token issue/validation time and has a 32-byte minimum. Provider secrets are read from environment variables; never commit real values.
- **Privacy:** order records retain customer contact and shipping-address snapshots. No automated order-data retention/deletion job or customer erasure workflow was verified.
- **Abuse controls:** no distributed rate limiter was found on login, registration, checkout, or webhook routes during this source review. Enforce per-IP and per-account limits at the edge/API gateway before public launch.
- **Operational controls:** backup encryption, PITR, restore drills, production secret rotation, alert delivery, and external penetration testing are deployment-level checks and cannot be proven from source code alone.

## Required deployment configuration

- Keep `DEMO_COMMERCE_ENABLED=false` in every production environment.
- Store JWT, Meta, Resend, and database credentials in the deployment secret manager, not GitHub source files or client-side `NEXT_PUBLIC_*` variables.
- Rotate any credential that has ever been committed or shared outside the secret manager.
- Restrict production database/network access; use TLS at the reverse proxy and database/provider connections where supported.
- Configure edge rate limits for authentication, registration, checkout, tracking, and webhooks. Webhook rate limits must allow legitimate provider retries.
- Define and approve a retention schedule for order PII, audit events, and backups before launch.

## Verification status

- Remediation unit tests were added for production demo-endpoint isolation, worker lease loss, and post-delivery PII scrubbing.
- CI is configured to run on the remediation branch and its PR target.
- A passing CI run is required before these changes can be called verified.
- Live payment, Meta, Resend, production secrets, deployment configuration, backup restoration, and external penetration tests were not executed by this source-only review.


## Follow-up hardening (2026-11-08)

- Added a PostgreSQL-backed fixed-window rate limiter shared by API replicas: login 10/15m, registration 5/hour, checkout 30/15m, and provider webhooks 300/min. Responses over the limit include HTTP 429 and `Retry-After`. Only SHA-256 bucket keys are persisted, not raw IP values.
- Added an explicit dry-run-first order PII redaction command. It requires an owner-approved `ORDER_PII_RETENTION_DAYS` between 30 and 3650; writes additionally require `--apply` and `ORDER_PII_RETENTION_CONFIRM=REDACT_TERMINAL_ORDER_PII`. It excludes non-terminal orders and orders with pending/processing notification jobs. It retains financial/order-item history and does not erase user profiles, address book entries, backups, logs or provider records.
- Unexpected rejected promises from individual outbox worker tasks are now logged with the notification identifier and a sanitized error class.
- The previous CI failure on PR #11 was isolated to a syntax error in `scripts/verify-motion-embeds.mjs`; the workflow's type-check, tests, build, Docker stack, commerce E2E, k6 and PostgreSQL restore steps had succeeded on that run. The verifier path handling has been corrected and hardened against repository path traversal.

### Remaining release gates

- Approve retention duration and customer-erasure process with qualified local counsel before enabling destructive retention runs.
- Configure a precise trusted-proxy hop count or equivalent edge controls when deployed behind a reverse proxy. Do not trust arbitrary forwarded IP headers.
- Add MFA, secure HttpOnly/BFF sessions, session revocation and fine-grained admin permissions.
- Configure encrypted off-site backups, PITR, immutable retention, RPO/RTO and production restore drills.
- Perform live provider preflight and controlled test sends only after real secrets and owner-controlled test destinations are configured.
- Complete independent external penetration testing. CI is not a penetration test or compliance certification.
