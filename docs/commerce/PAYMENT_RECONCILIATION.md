# Payment reconciliation report

The admin API exposes a read-only reconciliation report:

`GET /admin/payments/reconciliation?page=1&limit=50&provider=...`

The route inherits the admin authentication and role guards from `AdminController`.

## Checks

Each payment is compared with its linked order for:
- payment/order amount mismatch;
- payment/order currency mismatch;
- paid payment while the order remains pending;
- refunded payment while the order is not marked refunded;
- paid payment without a provider reference;
- cash-on-delivery orders marked as paid.

The response contains `mode: READ_ONLY`, `automatedCorrections: false`, paginated rows, and a summary for the current page. It never changes payments or orders, calls a payment provider, issues refunds, or attempts settlement.

## Operational boundary

This is an internal consistency report over persisted records, not a provider-side settlement reconciliation. A production-grade provider reconciliation still requires a verified provider API/webhook adapter, signature and replay validation, provider-side transaction references, settlement reports, currency/amount rules, and authorized staging tests. Do not mark a payment refunded or paid based solely on this report.
