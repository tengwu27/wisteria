from __future__ import annotations

from pathlib import Path

from PIL import Image


SCENE_ROOT = Path(__file__).resolve().parent.parent
SOURCE_ROOT = SCENE_ROOT / "source"
REGISTERED_ROOT = SCENE_ROOT / "registered"
PROOF_ROOT = SCENE_ROOT / "proofs"

MASTER_SIZE = (2412, 941)
CLOUD_OPACITY = 0.27
CLOUD_OVERSCAN_X = 0.074
CLOUD_OVERSCAN_Y = 0.072


def crop_to_aspect(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    target_ratio = size[0] / size[1]
    source_ratio = image.width / image.height
    if source_ratio > target_ratio:
        width = round(image.height * target_ratio)
        left = (image.width - width) // 2
        box = (left, 0, left + width, image.height)
    else:
        height = round(image.width / target_ratio)
        top = (image.height - height) // 2
        box = (0, top, image.width, top + height)
    return image.crop(box).resize(size, Image.Resampling.LANCZOS)


def build_fallback(village: Image.Image, clouds: Image.Image) -> Image.Image:
    width, height = village.size
    cloud_width = round(width * (1 + CLOUD_OVERSCAN_X * 2))
    cloud_height = round(height * (1 + CLOUD_OVERSCAN_Y * 2))
    expanded_clouds = clouds.resize(
        (cloud_width, cloud_height),
        Image.Resampling.LANCZOS,
    )
    alpha = expanded_clouds.getchannel("A").point(
        lambda value: round(value * CLOUD_OPACITY)
    )
    expanded_clouds.putalpha(alpha)

    overlay = Image.new("RGBA", village.size, (0, 0, 0, 0))
    overlay.alpha_composite(
        expanded_clouds,
        ((width - cloud_width) // 2, (height - cloud_height) // 2),
    )
    return Image.alpha_composite(village.convert("RGBA"), overlay).convert("RGB")


def main() -> None:
    village = Image.open(SOURCE_ROOT / "village-master.png").convert("RGB")
    if village.size != MASTER_SIZE:
        raise ValueError(
            f"Expanded village master must remain {MASTER_SIZE}, got {village.size}"
        )

    cloud_source = Image.open(SOURCE_ROOT / "clouds-master.webp").convert("RGBA")
    clouds = crop_to_aspect(cloud_source, MASTER_SIZE)
    fallback = build_fallback(village, clouds)

    REGISTERED_ROOT.mkdir(parents=True, exist_ok=True)
    PROOF_ROOT.mkdir(parents=True, exist_ok=True)
    clouds.save(
        REGISTERED_ROOT / "01-clouds.webp",
        "WEBP",
        quality=80,
        method=6,
        exact=True,
    )
    village.save(
        REGISTERED_ROOT / "02-village.webp",
        "WEBP",
        quality=78,
        method=6,
    )
    fallback.save(
        REGISTERED_ROOT / "fallback.webp",
        "WEBP",
        quality=76,
        method=6,
    )
    fallback.save(
        PROOF_ROOT / "neutral-cloud-composite.jpg",
        "JPEG",
        quality=92,
        optimize=True,
        progressive=True,
    )


if __name__ == "__main__":
    main()
