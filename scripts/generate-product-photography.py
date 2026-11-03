#!/usr/bin/env python3
"""Generate two photorealistic catalog images per MES STORE product and update products.json.

Requires OPENAI_API_KEY. Images are generated from the product catalogue metadata; they are
AI-generated visual representations, not evidence of actual stock or exact garment construction.
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PRODUCTS_FILE = ROOT / "data" / "products.json"
ASSET_ROOT = ROOT / "assets" / "products"
API_URL = "https://api.openai.com/v1/images/generations"
MODEL = os.environ.get("OPENAI_IMAGE_MODEL", "gpt-image-2")
COLOR_NAMES = {
    "#1e3a8a": "deep indigo blue", "#18181b": "near-black", "#1d4ed8": "vivid denim blue",
    "#3f3f46": "charcoal grey", "#d6c7b2": "warm cream beige", "#52525b": "mid grey",
    "#09090b": "jet black", "#111115": "matte black", "#4b5563": "slate grey",
    "#6b1d2f": "deep burgundy", "#5c3a21": "rich brown", "#451a03": "dark chocolate brown",
    "#6b7280": "heather grey", "#543310": "earth brown", "#171717": "black",
    "#e4e4e7": "icy white", "#0f0f12": "soft black",
}

def clean(value: object, fallback: str = "") -> str:
    text = str(value or fallback).strip()
    return re.sub(r"[\r\n\t]+", " ", text)[:180]

def prompt_for(product: dict, shot: str) -> str:
    title = clean(product.get("title"), product.get("id", "men's garment"))
    category = clean(product.get("category"), "men's clothing")
    visual = product.get("visual") or {}
    color = COLOR_NAMES.get(str(visual.get("color", "")).lower(), "the exact primary garment color specified by the product")
    kind = clean(visual.get("type"), category)
    common = (
        f"Create a premium, photorealistic commercial fashion photograph for a men's clothing "
        f"e-commerce catalogue. Product: {title}. Category: {category}. Garment type: {kind}. "
        f"Primary color: {color}. The garment must be the clear subject. Preserve the stated "
        f"garment category, silhouette, color family and any details explicitly named in the title. "
        f"Do not add readable text, watermarks, brand logos, labels, badges, extra accessories, "
        f"or graphic marks that are not specified. Realistic fabric texture, accurate seams, "
        f"natural folds, premium studio lighting, sharp focus, neutral restrained styling."
    )
    if shot == "studio":
        return common + (
            " Shot type: isolated product-only studio photograph, the complete garment displayed "
            "front-facing in a natural invisible-ghost-mannequin presentation, centered, fully "
            "visible from edge to edge, subtle soft shadow, seamless warm-white to very-light-grey "
            "background, no person, no hanger, no props. Vertical 2:3 product image."
        )
    return common + (
        " Shot type: adult male fashion model wearing the garment, tasteful contemporary menswear "
        "editorial, natural confident standing pose, three-quarter to full-body framing so the "
        "garment is clearly visible, clean minimal studio set with a neutral grey background, "
        "soft directional fashion lighting. The clothing remains the focus; no distracting props. "
        "Vertical 2:3 editorial product photograph."
    )

def request_image(api_key: str, prompt: str, destination: Path) -> None:
    payload = {
        "model": MODEL,
        "prompt": prompt,
        "size": "1024x1536",
        "quality": "high",
        "output_format": "jpeg",
        "n": 1,
    }
    body = json.dumps(payload).encode("utf-8")
    for attempt in range(4):
        req = urllib.request.Request(
            API_URL, data=body,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=360) as response:
                result = json.loads(response.read().decode("utf-8"))
            encoded = result["data"][0]["b64_json"]
            image = base64.b64decode(encoded, validate=True)
            if not image.startswith(bytes.fromhex("ffd8ff")):
                raise RuntimeError("Image API returned data that is not a JPEG.")
            destination.parent.mkdir(parents=True, exist_ok=True)
            temporary = destination.with_suffix(destination.suffix + ".tmp")
            temporary.write_bytes(image)
            temporary.replace(destination)
            return
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", "replace")[:1200]
            if exc.code not in (429, 500, 502, 503, 504) or attempt == 3:
                raise RuntimeError(f"Image API HTTP {exc.code}: {detail}") from exc
            time.sleep(2 ** (attempt + 1))
        except (TimeoutError, urllib.error.URLError):
            if attempt == 3:
                raise
            time.sleep(2 ** (attempt + 1))

def main() -> int:
    parser = argparse.ArgumentParser(description="Generate studio and on-model photography for MES STORE.")
    parser.add_argument("--limit", type=int, default=0, help="Limit to the first N products (0 = all).")
    parser.add_argument("--product-ids", default="", help="Comma-separated stable product IDs.")
    parser.add_argument("--force", action="store_true", help="Regenerate even when both photos already exist.")
    args = parser.parse_args()

    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        print("ERROR: OPENAI_API_KEY is not configured in the environment.", file=sys.stderr)
        return 2
    catalogue = json.loads(PRODUCTS_FILE.read_text(encoding="utf-8"))
    products = catalogue.get("products", [])
    requested = {item.strip() for item in args.product_ids.split(",") if item.strip()}
    if requested:
        products = [p for p in products if p.get("id") in requested]
        missing = requested - {p.get("id") for p in products}
        if missing:
            raise SystemExit("Unknown product IDs: " + ", ".join(sorted(missing)))
    if args.limit > 0:
        products = products[:args.limit]
    if not products:
        raise SystemExit("No matching products.")
    total = len(products)
    for index, product in enumerate(products, 1):
        product_id = clean(product.get("id"))
        if not re.fullmatch(r"[a-zA-Z0-9_-]+", product_id):
            raise SystemExit(f"Unsafe product ID: {product_id!r}")
        folder = ASSET_ROOT / product_id
        studio = folder / "studio.jpg"
        model = folder / "model.jpg"
        media = product.setdefault("media", {})
        if not args.force and studio.is_file() and model.is_file():
            print(f"[{index}/{total}] {product_id}: already generated; skipping")
        else:
            print(f"[{index}/{total}] {product_id}: generating studio photograph", flush=True)
            request_image(api_key, prompt_for(product, "studio"), studio)
            print(f"[{index}/{total}] {product_id}: generating on-model photograph", flush=True)
            request_image(api_key, prompt_for(product, "model"), model)
        media["cover"] = f"assets/products/{product_id}/studio.jpg"
        media["images"] = [f"assets/products/{product_id}/model.jpg"]
        media["photography"] = {
            "source": "ai-generated",
            "reviewRequired": True,
            "disclosure": "AI-generated catalogue photography; verify against the actual item before sale."
        }
    PRODUCTS_FILE.write_text(json.dumps(catalogue, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Updated {len(products)} product records. Generated files are ready for the workflow commit.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
