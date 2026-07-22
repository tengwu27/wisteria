#!/usr/bin/env python3
"""Relocate door hardware without changing its rendered geometry.

The hinge and handle pixels are extracted from the accepted bottom-right door,
translated only, then composited over a repaired copy of the same door. No
hardware layer is mirrored, rotated, scaled, skewed, or regenerated.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageChops, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / "assets/model-library/house/v2"
CANDIDATES = PACKAGE / "candidates"
SOURCE = CANDIDATES / "main-door-closed-bottom-right-v3-cutout.png"
CLEAN_BASE = CANDIDATES / "main-door-clean-base-v1-cutout.png"
OUTPUT = CANDIDATES / "main-door-closed-bottom-right-hardware-translated-v5-cutout.png"
HANDLE_LAYER = CANDIDATES / "hardware-handle-original-geometry-v1.png"
HINGE_LAYER = CANDIDATES / "hardware-hinges-original-geometry-v1.png"

# Source boxes are deliberately tight enough to exclude the porthole and plate.
HANDLE_BOX = (315, 688, 466, 944)
HINGE_BOXES = ((800, 355, 875, 525), (800, 742, 875, 925))
HANDLE_SHIFT = (360, 0)
HINGE_SHIFT = (-540, 0)
DOOR_RIGHT_EDGE = 852


def brass_mask(image: Image.Image, box: tuple[int, int, int, int], dilation: int) -> Image.Image:
    """Select brass hardware, then grow over its dark outline and cast shading."""
    mask = Image.new("L", image.size, 0)
    pixels = image.load()
    selected = mask.load()
    x0, y0, x1, y1 = box
    for y in range(y0, y1):
        for x in range(x0, x1):
            r, g, b, a = pixels[x, y]
            if a > 24 and r > 92 and g > 48 and r > g * 1.08 and g > b * 1.22:
                selected[x, y] = 255
    grown = mask.filter(ImageFilter.MaxFilter(dilation))
    return ImageChops.multiply(grown, image.getchannel("A"))


def masked_layer(image: Image.Image, mask: Image.Image) -> Image.Image:
    layer = image.copy()
    layer.putalpha(ImageChops.multiply(image.getchannel("A"), mask))
    return layer


def translate_layer(layer: Image.Image, shift: tuple[int, int]) -> Image.Image:
    dx, dy = shift
    bbox = layer.getchannel("A").getbbox()
    moved = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    if bbox is None:
        return moved
    crop = layer.crop(bbox)
    moved.alpha_composite(crop, (bbox[0] + dx, bbox[1] + dy))
    return moved


def repair_handle_area(image: Image.Image, source: Image.Image, mask: Image.Image) -> None:
    """Clone nearby board texture into only the vacated hardware silhouette."""
    pixels = image.load()
    source_pixels = source.load()
    selected = mask.load()
    x0, y0, x1, y1 = HANDLE_BOX
    for y in range(y0, y1):
        for x in range(x0, x1):
            if selected[x, y] > 0:
                pixels[x, y] = source_pixels[x + 170, y]


def repair_hinge_area(image: Image.Image, source: Image.Image, mask: Image.Image) -> None:
    """Restore the native right door edge after removing protruding hinges."""
    pixels = image.load()
    source_pixels = source.load()
    selected = mask.load()
    for box in HINGE_BOXES:
        x0, y0, x1, y1 = box
        for y in range(y0, y1):
            for x in range(x0, x1):
                if selected[x, y] == 0:
                    continue
                pixels[x, y] = source_pixels[x - 80, y] if x < DOOR_RIGHT_EDGE else (0, 0, 0, 0)


def main() -> None:
    source = Image.open(SOURCE).convert("RGBA")
    handle_mask = brass_mask(source, HANDLE_BOX, 21)
    hinge_mask = Image.new("L", source.size, 0)
    for box in HINGE_BOXES:
        hinge_mask = ImageChops.lighter(hinge_mask, brass_mask(source, box, 17))

    handle_layer = masked_layer(source, handle_mask)
    hinge_layer = masked_layer(source, hinge_mask)
    handle_layer.save(HANDLE_LAYER, optimize=True)
    hinge_layer.save(HINGE_LAYER, optimize=True)

    clean = Image.open(CLEAN_BASE).convert("RGBA")
    if clean.size != source.size:
        raise ValueError(f"Clean base size {clean.size} does not match source {source.size}")
    result = Image.alpha_composite(clean, translate_layer(handle_layer, HANDLE_SHIFT))
    result = Image.alpha_composite(result, translate_layer(hinge_layer, HINGE_SHIFT))
    result.save(OUTPUT, optimize=True)
    print(f"Wrote {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
