#!/usr/bin/env python3
"""Render a hinged door or gate over a paired active/interior plate."""

from __future__ import annotations

import argparse
import math
import shutil
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter


def csv_ints(value: str, count: int, label: str) -> tuple[int, ...]:
    try:
        values = tuple(int(part.strip()) for part in value.split(","))
    except ValueError as exc:
        raise argparse.ArgumentTypeError(f"{label} must contain integers") from exc
    if len(values) != count:
        raise argparse.ArgumentTypeError(f"{label} requires {count} comma-separated integers")
    return values


def parse_box(value: str) -> tuple[int, int, int, int]:
    values = csv_ints(value, 4, "box")
    x0, y0, x1, y1 = values
    if x1 <= x0 or y1 <= y0:
        raise argparse.ArgumentTypeError("box must satisfy x1>x0 and y1>y0")
    return x0, y0, x1, y1


def parse_point(value: str) -> tuple[int, int]:
    return csv_ints(value, 2, "point")


def parse_size(value: str) -> tuple[int, int]:
    try:
        width, height = (int(part) for part in value.lower().split("x", 1))
    except (ValueError, TypeError) as exc:
        raise argparse.ArgumentTypeError("size must use WIDTHxHEIGHT") from exc
    if width <= 0 or height <= 0:
        raise argparse.ArgumentTypeError("size values must be positive")
    return width, height


def smoothstep(value: float) -> float:
    value = max(0.0, min(1.0, value))
    return value * value * (3.0 - 2.0 * value)


def arched_mask(
    size: tuple[int, int],
    box: tuple[int, int, int, int],
    arch_ratio: float,
    feather: float,
) -> Image.Image:
    x0, y0, x1, y1 = box
    height = y1 - y0
    arch_height = max(1, round(height * arch_ratio))
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    draw.pieslice((x0, y0, x1, y0 + arch_height * 2), 180, 360, fill=255)
    draw.rectangle((x0, y0 + arch_height, x1, y1), fill=255)
    return mask.filter(ImageFilter.GaussianBlur(feather)) if feather > 0 else mask


def load_mask(
    path: Path | None,
    size: tuple[int, int],
    box: tuple[int, int, int, int],
    arch_ratio: float,
    feather: float,
) -> Image.Image:
    if path is None:
        return arched_mask(size, box, arch_ratio, feather)
    mask = Image.open(path).convert("L")
    if mask.size != size:
        raise ValueError(f"Mask {path} is {mask.size}; expected {size}")
    return mask


def homography(
    source: list[tuple[float, float]], destination: list[tuple[float, float]]
) -> tuple[float, ...]:
    matrix_rows: list[list[float]] = []
    results: list[float] = []
    for (x, y), (u, v) in zip(source, destination):
        matrix_rows.append([x, y, 1, 0, 0, 0, -u * x, -u * y])
        results.append(u)
        matrix_rows.append([0, 0, 0, x, y, 1, -v * x, -v * y])
        results.append(v)
    solved = np.linalg.solve(np.asarray(matrix_rows, float), np.asarray(results, float))
    forward = np.array(
        [[solved[0], solved[1], solved[2]],
         [solved[3], solved[4], solved[5]],
         [solved[6], solved[7], 1.0]]
    )
    inverse = np.linalg.inv(forward)
    inverse /= inverse[2, 2]
    return tuple(inverse.flatten()[:8])


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("closed", type=Path, help="Closed-state image")
    parser.add_argument("active", type=Path, help="Open/interior plate")
    parser.add_argument("output", type=Path, help="Output MP4")
    parser.add_argument("--door-box", required=True, type=parse_box, help="x0,y0,x1,y1")
    parser.add_argument("--opening-box", type=parse_box, help="Defaults to --door-box")
    parser.add_argument("--door-mask", type=Path, help="Full-size grayscale mask")
    parser.add_argument("--opening-mask", type=Path, help="Full-size grayscale mask")
    parser.add_argument("--hinge", choices=("left", "right"), default="right")
    parser.add_argument("--anchor", type=parse_point, help="Camera anchor x,y")
    parser.add_argument("--output-size", type=parse_size, default=(1920, 1080))
    parser.add_argument("--duration", type=float, default=3.0)
    parser.add_argument("--fps", type=int, default=30)
    parser.add_argument("--angle", type=float, default=82.0)
    parser.add_argument("--zoom", type=float, default=0.235, help="Final fractional zoom")
    parser.add_argument("--open-start", type=float, default=0.115, help="Normalized time")
    parser.add_argument("--open-end", type=float, default=0.885, help="Normalized time")
    parser.add_argument("--arch-ratio", type=float, default=0.20)
    parser.add_argument("--mask-feather", type=float, default=1.5)
    parser.add_argument("--bob", type=float, default=1.45, help="Walking bob in source pixels")
    parser.add_argument("--crf", type=int, default=17)
    parser.add_argument("--preset", default="slow")
    parser.add_argument("--poster", type=Path, help="Optional JPEG or PNG poster")
    parser.add_argument("--ffmpeg", default=None, help="FFmpeg executable")
    return parser


def main() -> None:
    args = build_parser().parse_args()
    if args.duration <= 0 or args.fps <= 0:
        raise SystemExit("duration and fps must be positive")
    if not 0 <= args.open_start < args.open_end <= 1:
        raise SystemExit("open timing must satisfy 0 <= start < end <= 1")
    if not 0 <= args.arch_ratio <= 0.5:
        raise SystemExit("arch-ratio must be between 0 and 0.5")

    ffmpeg = args.ffmpeg or shutil.which("ffmpeg")
    if not ffmpeg:
        raise SystemExit("FFmpeg was not found; pass --ffmpeg or add it to PATH")

    closed = Image.open(args.closed).convert("RGBA")
    active = Image.open(args.active).convert("RGBA")
    if active.size != closed.size:
        raise SystemExit(f"Input dimensions differ: {closed.size} vs {active.size}")

    width, height = closed.size
    x0, y0, x1, y1 = args.door_box
    if not (0 <= x0 < x1 <= width and 0 <= y0 < y1 <= height):
        raise SystemExit("door-box lies outside the source image")
    opening_box = args.opening_box or args.door_box

    door_mask = load_mask(
        args.door_mask, closed.size, args.door_box, args.arch_ratio, args.mask_feather
    )
    opening_mask = load_mask(
        args.opening_mask, closed.size, opening_box, args.arch_ratio, args.mask_feather * 1.3
    )

    door_layer = closed.copy()
    door_layer.putalpha(door_mask)
    door_crop = door_layer.crop(args.door_box)
    background = Image.composite(active, closed, opening_mask)

    crop_width, crop_height = door_crop.size
    source_quad = [
        (0, 0),
        (crop_width, 0),
        (crop_width, crop_height),
        (0, crop_height),
    ]

    output_width, output_height = args.output_size
    frame_count = max(2, round(args.duration * args.fps))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    command = [
        ffmpeg, "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
        "-s", f"{output_width}x{output_height}", "-r", str(args.fps),
        "-i", "-", "-an", "-c:v", "libx264", "-preset", args.preset,
        "-crf", str(args.crf), "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        str(args.output),
    ]
    process = subprocess.Popen(command, stdin=subprocess.PIPE)
    if process.stdin is None:
        raise SystemExit("Could not open FFmpeg input pipe")

    anchor_x, anchor_y = args.anchor or ((x0 + x1) // 2, (y0 + y1) // 2)
    initial_screen_x = anchor_x / width
    initial_screen_y = anchor_y / height

    for frame_number in range(frame_count):
        normalized = frame_number / (frame_count - 1)
        travel = smoothstep(normalized)
        door_progress = smoothstep(
            (normalized - args.open_start) / (args.open_end - args.open_start)
        )
        angle = math.radians(args.angle * door_progress)
        projected_width = crop_width * math.cos(angle)
        vertical_inset = 8.0 * math.sin(angle)

        if args.hinge == "right":
            free_x = x1 - projected_width
            destination_quad = [
                (free_x, y0 + vertical_inset),
                (x1, y0),
                (x1, y1),
                (free_x, y1 - vertical_inset * 0.625),
            ]
        else:
            free_x = x0 + projected_width
            destination_quad = [
                (x0, y0),
                (free_x, y0 + vertical_inset),
                (free_x, y1 - vertical_inset * 0.625),
                (x0, y1),
            ]

        coefficients = homography(source_quad, destination_quad)
        shade = 1.0 - 0.28 * math.sin(angle)
        shaded_door = ImageEnhance.Brightness(door_crop).enhance(shade)
        moving_door = shaded_door.transform(
            closed.size,
            Image.Transform.PERSPECTIVE,
            coefficients,
            resample=Image.Resampling.BICUBIC,
            fillcolor=(0, 0, 0, 0),
        )

        scene = background.copy()
        shadow = Image.new("RGBA", closed.size, (0, 0, 0, 0))
        shadow_draw = ImageDraw.Draw(shadow)
        alpha = round(42 * math.sin(angle))
        shadow_draw.polygon(
            [(min(x0, free_x), y0 + 12), (max(x1, free_x), y0 + 8),
             (max(x1, free_x), y1), (min(x0, free_x), y1 - 8)],
            fill=(24, 16, 10, alpha),
        )
        scene.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(8)))
        scene.alpha_composite(moving_door)

        zoom = 1.0 + args.zoom * travel
        view_width, view_height = width / zoom, height / zoom
        screen_x = initial_screen_x * (1 - travel) + 0.5 * travel
        screen_y = initial_screen_y * (1 - travel) + 0.53 * travel
        bob = (
            args.bob
            * math.sin(2 * math.pi * 1.1 * (frame_number / args.fps))
            * math.sin(math.pi * normalized)
        )
        left = anchor_x - screen_x * view_width
        top = anchor_y - screen_y * view_height + bob
        output_frame = scene.convert("RGB").transform(
            args.output_size,
            Image.Transform.EXTENT,
            (left, top, left + view_width, top + view_height),
            resample=Image.Resampling.BICUBIC,
        )
        process.stdin.write(output_frame.tobytes())

    process.stdin.close()
    if process.wait() != 0:
        raise SystemExit("FFmpeg encoding failed")

    if args.poster:
        args.poster.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            [ffmpeg, "-y", "-ss", "0.05", "-i", str(args.output),
             "-frames:v", "1", "-update", "1", str(args.poster)],
            check=True,
        )


if __name__ == "__main__":
    main()
