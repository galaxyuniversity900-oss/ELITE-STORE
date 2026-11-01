# MES product media library

Upload each product's actual media into a folder named with its stable product ID.

```
assets/products/
  mes11/
    cover.webp
    detail-1.webp
    detail-2.webp
    preview.mp4
  mes8/
    cover.webp
```

Then open `data/products.json` and edit the matching product:

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

- `cover`: the main image used on the product card and in quick view.
- `images`: additional product photographs displayed in the quick-view gallery.
- `videos`: product videos with browser playback controls.
- Keep product IDs stable when changing prices or media.
- For a replacement photo, upload a new filename (for example `cover-v2.webp`) and update the JSON path. This also prevents an old garment-motion mask from being reused with a new photograph.
- Prefer optimized WebP/JPG images and short MP4 (H.264) or WebM clips.
- Use relative paths under `assets/products/` or a trusted HTTPS media URL.
- Empty arrays mean no additional gallery photos or videos.
- The media files themselves must be uploaded to the repository; this guide only defines the folder convention.
