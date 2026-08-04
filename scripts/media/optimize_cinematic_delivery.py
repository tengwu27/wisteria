#!/usr/bin/env python3
"""Build geometry-safe WebP delivery assets for immersive scenes.

Original PNG/JPEG files are retained under assets/cinematic/delivery-sources,
outside Astro's public delivery tree. Sparse RGBA plates are cropped to their
non-transparent bounds while recording the exact master-canvas registration in
their source manifest.
"""

from __future__ import annotations

import json
import math
import shutil
from pathlib import Path

from PIL import Image, ImageChops


ROOT = Path(__file__).resolve().parents[2]
PUBLIC_MEDIA = ROOT / "public" / "media"
SOURCE_MEDIA = ROOT / "assets" / "cinematic" / "delivery-sources"
LAYER_ROOTS = (
    Path("living-room/parallax"),
    Path("cafe-gallery/parallax"),
    Path("car-interior/parallax"),
    Path("garage-workshop/parallax"),
)
EXTRA_IMAGES = (
    Path("village/ambient/clouds-day-near-v2.png"),
    Path("village/ui/welcome-to-wisteria.png"),
)
MASTER_SIZE = (1672, 941)
SPRITE_COVERAGE_LIMIT = 0.45
SPRITE_PADDING = 2


def move_source(relative: Path) -> Path:
    public_path = PUBLIC_MEDIA / relative
    source_path = SOURCE_MEDIA / relative
    if public_path.exists() and source_path.exists():
        raise RuntimeError(f"Both delivery and source copies exist: {relative}")
    if public_path.exists():
        source_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(public_path, source_path)
    if not source_path.exists():
        raise FileNotFoundError(source_path)
    return source_path


def padded_bbox(image: Image.Image) -> tuple[int, int, int, int]:
    alpha = image.getchannel("A")
    bbox = alpha.getbbox() or (0, 0, image.width, image.height)
    left, top, right, bottom = bbox
    return (
        max(0, left - SPRITE_PADDING),
        max(0, top - SPRITE_PADDING),
        min(image.width, right + SPRITE_PADDING),
        min(image.height, bottom + SPRITE_PADDING),
    )


def psnr(source: Image.Image, encoded: Image.Image) -> float:
    source_rgb = source.convert("RGB").get_flattened_data()
    encoded_rgb = encoded.convert("RGB").get_flattened_data()
    alpha = source.getchannel("A").get_flattened_data()
    squared_error = 0
    samples = 0
    for opacity, expected, actual in zip(alpha, source_rgb, encoded_rgb):
        if opacity < 16:
            continue
        squared_error += sum(
            (left - right) ** 2 for left, right in zip(expected, actual)
        )
        samples += 3
    mean_error = squared_error / max(1, samples)
    return 99.0 if mean_error == 0 else 10 * math.log10(255 * 255 / mean_error)


def encode_layer(source: Path, destination: Path) -> dict[str, object]:
    image = Image.open(source).convert("RGBA")
    bbox = padded_bbox(image)
    coverage = (
        (bbox[2] - bbox[0]) * (bbox[3] - bbox[1]) /
        (image.width * image.height)
    )
    should_crop = image.size == MASTER_SIZE and coverage < SPRITE_COVERAGE_LIMIT
    delivery_rect = bbox if should_crop else (0, 0, image.width, image.height)
    delivery = image.crop(delivery_rect)

    destination.parent.mkdir(parents=True, exist_ok=True)
    delivery.save(
        destination,
        "WEBP",
        quality=90,
        method=6,
        exact=True,
    )

    decoded = Image.open(destination).convert("RGBA")
    if decoded.size != delivery.size:
        raise RuntimeError(f"Dimension mismatch: {destination}")
    alpha_delta = ImageChops.difference(
        delivery.getchannel("A"), decoded.getchannel("A")
    ).getextrema()[1]
    if alpha_delta != 0:
        raise RuntimeError(f"Alpha mismatch in {destination}: {alpha_delta}")
    score = psnr(delivery, decoded)
    if score < 25:
        raise RuntimeError(f"Insufficient quality in {destination}: {score:.2f} dB")

    left, top, right, bottom = delivery_rect
    return {
        "sourceFile": source.name,
        "file": destination.name,
        "deliveryRect": [left, top, right - left, bottom - top],
        "sourceBytes": source.stat().st_size,
        "deliveryBytes": destination.stat().st_size,
        "psnr": round(score, 2),
    }


def update_manifest(path: Path, deliveries: dict[str, dict[str, object]]) -> None:
    manifest = json.loads(path.read_text())
    for layer in manifest.get("layers", []):
        current = layer.get("sourceFile", layer.get("file"))
        delivery = deliveries.get(current)
        if not delivery:
            continue
        layer["sourceFile"] = delivery["sourceFile"]
        layer["file"] = delivery["file"]
        layer["deliveryRect"] = delivery["deliveryRect"]
        layer["deliveryBytes"] = delivery["deliveryBytes"]
    manifest["delivery"] = {
        "format": "webp",
        "quality": 90,
        "alpha": "lossless",
        "registration": "master-canvas rect",
    }
    path.write_text(json.dumps(manifest, indent=2) + "\n")


def encode_flat_image(source: Path, destination: Path, quality: int) -> None:
    image = Image.open(source)
    destination.parent.mkdir(parents=True, exist_ok=True)
    save_options: dict[str, object] = {
        "quality": quality,
        "method": 6,
    }
    if "A" in image.getbands():
        image = image.convert("RGBA")
        save_options["exact"] = True
    else:
        image = image.convert("RGB")
    image.save(destination, "WEBP", **save_options)
    if Image.open(destination).size != image.size:
        raise RuntimeError(f"Dimension mismatch: {destination}")


def main() -> None:
    source_bytes = 0
    delivery_bytes = 0
    converted = 0

    for relative_root in LAYER_ROOTS:
        public_root = PUBLIC_MEDIA / relative_root
        source_root = SOURCE_MEDIA / relative_root
        source_root.mkdir(parents=True, exist_ok=True)

        for public_source in sorted(public_root.rglob("*.png")):
            move_source(public_source.relative_to(PUBLIC_MEDIA))
        for public_manifest in sorted(public_root.rglob("layers.json")):
            move_source(public_manifest.relative_to(PUBLIC_MEDIA))

        for theme in ("day", "night"):
            theme_source = source_root / theme
            deliveries: dict[str, dict[str, object]] = {}
            for source in sorted(theme_source.glob("*.png")):
                destination = public_root / theme / f"{source.stem}.webp"
                delivery = encode_layer(source, destination)
                deliveries[source.name] = delivery
                source_bytes += source.stat().st_size
                delivery_bytes += destination.stat().st_size
                converted += 1
            update_manifest(theme_source / "layers.json", deliveries)

    for public_source in sorted(PUBLIC_MEDIA.rglob("*poster.jpg")):
        relative = public_source.relative_to(PUBLIC_MEDIA)
        move_source(relative)

    for source in sorted(SOURCE_MEDIA.rglob("*poster.jpg")):
        relative = source.relative_to(SOURCE_MEDIA)
        destination = (PUBLIC_MEDIA / relative).with_suffix(".webp")
        encode_flat_image(source, destination, quality=82)
        source_bytes += source.stat().st_size
        delivery_bytes += destination.stat().st_size
        converted += 1

    for relative in EXTRA_IMAGES:
        source = move_source(relative)
        destination = (PUBLIC_MEDIA / relative).with_suffix(".webp")
        encode_flat_image(source, destination, quality=90)
        source_bytes += source.stat().st_size
        delivery_bytes += destination.stat().st_size
        converted += 1

    reduction = 100 * (1 - delivery_bytes / source_bytes)
    print(
        f"Converted {converted} assets: "
        f"{source_bytes / 1024 / 1024:.2f} MiB -> "
        f"{delivery_bytes / 1024 / 1024:.2f} MiB "
        f"({reduction:.1f}% smaller)."
    )


if __name__ == "__main__":
    main()
