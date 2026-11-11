# Commerce intelligence

Admin-only endpoint:

`GET /admin/analytics/commerce?from=2026-10-01&to=2026-10-31`

Returns:
- order count for the requested period;
- gross order value grouped by order status and currency (currencies are never combined);
- top ten products by gross line value, including units and SKU.

The endpoint rejects invalid dates and ranges longer than 366 days. It returns aggregated data only and does not expose customer names, emails, phones, addresses, order numbers or payment references.

This is an operational summary, not a financial ledger or audited accounting report. Cancelled and refunded orders are excluded from top-product rankings; the status/currency revenue table includes every order status so operators can see the full lifecycle distribution. Finance reconciliation must use the payment reconciliation workflow and provider settlement records.
