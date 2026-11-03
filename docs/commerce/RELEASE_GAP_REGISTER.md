# MES STORE — Release Gap Register

Status: engineering backlog derived from the repository state on 2026-11-02.
Scope: preserve the existing static storefront and extend the current monorepo in place.
This register is not a claim that any listed control has passed verification.

## Release decision

**Not approved for unrestricted production launch yet.** The repository contains a working implementation foundation (static storefront, Next.js web/admin apps, NestJS API, Prisma/PostgreSQL schema, guest cart, COD checkout, administrator login/RBAC, migrations and CI workflow). The presence of code or a CI workflow is not evidence that the current branch passes its complete release gates.

## P0 — prove and close before production

| Area | Current repository evidence | Required completion evidence |
|---|---|---|
| CI and full-stack verification | CI workflow defines schema, type, test, build, Docker and HTTP smoke checks | Latest workflow run on the exact release commit is green; preserve logs/artifacts for failures |
| Admin session security | Short-lived bearer token is held in browser session storage, per commerce policy | Move to a server-managed HttpOnly, Secure, SameSite session/BFF design; add CSRF protections where applicable; verify logout/revocation and session expiry |
| Authentication abuse controls | Login and role checks exist; edge/API rate limiting remains listed as outstanding | Enforced limits, generic auth errors, lockout/backoff policy and automated abuse tests |
| Authorization and object ownership | Admin routes have role guards; guest cart is session-ID based | Negative tests for IDOR, cross-session cart access, inactive accounts, role changes and every admin mutation |
| Checkout correctness | COD checkout uses idempotency and tracked-stock transaction logic; shipping/discount totals are zero in this API path | Integration tests for concurrent checkout, retries, insufficient stock, inactive products, malformed fulfilment data and duplicate keys; server-side verified shipping/coupon rules before enabling them |
| Database invariants | Follow-up SQL migration adds CHECK constraints for product prices/stock, cart quantities, order totals, line totals and payment amounts; cart service rejects combined line quantities above 20 | Apply both migrations on clean and representative existing databases; verify the negative cases are rejected and valid checkout rows pass |
| Migration safety | Initial and commerce-integrity Prisma migrations and deployment command exist | Validate migration against a clean database and a representative existing database; backup and restore rehearsal; never baseline without schema comparison |
| Production infrastructure | Compose host ports now bind to loopback by default; GitHub Pages deploys only static storefront | Document and verify production hosting for API, web/admin, database, TLS, private networking, secrets, health/readiness, rollback and persistent storage |
| Recovery and operations | Backups, monitoring and incident readiness are documented as outstanding | Automated encrypted backups, restore drill, RPO/RTO, alerts, structured redacted logs and incident runbooks |

## P1 — complete before calling the commerce platform feature-complete

- **Customer identity:** registration/login, verified contact flow, account recovery, customer-owned order history and address management, or explicitly document a guest-only launch scope.
- **Product variants:** model size/color as independently sellable SKUs with independent stock; validate variant selection end-to-end. Do not imply product-level stock covers variants.
- **Media:** secure upload pipeline with MIME and file-signature validation, size limits, image processing, private staging, CDN delivery and admin media management.
- **Product administration:** complete edit workflow, SKU/slug validation, price/compare-at-price audit trail, category management and image ordering.
- **Promotions:** server-side coupon and quantity-discount eligibility, date windows, limits, stacking, redemption concurrency and immutable order snapshots. Browser-only discount display must not change payable totals.
- **Shipping and returns:** configurable serviceability, quote snapshots, customer-visible delivery/return terms, traceable fulfilment and controlled return/restock workflow.
- **Notifications:** durable outbox/retry pattern for WhatsApp/email/SMS notifications; notification failure must not undo an accepted order.
- **Finance:** payment reconciliation and append-only audit trail. Keep online payment disabled until provider webhooks, signature/replay verification, refunds and reconciliation are implemented.
- **Accessibility and performance:** automated and manual Arabic RTL/mobile checks, keyboard and screen-reader paths, reduced motion, Core Web Vitals and slow-network testing.
- **Garment Motion:** retain as optional enhancement; verify source-image fingerprint invalidation, large-pack handling, keyboard/accessibility fallback and that animation never blocks purchase flows.

## P2 — scale and optimization

- Use Redis only when a defined cache, queue, rate-limit or coordination use case is implemented and tested.
- Add search, filtering, analytics and merchandising only with measured performance and privacy controls.
- Add load tests, capacity limits, dependency update automation and supply-chain review.
- Add multi-region, advanced observability or event-driven services only when operating requirements justify them.

## Required verification record for every release

Record the exact commit SHA and the outcome (pass/fail/not run) for:
1. JSON and Prisma schema validation.
2. Migration deploy on a clean disposable database.
3. Type-check/lint for all workspaces.
4. Unit and API integration tests, including negative and concurrency cases.
5. All application builds.
6. Docker Compose validation and complete stack startup.
7. API health, catalogue, cart, COD checkout and admin-auth smoke tests.
8. Browser E2E for Arabic RTL/mobile storefront and admin critical paths.
9. Dependency, secret, static-analysis and authorization/security checks.
10. Backup restoration and rollback rehearsal.
11. Production deployment and post-deploy synthetic order.

A gate marked **not run** is not a pass. A build pass is not a security review, payment certification or production-readiness claim.
