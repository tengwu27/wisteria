import argparse
import math
import subprocess

from PIL import Image, ImageDraw, ImageFilter


REFERENCE_WIDTH = 2048
REFERENCE_HEIGHT = 1152
OUTPUT_WIDTH = 1920
OUTPUT_HEIGHT = 1080
FPS = 30
DURATION_SECONDS = 5
FRAME_COUNT = FPS * DURATION_SECONDS


def parse_args():
    parser = argparse.ArgumentParser(
        description=(
            "Render the daytime village ambient loop with only the airplane, "
            "car, and sailboat moving."
        )
    )
    parser.add_argument("source", help="Registered 16:9 village master")
    parser.add_argument("output", help="Destination H.264 MP4")
    parser.add_argument(
        "--poster",
        help="Optional matching 1920x1080 JPEG poster",
    )
    return parser.parse_args()


def polygon_layer(source, points, feather=2):
    mask = Image.new("L", source.size, 0)
    ImageDraw.Draw(mask).polygon(points, fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(feather))
    layer = source.copy()
    layer.putalpha(mask)
    return layer


def place_rotated(base, layer, angle, center, shift=(0, 0)):
    moved = layer.rotate(
        angle,
        resample=Image.Resampling.BICUBIC,
        center=center,
        translate=shift,
    )
    base.alpha_composite(moved)


def main():
    args = parse_args()
    source = Image.open(args.source).convert("RGBA")
    if source.width * 9 != source.height * 16:
        raise SystemExit(
            "Expected a 16:9 village master, got "
            f"{source.width}x{source.height}"
        )

    scale_x = source.width / REFERENCE_WIDTH
    scale_y = source.height / REFERENCE_HEIGHT

    def scaled_points(points):
        return [
            (round(x * scale_x), round(y * scale_y))
            for x, y in points
        ]

    def scaled_center(center):
        return (
            round(center[0] * scale_x),
            round(center[1] * scale_y),
        )

    car = polygon_layer(
        source,
        scaled_points([
            (748, 745),
            (764, 706),
            (809, 669),
            (913, 659),
            (976, 688),
            (997, 729),
            (985, 775),
            (940, 801),
            (823, 810),
            (774, 790),
        ]),
        2.2 * scale_x,
    )
    sailboat = polygon_layer(
        source,
        scaled_points([
            (1730, 888),
            (1770, 856),
            (1818, 839),
            (1835, 572),
            (1872, 520),
            (1902, 573),
            (1934, 694),
            (1969, 844),
            (2048, 862),
            (2048, 1055),
            (1910, 1040),
            (1806, 992),
        ]),
        2.0 * scale_x,
    )
    airplane = polygon_layer(
        source,
        scaled_points([
            (230, 168),
            (259, 151),
            (264, 112),
            (283, 110),
            (320, 145),
            (401, 146),
            (449, 158),
            (439, 176),
            (399, 183),
            (386, 220),
            (364, 238),
            (344, 236),
            (342, 194),
            (290, 190),
            (270, 218),
            (243, 232),
            (234, 222),
            (253, 185),
        ]),
        1.8 * scale_x,
    )

    if args.poster:
        poster = source.convert("RGB").resize(
            (OUTPUT_WIDTH, OUTPUT_HEIGHT),
            Image.Resampling.LANCZOS,
        )
        poster.save(args.poster, quality=88, optimize=True, progressive=True)

    command = [
        "/opt/homebrew/bin/ffmpeg",
        "-y",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "rgb24",
        "-s",
        f"{OUTPUT_WIDTH}x{OUTPUT_HEIGHT}",
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
        "22",
        "-g",
        str(FRAME_COUNT),
        "-keyint_min",
        str(FRAME_COUNT),
        "-sc_threshold",
        "0",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        args.output,
    ]
    process = subprocess.Popen(command, stdin=subprocess.PIPE)

    for frame in range(FRAME_COUNT):
        phase = 2 * math.pi * frame / FRAME_COUNT
        canvas = source.copy()

        # The parked car has a restrained, periodic engine-idle vibration.
        car_y = (
            0.30 * math.sin(20 * phase)
            + 0.10 * math.sin(35 * phase + 0.7)
        )
        place_rotated(
            canvas,
            car,
            0.018 * math.sin(20 * phase),
            scaled_center((875, 744)),
            (0, car_y * scale_y),
        )

        # The airplane remains parked; only a very soft engine vibration moves it.
        airplane_y = (
            0.24 * math.sin(12 * phase + 0.3)
            + 0.08 * math.sin(20 * phase)
        )
        place_rotated(
            canvas,
            airplane,
            0.014 * math.sin(12 * phase),
            scaled_center((335, 174)),
            (0, airplane_y * scale_y),
        )

        # One complete rock-and-bob cycle closes exactly at the loop boundary.
        place_rotated(
            canvas,
            sailboat,
            0.18 * math.sin(phase),
            scaled_center((1885, 900)),
            (0, 0.45 * scale_y * math.sin(phase + 0.8)),
        )

        frame_image = canvas.convert("RGB").resize(
            (OUTPUT_WIDTH, OUTPUT_HEIGHT),
            Image.Resampling.LANCZOS,
        )
        process.stdin.write(frame_image.tobytes())

    process.stdin.close()
    if process.wait() != 0:
        raise SystemExit("ffmpeg encoding failed")


if __name__ == "__main__":
    main()
