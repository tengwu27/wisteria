from pathlib import Path

from PIL import Image


SCENE_ROOT = Path(__file__).resolve().parents[1]
SOURCE = SCENE_ROOT / "source" / "harbor-view-approved.png"
OUTPUT = SCENE_ROOT / "delivery" / "harbor-view-approved.webp"
EXPECTED_SIZE = (1672, 941)


def main() -> None:
    with Image.open(SOURCE) as image:
        image.load()
        if image.size != EXPECTED_SIZE:
            raise ValueError(
                f"Expected approved artwork at {EXPECTED_SIZE}, got {image.size}"
            )
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        image.convert("RGB").save(
            OUTPUT,
            format="WEBP",
            quality=88,
            method=6,
            exact=True,
        )
    print(f"Wrote {OUTPUT.relative_to(SCENE_ROOT)} ({OUTPUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
