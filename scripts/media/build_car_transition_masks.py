from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


SIZE = (1672, 941)
SUPERSAMPLE = 4
ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = (
    ROOT
    / "assets/cinematic/scenes/car-interior/transitions/driver-door/masks"
)
OUT_DIR.mkdir(parents=True, exist_ok=True)

# These registered contours describe the complete driver-door leaf and exact
# glazing aperture. The outer handle is on the rear side, which identifies the
# opposite front side as the hinge. The renderer owns that nearly vertical
# hinge axis and keeps the door upright while it swings.
DOOR_CONTOUR = [
    (601, 278),
    (829, 278),
    (847, 282),
    (863, 291),
    (878, 306),
    (891, 327),
    (905, 352),
    (920, 380),
    (936, 408),
    (948, 429),
    (950, 642),
    (947, 655),
    (939, 664),
    (929, 668),
    (578, 647),
    (566, 642),
    (559, 631),
    (556, 617),
    (556, 438),
    (562, 418),
    (574, 394),
    (586, 366),
    (591, 339),
    (592, 311),
    (595, 291),
]

WINDOW_APERTURE = [
    (633, 291),
    (817, 292),
    (833, 294),
    (846, 301),
    (857, 313),
    (869, 331),
    (881, 353),
    (894, 377),
    (905, 397),
    (912, 411),
    (909, 418),
    (899, 422),
    (883, 424),
    (634, 410),
    (623, 408),
    (615, 402),
    (610, 392),
    (607, 378),
    (608, 321),
    (611, 307),
    (618, 298),
]

MIRROR_BODY = (875, 384, 932, 449)
MIRROR_STEM = [(900, 426), (929, 449), (918, 458), (891, 433)]


def scaled_points(points: list[tuple[int, int]]) -> list[tuple[int, int]]:
    return [(x * SUPERSAMPLE, y * SUPERSAMPLE) for x, y in points]


def detailed_mask(
    polygon: list[tuple[int, int]],
    *,
    include_mirror: bool = False,
    feather: float = 0.55,
) -> Image.Image:
    large = Image.new(
        "L",
        (SIZE[0] * SUPERSAMPLE, SIZE[1] * SUPERSAMPLE),
        0,
    )
    draw = ImageDraw.Draw(large)
    draw.polygon(scaled_points(polygon), fill=255)
    if include_mirror:
        draw.ellipse(
            tuple(value * SUPERSAMPLE for value in MIRROR_BODY),
            fill=255,
        )
        draw.polygon(scaled_points(MIRROR_STEM), fill=255)

    mask = large.resize(SIZE, Image.Resampling.LANCZOS)
    if feather:
        mask = mask.filter(ImageFilter.GaussianBlur(feather))
    return mask


def main() -> None:
    glazing = detailed_mask(WINDOW_APERTURE, feather=0.45)
    glazing.save(OUT_DIR / "car-driver-door-glazing-mask-v3.png")

    outer = detailed_mask(DOOR_CONTOUR, include_mirror=True)
    # Preserve the complete painted frame and rubber seal, but make the exact
    # inner glazing aperture transparent.
    outer = Image.fromarray(
        np.minimum(
            np.asarray(outer),
            255 - np.asarray(glazing),
        ).astype("uint8")
    )
    # The mirror and its stem overlap the glazing aperture and remain opaque.
    mirror = Image.new(
        "L",
        (SIZE[0] * SUPERSAMPLE, SIZE[1] * SUPERSAMPLE),
        0,
    )
    mirror_draw = ImageDraw.Draw(mirror)
    mirror_draw.ellipse(
        tuple(value * SUPERSAMPLE for value in MIRROR_BODY),
        fill=255,
    )
    mirror_draw.polygon(scaled_points(MIRROR_STEM), fill=255)
    mirror = mirror.resize(SIZE, Image.Resampling.LANCZOS)
    outer = Image.fromarray(
        np.maximum(
            np.asarray(outer),
            np.asarray(mirror),
        ).astype("uint8")
    )
    outer.save(OUT_DIR / "car-driver-door-outer-mask-v3.png")


if __name__ == "__main__":
    main()
