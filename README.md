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

Only the single quantity rule giving the largest saving is applied; quantity rules do not stack with one another. A valid coupon can stack with that quantity discount. The total is never reduced below zero.

Example: enable `buy-2-save-5` to give 5% off the cart when the customer buys at least two units. It is initially disabled so no new promotion is activated without the store owner's decision. The `MESVIP200` coupon is configured in the same file and can be changed or disabled there.

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
