# Demo commerce systems

This branch now includes demo-ready payment, shipping, customer-account and order-tracking foundations. These are simulations only.

## Payment methods

`GET /api/demo-commerce/payment-methods` returns the configured methods:
- `CASH_ON_DELIVERY` — cash on delivery; no online charge.
- `DEMO_CARD` — simulated card payment.
- `DEMO_WALLET` — simulated wallet payment.

For a demo online-payment result, call:

```http
POST /api/demo-commerce/orders/{orderNumber}/payment
Content-Type: application/json

{ "phone": "the-phone-used-at-checkout", "outcome": "success" }
```

`outcome` accepts `success`, `failed` or `pending`. The API writes a clearly marked `demo_gateway` payment record and never contacts a bank, wallet or payment processor. A simulated successful payment confirms a pending order. Do not use this endpoint as a real payment integration.

## Shipping options

`GET /api/demo-commerce/shipping-options` returns server-priced demo methods:
- `DEMO_STANDARD`: EGP 45, estimated 3–5 days.
- `DEMO_EXPRESS`: EGP 75, estimated 1–2 days.
- `DEMO_PICKUP`: EGP 0, collection estimate depends on readiness.

Checkout accepts optional `paymentMethod` and `shippingMethod` fields. The server calculates the selected demo shipping fee; browser-submitted totals are not trusted. These are sample rates, not carrier quotes.

To create a demo dispatch for an order already in `PROCESSING` state:

```http
POST /api/demo-commerce/orders/{orderNumber}/dispatch
Content-Type: application/json

{ "phone": "the-phone-used-at-checkout" }
```

This creates a `DEMO_COURIER` shipment and a `MES-TRK-*` tracking number. No courier is contacted and no physical label is purchased. Order state changes caused by simulated payment, dispatch and delivery are recorded in the append-only `order_status_events` audit table in the same database transaction. A dispatch cannot skip the `CONFIRMED → PROCESSING → SHIPPED` lifecycle. Repeated identical shipment status callbacks are idempotent, and a successful demo payment cannot be downgraded to failed.

Demo shipment events can be added through `POST /api/demo-commerce/shipments/{trackingNumber}/status` using the checkout phone, one of `PICKED_UP`, `IN_TRANSIT`, `OUT_FOR_DELIVERY`, `DELIVERED` or `DELIVERY_ATTEMPT_FAILED`, plus a description and location. These endpoints are intentionally demo-only and must be replaced with authenticated staff actions and signed carrier webhooks before production.

## Customer accounts

- `POST /api/auth/register`: create a customer account. Password minimum is 12 characters.
- `POST /api/auth/login`: issue the existing short-lived bearer token.
- `GET /api/account/me`: profile.
- `GET /api/account/addresses` and `POST /api/account/addresses`: saved delivery addresses.
- `GET /api/account/orders`: latest 50 orders belonging to the authenticated customer.

Send `Authorization: Bearer <token>` to account endpoints. If a customer checks out while signed in, the order is linked to that account and appears in order history. Guest checkout remains supported. Email verification, password reset, MFA, refresh-token/session management, consent/privacy workflows and customer self-service cancellation are not implemented yet.

## Tracking lookup

`GET /api/demo-commerce/track/{trackingNumber}?phone={checkoutPhone}` returns the shipment timeline only when the supplied phone exactly matches the phone stored on the order. This is a demo access check, not a substitute for production-grade tracking tokens, throttling and abuse monitoring.

## Replacing the demos

The payment and shipping provider names, identifiers and demo rates are isolated in `apps/api/src/demo-commerce/demo-commerce.service.ts`. Replace these adapters with provider-specific server-side integrations, keep credentials in environment secrets, verify payment signatures/webhooks, implement idempotent capture/refund/reconciliation, obtain live carrier quotes, and authenticate staff shipment updates. Preserve the stable order/payment/shipment records and never treat a demo `PAID` status as evidence of a real financial transaction.

**Safety boundary:** every demo response marks `demo: true` or `environment: DEMO_ONLY`; no external payment or courier provider is called.


## Customer-facing portal

The Next.js customer web app exposes:
- `/account` — registration/login, customer profile, saved addresses and order history.
- `/track` — tracking-number and checkout-phone lookup.

The account page stores the short-lived demo bearer token in browser session storage. This is acceptable only for a controlled demo; before public release, replace it with an HttpOnly, Secure, SameSite cookie through a BFF/session layer and add CSRF protection, rate limiting, email verification and account recovery. Set `NEXT_PUBLIC_API_URL` to the public HTTPS API base URL in the web deployment environment.


## Current storefront integration boundary

The payment and shipping options are available through the API and accepted by the API checkout DTO. The new Next.js customer portal currently provides account and tracking screens. The original `ELITE.html` checkout still follows its existing WhatsApp flow; its cart has not yet been migrated to the API checkout session. Therefore, the demo payment/shipping choices are API-ready but are not yet selectable from that legacy checkout screen. Do not present the old WhatsApp checkout as having charged or booked anything.
