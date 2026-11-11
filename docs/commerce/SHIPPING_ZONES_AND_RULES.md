# Shipping zones and rules

Admin-only API:
- `GET /admin/shipping-rules`
- `POST /admin/shipping-rules`
- `PATCH /admin/shipping-rules/:id`
- `DELETE /admin/shipping-rules/:id` (soft deactivation)

A rule matches country, city, optional area, and shipping method. Exact-area rules take precedence over city-wide rules. Checkout calculates the fee on the server and snapshots the rule ID and delivery-day range into the order shipping address.

For backward compatibility, the existing clearly labelled demo rates are used only while no active shipping rules exist. Once any active rule is configured, checkout rejects destinations/methods without a matching rule. The current checkout currency is EGP; non-EGP shipping rules are rejected until multi-currency checkout is implemented.

No courier booking, label purchase, or carrier API call is performed by these rules.
