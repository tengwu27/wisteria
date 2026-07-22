#!/usr/bin/env python3
"""Build deterministic house-component animation frames from canonical artwork."""

from __future__ import annotations

import math
from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "assets/model-library/house/experiments/keyframes"


def keep_large_alpha_components(image: Image.Image) -> Image.Image:
    alpha = image.getchannel("A")
    pixels = alpha.load()
    width, height = image.size
    visited: set[tuple[int, int]] = set()
    components: list[list[tuple[int, int]]] = []
    for y in range(height):
        for x in range(width):
            if pixels[x, y] <= 16 or (x, y) in visited:
                continue
            queue = deque([(x, y)])
            visited.add((x, y))
            component: list[tuple[int, int]] = []
            while queue:
                px, py = queue.popleft()
                component.append((px, py))
                for nx in range(max(0, px - 1), min(width, px + 2)):
                    for ny in range(max(0, py - 1), min(height, py + 2)):
                        if pixels[nx, ny] > 16 and (nx, ny) not in visited:
                            visited.add((nx, ny))
                            queue.append((nx, ny))
            components.append(component)
    largest_size = max(len(component) for component in components)
    keep = {
        point
        for component in components
        if len(component) >= max(40, int(largest_size * 0.015))
        for point in component
    }
    cleaned = image.copy()
    cleaned_alpha = cleaned.getchannel("A")
    cleaned_pixels = cleaned_alpha.load()
    for y in range(height):
        for x in range(width):
            if (x, y) not in keep:
                cleaned_pixels[x, y] = 0
    cleaned.putalpha(cleaned_alpha)
    return cleaned


def polygon_mask(
    size: tuple[int, int],
    polygons: list[list[tuple[int, int]]],
    ellipses: list[tuple[int, int, int, int]] | None = None,
) -> Image.Image:
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    for polygon in polygons:
        draw.polygon(polygon, fill=255)
    for ellipse in ellipses or []:
        draw.ellipse(ellipse, fill=255)
    return mask.filter(ImageFilter.GaussianBlur(0.45))


def rebuild_turbine_frames() -> list[Image.Image]:
    canonical = Image.open(ASSET_DIR / "house-motion-states-canonical-clean.png").convert("RGBA").crop(
        (280, 35, 600, 270)
    )
    width, height = canonical.size
    center = (160, 115)

    # The polygons isolate the five blades and hub while excluding the fixed mast.
    rotor_mask = polygon_mask(
        canonical.size,
        [
            [(126, 116), (74, 90), (78, 146), (151, 136)],
            [(132, 104), (91, 18), (129, 12), (160, 99)],
            [(160, 99), (177, 13), (225, 19), (184, 116)],
            [(176, 108), (263, 106), (270, 158), (176, 139)],
            [(151, 130), (145, 204), (185, 211), (177, 132)],
        ],
        ellipses=[(128, 83, 193, 148)],
    )

    # The lower cream blade crosses in front of the teal mast in the painted
    # source. Refine that wedge by color, then dilate it slightly to retain its
    # inked edge without accidentally rotating any mast pixels.
    lower_wedge = polygon_mask(
        canonical.size,
        [[(148, 126), (137, 205), (190, 215), (180, 127)]],
    )
    cream_seed = Image.new("L", canonical.size, 0)
    seed_pixels = cream_seed.load()
    source_pixels = canonical.load()
    wedge_pixels = lower_wedge.load()
    for y in range(125, min(height, 216)):
        for x in range(132, min(width, 194)):
            r, g, b, a = source_pixels[x, y]
            if wedge_pixels[x, y] and a and r > 110 and g > 90 and b > 65:
                seed_pixels[x, y] = 255
    cream_blade = cream_seed.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(0.35))
    cream_pixels = cream_blade.load()
    for y in range(200, height):
        for x in range(width):
            cream_pixels[x, y] = 0
    rotor_mask = Image.composite(cream_blade, rotor_mask, lower_wedge)

    hub_mask = Image.new("L", canonical.size, 0)
    hub_draw = ImageDraw.Draw(hub_mask)
    hub_draw.ellipse((136, 91, 185, 140), fill=255)
    hub_mask = hub_mask.filter(ImageFilter.GaussianBlur(0.35))
    hub = Image.new("RGBA", canonical.size, (0, 0, 0, 0))
    hub.paste(canonical, (0, 0), hub_mask)
    # The hub is fixed; remove it from the rotating blade layer.
    rotor_mask_pixels = rotor_mask.load()
    hub_pixels = hub_mask.load()
    for y in range(height):
        for x in range(width):
            if hub_pixels[x, y] > 8:
                rotor_mask_pixels[x, y] = 0
    rotor = Image.new("RGBA", canonical.size, (0, 0, 0, 0))
    rotor.paste(canonical, (0, 0), Image.composite(canonical.getchannel("A"), Image.new("L", canonical.size), rotor_mask))
    rotor = keep_large_alpha_components(rotor)

    # Reconstruct a single fixed mast behind the rotor. It is shared byte-for-byte
    # by every frame; only the rotor layer below is transformed.
    mast = Image.new("RGBA", canonical.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(mast)
    draw.rounded_rectangle((151, 108, 170, 209), radius=6, fill=(22, 47, 52, 255))
    draw.rounded_rectangle((154, 109, 167, 207), radius=4, fill=(26, 108, 124, 255))
    draw.rectangle((156, 111, 159, 204), fill=(53, 137, 148, 255))
    draw.rounded_rectangle((147, 184, 174, 196), radius=4, fill=(72, 43, 20, 255))
    draw.rounded_rectangle((150, 184, 171, 193), radius=4, fill=(202, 126, 35, 255))
    draw.rounded_rectangle((137, 201, 185, 220), radius=7, fill=(20, 47, 51, 255))
    draw.rounded_rectangle((141, 202, 181, 216), radius=5, fill=(26, 103, 119, 255))
    draw.rectangle((148, 203, 157, 216), fill=(52, 137, 148, 255))

    # Runtime packages use one rigid rotor, sandwiched between the fixed mast
    # and hub. These canonical layers replace painted rotation-frame families.
    mast.save(ASSET_DIR / "turbine-mast-v2.png", optimize=True)
    rotor.save(ASSET_DIR / "turbine-rotor-canonical-v2.png", optimize=True)
    hub.save(ASSET_DIR / "turbine-hub-v2.png", optimize=True)

    frames: list[Image.Image] = []
    for index, clockwise_degrees in enumerate((0, 24, 48), start=1):
        rotated = rotor.rotate(
            -clockwise_degrees,
            resample=Image.Resampling.BICUBIC,
            center=center,
            expand=False,
        )
        frame = Image.alpha_composite(Image.alpha_composite(mast, rotated), hub)
        frame.save(ASSET_DIR / f"turbine-v2-frame-{index:02d}.png")
        frames.append(frame)
    return frames


def clock_base(canonical: Image.Image, center: tuple[int, int]) -> Image.Image:
    base = canonical.copy()
    pixels = base.load()
    cx, cy = center

    # Remove the original hands inside the dial by borrowing nearby face texture.
    source = canonical.copy()
    source_pixels = source.load()
    for y in range(cy - 32, cy + 33):
        for x in range(cx - 32, cx + 33):
            radius = math.hypot(x - cx, y - cy)
            if radius > 30:
                continue
            r, g, b, a = pixels[x, y]
            if a > 0 and max(r, g, b) < 125:
                sample_x = cx - (y - cy)
                sample_y = cy + (x - cx)
                sr, sg, sb, sa = source_pixels[sample_x, sample_y]
                if sa == 0 or max(sr, sg, sb) < 125:
                    sr, sg, sb = (225, 207, 165)
                pixels[x, y] = (sr, sg, sb, a)

    # Clear the old central pin so every frame receives an identical replacement.
    draw = ImageDraw.Draw(base)
    draw.ellipse((cx - 7, cy - 7, cx + 7, cy + 7), fill=(225, 207, 165, 255))
    return base


def hand_endpoint(center: tuple[int, int], angle: float, length: float) -> tuple[float, float]:
    radians = math.radians(angle)
    return (center[0] + math.cos(radians) * length, center[1] - math.sin(radians) * length)


def draw_clock_hands(base: Image.Image, hour_angle: float, minute_angle: float) -> Image.Image:
    scale = 4
    center = (155, 87)
    large = base.resize((base.width * scale, base.height * scale), Image.Resampling.LANCZOS)
    draw = ImageDraw.Draw(large)
    c = (center[0] * scale, center[1] * scale)

    def line(angle: float, length: float, outer: int, inner: int) -> None:
        endpoint = hand_endpoint(center, angle, length)
        e = (endpoint[0] * scale, endpoint[1] * scale)
        draw.line((c, e), fill=(31, 37, 32, 255), width=outer * scale)
        draw.line((c, e), fill=(74, 67, 43, 255), width=inner * scale)

    line(hour_angle, 19, 6, 3)
    line(minute_angle, 29, 4, 2)
    draw.ellipse(
        ((center[0] - 7) * scale, (center[1] - 7) * scale,
         (center[0] + 7) * scale, (center[1] + 7) * scale),
        fill=(67, 39, 19, 255),
    )
    draw.ellipse(
        ((center[0] - 5) * scale, (center[1] - 5) * scale,
         (center[0] + 5) * scale, (center[1] + 5) * scale),
        fill=(213, 132, 34, 255),
    )
    draw.ellipse(
        ((center[0] - 2) * scale, (center[1] - 3) * scale,
         (center[0] + 1) * scale, center[1] * scale),
        fill=(246, 190, 75, 255),
    )
    return large.resize(base.size, Image.Resampling.LANCZOS)


def rebuild_clock_frames() -> list[Image.Image]:
    canonical = Image.open(ASSET_DIR / "house-motion-states-canonical-clean.png").convert("RGBA").crop(
        (280, 775, 600, 970)
    )
    base = clock_base(canonical, (155, 87))
    base.save(ASSET_DIR / "clock-base-v2.png", optimize=True)
    # Angles use mathematical coordinates. Decreasing values rotate clockwise.
    angles = ((150, 25), (146, 10), (142, -5))
    frames: list[Image.Image] = []
    for index, (hour_angle, minute_angle) in enumerate(angles, start=1):
        frame = draw_clock_hands(base, hour_angle, minute_angle)
        frame.save(ASSET_DIR / f"clock-v2-frame-{index:02d}.png")
        frames.append(frame)
    return frames


def rebuild_sheet(turbines: list[Image.Image], clocks: list[Image.Image]) -> Image.Image:
    sheet = Image.new("RGBA", (1536, 1024), (0, 0, 0, 0))
    turbine_boxes = [(280, 35), (608, 35), (936, 35)]
    flag_boxes = [(280, 290), (608, 290), (936, 290)]
    lamp_boxes = [(400, 545), (756, 545)]
    clock_boxes = [(280, 775), (608, 775), (936, 775)]

    for image, position in zip(turbines, turbine_boxes):
        sheet.alpha_composite(image, position)
    for index, position in enumerate(flag_boxes, start=1):
        image = Image.open(ASSET_DIR / f"flag-v2-frame-{index:02d}.png").convert("RGBA")
        sheet.alpha_composite(image, position)
    for index, position in enumerate(lamp_boxes, start=1):
        image = Image.open(ASSET_DIR / f"lamp-v2-frame-{index:02d}.png").convert("RGBA")
        sheet.alpha_composite(image, position)
    for image, position in zip(clocks, clock_boxes):
        sheet.alpha_composite(image, position)

    sheet.save(ASSET_DIR / "house-motion-states-v2.png")
    sheet.save(ASSET_DIR / "house-motion-states-v1.png")
    return sheet


def save_legacy_aliases(turbines: list[Image.Image], clocks: list[Image.Image]) -> None:
    for name, frames, canvas_size in (
        ("turbine", turbines, (512, 330)),
        ("clock", clocks, (512, 224)),
    ):
        for index, frame in enumerate(frames, start=1):
            canvas = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
            position = (
                (canvas.width - frame.width) // 2,
                (canvas.height - frame.height) // 2,
            )
            canvas.alpha_composite(frame, position)
            canvas.save(ASSET_DIR / f"{name}-{index:02d}.png")


def save_preview(name: str, frames: list[Image.Image], duration: int) -> None:
    background_frames: list[Image.Image] = []
    for frame in frames:
        background = Image.new("RGBA", frame.size, (21, 25, 27, 255))
        background.alpha_composite(frame)
        background_frames.append(background.convert("RGB"))
    background_frames[0].save(
        ASSET_DIR / f"{name}-preview.gif",
        save_all=True,
        append_images=background_frames[1:],
        duration=duration,
        loop=0,
        disposal=2,
    )


def main() -> None:
    turbines = rebuild_turbine_frames()
    clocks = rebuild_clock_frames()
    rebuild_sheet(turbines, clocks)
    save_legacy_aliases(turbines, clocks)
    save_preview("turbine", turbines, 140)
    save_preview("clock", clocks, 220)


if __name__ == "__main__":
    main()
