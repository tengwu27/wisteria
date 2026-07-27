import argparse
import math
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


FPS = 30
DURATION_SECONDS = 3.6
MOVE_SECONDS = 3.0
MASTER_SIZE = (1672, 941)
OUTPUT_SIZE = (1920, 1080)

EXTERIOR_START_Y = -33.0
EXTERIOR_END_Y = 0.0
INTERIOR_START_Y = -94.0
INTERIOR_END_Y = 0.0
SEAT_START_Y = -490.0
SEAT_END_Y = 12.0
CHARM_POSITION = (700, 228)
CHARM_SWING_DEGREES = 1.35


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Render the one-time rising back-seat travel reveal."
    )
    parser.add_argument("asset_dir", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("poster", type=Path)
    parser.add_argument("--verification-dir", type=Path)
    return parser.parse_args()


def smootherstep(value: float) -> float:
    value = max(0.0, min(1.0, value))
    return value * value * value * (
        value * (value * 6.0 - 15.0) + 10.0
    )


def lerp(start: float, end: float, amount: float) -> float:
    return start + (end - start) * amount


def load_layer(path: Path) -> Image.Image:
    image = Image.open(path).convert("RGBA")
    if image.size != MASTER_SIZE:
        raise ValueError(f"{path} is {image.size}; expected {MASTER_SIZE}")
    return image


def load_seat(path: Path) -> Image.Image:
    image = Image.open(path).convert("RGBA")
    if (
        image.width != MASTER_SIZE[0]
        or image.height < MASTER_SIZE[1]
    ):
        raise ValueError(
            f"{path} is {image.size}; expected width {MASTER_SIZE[0]} "
            f"and height >= {MASTER_SIZE[1]}"
        )
    return image


def load_prop(path: Path) -> Image.Image:
    return Image.open(path).convert("RGBA")


def reflected_vertical_shift(
    layer: Image.Image,
    y_shift: float,
) -> Image.Image:
    # The shot moves only vertically. Reflected overscan keeps the clean
    # exterior and opaque lower cabin covered without stretching edge pixels.
    pad = 384
    array = np.asarray(layer)
    padded = np.pad(
        array,
        ((pad, pad), (0, 0), (0, 0)),
        mode="reflect",
    )
    start = pad - round(y_shift)
    shifted = padded[start : start + MASTER_SIZE[1], :, :]
    return Image.fromarray(shifted)


def swing_charm(
    charm: Image.Image,
    angle_degrees: float,
) -> Image.Image:
    padded = Image.new(
        "RGBA",
        (charm.width + 60, charm.height + 30),
        (0, 0, 0, 0),
    )
    padded.alpha_composite(charm, (30, 0))
    return padded.rotate(
        angle_degrees,
        resample=Image.Resampling.BICUBIC,
        center=(padded.width / 2, 0),
    )


def render_frame(
    exterior: Image.Image,
    blurred_exterior: Image.Image,
    interior: Image.Image,
    seat: Image.Image,
    charm: Image.Image,
    progress: float,
    timeline_phase: float,
) -> Image.Image:
    exterior_y = lerp(EXTERIOR_START_Y, EXTERIOR_END_Y, progress)
    interior_y = lerp(INTERIOR_START_Y, INTERIOR_END_Y, progress)
    seat_y = lerp(SEAT_START_Y, SEAT_END_Y, progress)

    # Start with the far scenery softly out of focus, then resolve it before
    # the exact ambient handoff. Near cabin structure remains crisp throughout.
    focused_exterior = Image.blend(
        blurred_exterior,
        exterior,
        progress,
    )
    frame = reflected_vertical_shift(focused_exterior, exterior_y)
    frame.alpha_composite(
        reflected_vertical_shift(interior, interior_y)
    )
    charm_angle = CHARM_SWING_DEGREES * math.sin(
        2.0 * math.pi * timeline_phase
    )
    swinging_charm = swing_charm(charm, charm_angle)
    frame.alpha_composite(
        swinging_charm,
        (
            CHARM_POSITION[0],
            round(CHARM_POSITION[1] + interior_y),
        ),
    )
    frame.alpha_composite(seat, (0, round(seat_y)))
    return frame.convert("RGB").resize(
        OUTPUT_SIZE,
        Image.Resampling.LANCZOS,
    )


def main() -> None:
    args = parse_args()
    exterior = load_layer(args.asset_dir / "01-exterior.png")
    blurred_exterior = exterior.filter(ImageFilter.GaussianBlur(2.6))
    interior = load_layer(args.asset_dir / "03-interior-cutout.png")
    seat = load_seat(args.asset_dir / "04-front-seat.png")
    charm = load_prop(args.asset_dir / "06-buddha-charm.png")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.poster.parent.mkdir(parents=True, exist_ok=True)
    if args.verification_dir:
        args.verification_dir.mkdir(parents=True, exist_ok=True)

    frame_count = round(FPS * DURATION_SECONDS)
    process = subprocess.Popen(
        [
            "ffmpeg",
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
            "18",
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

    verification_frames = {
        0: "start.png",
        round(MOVE_SECONDS * FPS / 2): "middle.png",
        frame_count - 1: "end.png",
    }
    first_frame = None

    try:
        for frame_index in range(frame_count):
            seconds = frame_index / FPS
            progress = smootherstep(min(1.0, seconds / MOVE_SECONDS))
            timeline_phase = frame_index / max(1, frame_count - 1)
            frame = render_frame(
                exterior,
                blurred_exterior,
                interior,
                seat,
                charm,
                progress,
                timeline_phase,
            )
            if first_frame is None:
                first_frame = frame
            if (
                args.verification_dir
                and frame_index in verification_frames
            ):
                frame.save(
                    args.verification_dir
                    / verification_frames[frame_index]
                )
            process.stdin.write(frame.tobytes())
    finally:
        if process.stdin:
            process.stdin.close()

    if process.wait() != 0:
        raise RuntimeError("FFmpeg encoding failed")
    if first_frame is None:
        raise RuntimeError("No frames rendered")
    first_frame.save(args.poster, quality=92, subsampling=0)


if __name__ == "__main__":
    main()
