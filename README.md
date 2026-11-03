# ELITE-STORE — MES STORE Men's Collection

Arabic RTL men's clothing storefront with an integrated, optional Garment Motion Engine.

## Garment Motion Engine

The engine is integrated into the existing `ELITE.html` product cards and quick-view modal. It does not replace the storefront, cart, sizes, wishlist, WhatsApp checkout, or the existing 32-category interaction lab.

### What it does

- Per-product image upload (JPG, PNG, WebP; 15 MB maximum).
- Manual garment mask painting and erasing, plus a simple uniform-background color-difference selection helper.
- Optional AI segmentation adapter: configure an external endpoint that accepts multipart field `image` and returns a PNG mask or JSON `{ "mask": "data:image/png;base64,..." }` / `{ "maskUrl": "https://.../mask.png" }`. The endpoint must allow browser CORS. No AI inference server or model weights are bundled.
- Static background reconstruction for the selected garment area, then a transparent garment layer.
- Category-specific 2.5D mesh deformation profiles: jacket/coat, hoodie/sweatshirt, jeans/trousers, shirt, T-shirt, dress, and generic.
- User controls for speed, intensity, sleeves, body, and garment edges. Defaults are speed 77 and intensity 63.
- Local browser persistence using IndexedDB.
- Animated product-card and quick-view rendering after a product has a saved motion pack.
- Export/import of portable JSON motion packs.

### Admin editor

Open the storefront with the query parameter:

`ELITE.html?gm-admin=1`

The product cards then show **إعداد / معاينة حركة الملابس**. Upload the actual product photograph, paint the garment mask (gold overlay), correct edges with the eraser, preview, and save.

The query parameter is a convenience UI switch, **not authentication**. Do not treat it as a security boundary. Protect editor access with real server-side authentication before exposing an editor on a public production site.

### Publish motion to every visitor

IndexedDB is local to the browser and is not shared with customers. To publish a saved product animation:

1. Open that product in the editor and choose **تنزيل ملف النشر JSON**.
2. Add the downloaded file to `assets/garment-motion/<product-id>.json` (for example `assets/garment-motion/mes11.json`).
3. Commit and deploy the repository.
4. The storefront attempts to fetch the static JSON pack when no local copy exists, then caches it in IndexedDB.

The pack includes the original image, mask, and reconstructed background as data URLs. Compress source photographs before upload; large packs increase repository size and initial download cost.

### Motion and image limitations

- This is a **2.5D image-mesh effect**, not a full 3D garment reconstruction or a physically accurate invisible-human simulation.
- One front-facing photograph cannot reveal the back of a garment or unseen folds. Avoid large rotations or claims of unseen geometry.
- The built-in automatic mask helper is color-difference based and works best on plain studio backgrounds. Actual AI segmentation requires configuring the optional external endpoint in the editor; no AI model or server is bundled. Use the manual brush/eraser to correct any model output.
- Background reconstruction uses a fast nearest-boundary color propagation fill. It works best on plain/soft backgrounds; complex scenes need a proper AI inpainting/segmentation service.
- The current repository is a static HTML storefront. There is no server-side image service or multi-user asset database in this change.

### Local validation

Requires Node.js 20.19+ or 22.12+.

```bash
node scripts/verify-garment-motion.mjs
```

No build step or npm dependency is required for the current single-file storefront.

## Existing store

The original single-file storefront remains in `ELITE.html`. Existing product data, prices, sizes, cart, wishlist, and checkout interactions are retained.


## Editable product catalogue and media library

Product information is maintained separately from the storefront in `data/products.json`. The storefront loads this file when it opens and keeps its built-in product list as a fallback if the catalogue cannot be fetched.

### Change a product price or details on GitHub

1. Open `data/products.json` in the repository.
2. Select **Edit this file**.
3. Find the product by its stable ID, such as `mes11`.
4. Change the numeric `price`, `title`, `desc`, `badge`, or `category`.
5. Commit the change.

Prices are in Egyptian pounds (EGP). Keep `price` numeric: write `1299`, not `1,299 ج.م`.

Set `active` to `false` to hide a product without deleting its record. Set it back to `true` to display it again. New records can be added by copying a product object and assigning a unique ID, for example `mes23`. Category filters are generated from the catalogue, including new categories.

### Replace or add product photographs and videos

Upload the actual files to `assets/products/<product-id>/` on GitHub. For example:

```
assets/products/mes11/
  cover.webp
  detail-1.webp
  detail-2.webp
  preview.mp4
```

Then edit the same product's `media` fields in `data/products.json`:

```json
"media": {
  "cover": "assets/products/mes11/cover.webp",
  "images": [
    "assets/products/mes11/detail-1.webp",
    "assets/products/mes11/detail-2.webp"
  ],
  "videos": [
    "assets/products/mes11/preview.mp4"
  ]
}
```

- `cover` is used as the main product photograph.
- `images` holds additional gallery images shown in quick view.
- `videos` holds playable product videos shown in quick view.
- To replace a photo, upload a new filename (such as `cover-v2.webp`) and update the JSON path. Using a new filename avoids browser/CDN cache confusion and prevents a motion mask made for the old photograph from being reused.
- To remove a gallery item or video, remove its path from the relevant array.
- Use optimized WebP/JPG/PNG images and short MP4 (H.264) or WebM videos.
- Relative paths under `assets/products/` and HTTPS URLs are supported.

The repository contains no real per-product photo set yet. Until you upload each product's own files, the existing built-in visual fallback remains in use; the catalogue does not fabricate product photographs.

### Publish changes

A GitHub commit updates the repository immediately. Visitors see the update after the configured hosting workflow finishes deploying the commit and the host/browser cache refreshes. A GitHub commit by itself does not guarantee instant delivery to visitors.

For large video files, use a video CDN or a hosting service and put its HTTPS URL in `media.videos`. Keep the GitHub repository focused on optimized photos and small assets.


## Storefront entry point

The repository root now includes `index.html`, which forwards visitors to `ELITE.html`. When GitHub Pages is enabled with the repository root as its publishing source, the repository's main URL can open the storefront without requiring visitors to type the HTML filename.


## Store contact details

Edit `data/contact.json` to maintain the store's public contact information. The footer reads this file automatically.

- `whatsapp_number`: store WhatsApp number in international digits only (for Egypt, use `20...`, without a leading `+` or local leading zero).
- `phone`, `email`, `address`, `working_hours`: optional public contact details.
- `instagram_url`, `facebook_url`, `tiktok_url`: optional HTTPS profile links.
- `store_name` and `footer_note`: displayed store identity and footer note.

The checkout preview adds a **Send order to store WhatsApp** link only when a valid WhatsApp number is configured. The owner must enter and verify their own number; no contact number is prefilled.

## Quantity discounts and coupon rules

Edit `data/discounts.json`. Discounts are calculated from the catalogue prices and actual cart quantities; there is no need to edit every product price when creating a promotion.

### Quantity rule fields

- `active`: set to `true` to enable the rule.
- `scope`: `cart`, `product`, or `category`.
- `min_units`: minimum eligible quantity. For product/category rules this is counted only among matching products.
- `type`: `percentage`, `fixed_amount` (discount per eligible unit), or `fixed_price` (new unit price).
- `value`: percentage, amount in EGP, or target unit price depending on type.
- `product_ids` or `categories`: required when using the matching scope.
- `starts_at` and `ends_at`: optional ISO date/time boundaries.

Only one promotion is applied per cart: the storefront compares the best eligible quantity discount with the coupon discount and uses the larger saving. Coupon and quantity discounts do not stack. The total is never reduced below zero.

Example: enable `buy-2-save-5` to give 5% off the cart when the customer buys at least two units. All starter coupon and quantity rules are currently disabled until the store owner approves the exact offer, eligibility and dates. The `MESVIP200` coupon is retained in the same file and can be configured or disabled there.

## Per-section configuration files

Each part of the storefront has its own editable JSON file under `data/sections/`:

| File | Controls |
|---|---|
| `home.json` | Hero title and subtitle |
| `catalog.json` | Product section title, description and display controls |
| `categories.json` | Category heading and category labels |
| `offers.json` | Offer section settings |
| `product-details.json` | Product gallery, video and badge visibility |
| `checkout.json` | Checkout methods and shipping note |
| `footer.json` | Footer visibility, copyright and contact links |
| `index.json` | Registry of the section configuration files |

The storefront loads the section registry and the individual files. The home, category and catalogue headings, category labels, product gallery/video visibility, and footer visibility are connected to their corresponding settings. Keep each file's `version` at `1` and preserve valid JSON when editing.


## Contact details, section settings and discount management

### Store contact details

Edit `data/contact.json` on GitHub. These values are loaded by the storefront and update the footer and WhatsApp order destination:

- `store_name`: store name shown in the footer and order message.
- `whatsapp_number`: WhatsApp number in international digits, without `+` or spaces (for Egypt, start with `20`, not the leading domestic zero).
- `phone`, `email`, `address`, `working_hours`.
- `instagram_url`, `facebook_url`, `tiktok_url`: full HTTPS profile links.
- `footer_note`: short footer message.

The WhatsApp number is intentionally blank until the store owner enters the correct number. Orders cannot be directed to the store until it is configured.

### Discounts are calculated from live catalogue prices and quantities

Edit `data/discounts.json`. The storefront calculates the eligible discount from the current product prices in `data/products.json` multiplied by the quantities in the cart. Do not enter a manually calculated cart total.

Supported quantity rule fields:

- `active`: enable or disable the rule.
- `scope`: `cart`, `product`, or `category`.
- `min_units`: minimum eligible units required.
- `type`: `percentage`, `fixed_amount` (per eligible unit), or `fixed_price` (set the eligible unit price to `value`).
- `value`: percentage or EGP amount, depending on the rule type.
- `product_ids` / `categories`: optional eligibility filters for product/category rules.
- `starts_at` / `ends_at`: optional ISO date-time limits.

The starter rules are retained but disabled pending store-owner approval: 5% off from 2 cart units, and 10% off from 3 cart units. When multiple quantity rules qualify, the largest eligible quantity discount is selected. The storefront compares that amount with any eligible coupon and applies only the larger discount; promotions do not stack. The final total cannot go below zero.

Coupons support `percentage` and `fixed_amount`, `min_units`, `active`, `starts_at`, and `ends_at`. The promotional coupon card displays the first currently active coupon in the file. Change its code/value/description there; do not hard-code discount amounts in the storefront.

### Section-by-section settings

Use `data/sections/index.json` to see the section IDs and their matching files in `data/sections/`. Each section file can be edited independently:

- `home.json`: hero title and subtitle; enable/disable the home hero.
- `catalog.json`: catalogue heading and section visibility.
- `categories.json`: category heading, labels and visibility.
- `offers.json`: show/hide the offers and interactive promotions section.
- `product-details.json`: show/hide product image galleries and videos.
- `checkout.json`: show/hide checkout and edit the checkout shipping note.
- `footer.json`: show/hide the footer.

Set `enabled` to `false` to hide a supported section. Commit the JSON edit to update the repository; the live website changes after its hosting deployment and cache refresh.


### Checkout configuration

The `data/sections/checkout.json` file controls the checkout drawer, the shipping note, and the displayed payment-method list. Edit `payment_methods` as a list of customer-facing labels, for example `["الدفع عند الاستلام", "تحويل بنكي"]`. Only list payment methods the store actually accepts.

The checkout sends the order to the WhatsApp number in `data/contact.json`. Enter and verify that number before publishing or accepting real orders.


## Monorepo platform

The repository now contains the original static storefront plus a working TypeScript workspace foundation:

- `apps/web`: Next.js customer-facing application. Its home page reads active products from the API and links to the existing storefront.
- `apps/api`: NestJS API with health, product catalogue, guest-cart, idempotent COD checkout, administrator authentication and protected administration endpoints.
- `apps/admin`: separate Next.js administrator console with login and API-backed overview, product creation/archive and order progression. The current browser token is held in session storage; complete the HttpOnly session/BFF hardening before broad public exposure.
- `packages/types`: shared TypeScript commerce contracts.
- `packages/database`: shared Prisma Client package.
- `prisma/schema.prisma`: PostgreSQL schema for users, addresses, categories, products, images, carts, orders, order items, and payments.
- `infra/docker`: Dockerfiles and Compose services for PostgreSQL, Redis, API, and web.
- `turbo.json`: workspace task graph and build caching.
- `.github/workflows/ci.yml`: schema validation, generated client, type checks, tests, and builds.
- `.github/workflows/deploy.yml`: automatic GitHub Pages deployment of the existing static storefront after changes reach `main`. The Next.js and NestJS services are built and containerized separately; GitHub Pages does not host those server applications.

The existing `ELITE.html`, product catalogue JSON, discounts, contact settings, and motion engine remain in the repository. The Next.js application does not replace the existing storefront.

### Run the full local stack

Requires Node.js 22 and Docker Compose.

1. Copy `.env.example` to `.env`.
2. Replace the PostgreSQL and Redis secrets with long URL-safe random alphanumeric values. Keep the PostgreSQL password in `DATABASE_URL` identical to `POSTGRES_PASSWORD`.
3. Start the stack from the repository root:

   ```bash
   docker compose --env-file .env -f infra/docker/docker-compose.yml up --build
   ```

The Compose API startup applies committed Prisma migrations with `prisma migrate deploy` and imports the current `data/products.json` catalogue. Do not use `prisma db push` for production schema changes.

- Web application: `http://localhost:3000`
- API health: `http://localhost:4000/api/health`
- Product list: `http://localhost:4000/api/products`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

### Run apps separately

After installing dependencies and ensuring PostgreSQL is available:

```bash
npm install
npm run db:generate
npm run db:validate
npm run dev:api
npm run dev:web
npm run dev:admin
```

The commands for API, web, and admin are separate so each can be run in its own terminal. The API reads the repository-root `.env` file when started through its workspace script.

### API routes currently implemented

- `GET /api/health` — API process health.
- `GET /api/products?page=1&limit=24` — paginated active catalogue; optional `category` slug filter.
- `GET /api/products/:slug` — active product details.
- `GET /api/cart/:sessionId` — guest cart lookup; session ID must be a UUID.
- `POST /api/cart/:sessionId/items` — add product and quantity.
- `PATCH /api/cart/:sessionId/items/:itemId` — update quantity.
- `DELETE /api/cart/:sessionId/items/:itemId` — remove item.

The product seed imports stable product IDs, names, prices, categories, and configured image URLs from `data/products.json`. Inventory is kept `null` when the source catalogue does not specify stock; the system does not invent stock counts. Cart quantity limits are enforced whenever inventory is explicitly configured.

### Workspace checks

```bash
npm run db:validate
npm run db:generate
npm run lint
npm test
npm run build
node scripts/verify-garment-motion.mjs
```

CI runs these checks on feature branch pushes and pull requests. A successful build validates the workspace code; it does not mean the API has production authentication, a live payment provider, or a deployed database.

### Security and production boundaries

- PostgreSQL and Redis credentials must be supplied through environment variables; never commit `.env`.
- Helmet, request validation, CORS allow-listing, and UUID validation for guest cart sessions are enabled in the API.
- Guest COD checkout uses server-side database prices, transactional tracked-stock decrement and an idempotency key. Shipping and discounts are zero in this API path until verified server-side rules are configured.
- Administrator login and role-protected product/order API routes exist. The admin browser currently stores its short-lived bearer token in session storage; use a controlled admin origin and complete HttpOnly-cookie/BFF hardening before broad public exposure.
- The Compose host ports bind to `127.0.0.1` by default, including PostgreSQL and Redis. Keep databases private; expose application traffic through a configured HTTPS reverse proxy. Set `HOST_BIND_ADDRESS=0.0.0.0` only when the host firewall and network exposure are intentionally configured.
- Redis is provisioned in Compose but is not yet used by the API.
- Use Prisma migrations for production. Do not run `prisma db push` against a production database.

## Commerce engineering rules

The repository-wide requirements for pricing, inventory, checkout, payments, security, shipping, accessibility, performance, privacy, operations and release quality are in [docs/commerce/COMMERCE_RULES.md](docs/commerce/COMMERCE_RULES.md). This policy separates implemented features from remaining production controls and is the acceptance baseline for future changes.

## API checkout safety contract

The NestJS API exposes guest cash-on-delivery checkout at:

`POST /api/orders/checkout/:sessionId`

Send the cart's UUID session ID and a request header named `Idempotency-Key`. The key must contain 8–128 ASCII letters, digits, dots, underscores, colons or hyphens. Generate it once when the customer starts a checkout attempt and reuse the **same key** for network retries of that attempt. Generate a new key only for a genuinely new checkout attempt.

The API scopes the key to the cart session and persists it with the order. A repeated request returns the already-created order instead of reserving stock or creating another COD payment. The database unique constraint is the final concurrency guard; serialization/unique-key retries re-read the committed order.

The API recalculates item prices from the database and reserves tracked stock in the same database transaction. Shipping and discounts remain zero in this API path until verified server-side shipping and coupon rules are configured. The static storefront's browser-side promotion display is not a substitute for server-side price calculation.


## Full platform operations: API, administrator and database

### Secure administrator bootstrap

The administrator console is served on port 3001 and the API on port 4000. Copy `.env.example` to `.env`, generate unique random values for `JWT_SECRET`, database passwords and Redis password, then set both `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD`. The bootstrap password must be at least 16 characters. The first startup creates a `SUPER_ADMIN` only when that email does not already exist; subsequent startups do not overwrite an existing account's password or role. There is no public registration endpoint.

The login endpoint is `POST /api/auth/login`. It issues a 15-minute HMAC-SHA256 bearer token. Passwords are stored as salted scrypt hashes. Every protected request reloads the account and checks that it remains active. Administrative routes require the `ADMIN` or `SUPER_ADMIN` role. Do not use the example values in production. Configure rate limiting at the public reverse proxy/API gateway, use HTTPS, rotate secrets, and restrict network access to the database and Redis.

### Administrator capabilities

- Overview counts for active products, orders, pending orders and customer accounts.
- Product creation, editing through the API, and archive (soft-delete) operations.
- Order listing and guarded status transitions: pending → confirmed → processing → shipped → delivered. Cancellation is available before shipment and restores tracked stock in the same transaction.
- Refund status is deliberately blocked until a real payment-provider refund and reconciliation workflow exists.

The admin web console exposes product creation, editing, archive and order progression. Product image upload still requires a secure media-storage service and dedicated media-management UI.

### Database migrations

New environments use `npm run db:migrate:deploy`; the Docker API service applies committed Prisma migrations before seeding. The first migration creates the schema represented by `prisma/schema.prisma`. Existing installations previously created with `prisma db push` must be checked against this migration and baselined once with `prisma migrate resolve --applied 20261102080000_initial_commerce` **only after confirming every table, enum, index and constraint matches**. Back up the database before baselining. Never run `db push` as a production startup command.

### Run locally

```bash
cp .env.example .env
# Replace every example secret before starting
docker compose -f infra/docker/docker-compose.yml up -d --build
```

- Storefront: http://localhost:3000
- Admin console: http://localhost:3001
- API health: http://localhost:4000/api/health

This is a deployable application stack, not a claim that production operations are fully finished. Before public launch, complete reverse-proxy rate limiting, HTTPS and security headers at the edge, backup/restore drills, monitoring/alerts, payment-provider integration, verified shipping/tax/coupon rules, customer account flows, image storage/CDN, and browser-level end-to-end testing.


## Demo payment, shipping, customer accounts and tracking

The API now includes explicitly simulated payment and courier flows, configurable demo checkout choices, customer registration/profile/address/order-history endpoints, and phone-verified demo shipment tracking. These systems do not capture money or book a real courier. See [Demo commerce guide](docs/commerce/DEMO_COMMERCE_GUIDE.md) for routes, request examples, demo rates and the production replacement boundary. Customer account registration is available through the API; email verification, password reset and production session hardening remain release requirements.


## Commercial test readiness

A controlled QA plan and an automated checkout-safety audit are available:

- [Commercial test readiness plan](docs/commerce/COMMERCIAL_TEST_READINESS.md)
- Run `node scripts/verify-commercial-readiness.mjs` with Node.js 22 to validate the checkout flow and print owner-controlled pre-launch blockers.
- Set `STRICT_COMMERCIAL=1` to make unresolved owner configuration fail the audit.
- The audit runs in the Monorepo CI workflow alongside the existing garment-motion verification.

The static WhatsApp checkout now rejects an empty cart and invalid customer details, renders customer-provided values as text rather than HTML, blocks products whose price is marked as requiring confirmation, and applies either the eligible quantity discount or the coupon discount (not both). The WhatsApp message is explicitly a preliminary request; it is not a recorded order, payment, inventory reservation or courier booking.

**Current limitation:** automated structural checks do not establish commercial launch readiness. The audit reports missing store contact configuration, missing product photography, unresolved prices, unapproved promotions, production infrastructure/provider requirements and pending browser/security/accessibility checks. Resolve those items and verify the exact release deployment before accepting public orders.
