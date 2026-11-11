# Size and fit guides

Admin-only endpoints:
- `GET /admin/size-guides?categoryId=...`
- `POST /admin/categories/:categoryId/size-guides`
- `PATCH /admin/size-guides/:id`
- `DELETE /admin/size-guides/:id` (soft deactivation)

Each guide stores a category, name, measurement unit, structured measurement map and optional fit advice. Active guides are included in the public product detail response under the product category.

This is a deterministic size-chart foundation, not an AI sizing recommendation. No body measurements or sensitive customer body profiles are collected. Customer-specific size prediction, fit feedback and return-rate learning remain separate work.
