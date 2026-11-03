# MES STORE — Commerce Engineering Rules

Status: repository-wide engineering policy. Applies to the existing storefront, web/API/admin apps, database, integrations, CI/CD and future clients.

Decision rule: customer safety, financial correctness, data integrity and recoverability take priority over speed or visual novelty. This policy is informed by OWASP ASVS 5.0, OWASP security guidance, PCI Security Standards Council e-commerce guidance, W3C WCAG 2.2 and Google Core Web Vitals. It does not claim certification or legal compliance.

## 1. Non-negotiable principles
1. Preserve the existing storefront, product IDs, catalogue, media, contact details, promotions, WhatsApp flow and garment-motion work. Extend in place; do not replace with a demo.
2. Never fabricate products, photos, stock, reviews, customer data, shipping promises, payment success or business policies.
3. The server/database are authoritative for price, discount, stock, order totals, payment state and permissions. Browser values are untrusted.
4. Money and stock changes must be atomic, auditable and repeat-safe. Never use floating-point arithmetic for money.
5. Customer flows must work on mobile, support Arabic RTL, explain errors and preserve input when safe.
6. Fail closed for authentication, authorization, payment verification, promotions and admin operations.
7. Every critical behavior needs automated tests; a successful build alone is not proof.
8. Distinguish implemented, tested, externally configured and not-yet-implemented capabilities.

## 2. Catalogue and product data
- Product ID is stable and immutable; SKU and slug are unique. Never recycle IDs.
- Purchasable products must be ACTIVE and have valid price and required customer information.
- Store prices as fixed-precision decimals with explicit currency. EGP is the default display currency; never silently mix currencies.
- A crossed-out/reference price must be genuine and auditable.
- Stock quantity is nullable only when inventory is genuinely untracked. Zero means unavailable; null is not automatically unlimited.
- Variants (size/color) must become distinct sellable SKUs with their own stock; do not pretend one product-level count tracks variant stock.
- Images must belong to the correct product, have optimized formats, meaningful alt text and stable order. A garment-motion mask must not be reused after its source image changes.
- Claims about fabric, sizing, care, delivery and reviews must be sourced and verifiable.
- Archive products referenced by orders; do not delete historical commerce records.

## 3. Pricing, discounts, coupons and tax
- Recalculate totals on the server at checkout from database records. Ignore client-supplied prices, discounts, totals and shipping costs.
- Use decimal/minor-unit arithmetic consistently. Document rounding and whether discounts apply before/after shipping and tax.
- Quantity discounts require eligibility scope, dates, limits, exclusions and clear customer disclosure.
- Coupon validation is server-side: active window, usage limits, per-customer limits, eligible scope, minimum spend and stacking policy.
- Prevent replay/double redemption using transactions and database constraints.
- Promotion stacking must be explicitly defined; never silently combine offers.
- Do not invent tax rates, VAT treatment or invoice obligations. Confirm Egyptian tax/e-invoicing requirements with a qualified local accountant/adviser.
- Save price/discount snapshots on order items so catalogue edits cannot rewrite historical orders.

## 4. Inventory and carts
- Validate product status and stock when adding to cart and again inside the checkout transaction.
- A cart is not a stock reservation. Any future hold system needs expiry, release, renewal and concurrency rules.
- Quantities are bounded positive integers. Reject malformed IDs, inactive products and requests exceeding tracked stock.
- Prevent overselling with conditional atomic updates, transactions and retry handling for serialization conflicts.
- Checkout must be idempotent: duplicate requests must not create duplicate orders or charges. Persist an idempotency key before online payments or automatic retries.
- Enforce cart ownership. A session identifier alone is not authorization to read private customer data.
- Never expose another customer's cart/order by guessing an ID.

## 5. Checkout and order lifecycle
- Guest checkout may remain available; collect only fulfilment-required data.
- Validate recipient, reachable phone, city, street and delivery fields. Save address snapshots.
- Before confirmation, show itemized totals, currency, discounts, shipping, applicable taxes/fees, payment method and delivery conditions.
- A browser redirect or frontend callback is never proof of payment.
- Use controlled transitions: PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED; cancellation/refund are explicit authorized transitions.
- Reject illegal or repeated transitions that cause duplicate side effects.
- Save immutable item snapshots: name, SKU, variant, unit price, quantity and line total.
- Persist the order before sending email/WhatsApp/SMS. Notifications are retryable side effects, not the order itself.
- COD remains payment-pending until collection is explicitly recorded. Creating a COD order is not receiving money.

## 6. Payments and finance
- Keep COD separate from online payment integrations.
- Use a PCI-compliant hosted checkout/provider tokenization for cards. Never store/log full PAN, CVV, PIN or raw card credentials.
- Verify payment server-to-server using signed webhooks/provider APIs; verify signature, replay/timestamp, amount, currency, merchant and order reference.
- Persist provider event IDs with unique constraints and process webhooks idempotently.
- Mark an order paid only after verified evidence is persisted.
- Refunds, partial refunds, failures and chargebacks require records, reason, actor and reconciliation.
- Financial audit records are append-only; corrections use compensating entries.
- Keep test/live credentials separate and out of source control, frontend bundles and logs.
- Hosted checkout alone does not prove PCI compliance; confirm scope with the acquirer/provider.

## 7. Shipping, returns and customer policies
- Shipping prices and delivery estimates come from configured rules/carrier data, not assumptions.
- Validate serviceability before accepting payment or confirming the order.
- Store the shipping quote and destination snapshot used at checkout.
- Tracking updates must be traceable to carrier data or a documented manual action.
- Publish delivery, exchange, return, cancellation and refund terms before purchase.
- Returns reference original order/items and record condition, restock decision and refund status.
- Never automatically restock damaged/used goods.
- Do not invent delivery SLAs, free-shipping thresholds or coverage areas.

## 8. Identity and administration
- Admin is never protected by hidden URLs, query parameters, hidden buttons or client-only checks.
- Authorize every API route and every object access; deny by default.
- Separate CUSTOMER, ADMIN and SUPER_ADMIN with least privilege.
- Require MFA for administrators before production; reauthenticate for sensitive changes and protect recovery.
- Use modern password hashing (Argon2id preferred), secure session cookies, CSRF protection where applicable, session rotation, server-side expiry and logout invalidation.
- Rate-limit login, reset, OTP, coupon, checkout and abuse-prone endpoints. Avoid account enumeration in reset/login responses.
- Audit who changed prices, stock, discounts, orders, refunds, roles and settings, including timestamp and before/after values.
- Never return password hashes, tokens, secrets or private customer data in API responses/logs.

## 9. Application and infrastructure security
- Use OWASP ASVS 5.0 as a verification baseline; track requirements and evidence.
- Validate inputs at API boundaries; reject unknown DTO fields; encode output and avoid unsafe HTML injection.
- Use parameterized database access. Test for injection, XSS, CSRF, SSRF, broken access control/IDOR, insecure deserialization and misconfiguration.
- Restrict CORS to explicit production origins. CORS is not authentication.
- Production requires HTTPS, secure cookies, suitable security headers and a tested CSP.
- Apply request/body limits, upload type/size and file-signature checks; store uploads outside executable web roots.
- Patch dependencies and run dependency, secret and static-analysis scans. Review supply-chain changes.
- Use least-privilege environment-specific credentials and rotate after suspected exposure.
- Never run uncontrolled schema mutation (for example, Prisma db push) at production startup. Production schema changes require reviewed versioned migrations, backup and recovery planning.
- Keep PostgreSQL and Redis on private networks; do not expose them publicly without a documented security requirement.

## 10. Privacy
- Collect the minimum data needed to fulfil orders and support customers.
- Define retention/deletion rules for customers, abandoned carts, logs, exports and backups.
- Restrict addresses, phone numbers and order history by role and ownership.
- Encrypt transport and protect sensitive stored data according to risk and legal requirements.
- Redact personal data from logs, analytics and support exports.
- Obtain appropriate consent for marketing and provide opt-out; distinguish transactional from marketing messages.
- Document third-party tracking and data sharing. Review Egyptian privacy and consumer-protection requirements with qualified local counsel.

## 11. Accessibility, RTL and performance
- Target WCAG 2.2 AA across complete customer/admin journeys.
- Support keyboard use, visible unobscured focus, accessible names, sufficient contrast, semantic structure and useful errors.
- Support Arabic RTL and correct LTR rendering for numbers, email, phone, URLs and identifiers.
- Mobile-first; resilient on slow networks; respect reduced-motion preferences.
- Optimize responsive images, fonts, scripts and caching without serving stale prices/stock.
- Monitor Core Web Vitals at the 75th percentile: LCP ≤ 2.5s, INP < 200ms, CLS < 0.1.
- Product pages need meaningful metadata, canonical URLs, crawlable links, accurate structured product/offer data, sitemap and robots rules.
- No fake urgency, fake scarcity, fabricated reviews or misleading checkout defaults.
- Design and test loading, empty, error, unavailable and success states.

## 12. Reliability and recovery
- Use structured logs and request IDs; never log credentials or payment secrets.
- Monitor errors, latency, checkout failures, payment reconciliation, stock conflicts, database health and background jobs.
- Health/readiness checks must cover dependencies needed to serve traffic.
- Back up database and critical assets; encrypt backups and test restoration. An untested backup is unverified.
- Define RPO/RTO before production.
- Use graceful shutdown, bounded retry with backoff/jitter and recovery queues for failed asynchronous work.
- Prevent duplicate side effects with idempotency and unique event constraints.
- Maintain incident procedures for payment errors, data exposure, overselling, failed deploys and corruption.

## 13. Release gates
A change is complete only after relevant gates pass:
1. Inspect the diff and prove existing behavior/data was not unintentionally removed.
2. Type-check and lint affected workspaces.
3. Validate schema and migration compatibility.
4. Run unit, API integration and browser critical-path tests.
5. Test negative paths: invalid input, inactive products, insufficient stock, duplicate requests, concurrent checkout, unauthorized access and provider failure.
6. Build all affected apps.
7. Validate Docker and boot the full stack against disposable services.
8. Smoke-test health, catalogue, cart, checkout and storefront.
9. Run security/dependency/secret, accessibility and performance checks appropriate to the change.
10. Verify logs, recovery notes and documentation.
11. Confirm the final workflow is successful on the exact release commit.
12. Deploy through a reviewed process and verify the live deployment plus a synthetic purchase.
Never merge/deploy merely to clear a checklist. Report failed and pending gates accurately.

## 14. MES STORE policy defaults
- Store name: MES STORE. Primary language Arabic/RTL. Currency EGP by default.
- Guest checkout is allowed.
- COD is allowed as a pending payment method, subject to actual fulfilment operations.
- Online payments stay disabled until a real provider, verified webhooks, refunds and reconciliation are implemented.
- Shipping price/ETA is unset until the owner confirms real operating rules.
- Tax is not assumed; confirm locally.
- Unknown stock stays unknown.
- Preserve current coupon/quantity-discount data, but do not treat it as production-authoritative until server-side validation/calculation is implemented.
- WhatsApp is a contact/notification channel, not proof of payment or fulfilment.
- Garment Motion is an enhancement and must never block browsing, cart, checkout or accessibility.

## 15. Implementation truth at policy adoption
- Existing static storefront and its catalogue/data/WhatsApp interactions are retained.
- Monorepo includes Next.js web/admin shells, NestJS API, Prisma schema, PostgreSQL/Redis Docker configuration and CI.
- Product listing and guest-cart API routes exist.
- Guest checkout/COD order creation with transactional tracked-stock decrement has been added.
- Checkout unit tests have been added; they are not considered verified until CI passes on the final commit.
- A first administrator authentication/RBAC implementation, protected product/order administration API, initial Prisma migration and administrator web console have been added. They remain pending final CI verification and security review; the admin browser currently holds its short-lived bearer token in session storage.
- Redis is provisioned but is not yet a fully implemented application dependency.
- GitHub Pages static deployment does not deploy Next.js/NestJS services.
- A passing workflow proves only the checks run against that exact commit; it is not certification or proof of production readiness.

## 16. Primary references
- OWASP ASVS 5.0: https://asvs.owasp.org/
- OWASP Top 10: https://owasp.org/www-project-top-ten/
- OWASP Session Management: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- PCI Security Standards Council: https://www.pcisecuritystandards.org/
- W3C WCAG 2.2: https://www.w3.org/TR/WCAG22/
- Google Core Web Vitals: https://developers.google.com/search/docs/appearance/core-web-vitals

These are engineering baselines, not a security certification or substitute for qualified legal/accounting/payment-provider advice.


## 17. Newly implemented platform controls (verification pending)
- Administrator login is private: no public registration endpoint exists. First-run bootstrap is opt-in through paired environment variables and creates a SUPER_ADMIN only if the email is absent.
- Passwords use per-account random-salt scrypt hashes; API access tokens are HMAC-SHA256 signed and expire after 15 minutes. Protected requests reload the user and reject inactive accounts.
- Admin routes enforce ADMIN or SUPER_ADMIN roles on the server. Hiding UI controls is never treated as authorization.
- Product archive is a soft-delete. Order state transitions are checked server-side; cancellation before shipment restores tracked stock in the same transaction. Refund status is blocked until payment-provider reconciliation exists.
- New environments apply committed migrations with `prisma migrate deploy`. Existing databases created with `db push` require a reviewed baseline operation and backup; never mark a migration applied without verifying the live schema.
- Remaining security work includes edge/API rate limiting, MFA, session revocation/refresh strategy, formal audit logging, production HTTPS/reverse-proxy configuration and a penetration test. Session-storage bearer tokens are exposed to same-origin script execution; keep the admin origin tightly controlled and prioritize an HttpOnly-cookie/BFF session before broad public exposure.
- The admin UI currently supports login, overview, product creation/edit/archive and order progression. Image upload/media management, customer accounts, coupons/shipping administration and refunds remain incomplete.
- Full CI, browser E2E, backup restore, monitoring and production deployment must pass on the exact release commit before declaring the platform production-ready.

## 18. Database and local-network hardening (verification pending)
- A follow-up migration adds database CHECK constraints for positive product prices, nonnegative tracked stock, bounded cart-line quantities, nonnegative order/payment amounts, reconciled order totals and mathematically consistent order-item line totals. The migration intentionally fails on pre-existing invalid data rather than silently correcting financial or inventory records.
- The cart API rejects a combined product line quantity above 20 before writing, matching the database constraint and DTO contract.
- Docker Compose published ports bind to `127.0.0.1` by default, including PostgreSQL and Redis. Set `HOST_BIND_ADDRESS=0.0.0.0` only when intentional external exposure is protected by a firewall and the required network controls. Application services should normally sit behind an HTTPS reverse proxy.
- These changes require successful migration execution, Docker Compose validation and full CI on the exact commit before they can be marked verified.
