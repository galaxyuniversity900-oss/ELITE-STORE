# Product variants foundation

Admin API routes (all inherit the admin role guards):
- `GET /admin/products/:id/variants`
- `POST /admin/products/:id/variants`
- `PATCH /admin/product-variants/:id`
- `DELETE /admin/product-variants/:id` (soft archive; preserves the SKU record)

Each variant has a globally unique SKU, optional size and color, optional structured attributes, optional price override, independent non-negative stock quantity, and active state.

## Scope boundary

This PR implements variant catalog management only. It does not yet bind variant IDs into carts, checkout snapshots, order items, inventory reservations, or storefront selectors. Those integrations must be delivered together with the inventory reservation and checkout pricing workstreams before variants are offered for purchase. Existing product-level stock and checkout behavior remains unchanged.
