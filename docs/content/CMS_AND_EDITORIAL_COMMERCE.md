# CMS and editorial commerce

## Admin workspace API

Content pages:
- `GET /admin/content/pages`
- `POST /admin/content/pages`
- `PATCH /admin/content/pages/:id`

Editorial collections:
- `GET /admin/editorial/collections`
- `POST /admin/editorial/collections`
- `PATCH /admin/editorial/collections/:id`
- `POST /admin/editorial/collections/:id/products`
- `DELETE /admin/editorial/collections/:id/products/:productId`

Pages and collections support DRAFT, PUBLISHED and ARCHIVED states, slug, structured JSON body, hero image and SEO metadata. Publishing stamps `publishedAt`; returning to draft/archive clears it. Collection product membership is unique per product and supports explicit ordering.

## Public read API

- `GET /api/content/pages/:slug`
- `GET /api/content/collections/:slug`

Public endpoints expose only PUBLISHED records with a publication timestamp not in the future. Editorial collection responses include only active products and their images/category.

This PR provides the content data model and API workspace foundation. A visual block editor, preview/draft authorization, revision history, asset upload workflow, scheduled publishing UI and storefront editorial templates remain follow-up work.
