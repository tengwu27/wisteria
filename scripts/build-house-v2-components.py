#!/usr/bin/env python3
"""Build the remaining main-house components on the canonical 780x975 canvas."""

from __future__ import annotations

import shutil
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / "assets/model-library/house/v2"
RUNTIME = ROOT / "src/assets/images/world/house/v2"
SHEET = ROOT / "assets/model-library/house/v1/house-interactive-world-v1.png"
MOTION = ROOT / "assets/model-library/house/experiments/keyframes"
CANVAS = (780, 975)


def save_both(image: Image.Image, name: str) -> None:
    image.save(PACKAGE / name, optimize=True)
    image.save(RUNTIME / name, optimize=True)


def tight_crop(image: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    crop = image.crop(box)
    bbox = crop.getchannel("A").getbbox()
    if bbox is None:
        raise ValueError(f"No visible artwork in source box {box}")
    return crop.crop(bbox)


def place(canvas: Image.Image, asset: Image.Image, rect: tuple[int, int, int, int]) -> None:
    x, y, width, height = rect
    resized = asset.resize((width, height), Image.Resampling.LANCZOS)
    canvas.alpha_composite(resized, (x, y))


def place_full_frame(canvas: Image.Image, path: Path, rect: tuple[int, int, int, int]) -> None:
    place(canvas, Image.open(path).convert("RGBA"), rect)


def window_layers(sheet: Image.Image) -> tuple[Image.Image, Image.Image, Image.Image]:
    arch_closed = tight_crop(sheet, (930, 55, 1130, 300))
    arch_open = tight_crop(sheet, (1170, 55, 1425, 305))
    shutter_closed = tight_crop(sheet, (920, 300, 1130, 530))
    shutter_open = tight_crop(sheet, (1170, 300, 1430, 530))

    closed = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    opened = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    backplates = Image.new("RGBA", CANVAS, (0, 0, 0, 0))

    # Full window sprites deliberately underlap the house shell. The shell's
    # permanent casings act as the final stencil and conceal every seam.
    arch_targets = [
        (263, 399, 105, 164),  # balcony arch
        (74, 615, 112, 151),   # left wing arch
        (552, 665, 105, 143),  # right wing arch
    ]
    for target in arch_targets:
        place(closed, arch_closed, target)
        place(opened, arch_open, target)
    place(closed, shutter_closed, (486, 380, 112, 116))
    place(opened, shutter_open, (486, 380, 112, 116))

    draw = ImageDraw.Draw(backplates)
    for box in ((250, 282, 353, 360), (274, 410, 358, 557), (91, 625, 176, 754),
                (504, 392, 582, 476), (565, 671, 649, 802), (668, 674, 737, 755)):
        draw.rounded_rectangle(box, radius=18, fill=(13, 36, 42, 255))
    return closed, opened, backplates


def mounted_layers() -> dict[str, Image.Image]:
    layers = {name: Image.new("RGBA", CANVAS, (0, 0, 0, 0)) for name in (
        "turbine-mast-v2.png", "turbine-rotor-v2.png", "turbine-hub-v2.png",
        "roof-flag-v2.png", "wall-lamp-off-v2.png", "wall-lamp-on-v2.png",
        "clock-base-v2.png",
    )}

    turbine_rect = (250, 20, 200, 147)
    place_full_frame(layers["turbine-mast-v2.png"], MOTION / "turbine-mast-v2.png", turbine_rect)
    place_full_frame(layers["turbine-rotor-v2.png"], MOTION / "turbine-rotor-canonical-v2.png", turbine_rect)
    place_full_frame(layers["turbine-hub-v2.png"], MOTION / "turbine-hub-v2.png", turbine_rect)
    place_full_frame(layers["roof-flag-v2.png"], MOTION / "flag-v2-frame-01.png", (500, 40, 180, 124))
    place_full_frame(layers["wall-lamp-off-v2.png"], MOTION / "lamp-v2-frame-01.png", (430, 570, 105, 75))
    place_full_frame(layers["wall-lamp-on-v2.png"], MOTION / "lamp-v2-frame-02.png", (430, 570, 105, 75))
    place_full_frame(layers["clock-base-v2.png"], MOTION / "clock-base-v2.png", (355, 442, 99, 60))
    return layers


def main() -> None:
    PACKAGE.mkdir(parents=True, exist_ok=True)
    RUNTIME.mkdir(parents=True, exist_ok=True)
    sheet = Image.open(SHEET).convert("RGBA")
    closed, opened, backplates = window_layers(sheet)
    save_both(backplates, "window-backplates-v2.png")
    save_both(closed, "windows-closed-v2.png")
    save_both(opened, "windows-open-v2.png")
    for name, layer in mounted_layers().items():
        save_both(layer, name)
    shutil.copy2(PACKAGE / "house-v2.json", RUNTIME / "house-v2.json")
    print("Built window states and foreground-mounted house components on 780x975 canvas")


if __name__ == "__main__":
    main()
