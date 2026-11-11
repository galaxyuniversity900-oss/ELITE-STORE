# Customer consent preferences

Authenticated customer API:
- `GET /account/consents`
- `POST /account/consents` with `{ "consentType": "MARKETING_EMAIL", "granted": false }`

Supported purposes: `MARKETING_EMAIL`, `MARKETING_WHATSAPP`, `ANALYTICS`, and `PERSONALIZATION`.

Each decision is stored per user and purpose, with the current policy version, source and decision timestamp. Revocation is recorded as `granted: false`; records are not deleted when consent is withdrawn. The API uses the authenticated user ID and cannot write another customer's preferences.

Set `CONSENT_POLICY_VERSION` in the API environment to the identifier of the currently published privacy/consent policy. The API fails closed when this value is missing. Marketing and analytics systems must check the relevant consent before processing; this endpoint alone does not automatically enforce consent in every downstream integration.

## Data access and erasure requests

- `GET /account/export` returns a versioned JSON export of the authenticated customer's profile, addresses, consent decisions, orders, order items, payment metadata and shipment summary.
- `POST /account/erasure-requests` creates a pending erasure request; an existing open request is returned instead of creating a duplicate.
- `GET /account/erasure-requests` lists only the authenticated customer's requests.

An erasure request is not an immediate deletion command. It must be reviewed for applicable statutory retention, active disputes, fraud prevention and accounting obligations. This implementation records and deduplicates the request; it does not yet provide an admin approval/rejection workflow or execute anonymization/deletion. Do not represent a pending request as completed.

## Customer return request intake

- `POST /account/orders/:orderNumber/return-requests` accepts a reason for an order owned by the authenticated customer.
- Only delivered orders are eligible.
- `GET /account/return-requests` returns the customer's own request history.
- A unique order constraint prevents multiple return requests for the same order.

This is request intake only. It does not approve a return, create a shipping label, mark a payment refunded, or move money. Admin review, item-level inspection, policy-window enforcement and verified payment-provider refund execution remain separate work.
