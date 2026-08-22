#!/usr/bin/env python3
"""Validate a registered interactive-parallax layer manifest."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from PIL import Image, ImageChops


def resolve(base: Path, value: str) -> Path:
    path = Path(value)
    return path if path.is_absolute() else base / path


def parse_canvas(value) -> tuple[int, int]:
    if (
        not isinstance(value, list)
        or len(value) != 2
        or any(not isinstance(item, int) or item <= 0 for item in value)
    ):
        raise ValueError("canvas must be [positiveWidth, positiveHeight]")
    return value[0], value[1]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("manifest", type=Path)
    args = parser.parse_args()

    manifest_path = args.manifest.resolve()
    data = json.loads(manifest_path.read_text(encoding="utf-8"))
    base = manifest_path.parent
    errors: list[str] = []
    warnings: list[str] = []

    try:
        canvas = parse_canvas(data.get("canvas"))
    except ValueError as error:
        print(json.dumps({"valid": False, "errors": [str(error)]}, indent=2))
        return 1

    layers = data.get("layers")
    if not isinstance(layers, list) or not layers:
        errors.append("layers must be a non-empty array")
        layers = []

    ids: set[str] = set()
    z_values: set[float] = set()
    layer_paths: dict[str, Path] = {}
    maximum_shift = 0.0

    for index, layer in enumerate(layers):
        label = f"layers[{index}]"
        if not isinstance(layer, dict):
            errors.append(f"{label} must be an object")
            continue
        layer_id = layer.get("id")
        if not isinstance(layer_id, str) or not layer_id:
            errors.append(f"{label}.id must be a non-empty string")
            continue
        if layer_id in ids:
            errors.append(f"duplicate layer id: {layer_id}")
        ids.add(layer_id)

        owner = layer.get("owner")
        if not isinstance(owner, str) or not owner:
            errors.append(f"{layer_id}: owner is required")

        z = layer.get("z")
        if not isinstance(z, (int, float)):
            errors.append(f"{layer_id}: numeric z is required")
        elif z in z_values:
            errors.append(f"{layer_id}: duplicate z value {z}")
        else:
            z_values.add(z)

        shift = layer.get("maxShiftPercent", 0)
        if not isinstance(shift, (int, float)) or shift < 0:
            errors.append(f"{layer_id}: maxShiftPercent must be non-negative")
        else:
            maximum_shift = max(maximum_shift, float(shift))

        filename = layer.get("file")
        if not isinstance(filename, str) or not filename:
            errors.append(f"{layer_id}: file is required")
            continue
        path = resolve(base, filename)
        layer_paths[layer_id] = path
        if not path.is_file():
            errors.append(f"{layer_id}: missing file {path}")
            continue
        try:
            with Image.open(path) as image:
                if image.size != canvas:
                    errors.append(
                        f"{layer_id}: size {image.size} does not match {canvas}"
                    )
        except OSError as error:
            errors.append(f"{layer_id}: cannot decode {path}: {error}")

        for effect in layer.get("effects", []):
            if not isinstance(effect, dict):
                continue
            anchor = effect.get("anchor")
            if anchor is None:
                continue
            if (
                not isinstance(anchor, list)
                or len(anchor) != 2
                or not all(isinstance(value, (int, float)) for value in anchor)
                or not (0 <= anchor[0] <= canvas[0])
                or not (0 <= anchor[1] <= canvas[1])
            ):
                errors.append(f"{layer_id}: invalid effect anchor {anchor}")

    overscan = data.get("overscanPercent")
    if isinstance(overscan, (int, float)):
        if overscan < maximum_shift:
            errors.append(
                f"overscanPercent {overscan} is below maximum shift {maximum_shift}"
            )
    else:
        warnings.append("overscanPercent is not declared")

    aperture = data.get("aperture")
    if isinstance(aperture, dict) and aperture.get("reference"):
        owner_id = aperture.get("layer") or aperture.get("owner")
        reference = resolve(base, aperture["reference"])
        owner_path = layer_paths.get(owner_id)
        if owner_path is None:
            errors.append(f"aperture owner layer is missing: {owner_id}")
        elif not reference.is_file():
            errors.append(f"aperture reference is missing: {reference}")
        else:
            with Image.open(owner_path) as owner_image, Image.open(reference) as ref:
                owner = owner_image.convert("RGBA").getchannel("A")
                expected = ref.convert("RGBA").getchannel("A")
                if owner.size != expected.size:
                    errors.append("aperture alpha images have different sizes")
                elif ImageChops.difference(owner, expected).getbbox() is not None:
                    errors.append("aperture alpha differs from its reference")

    result = {
        "valid": not errors,
        "canvas": list(canvas),
        "layerCount": len(layers),
        "maximumShiftPercent": maximum_shift,
        "errors": errors,
        "warnings": warnings,
    }
    print(json.dumps(result, indent=2))
    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
