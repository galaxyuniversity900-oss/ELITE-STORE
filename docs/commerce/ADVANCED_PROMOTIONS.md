# Advanced promotions

Admin-only endpoints:
- `GET /admin/promotions`
- `POST /admin/promotions`
- `PATCH /admin/promotions/:id`
- `DELETE /admin/promotions/:id` (deactivates; keeps redemption history)

Checkout accepts an optional `promotionCode`. Codes are normalized to uppercase. The server validates active state, start/expiry timestamps, minimum subtotal and remaining usage. Percentage and fixed discounts are calculated server-side, capped by `maxDiscount` and never exceed the subtotal. The usage count increment and redemption record are committed in the same transaction as order creation and notification enqueue; a concurrent claim that loses the compare-and-set fails checkout rather than exceeding the limit.

This implementation currently supports cart-wide EGP promotions only. It does not implement product/category exclusions, customer segments, stackable offers, gift cards, coupon UI, tax handling or campaign attribution. Do not advertise a promotion until it is configured and tested in staging.
