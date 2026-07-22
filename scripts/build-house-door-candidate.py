#!/usr/bin/env python3
"""Normalize a generated closed-door candidate to the house aperture contract."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / "assets/model-library/house/v2"
CANDIDATES = PACKAGE / "candidates"
DEFAULT_SOURCE = CANDIDATES / "main-door-closed-bottom-right-v3-cutout.png"
DEFAULT_OUTPUT = CANDIDATES / "main-door-closed-bottom-right-v3.png"
DEFAULT_ASSEMBLY = PACKAGE / "validation/door-closed-bottom-right-v3-assembly.png"
DEFAULT_DETAIL = PACKAGE / "validation/door-closed-bottom-right-v3-detail.png"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--assembly", type=Path, default=DEFAULT_ASSEMBLY)
    parser.add_argument("--detail", type=Path, default=DEFAULT_DETAIL)
    args = parser.parse_args()
    for name in ("source", "output", "assembly", "detail"):
        value = getattr(args, name)
        if not value.is_absolute():
            setattr(args, name, ROOT / value)

    mask = Image.open(PACKAGE / "main-door-fit-mask-v2.png").convert("RGBA").getchannel("A")
    mask_bbox = mask.getbbox()
    if mask_bbox is None:
        raise ValueError("House doorway mask has no visible pixels")

    source = Image.open(args.source).convert("RGBA")
    source_bbox = source.getchannel("A").getbbox()
    if source_bbox is None:
        raise ValueError("Generated door candidate has no visible pixels")

    target_size = (mask_bbox[2] - mask_bbox[0], mask_bbox[3] - mask_bbox[1])
    artwork = source.crop(source_bbox).resize(target_size, Image.Resampling.LANCZOS)
    # Guarantee full mask coverage without adding casing, hinges, or trim outside
    # the aperture. The colored underpaint is visible only at antialiased edges.
    texture = Image.new("RGBA", target_size, (24, 91, 99, 255))
    texture.alpha_composite(artwork)
    texture.putalpha(Image.new("L", target_size, 255))

    canvas = Image.new("RGBA", mask.size, (0, 0, 0, 0))
    canvas.paste(texture, mask_bbox[:2], mask.crop(mask_bbox))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(args.output, optimize=True)

    interior = Image.open(PACKAGE / "main-door-interior-v2.png").convert("RGBA")
    shell = Image.open(PACKAGE / "house-shell-v2.png").convert("RGBA")
    foreground = Image.open(PACKAGE / "main-door-foreground-v2.png").convert("RGBA")
    assembly = Image.alpha_composite(Image.alpha_composite(interior, shell), canvas)
    assembly = Image.alpha_composite(assembly, foreground)
    args.assembly.parent.mkdir(parents=True, exist_ok=True)
    assembly.save(args.assembly, optimize=True)

    x0, y0, x1, y1 = mask_bbox
    margin = 34
    detail_box = (x0 - margin, y0 - margin, x1 + margin, y1 + margin)
    args.detail.parent.mkdir(parents=True, exist_ok=True)
    assembly.crop(detail_box).resize((472, 924), Image.Resampling.NEAREST).save(args.detail, optimize=True)
    print(f"Built {args.output.relative_to(ROOT)} on {canvas.width}x{canvas.height}; fit={mask_bbox}")


if __name__ == "__main__":
    main()
