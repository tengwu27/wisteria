import argparse
import math
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


FPS = 30
DURATION_SECONDS = 8
OUTPUT_SIZE = (1920, 1080)
MASTER_SIZE = (1672, 941)


def parse_args():
    parser = argparse.ArgumentParser(
        description="Render a seamless ambient café-gallery interior loop."
    )
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("poster", type=Path)
    parser.add_argument("--theme", choices=("day", "night"), default="day")
    parser.add_argument("--verification-dir", type=Path)
    return parser.parse_args()


def scale_point(point):
    return (
        point[0] * OUTPUT_SIZE[0] / MASTER_SIZE[0],
        point[1] * OUTPUT_SIZE[1] / MASTER_SIZE[1],
    )


def practical_light_layer(phase, theme):
    layer = Image.new("RGBA", OUTPUT_SIZE, (0, 0, 0, 0))
    glow = Image.new("RGBA", OUTPUT_SIZE, (0, 0, 0, 0))
    draw = ImageDraw.Draw(glow)

    # Integer-frequency waves meet exactly at the loop boundary.
    flicker = (
        0.78
        + 0.12 * math.sin(2 * math.pi * 2 * phase)
        + 0.07 * math.sin(2 * math.pi * 5 * phase + 0.4)
        + 0.03 * math.sin(2 * math.pi * 9 * phase + 1.1)
    )
    flicker = max(0.58, min(1.0, flicker))
    theme_strength = 1.0 if theme == "night" else 0.52

    lights = (
        ((878, 49), 48, 28),
        ((589, 263), 42, 25),
        ((1277, 273), 42, 24),
        ((1551, 172), 58, 28),
        ((1499, 259), 32, 18),
    )
    for center, radius, strength in lights:
        x, y = scale_point(center)
        scaled_radius = radius * OUTPUT_SIZE[0] / MASTER_SIZE[0]
        alpha = round(strength * theme_strength * flicker)
        draw.ellipse(
            (
                x - scaled_radius,
                y - scaled_radius,
                x + scaled_radius,
                y + scaled_radius,
            ),
            fill=(255, 177, 72, alpha),
        )

    layer.alpha_composite(glow.filter(ImageFilter.GaussianBlur(26)))
    return layer


def steam_layer(phase, theme):
    layer = Image.new("RGBA", OUTPUT_SIZE, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    sources = (
        ((1085, 819), 1.0),
        ((190, 823), 0.65),
    )
    for source_index, (source, strength) in enumerate(sources):
        source_x, source_y = scale_point(source)
        for index in range(9):
            age = (
                phase * 2
                + index / 9
                + source_index * 0.17
            ) % 1.0
            x = (
                source_x
                - 10 * age
                + 4
                * math.sin(
                    2
                    * math.pi
                    * (age + phase * 2 + index * 0.13)
                )
            )
            y = source_y - 66 * age
            radius_x = 2.0 + 7.0 * age
            radius_y = 4.0 + 11.0 * age
            max_alpha = 82 if theme == "night" else 64
            alpha = round(
                max_alpha
                * strength
                * (math.sin(math.pi * age) ** 1.5)
            )
            draw.ellipse(
                (
                    x - radius_x,
                    y - radius_y,
                    x + radius_x,
                    y + radius_y,
                ),
                fill=(246, 240, 224, alpha),
            )
    return layer.filter(ImageFilter.GaussianBlur(3.1))


def render_frame(base, phase, theme):
    frame = base.copy()
    frame.alpha_composite(practical_light_layer(phase, theme))
    frame.alpha_composite(steam_layer(phase, theme))
    return frame.convert("RGB")


def main():
    args = parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.poster.parent.mkdir(parents=True, exist_ok=True)
    if args.verification_dir:
        args.verification_dir.mkdir(parents=True, exist_ok=True)

    source = Image.open(args.input).convert("RGBA")
    if source.size != MASTER_SIZE:
        raise ValueError(
            f"Interior master is {source.size}; expected {MASTER_SIZE}"
        )
    base = source.resize(OUTPUT_SIZE, Image.Resampling.LANCZOS)
    frame_count = FPS * DURATION_SECONDS

    ffmpeg = subprocess.Popen(
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

    verification_frames = {
        0: "start.png",
        frame_count // 4: "quarter.png",
        frame_count // 2: "middle.png",
        frame_count - 1: "end.png",
    }
    first_frame = None
    try:
        for frame_index in range(frame_count):
            phase = frame_index / frame_count
            frame = render_frame(base, phase, args.theme)
            if first_frame is None:
                first_frame = frame
            if args.verification_dir and frame_index in verification_frames:
                frame.save(
                    args.verification_dir
                    / verification_frames[frame_index]
                )
            ffmpeg.stdin.write(frame.tobytes())
    finally:
        if ffmpeg.stdin:
            ffmpeg.stdin.close()

    return_code = ffmpeg.wait()
    if return_code:
        raise RuntimeError(f"ffmpeg exited with status {return_code}")
    if first_frame is None:
        raise RuntimeError("No frames rendered")
    first_frame.save(args.poster, quality=92, subsampling=0)


if __name__ == "__main__":
    main()
