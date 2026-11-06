# PowerPoint Motion → MES STORE Embed

This integration displays motion assets authored in PowerPoint without embedding a .pptx file or relying on PowerPoint/Office at runtime.

## Recommended export format

| PowerPoint output | Web format | Use it for |
| --- | --- | --- |
| Export → Create a Video | MP4 (H.264) | Product showcases, transitions, hero sequences, realistic movement |
| Animated export | GIF | Short, small looping details |
| Export frames / convert with a trusted graphics tool | Animated SVG | Lightweight vector motion; keep SVG self-contained and script-free |
| Rebuild/export through a Lottie-compatible workflow | Lottie JSON | Interface-style vector animation and icons |

For photographic clothing motion, use MP4/WebM. Do not expect PowerPoint to export its native timeline directly as editable HTML/CSS or Lottie. A conversion step is required. Keep a clean still poster image for reduced-motion users and slow connections.

## Add a PowerPoint animation

1. Create the animation in PowerPoint and set the slide size to the intended website aspect ratio (16:9 is a useful default for a hero; use 1:1 or 4:5 for product media).
2. Use File → Export → Create a Video and export MP4 at 1080p. Choose a frame rate appropriate to the movement; 24–30 fps is usually sufficient.
3. Keep the clip concise, remove unnecessary audio, and compress it for web delivery. Export a matching JPG/WebP poster.
4. Add the files under assets/motion/ (for example assets/motion/hero-campaign.mp4 and assets/motion/hero-campaign.webp).
5. Edit data/motion-embeds.json and add an entry. The target selector must identify an existing element in ELITE.html.

Example:
```json
{
  "version": 1,
  "items": [
    {
      "id": "hero-campaign",
      "enabled": true,
      "target": "#hero-showcase",
      "placement": "beforeend",
      "type": "video",
      "src": "./assets/motion/hero-campaign.mp4",
      "poster": "./assets/motion/hero-campaign.webp",
      "title": "MES seasonal campaign",
      "alt": "عرض متحرك لمجموعة MES STORE",
      "caption": "",
      "autoplay": true,
      "loop": true,
      "muted": true,
      "controls": false,
      "decorative": false,
      "aspectRatio": "16 / 9",
      "maxWidth": "1200px"
    }
  ]
}
```

## Supported configuration fields

- id: unique stable key.
- enabled: set to false to disable an entry without deleting it.
- target: CSS selector for an existing page element.
- placement: beforebegin, afterbegin, beforeend, or afterend.
- type: video, gif, webp, svg, or lottie.
- src: same-origin path to the exported asset. External URLs, data URLs, and javascript URLs are rejected.
- poster: optional same-origin still image; recommended for video and Lottie.
- title, alt, caption, decorative: accessibility and presentation metadata.
- autoplay, loop, muted, controls: playback behavior for video/Lottie.
- aspectRatio, maxWidth: optional layout constraints.

## Performance, privacy, and accessibility rules

- Prefer MP4 for PowerPoint timelines; do not upload the original PPTX to the public site.
- Keep video muted when autoplaying. Browsers generally block autoplay with sound.
- Use a poster, preload metadata, and concise clips. Avoid multiple simultaneous autoplay videos.
- The integration only accepts same-origin media paths. Lottie runtime is loaded from a pinned CDN version only when a Lottie entry is configured.
- The visitor's prefers-reduced-motion setting disables automatic motion and exposes video controls.
- Supply meaningful alt text for informative media. Mark purely decorative motion with decorative: true.
- Do not place essential product information, prices, sizes, or purchase controls inside a video. Keep all commerce UI in the native page.
- Verify the exported files in mobile Safari/Chrome and on a slow connection before publishing.

## Current repository state

The renderer and styling are integrated into ELITE.html. data/motion-embeds.json intentionally starts with an empty list because no PowerPoint-exported media files were supplied with this change. Add the real exported files and matching configuration entries to activate specific animations.
