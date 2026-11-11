# Complete the Look

Admin-only endpoints:
- `GET /admin/products/:id/relations?type=COMPLETE_THE_LOOK`
- `POST /admin/products/:id/relations` with a related product ID and optional relation type/order
- `DELETE /admin/products/:id/relations/:relationId`

Supported relation types: `COMPLETE_THE_LOOK`, `SIMILAR`, and `PAIR_WITH`. Self-relations are rejected; both products must be active; relation uniqueness is enforced by the database. Product detail responses include active `COMPLETE_THE_LOOK` relations with the related product's images and category.

This is curated merchandising, not an automated recommendation model. The storefront still needs a designed presentation component and analytics to measure add-to-cart lift.
