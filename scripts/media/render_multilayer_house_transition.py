import argparse
import math
import shutil
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter


FPS = 30
DURATION_SECONDS = 4.0
OUTPUT_SIZE = (1920, 1080)
MASTER_SIZE = (1672, 941)
DOOR_BOX = (760, 452, 914, 713)
DOOR_ANCHOR = (838.0, 575.0)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Render the split-garden multilayer house transition."
    )
    parser.add_argument("closed", type=Path)
    parser.add_argument("interior", type=Path)
    parser.add_argument("layer_dir", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("poster", type=Path)
    parser.add_argument("--verification-dir", type=Path)
    return parser.parse_args()


def clamp(value: float) -> float:
    return max(0.0, min(1.0, value))


def smoothstep(value: float) -> float:
    value = clamp(value)
    return value * value * (3.0 - 2.0 * value)


def smootherstep(value: float) -> float:
    value = clamp(value)
    return value * value * value * (
        value * (value * 6.0 - 15.0) + 10.0
    )


def lerp(start: float, end: float, amount: float) -> float:
    return start + (end - start) * amount


def homography(
    source: list[tuple[float, float]],
    destination: list[tuple[float, float]],
) -> tuple[float, ...]:
    matrix_rows = []
    results = []
    for (x, y), (u, v) in zip(source, destination):
        matrix_rows.append([x, y, 1, 0, 0, 0, -u * x, -u * y])
        results.append(u)
        matrix_rows.append([0, 0, 0, x, y, 1, -v * x, -v * y])
        results.append(v)
    solved = np.linalg.solve(
        np.asarray(matrix_rows, float),
        np.asarray(results, float),
    )
    forward = np.asarray(
        [
            [solved[0], solved[1], solved[2]],
            [solved[3], solved[4], solved[5]],
            [solved[6], solved[7], 1.0],
        ],
        dtype=float,
    )
    inverse = np.linalg.inv(forward)
    inverse /= inverse[2, 2]
    return tuple(inverse.flatten()[:8])


def build_registered_scene(
    closed: Image.Image,
    interior: Image.Image,
) -> tuple[Image.Image, Image.Image]:
    width, height = closed.size
    x0, y0, x1, y1 = DOOR_BOX

    door_mask = Image.new("L", (width, height), 0)
    door_draw = ImageDraw.Draw(door_mask)
    door_draw.pieslice((766, 457, 908, 565), 180, 360, fill=255)
    door_draw.rectangle((766, 510, 908, 708), fill=255)
    door_mask = door_mask.filter(ImageFilter.GaussianBlur(1.25))
    moving_door = closed.copy()
    moving_door.putalpha(door_mask)

    opening_mask = Image.new("L", (width, height), 0)
    opening_draw = ImageDraw.Draw(opening_mask)
    opening_draw.pieslice(
        (762, 449, 912, 571),
        180,
        360,
        fill=255,
    )
    opening_draw.rectangle((762, 509, 912, 713), fill=255)
    opening_mask = opening_mask.filter(ImageFilter.GaussianBlur(2.0))
    background = Image.composite(interior, closed, opening_mask)

    return background, moving_door.crop((x0, y0, x1, y1))


def moving_door_layer(
    door_crop: Image.Image,
    progress: float,
) -> tuple[Image.Image, float]:
    width, height = MASTER_SIZE
    x0, y0, x1, y1 = DOOR_BOX
    angle = math.radians(82.0 * progress)
    projected_width = door_crop.width * math.cos(angle)
    source_quad = [
        (0.0, 0.0),
        (float(door_crop.width), 0.0),
        (float(door_crop.width), float(door_crop.height)),
        (0.0, float(door_crop.height)),
    ]
    destination_quad = [
        (x1 - projected_width, y0 + 8.0 * math.sin(angle)),
        (x1, y0),
        (x1, y1),
        (x1 - projected_width, y1 - 5.0 * math.sin(angle)),
    ]
    coefficients = homography(source_quad, destination_quad)
    shaded = ImageEnhance.Brightness(door_crop).enhance(
        1.0 - 0.28 * math.sin(angle)
    )
    transformed = shaded.transform(
        (width, height),
        Image.Transform.PERSPECTIVE,
        coefficients,
        resample=Image.Resampling.BICUBIC,
        fillcolor=(0, 0, 0, 0),
    )
    return transformed, angle


def composite_garden(
    scene: Image.Image,
    left_garden: Image.Image,
    right_garden: Image.Image,
    progress: float,
) -> None:
    split = smootherstep((progress - 0.015) / 0.80)
    # Begin with a clear central aisle rather than a closed botanical wall.
    # By the final hold, roughly four fifths of each full-width curtain has
    # cleared the frame, leaving the plants as edge framing for the house.
    left_x = lerp(-480.0, -1180.0, split)
    right_x = lerp(480.0, 1180.0, split)
    rise = 8.0 * math.sin(math.pi * split)
    scene.alpha_composite(left_garden, (round(left_x), round(rise)))
    scene.alpha_composite(right_garden, (round(right_x), round(rise)))


def apply_camera(
    scene: Image.Image,
    progress: float,
    frame_index: int,
) -> Image.Image:
    width, height = MASTER_SIZE
    travel = smootherstep(progress)
    zoom = 1.0 + 0.215 * travel
    crop_width = width / zoom
    crop_height = height / zoom
    anchor_x, anchor_y = DOOR_ANCHOR
    initial_screen_x = anchor_x / width
    initial_screen_y = anchor_y / height
    screen_x = lerp(initial_screen_x, 0.5, travel)
    screen_y = lerp(initial_screen_y, 0.525, travel)
    bob = (
        0.75
        * math.sin(2.0 * math.pi * 0.9 * (frame_index / FPS))
        * math.sin(math.pi * progress)
    )
    left = anchor_x - screen_x * crop_width
    top = anchor_y - screen_y * crop_height + bob
    return scene.convert("RGB").transform(
        OUTPUT_SIZE,
        Image.Transform.EXTENT,
        (left, top, left + crop_width, top + crop_height),
        resample=Image.Resampling.BICUBIC,
    )


def main() -> None:
    args = parse_args()
    closed = Image.open(args.closed).convert("RGBA")
    interior = Image.open(args.interior).convert("RGBA")
    left_garden = Image.open(
        args.layer_dir / "01-left-garden.png"
    ).convert("RGBA")
    right_garden = Image.open(
        args.layer_dir / "02-right-garden.png"
    ).convert("RGBA")

    for path, image in (
        (args.closed, closed),
        (args.interior, interior),
        (args.layer_dir / "01-left-garden.png", left_garden),
        (args.layer_dir / "02-right-garden.png", right_garden),
    ):
        if image.size != MASTER_SIZE:
            raise ValueError(
                f"{path} is {image.size}; expected {MASTER_SIZE}"
            )

    background, door_crop = build_registered_scene(closed, interior)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.poster.parent.mkdir(parents=True, exist_ok=True)
    if args.verification_dir:
        args.verification_dir.mkdir(parents=True, exist_ok=True)

    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("FFmpeg is required")

    process = subprocess.Popen(
        [
            ffmpeg,
            "-y",
            "-loglevel",
            "error",
            "-f",
            "rawvideo",
            "-pix_fmt",
            "rgb24",
            "-s",
            f"{OUTPUT_SIZE[0]}x{OUTPUT_SIZE[1]}",
            "-r",
            str(FPS),
            "-i",
            "-",
            "-an",
            "-c:v",
            "libx264",
            "-preset",
            "slow",
            "-crf",
            "17",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            str(args.output),
        ],
        stdin=subprocess.PIPE,
    )
    if process.stdin is None:
        raise RuntimeError("Could not open FFmpeg input")

    frame_count = round(FPS * DURATION_SECONDS)
    verification_frames = {
        0: "start.png",
        round(frame_count * 0.5): "middle.png",
        frame_count - 1: "end.png",
    }
    first_frame = None
    final_frame = None

    try:
        for frame_index in range(frame_count):
            normalized = frame_index / (frame_count - 1)
            door_progress = smoothstep((normalized - 0.12) / 0.73)
            door, angle = moving_door_layer(door_crop, door_progress)

            scene = background.copy()
            shadow = Image.new("RGBA", MASTER_SIZE, (0, 0, 0, 0))
            shadow_draw = ImageDraw.Draw(shadow)
            projected_width = door_crop.width * math.cos(angle)
            free_x = DOOR_BOX[2] - projected_width
            shadow_draw.polygon(
                [
                    (free_x, DOOR_BOX[1] + 14),
                    (DOOR_BOX[2], DOOR_BOX[1] + 9),
                    (DOOR_BOX[2], DOOR_BOX[3]),
                    (free_x, DOOR_BOX[3] - 8),
                ],
                fill=(32, 19, 9, round(42 * math.sin(angle))),
            )
            scene.alpha_composite(
                shadow.filter(ImageFilter.GaussianBlur(8))
            )
            scene.alpha_composite(door)
            composite_garden(
                scene,
                left_garden,
                right_garden,
                normalized,
            )
            frame = apply_camera(scene, normalized, frame_index)

            if (
                args.verification_dir
                and frame_index in verification_frames
            ):
                frame.save(
                    args.verification_dir
                    / verification_frames[frame_index]
                )
            process.stdin.write(frame.tobytes())
            if first_frame is None:
                first_frame = frame
            final_frame = frame
    finally:
        if process.stdin:
            process.stdin.close()

    if process.wait() != 0:
        raise RuntimeError("FFmpeg encoding failed")
    if first_frame is None or final_frame is None:
        raise RuntimeError("No frames rendered")

    first_frame.save(args.poster, quality=92, subsampling=0)


if __name__ == "__main__":
    main()
