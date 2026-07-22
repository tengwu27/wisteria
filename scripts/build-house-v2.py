#!/usr/bin/env python3
"""Build the canonical full-canvas main-house v2 package.

The accepted shell is preserved. Door artwork is normalized onto the same
780x975 canvas and constrained by a socket mask derived from the shell's own
empty aperture. No runtime layer needs a hand-tuned child offset.
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps


ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / "assets/model-library/house/v2"
SOURCES = PACKAGE / "sources"
RUNTIME = ROOT / "src/assets/images/world/house/v2"
WORLD_RUNTIME = ROOT / "src/assets/images/world/landscape/base-v2.png"
CONTRACT = PACKAGE / "house-v2.json"


def save_both(image: Image.Image, name: str) -> None:
    image.save(PACKAGE / name, optimize=True)
    image.save(RUNTIME / name, optimize=True)


def opaque_texture(source: Image.Image, size: tuple[int, int]) -> Image.Image:
    bbox = source.getchannel("A").getbbox()
    if bbox is None:
        raise ValueError("Door source has no visible pixels")
    cropped = source.crop(bbox)
    fitted = ImageOps.fit(cropped, size, Image.Resampling.LANCZOS, centering=(0.5, 0.5))
    # Intentional transparent details such as the porthole become dark glass;
    # the socket alpha remains continuous and therefore cannot leave a gap.
    black = Image.new("RGBA", fitted.size, (11, 28, 32, 255))
    black.alpha_composite(fitted)
    black.putalpha(Image.new("L", fitted.size, 255))
    return black


def perspective_coefficients(
    target: list[tuple[float, float]], source: list[tuple[float, float]]
) -> tuple[float, ...]:
    """Solve Pillow's output-to-input perspective transform coefficients."""
    matrix: list[list[float]] = []
    values: list[float] = []
    for (x, y), (u, v) in zip(target, source, strict=True):
        matrix.append([x, y, 1, 0, 0, 0, -u * x, -u * y])
        values.append(u)
        matrix.append([0, 0, 0, x, y, 1, -v * x, -v * y])
        values.append(v)

    # Eight-variable Gaussian elimination keeps the asset builder dependency-free.
    for column in range(8):
        pivot_row = max(range(column, 8), key=lambda row: abs(matrix[row][column]))
        if abs(matrix[pivot_row][column]) < 1e-12:
            raise ValueError("Door projection is singular")
        matrix[column], matrix[pivot_row] = matrix[pivot_row], matrix[column]
        values[column], values[pivot_row] = values[pivot_row], values[column]
        divisor = matrix[column][column]
        matrix[column] = [value / divisor for value in matrix[column]]
        values[column] /= divisor
        for row in range(8):
            if row == column:
                continue
            factor = matrix[row][column]
            matrix[row] = [
                current - factor * solved
                for current, solved in zip(matrix[row], matrix[column], strict=True)
            ]
            values[row] -= factor * values[column]
    return tuple(values)


def main() -> None:
    data = json.loads(CONTRACT.read_text())
    canvas = (data["canvas"]["width"], data["canvas"]["height"])
    socket = data["sockets"]["mainDoor"]
    roi = socket["apertureRoi"]

    PACKAGE.mkdir(parents=True, exist_ok=True)
    RUNTIME.mkdir(parents=True, exist_ok=True)

    shell = Image.open(SOURCES / "legacy/house-shell-v1.png").convert("RGBA")
    if shell.size != canvas:
        raise ValueError(f"Expected shell canvas {canvas}, got {shell.size}")
    # Remove a tiny neighboring-sheet fragment at the lower-right edge of v1.
    shell.paste((0, 0, 0, 0), (760, 800, 780, 975))

    shell_alpha = shell.getchannel("A")
    fit_mask = Image.new("L", canvas, 0)
    x0, y0, x1, y1 = roi["x"], roi["y"], roi["x"] + roi["w"], roi["y"] + roi["h"]
    for y in range(y0, y1):
        for x in range(x0, x1):
            if shell_alpha.getpixel((x, y)) <= 16:
                fit_mask.putpixel((x, y), 255)
    fit_bbox = fit_mask.getbbox()
    if fit_bbox is None:
        raise ValueError("The doorway aperture could not be derived from the shell")

    interior = Image.new("RGBA", canvas, (0, 0, 0, 0))
    fill = Image.new("RGBA", canvas, (0, 0, 0, 0))
    height = max(1, fit_bbox[3] - fit_bbox[1])
    for y in range(fit_bbox[1], fit_bbox[3]):
        t = (y - fit_bbox[1]) / height
        color = (12 + int(14 * t), 31 + int(25 * t), 36 + int(24 * t), 255)
        for x in range(fit_bbox[0], fit_bbox[2]):
            fill.putpixel((x, y), color)
    interior.paste(fill, (0, 0), fit_mask)

    source = Image.open(SOURCES / "door-closed-alpha.png").convert("RGBA")
    fit_size = (fit_bbox[2] - fit_bbox[0], fit_bbox[3] - fit_bbox[1])
    closed_texture = opaque_texture(source, fit_size)
    closed = Image.new("RGBA", canvas, (0, 0, 0, 0))
    closed.paste(closed_texture, fit_bbox[:2], fit_mask.crop(fit_bbox))

    # Derive the authored open endpoint from the exact accepted closed leaf.
    # The full native right edge stays fixed; the opposite edge recedes into the
    # doorway. Mirroring the assembled house turns this into the requested
    # world-facing left hinge with a clockwise inward swing.
    leaf_patch = Image.new("RGBA", fit_size, (0, 0, 0, 0))
    leaf_patch.paste(closed_texture, (0, 0), fit_mask.crop(fit_bbox))
    projection = socket["openProjection"]
    target = [
        (projection["freeTop"]["x"], projection["freeTop"]["y"]),
        (projection["hingeTop"]["x"], projection["hingeTop"]["y"]),
        (projection["hingeBottom"]["x"], projection["hingeBottom"]["y"]),
        (projection["freeBottom"]["x"], projection["freeBottom"]["y"]),
    ]
    source_quad = [
        (0, 0),
        (fit_size[0] - 1, 0),
        (fit_size[0] - 1, fit_size[1] - 1),
        (0, fit_size[1] - 1),
    ]
    coefficients = perspective_coefficients(target, source_quad)
    open_state = leaf_patch.transform(
        canvas,
        Image.Transform.PERSPECTIVE,
        coefficients,
        Image.Resampling.BICUBIC,
    )
    projection_mask = Image.new("L", canvas, 0)
    ImageDraw.Draw(projection_mask).polygon(target, fill=255)
    open_state.putalpha(ImageChops.multiply(open_state.getchannel("A"), projection_mask))

    # Copy only the permanent lip/casing immediately around the socket. This
    # final layer hides anti-aliased seams without duplicating the moving leaf.
    dilated = fit_mask.filter(ImageFilter.MaxFilter(9))
    ring = ImageChops.subtract(dilated, fit_mask)
    threshold = Image.new("L", canvas, 0)
    threshold.paste(255, (286, fit_bbox[3] - 16, 356, fit_bbox[3] + 12))
    foreground_mask = ImageChops.lighter(ring, threshold)
    foreground_mask = ImageChops.multiply(foreground_mask, shell_alpha)
    foreground = Image.new("RGBA", canvas, (0, 0, 0, 0))
    foreground.paste(shell, (0, 0), foreground_mask)

    save_both(shell, "house-shell-v2.png")
    save_both(interior, "main-door-interior-v2.png")
    save_both(closed, "main-door-closed-v2.png")
    save_both(open_state, "main-door-open-v2.png")
    save_both(foreground, "main-door-foreground-v2.png")
    mask_rgba = Image.new("RGBA", canvas, (255, 255, 255, 0))
    mask_rgba.putalpha(fit_mask)
    mask_rgba.save(PACKAGE / socket["fitMask"], optimize=True)
    mask_rgba.save(RUNTIME / socket["fitMask"], optimize=True)

    closed_preview = Image.alpha_composite(Image.alpha_composite(interior, shell), closed)
    closed_preview = Image.alpha_composite(closed_preview, foreground)
    open_preview = Image.alpha_composite(Image.alpha_composite(interior, shell), open_state)
    open_preview = Image.alpha_composite(open_preview, foreground)
    closed_preview.save(PACKAGE / "validation/assembly-closed-v2.png", optimize=True)
    open_preview.save(PACKAGE / "validation/assembly-open-v2.png", optimize=True)

    accepted_world = Image.open(ROOT / "assets/model-library/world/v1/world-landscape-v1.png").convert("RGB")
    cleared_source = Image.open(SOURCES / "world-landscape-house-cleared-source.png").convert("RGB")
    cleared_world = cleared_source.resize(accepted_world.size, Image.Resampling.LANCZOS)
    site_mask = Image.new("L", accepted_world.size, 0)
    ImageDraw.Draw(site_mask).rectangle((720, -100, 1430, 650), fill=255)
    site_mask = site_mask.filter(ImageFilter.GaussianBlur(22))
    Image.composite(cleared_world, accepted_world, site_mask).save(WORLD_RUNTIME, optimize=True)
    shutil.copy2(CONTRACT, RUNTIME / "house-v2.json")

    print(f"Built house-v2 on {canvas[0]}x{canvas[1]} canvas; doorway mask bbox={fit_bbox}")


if __name__ == "__main__":
    main()
