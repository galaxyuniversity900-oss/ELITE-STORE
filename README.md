# ELITE-STORE — MES STORE Men's Collection

Arabic RTL men's clothing storefront with an integrated, optional Garment Motion Engine.

## Garment Motion Engine

The engine is integrated into the existing `ELITE.html` product cards and quick-view modal. It does not replace the storefront, cart, sizes, wishlist, WhatsApp checkout, or the existing 32-category interaction lab.

### What it does

- Per-product image upload (JPG, PNG, WebP; 15 MB maximum).
- Manual garment mask painting and erasing, plus a simple uniform-background color-difference selection helper.
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
- The automatic mask helper is color-difference based and works best on plain studio backgrounds. It is not an AI segmentation model. Use the manual brush/eraser to correct the mask.
- Background reconstruction is an approximate local diffusion fill. It works best on plain/soft backgrounds; complex scenes need a proper AI inpainting/segmentation service.
- The current repository is a static HTML storefront. There is no server-side image service or multi-user asset database in this change.

### Local validation

Requires Node.js 20.19+ or 22.12+.

```bash
node scripts/verify-garment-motion.mjs
```

No build step or npm dependency is required for the current single-file storefront.

## Existing store

The original single-file storefront remains in `ELITE.html`. Existing product data, prices, sizes, cart, wishlist, and checkout interactions are retained.
