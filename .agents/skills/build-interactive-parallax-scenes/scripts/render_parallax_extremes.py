#!/usr/bin/env python3
"""Render neutral and horizontal-focus extreme composites from a manifest."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageColor


def resolve(base: Path, value: str) -> Path:
    path = Path(value)
    return path if path.is_absolute() else base / path


def shifted(image: Image.Image, pixels: float) -> Image.Image:
    result = Image.new("RGBA", image.size, (0, 0, 0, 0))
    result.alpha_composite(image, (round(pixels), 0))
    return result


def apply_camera_scale(image: Image.Image, scale: float) -> Image.Image:
    if scale <= 1:
        return image
    width, height = image.size
    enlarged = image.resize(
        (round(width * scale), round(height * scale)),
        Image.Resampling.LANCZOS,
    )
    left = (enlarged.width - width) // 2
    top = (enlarged.height - height) // 2
    return enlarged.crop((left, top, left + width, top + height))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("manifest", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    manifest_path = args.manifest.resolve()
    data = json.loads(manifest_path.read_text(encoding="utf-8"))
    base = manifest_path.parent
    width, height = data["canvas"]
    background = ImageColor.getrgb(data.get("background", "#000000"))
    layers = sorted(data["layers"], key=lambda layer: layer["z"])
    camera_scale = float(data.get("cameraScale", 1.0))
    args.output.mkdir(parents=True, exist_ok=True)

    samples = (
        ("focus-left", 1.0),
        ("neutral", 0.0),
        ("focus-right", -1.0),
    )
    for name, focus in samples:
        composite = Image.new("RGBA", (width, height), (*background, 255))
        for layer in layers:
            plate = Image.open(resolve(base, layer["file"])).convert("RGBA")
            displacement = (
                width
                * float(layer.get("maxShiftPercent", 0))
                / 100
                * focus
            )
            composite.alpha_composite(shifted(plate, displacement))
        composite = apply_camera_scale(composite, camera_scale)
        composite.save(args.output / f"{name}.png", optimize=True)


if __name__ == "__main__":
    main()
