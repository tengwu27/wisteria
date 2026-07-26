import argparse
import subprocess
from pathlib import Path

from PIL import Image


FPS = 30
DURATION_SECONDS = 5.0
MOVE_SECONDS = 4.45
OUTPUT_SIZE = (1920, 1080)

# Distances are authored in the 1672×941 master coordinate system.
# Every moving plate travels left with a common progress curve; the distance
# increases toward the camera to preserve a coherent parallax camera move.
CAFE_START_X = 58
CAFE_END_X = 0
MIDDLE_START_X = 132
MIDDLE_END_X = 0
FOREGROUND_START_X = 0
FOREGROUND_END_X = -690


def parse_args():
    parser = argparse.ArgumentParser(
        description="Render the one-way café garden parallax reveal."
    )
    parser.add_argument("asset_dir", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("poster", type=Path)
    parser.add_argument("--verification-dir", type=Path)
    return parser.parse_args()


def smootherstep(value):
    value = max(0.0, min(1.0, value))
    return value * value * value * (value * (value * 6 - 15) + 10)


def lerp(start, end, amount):
    return start + (end - start) * amount


def composite_with_offset(canvas, layer, x):
    canvas.alpha_composite(layer, (round(x), 0))


def load_registered_layers(asset_dir):
    paths = {
        "sky": asset_dir / "01-sky.png",
        "cafe": asset_dir / "02-cafe-landscape.png",
        "middle": asset_dir / "03-middle-garden.png",
        "foreground": asset_dir / "04-foreground-garden.png",
    }
    layers = {
        name: Image.open(path).convert("RGBA")
        for name, path in paths.items()
    }
    master_size = layers["cafe"].size
    for name, image in layers.items():
        if image.size != master_size:
            raise ValueError(
                f"{name} plate is {image.size}; expected {master_size}"
            )

    return {
        name: image.resize(OUTPUT_SIZE, Image.Resampling.LANCZOS)
        for name, image in layers.items()
    }, master_size


def render_frame(layers, master_size, progress):
    width_scale = OUTPUT_SIZE[0] / master_size[0]
    canvas = layers["sky"].copy()
    composite_with_offset(
        canvas,
        layers["cafe"],
        lerp(CAFE_START_X, CAFE_END_X, progress) * width_scale,
    )
    composite_with_offset(
        canvas,
        layers["middle"],
        lerp(MIDDLE_START_X, MIDDLE_END_X, progress) * width_scale,
    )
    composite_with_offset(
        canvas,
        layers["foreground"],
        lerp(FOREGROUND_START_X, FOREGROUND_END_X, progress) * width_scale,
    )
    return canvas.convert("RGB")


def main():
    args = parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.poster.parent.mkdir(parents=True, exist_ok=True)
    if args.verification_dir:
        args.verification_dir.mkdir(parents=True, exist_ok=True)

    layers, master_size = load_registered_layers(args.asset_dir)
    frame_count = round(FPS * DURATION_SECONDS)
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
        round((MOVE_SECONDS * FPS) / 2): "middle.png",
        frame_count - 1: "end.png",
    }
    final_frame = None

    try:
        for frame_index in range(frame_count):
            seconds = frame_index / FPS
            linear_progress = min(1.0, seconds / MOVE_SECONDS)
            progress = smootherstep(linear_progress)
            frame = render_frame(layers, master_size, progress)
            if args.verification_dir and frame_index in verification_frames:
                frame.save(
                    args.verification_dir
                    / verification_frames[frame_index]
                )
            ffmpeg.stdin.write(frame.tobytes())
            final_frame = frame
    finally:
        if ffmpeg.stdin:
            ffmpeg.stdin.close()

    return_code = ffmpeg.wait()
    if return_code:
        raise RuntimeError(f"ffmpeg exited with status {return_code}")
    if final_frame is None:
        raise RuntimeError("No frames rendered")

    final_frame.save(args.poster, quality=92, subsampling=0)


if __name__ == "__main__":
    main()
