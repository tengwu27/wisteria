from pathlib import Path

from PIL import Image


SCENE_ROOT = Path(__file__).resolve().parents[1]
SOURCE = SCENE_ROOT / "source" / "restaurant-vista-room-v3.png"
OUTPUTS = {
    1672: (SCENE_ROOT / "delivery" / "restaurant-vista-patio-1672.webp", 86),
    2508: (SCENE_ROOT / "delivery" / "restaurant-vista-patio-2508.webp", 68),
    3072: (SCENE_ROOT / "delivery" / "restaurant-vista-patio-3072.webp", 56),
}
EXPECTED_SIZE = (3344, 1882)


def main() -> None:
    with Image.open(SOURCE) as image:
        image.load()
        if image.size != EXPECTED_SIZE:
            raise ValueError(
                f"Expected registered artwork at {EXPECTED_SIZE}, got {image.size}"
            )
        rgb = image.convert("RGB")
        for width, (output, quality) in OUTPUTS.items():
            output.parent.mkdir(parents=True, exist_ok=True)
            height = round(width * EXPECTED_SIZE[1] / EXPECTED_SIZE[0])
            rendered = rgb if width == EXPECTED_SIZE[0] else rgb.resize(
                (width, height),
                Image.Resampling.LANCZOS,
            )
            rendered.save(
                output,
                format="WEBP",
                quality=quality,
                method=6,
                exact=True,
            )
            print(f"Wrote {output.relative_to(SCENE_ROOT)} ({output.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
