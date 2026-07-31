"""Build browser-ready, registered living-room parallax plates.

The source artwork stays on the approved 1672×941 camera. Generated repairs are
restricted to a feathered table-removal region, and the foreground aperture
alpha is restored from the approved source after compositing.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[2]
CANVAS_SIZE = (1672, 941)
DAY_SOURCE = ROOT / "assets/cinematic/lifestyle/active/day"
NIGHT_SOURCE = ROOT / "assets/cinematic/lifestyle/active/night"
GENERATED = ROOT / "assets/cinematic/lifestyle/parallax/generated"
OUTPUT_ROOT = ROOT / "public/media/lifestyle/parallax"

SKY_SCALE = 0.55
SKY_POSITION = (550, -140)
HARBOR_SCALE = 0.76
HARBOR_POSITION = (380, 0)
BOAT_SCALE = 0.30
BOAT_TARGET_CENTER = (1000, 225)

# The generated isolated table is deliberately registered into the approved
# central-table footprint. Both themes share this exact target rectangle.
TABLE_TARGET_BBOX = (555, 545, 1265, 885)
TABLE_ALPHA_THRESHOLD = 64
REPAIR_RECT = (530, 515, 1300, 915)
REPAIR_FEATHER = 18


def rgba(path: Path) -> Image.Image:
    image = Image.open(path).convert("RGBA")
    if image.size != CANVAS_SIZE:
        raise ValueError(f"{path} is {image.size}; expected {CANVAS_SIZE}")
    return image


def fit_generated(path: Path) -> Image.Image:
    """Normalize ImageGen's occasional one/two-pixel canvas trimming."""

    image = Image.open(path).convert("RGBA")
    if image.size == CANVAS_SIZE:
        return image
    canvas = Image.new("RGBA", CANVAS_SIZE, (0, 0, 0, 0))
    canvas.alpha_composite(image, (0, 0))
    return canvas


def feathered_repair_mask() -> Image.Image:
    mask = Image.new("L", CANVAS_SIZE, 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle(REPAIR_RECT, radius=42, fill=255)
    return mask.filter(ImageFilter.GaussianBlur(REPAIR_FEATHER))


def build_room_shell(
    approved_path: Path,
    generated_clean_path: Path,
) -> Image.Image:
    approved = rgba(approved_path)
    generated = fit_generated(generated_clean_path)
    repaired = Image.composite(generated, approved, feathered_repair_mask())

    # Aperture ownership is immutable. RGB beneath transparent pixels is
    # irrelevant, but its alpha must exactly match the approved foreground.
    repaired.putalpha(approved.getchannel("A"))
    return repaired


def clean_table_alpha(image: Image.Image) -> tuple[Image.Image, tuple[int, int, int, int]]:
    alpha = image.getchannel("A")
    alpha = alpha.point(lambda value: value if value >= TABLE_ALPHA_THRESHOLD else 0)
    bbox = alpha.getbbox()
    if bbox is None:
        raise ValueError("Generated table plate has no opaque pixels")
    image.putalpha(alpha)
    return image, bbox


def build_table_plate(path: Path) -> Image.Image:
    source, bbox = clean_table_alpha(fit_generated(path))
    sprite = source.crop(bbox)
    target_width = TABLE_TARGET_BBOX[2] - TABLE_TARGET_BBOX[0]
    target_height = TABLE_TARGET_BBOX[3] - TABLE_TARGET_BBOX[1]
    sprite = sprite.resize(
        (target_width, target_height),
        Image.Resampling.LANCZOS,
    )
    plate = Image.new("RGBA", CANVAS_SIZE, (0, 0, 0, 0))
    plate.alpha_composite(sprite, TABLE_TARGET_BBOX[:2])
    return plate


def build_shadow(theme: str) -> Image.Image:
    layer = Image.new("RGBA", CANVAS_SIZE, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    alpha = 68 if theme == "day" else 88
    draw.ellipse((580, 805, 1275, 908), fill=(24, 21, 16, alpha))
    return layer.filter(ImageFilter.GaussianBlur(22))


def register_scaled(
    source: Image.Image,
    scale: float,
    position: tuple[int, int],
) -> Image.Image:
    registered = Image.new("RGBA", CANVAS_SIZE, (0, 0, 0, 0))
    resized = source.resize(
        (
            round(CANVAS_SIZE[0] * scale),
            round(CANVAS_SIZE[1] * scale),
        ),
        Image.Resampling.LANCZOS,
    )
    registered.alpha_composite(resized, position)
    return registered


def threshold_bbox(image: Image.Image, threshold: int = 128):
    return image.getchannel("A").point(
        lambda value: 255 if value > threshold else 0
    ).getbbox()


def register_boat(source: Image.Image) -> tuple[Image.Image, tuple[int, int], tuple[int, int]]:
    bbox = threshold_bbox(source)
    if bbox is None:
        raise ValueError("Sailboat source has no opaque pixels")
    padding = 8
    crop_box = (
        max(0, bbox[0] - padding),
        max(0, bbox[1] - padding),
        min(source.width, bbox[2] + padding),
        min(source.height, bbox[3] + padding),
    )
    sprite = source.crop(crop_box)
    sprite = sprite.resize(
        (
            round(sprite.width * BOAT_SCALE),
            round(sprite.height * BOAT_SCALE),
        ),
        Image.Resampling.LANCZOS,
    )
    position = (
        round(BOAT_TARGET_CENTER[0] - sprite.width / 2),
        round(BOAT_TARGET_CENTER[1] - sprite.height / 2),
    )
    layer = Image.new("RGBA", CANVAS_SIZE, (0, 0, 0, 0))
    layer.alpha_composite(sprite, position)
    return layer, position, sprite.size


def save_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, optimize=True)


def build_theme(theme: str, verification_dir: Path | None = None) -> None:
    output = OUTPUT_ROOT / theme
    output.mkdir(parents=True, exist_ok=True)

    if theme == "day":
        source = DAY_SOURCE
        sky_source = rgba(source / "01-sky-clouds.png")
        sky = register_scaled(sky_source, SKY_SCALE, SKY_POSITION)
        clouds = None
        harbor_source = rgba(source / "02-harbor-bay.png")
        harbor = register_scaled(harbor_source, HARBOR_SCALE, HARBOR_POSITION)
        boat_source = rgba(source / "03-sailboat.png")
        room = build_room_shell(
            source / "04-foreground-interior.png",
            GENERATED / "day-room-clean-generated.png",
        )
        table = build_table_plate(GENERATED / "day-table-transparent.png")
    else:
        source = NIGHT_SOURCE
        sky = rgba(source / "01-sky-moon.png")
        clouds = rgba(source / "02-clouds.png")
        harbor_source = rgba(source / "03-harbor-water-lighthouse.png")
        harbor = register_scaled(harbor_source, HARBOR_SCALE, HARBOR_POSITION)
        boat_source = rgba(source / "04-sailboat.png")
        room = build_room_shell(
            source / "05-foreground-interior.png",
            GENERATED / "night-room-clean-generated.png",
        )
        table = build_table_plate(GENERATED / "night-table-transparent.png")

    boat, boat_position, boat_size = register_boat(boat_source)
    shadow = build_shadow(theme)

    plates = {
        "01-sky.png": sky,
        "03-harbor.png": harbor,
        "04-sailboat.png": boat,
        "05-room-shell.png": room,
        "06-table-shadow.png": shadow,
        "07-coffee-table.png": table,
    }
    if clouds is not None:
        plates["02-clouds.png"] = clouds

    for filename, image in plates.items():
        save_png(image, output / filename)

    neutral = Image.new("RGBA", CANVAS_SIZE, (14, 35, 42, 255))
    neutral.alpha_composite(sky)
    if clouds is not None:
        neutral.alpha_composite(clouds)
    neutral.alpha_composite(harbor)
    neutral.alpha_composite(boat)
    neutral.alpha_composite(room)
    neutral.alpha_composite(shadow)
    neutral.alpha_composite(table)
    if verification_dir is not None:
        save_png(neutral, verification_dir / f"{theme}-neutral-composite.png")

    approved = rgba(
        (DAY_SOURCE / "04-foreground-interior.png")
        if theme == "day"
        else (NIGHT_SOURCE / "05-foreground-interior.png")
    )
    outside = ImageChops.difference(room, approved)
    outside.putalpha(
        ImageChops.multiply(
            outside.getchannel("A"),
            ImageChops.invert(feathered_repair_mask()),
        )
    )
    changed_outside_bbox = outside.getbbox()
    if changed_outside_bbox is not None:
        raise ValueError(
            f"{theme} room shell changed outside repair mask: {changed_outside_bbox}"
        )

    manifest = {
        "version": 1,
        "theme": theme,
        "canvas": list(CANVAS_SIZE),
        "aperture": {
            "owner": "room-shell",
            "bbox": [616, 8, 1110, 399],
            "alphaSource": (
                "active/day/04-foreground-interior.png"
                if theme == "day"
                else "active/night/05-foreground-interior.png"
            ),
        },
        "registration": {
            "tableTargetBbox": list(TABLE_TARGET_BBOX),
            "boatPosition": list(boat_position),
            "boatSize": list(boat_size),
            "boatPivot": [
                boat_position[0] + boat_size[0] / 2,
                boat_position[1] + boat_size[1] * 0.9,
            ],
        },
        "layers": [
            {
                "id": "sky",
                "file": "01-sky.png",
                "owner": "exterior-far",
                "z": 10,
                "maxShiftPercent": 0.15,
            },
            *(
                [
                    {
                        "id": "clouds",
                        "file": "02-clouds.png",
                        "owner": "exterior-clouds",
                        "z": 20,
                        "maxShiftPercent": 0.25,
                    }
                ]
                if clouds is not None
                else []
            ),
            {
                "id": "harbor",
                "file": "03-harbor.png",
                "owner": "exterior-mid",
                "z": 30,
                "maxShiftPercent": 0.35,
                "effects": (
                    ["moon-reflection", "lighthouse-glow"]
                    if theme == "night"
                    else []
                ),
            },
            {
                "id": "sailboat",
                "file": "04-sailboat.png",
                "owner": "exterior-boat",
                "z": 40,
                "maxShiftPercent": 0.45,
                "ambient": {
                    "rockDegrees": 0.9,
                    "bobPixels": 0.55,
                    "durationSeconds": 4,
                    "horizontalTravel": 0,
                },
            },
            {
                "id": "room",
                "file": "05-room-shell.png",
                "owner": "interior-shell",
                "z": 50,
                "maxShiftPercent": 0.75,
                "hotspots": ["photo-frame"],
            },
            {
                "id": "table-shadow",
                "file": "06-table-shadow.png",
                "owner": "table-contact-shadow",
                "z": 60,
                "maxShiftPercent": 1.05,
            },
            {
                "id": "table",
                "file": "07-coffee-table.png",
                "owner": "foreground-table",
                "z": 70,
                "maxShiftPercent": 1.5,
                "effects": ["coffee-steam"],
            },
        ],
    }
    (output / "layers.json").write_text(
        json.dumps(manifest, indent=2) + "\n",
        encoding="utf-8",
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Prepare registered living-room DOM parallax plates."
    )
    parser.add_argument(
        "--verification-dir",
        type=Path,
        help="Optional directory for neutral composite QA images.",
    )
    args = parser.parse_args()
    if args.verification_dir is not None:
        args.verification_dir.mkdir(parents=True, exist_ok=True)
    build_theme("day", args.verification_dir)
    build_theme("night", args.verification_dir)
    print(
        json.dumps(
            {
                "canvas": list(CANVAS_SIZE),
                "themes": ["day", "night"],
                "tableTargetBbox": list(TABLE_TARGET_BBOX),
                "repairRect": list(REPAIR_RECT),
                "output": str(OUTPUT_ROOT.relative_to(ROOT)),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
