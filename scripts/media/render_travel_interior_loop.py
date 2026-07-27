import argparse
import math
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


FPS = 30
DURATION_SECONDS = 8
MASTER_SIZE = (1672, 941)
OUTPUT_SIZE = (1920, 1080)
SEAT_END_Y = 12
CHARM_POSITION = (700, 228)
CHARM_SWING_DEGREES = 1.35


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Render the seamless final-pose travel interior loop."
    )
    parser.add_argument("asset_dir", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("poster", type=Path)
    parser.add_argument("--theme", choices=("day", "night"), default="day")
    parser.add_argument("--verification-dir", type=Path)
    return parser.parse_args()


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


def water_shimmer(phase: float, theme: str) -> Image.Image:
    layer = Image.new("RGBA", MASTER_SIZE, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    base_alpha = 29 if theme == "day" else 42
    color = (218, 246, 244) if theme == "day" else (155, 202, 255)

    for index in range(15):
        row_phase = 2.0 * math.pi * (
            phase * (2 + index % 3) + index * 0.173
        )
        x = 18 + (index % 5) * 82 + 8 * math.sin(row_phase)
        y = 292 + (index // 5) * 55 + 5 * math.sin(row_phase + 0.7)
        width = 28 + 12 * (0.5 + 0.5 * math.sin(row_phase + 1.1))
        alpha = round(
            base_alpha
            * (0.55 + 0.45 * math.sin(row_phase) ** 2)
        )
        draw.arc(
            (x, y, x + width, y + 9),
            8,
            172,
            fill=(*color, alpha),
            width=2,
        )

    return layer.filter(ImageFilter.GaussianBlur(0.55))


def dial_glow(phase: float, theme: str) -> Image.Image:
    layer = Image.new("RGBA", MASTER_SIZE, (0, 0, 0, 0))
    glow = Image.new("RGBA", MASTER_SIZE, (0, 0, 0, 0))
    draw = ImageDraw.Draw(glow)
    pulse = 0.5 + 0.5 * math.sin(2.0 * math.pi * 2.0 * phase)
    strength = (5 + 4 * pulse) if theme == "day" else (14 + 8 * pulse)
    draw.ellipse(
        (744, 477, 889, 625),
        fill=(255, 180, 75, round(strength)),
    )
    layer.alpha_composite(glow.filter(ImageFilter.GaussianBlur(24)))
    return layer


def render_frame(
    exterior: Image.Image,
    interior: Image.Image,
    seat: Image.Image,
    charm: Image.Image,
    phase: float,
    theme: str,
) -> Image.Image:
    phase %= 1.0
    frame = exterior.copy()
    frame.alpha_composite(water_shimmer(phase, theme))
    frame.alpha_composite(interior)
    frame.alpha_composite(dial_glow(phase, theme))
    charm_angle = CHARM_SWING_DEGREES * math.sin(
        4.0 * math.pi * phase
    )
    frame.alpha_composite(
        swing_charm(charm, charm_angle),
        CHARM_POSITION,
    )
    frame.alpha_composite(seat, (0, SEAT_END_Y))
    return frame.convert("RGB").resize(
        OUTPUT_SIZE,
        Image.Resampling.LANCZOS,
    )


def main() -> None:
    args = parse_args()
    exterior = load_layer(args.asset_dir / "01-exterior.png")
    interior = load_layer(args.asset_dir / "03-interior-cutout.png")
    seat = load_seat(args.asset_dir / "04-front-seat.png")
    charm = load_prop(args.asset_dir / "06-buddha-charm.png")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.poster.parent.mkdir(parents=True, exist_ok=True)
    if args.verification_dir:
        args.verification_dir.mkdir(parents=True, exist_ok=True)

    frame_count = FPS * DURATION_SECONDS
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
        frame_count // 8: "swing.png",
        frame_count // 4: "quarter.png",
        frame_count // 2: "middle.png",
        frame_count - 1: "end.png",
    }
    first_frame = None

    try:
        for frame_index in range(frame_count):
            phase = frame_index / frame_count
            frame = render_frame(
                exterior,
                interior,
                seat,
                charm,
                phase,
                args.theme,
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
    if args.verification_dir:
        render_frame(
            exterior,
            interior,
            seat,
            charm,
            1.0,
            args.theme,
        ).save(args.verification_dir / "closed-endpoint.png")


if __name__ == "__main__":
    main()
