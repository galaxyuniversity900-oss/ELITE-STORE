# MES STORE — Commercial Test Readiness Plan

**Purpose:** controlled pre-launch testing of the existing storefront and commerce platform. This document does not certify legal, PCI, security or production readiness.

## Current operating boundary

- The root GitHub Pages storefront uses a WhatsApp order-request flow. It does not create a server order, reserve stock, charge a payment method or book a courier.
- The NestJS API has guest checkout and demo payment/shipping adapters. Demo success is not real payment or shipment evidence.
- The original HTML storefront has not yet been migrated to the API checkout session.
- Product catalogue stock is unknown unless explicitly configured. Do not invent stock.
- All customer and order tests must use synthetic data, never real customer PII.

## Automated checks

Run with Node.js 22:

```bash
node scripts/verify-garment-motion.mjs
node scripts/verify-commercial-readiness.mjs
npm run lint
npm test
npm run build
npm run db:validate
docker compose -f infra/docker/docker-compose.yml config --quiet
```

The commercial readiness script separates structural test failures from owner-controlled pre-launch blockers. Set `STRICT_COMMERCIAL=1` to make missing owner configuration fail the command.

## Test data

Use a dedicated test browser profile and synthetic details only:
- Customer: MES QA Customer
- Phone: a test number controlled by the store owner (do not message a real customer)
- Address: QA / TEST ADDRESS — NOT FOR DELIVERY
- Products: use catalogue items with confirmed prices only
- Never use real card details, real addresses or a real courier dispatch in demo testing

## Manual customer journey matrix

| Area | Test | Expected result |
|---|---|---|
| Catalogue | Open on mobile and desktop | Products and category filters load; no broken assets or console errors |
| Product details | Open Quick View, switch variants, close with Escape | Correct product remains selected; modal is keyboard/touch usable |
| Motion | Disable motion in OS settings | Store remains usable and animations are reduced |
| Product price | Try an item marked price-confirmation-required | It cannot be added until its final price is set |
| Cart | Add confirmed-price products, change size and quantity | Cart lines and totals update consistently |
| Empty cart | Try to prepare checkout with no items | Checkout is blocked with a clear message |
| Customer fields | Submit blank, malformed phone, short address | No WhatsApp link is created; the first invalid field receives focus |
| Injection safety | Enter HTML-like text in customer fields | It is displayed as text, never executed as markup |
| Discounts | Test coupon and quantity rule separately | Only the better eligible discount is applied; no implicit stacking |
| WhatsApp | Use only an owner-controlled test number | Message contains the items, sizes, quantities and estimated total |
| Order status | Inspect the preview before sending | It clearly says pending store confirmation; no fake order-success claim |
| Missing contact | Clear the store WhatsApp setting in a test branch | The UI explains configuration is missing and creates no send link |
| Responsive layout | Test 360px, 390px, tablet and desktop widths | No clipped checkout fields, modal overflow or hidden purchase controls |
| Accessibility | Keyboard-only and screen reader spot check | Visible focus, meaningful names, readable errors, logical RTL order |

Do not actually send a test WhatsApp message unless the destination number is controlled by the store owner and the owner has approved the test.

## API demo checkout

Use the local Docker stack with disposable database data. Follow `docs/commerce/DEMO_COMMERCE_GUIDE.md` for the exact API routes and request contracts. Verify:
1. Checkout uses server-side catalogue prices, not browser-supplied prices.
2. Repeating the same checkout with the same `Idempotency-Key` returns the same order.
3. A different checkout attempt uses a new key.
4. Insufficient stock, inactive products and malformed quantities are rejected.
5. Demo payment outcomes are explicitly marked demo and never represented as real charges.
6. Demo shipping/tracking is never represented as a carrier booking.
7. Customer/order data cannot be read by another session or account.
8. Unauthorized admin actions are rejected.

Reset the disposable database after testing. Never point this test plan at a production database.

## Owner-controlled launch gates

The automated report currently flags these as blockers until verified:
- Correct store WhatsApp number and ownership.
- Actual product photography and final product prices, including products with `priceNote`.
- Approval of every active coupon/quantity discount and the no-stacking policy.
- Public delivery, exchange/return, cancellation, privacy and customer-contact policies.
- Production hosting for API/database, HTTPS, rate limits, monitoring, backups and a tested restore.
- Real payment provider and courier integration if online payment or booked delivery is advertised.
- Browser E2E, accessibility, security and performance checks on the exact release commit.

## Release decision

A controlled internal test can begin after the automated checks pass, using synthetic data and an owner-controlled WhatsApp destination. Do **not** open unrestricted public sales until every owner-controlled blocker is resolved and the final deployment is verified. A green CI run alone is not a commercial or production certification.
