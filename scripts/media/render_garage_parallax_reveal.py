from __future__ import annotations

import argparse
import math
import subprocess
from pathlib import Path

from PIL import Image


FPS = 60
DURATION_SECONDS = 3.4
MASTER_SIZE = (1672, 941)
OUTPUT_SIZE = (1920, 1080)
EDGE_COVERAGE_SAFETY = 16


def gentle_ease(value: float) -> float:
    """Ease without compressing too much travel into the middle of the shot."""
    value = max(0.0, min(1.0, value))
    return 0.5 - 0.5 * math.cos(math.pi * value)


def lerp(start: float, end: float, amount: float) -> float:
    return start + (end - start) * amount


def load_layer(path: Path) -> Image.Image:
    image = Image.open(path).convert("RGBA")
    if image.size != MASTER_SIZE:
        raise ValueError(
            f"{path} is {image.size}; expected {MASTER_SIZE}"
        )
    return image


def transformed(
    image: Image.Image,
    scale: float,
    x: float,
    y: float = 0,
) -> Image.Image:
    center_x = MASTER_SIZE[0] / 2
    center_y = MASTER_SIZE[1] / 2
    inverse_scale = 1 / scale
    return image.transform(
        MASTER_SIZE,
        Image.Transform.AFFINE,
        (
            inverse_scale,
            0,
            center_x * (1 - inverse_scale) - x * inverse_scale,
            0,
            inverse_scale,
            center_y * (1 - inverse_scale) - y * inverse_scale,
        ),
        Image.Resampling.BICUBIC,
        fillcolor=(0, 0, 0, 0),
    )


def with_opacity(image: Image.Image, opacity: float) -> Image.Image:
    result = image.copy()
    alpha = result.getchannel("A").point(
        lambda value: round(value * max(0.0, min(1.0, opacity)))
    )
    result.putalpha(alpha)
    return result


def keep_outer_edge_outside(
    scale: float,
    desired_x: float,
    side: str,
) -> float:
    """Clamp a full-canvas occluder so its outer plate edge stays offscreen."""
    half_overscan = MASTER_SIZE[0] * (scale - 1) / 2
    if half_overscan < EDGE_COVERAGE_SAFETY:
        raise ValueError(
            "Foreground scale does not provide enough horizontal overscan"
        )
    if side == "left":
        return min(
            desired_x,
            half_overscan - EDGE_COVERAGE_SAFETY,
        )
    if side == "right":
        return max(
            desired_x,
            -half_overscan + EDGE_COVERAGE_SAFETY,
        )
    raise ValueError(f"Unknown edge side: {side}")


def render_frame(
    background: Image.Image,
    lamp: Image.Image,
    left_bush: Image.Image,
    right_bush: Image.Image,
    progress: float,
) -> Image.Image:
    background_scale = lerp(1.0, 1.045, progress)
    frame = transformed(background, background_scale, 0)

    # At the start, the restrained foreground gathers toward the camera's
    # center. It then parts beyond the frame without ever shearing the garage.
    foreground_scale = lerp(1.085, 1.035, progress)
    lamp_x = lerp(118, -78, progress)
    left_x = keep_outer_edge_outside(
        foreground_scale,
        lerp(112, -285, progress),
        "left",
    )
    right_x = keep_outer_edge_outside(
        foreground_scale,
        lerp(-105, 285, progress),
        "right",
    )

    frame.alpha_composite(
        with_opacity(
            transformed(left_bush, foreground_scale, left_x, 8),
            1 - progress,
        )
    )
    frame.alpha_composite(
        with_opacity(
            transformed(right_bush, foreground_scale, right_x, 8),
            1 - progress,
        )
    )
    frame.alpha_composite(
        transformed(lamp, 1.055, lamp_x, 4)
    )

    # Subtle arrival vignette: the first frame is gently shaded and resolves
    # fully before handoff. It is not used as structural motion.
    shade_alpha = round(24 * (1 - progress))
    if shade_alpha:
        shade = Image.new(
            "RGBA",
            MASTER_SIZE,
            (4, 18, 22, shade_alpha),
        )
        frame.alpha_composite(shade)

    return frame.convert("RGB").resize(
        OUTPUT_SIZE,
        Image.Resampling.LANCZOS,
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("asset_dir", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("poster", type=Path)
    parser.add_argument("--reverse", action="store_true")
    parser.add_argument("--verification-dir", type=Path)
    args = parser.parse_args()

    background = load_layer(args.asset_dir / "01-garage-background.png")
    lamp = load_layer(args.asset_dir / "02-street-lamp.png")
    left_bush = load_layer(args.asset_dir / "03-left-bush.png")
    right_bush = load_layer(args.asset_dir / "04-right-bush.png")

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

    first_frame: Image.Image | None = None
    verification_frames = {
        0: "start.png",
        frame_count // 2: "middle.png",
        frame_count - 1: "end.png",
    }
    try:
        for frame_index in range(frame_count):
            linear = frame_index / max(1, frame_count - 1)
            if args.reverse:
                linear = 1 - linear
            progress = gentle_ease(linear)
            frame = render_frame(
                background,
                lamp,
                left_bush,
                right_bush,
                progress,
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
        process.stdin.close()

    if process.wait() != 0:
        raise RuntimeError("FFmpeg encoding failed")
    if first_frame is None:
        raise RuntimeError("No frames rendered")
    first_frame.save(args.poster, quality=92, subsampling=0)


if __name__ == "__main__":
    main()
