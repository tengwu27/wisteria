import argparse
import math
import shutil
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter


MASTER_SIZE = (1672, 941)
OUTPUT_SIZE = (1920, 1080)
FPS = 30
DURATION_SECONDS = 4.0
FAR_BACKGROUND_SCALE = 0.70

# The complete painted door—including its exact glazing aperture—remains one
# rigid exterior-facing leaf. The outer handle is on its rear edge, so the hinge
# belongs on the front edge. In this side view the physical hinge barrels are
# nearly vertical at x=950; opening therefore foreshortens the door
# horizontally without pitching its top edge upward.
SOURCE_QUAD = np.asarray(
    [
        (601.0, 278.0),
        (849.0, 282.0),
        (950.0, 648.0),
        (558.0, 637.0),
    ],
    dtype=float,
)
HINGE_X = 950.0
FINAL_OPEN_ANGLE = 68.0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Render the multilayer parallax car-door transition."
    )
    parser.add_argument("closed", type=Path)
    parser.add_argument("interior", type=Path)
    parser.add_argument("near_background", type=Path)
    parser.add_argument("far_background", type=Path)
    parser.add_argument("near_scene_mask", type=Path)
    parser.add_argument("car_mask", type=Path)
    parser.add_argument("outer_mask", type=Path)
    parser.add_argument("glazing_mask", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("poster", type=Path)
    parser.add_argument("--night", action="store_true")
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


def upright_door_destination(angle: float) -> np.ndarray:
    # Orthographic side-view projection of rotation around a vertical front
    # hinge. Keeping y unchanged prevents the false upward pitch that results
    # from treating the slanted window frame as the hinge axis.
    destination = SOURCE_QUAD.copy()
    destination[:, 0] = (
        HINGE_X
        + (SOURCE_QUAD[:, 0] - HINGE_X) * math.cos(angle)
    )
    return destination


def homography(
    source: np.ndarray,
    destination: np.ndarray,
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


def transform_layer(
    layer: Image.Image,
    destination: np.ndarray,
) -> Image.Image:
    coefficients = homography(SOURCE_QUAD[:, :2], destination)
    return layer.transform(
        MASTER_SIZE,
        Image.Transform.PERSPECTIVE,
        coefficients,
        resample=Image.Resampling.BICUBIC,
        fillcolor=(0, 0, 0, 0),
    )


def translated_composite(
    canvas: Image.Image,
    layer: Image.Image,
    x: float,
    y: float = 0.0,
) -> None:
    canvas.alpha_composite(layer, (round(x), round(y)))


def edge_shifted_layer(
    layer: Image.Image,
    x_shift: float,
) -> Image.Image:
    # Translate registered plates without rescaling them. A narrow reflected
    # extension avoids stretched border streaks during the subtle pan.
    pad = 96
    array = np.asarray(layer)
    padded = np.pad(
        array,
        ((0, 0), (pad, pad), (0, 0)),
        mode="reflect",
    )
    start = pad - round(x_shift)
    shifted = padded[
        :,
        start : start + MASTER_SIZE[0],
        :,
    ]
    return Image.fromarray(shifted)


def scaled_far_background(layer: Image.Image) -> Image.Image:
    # Reduce the apparent size of the distant foliage by 30%. Mirror the
    # downscaled plate across its far edges so the master remains fully covered
    # without stretching pixels or introducing a hard tile seam.
    scaled_size = (
        round(MASTER_SIZE[0] * FAR_BACKGROUND_SCALE),
        round(MASTER_SIZE[1] * FAR_BACKGROUND_SCALE),
    )
    scaled = layer.resize(scaled_size, Image.Resampling.LANCZOS)
    top = Image.new(
        "RGBA",
        (scaled_size[0] * 2, scaled_size[1]),
        (0, 0, 0, 255),
    )
    top.alpha_composite(scaled, (0, 0))
    top.alpha_composite(
        scaled.transpose(Image.Transpose.FLIP_LEFT_RIGHT),
        (scaled_size[0], 0),
    )
    mosaic = Image.new(
        "RGBA",
        (top.width, top.height * 2),
        (0, 0, 0, 255),
    )
    mosaic.alpha_composite(top, (0, 0))
    mosaic.alpha_composite(
        top.transpose(Image.Transpose.FLIP_TOP_BOTTOM),
        (0, top.height),
    )
    return mosaic.crop((0, 0, MASTER_SIZE[0], MASTER_SIZE[1]))


def make_near_scene(
    near_background: Image.Image,
    near_scene_mask: Image.Image,
) -> Image.Image:
    near_scene = near_background.copy()
    near_scene.putalpha(near_scene_mask)
    return near_scene


def composite_door_surface(
    scene: Image.Image,
    texture: Image.Image,
    destination: np.ndarray,
    x_shift: float,
) -> None:
    transformed = transform_layer(texture, destination)
    translated_composite(scene, transformed, x_shift)


def add_night_headlight_spill(
    scene: Image.Image,
    car_x: float,
    intensity: float,
) -> None:
    spill = Image.new("RGBA", MASTER_SIZE, (0, 0, 0, 0))
    draw = ImageDraw.Draw(spill)
    x = round(car_x)
    draw.ellipse(
        (1280 + x, 595, 1725 + x, 850),
        fill=(255, 193, 88, round(48 * intensity)),
    )
    draw.ellipse(
        (1330 + x, 625, 1635 + x, 780),
        fill=(255, 222, 147, round(38 * intensity)),
    )
    scene.alpha_composite(spill.filter(ImageFilter.GaussianBlur(55)))


def add_car_contact_shadow(
    scene: Image.Image,
    car_x: float,
    night: bool,
) -> None:
    shadow = Image.new("RGBA", MASTER_SIZE, (0, 0, 0, 0))
    draw = ImageDraw.Draw(shadow)
    x = round(car_x)
    draw.ellipse(
        (245 + x, 580, 1495 + x, 770),
        fill=(18, 22, 17, 72 if night else 58),
    )
    draw.ellipse(
        (330 + x, 620, 1415 + x, 748),
        fill=(10, 14, 11, 58 if night else 44),
    )
    scene.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(24)))


def output_frame(scene: Image.Image) -> Image.Image:
    # The camera is locked. All perceived travel comes from horizontal layer
    # translation, so the car never grows, bobs, or changes its focal geometry.
    return scene.convert("RGB").resize(
        OUTPUT_SIZE,
        Image.Resampling.LANCZOS,
    )


def main() -> None:
    args = parse_args()
    closed = Image.open(args.closed).convert("RGBA")
    interior = Image.open(args.interior).convert("RGBA")
    near_background = Image.open(args.near_background).convert("RGBA")
    far_background = Image.open(args.far_background).convert("RGBA")
    near_scene_mask = Image.open(args.near_scene_mask).convert("L")
    car_mask = Image.open(args.car_mask).convert("L")
    outer_mask = Image.open(args.outer_mask).convert("L")
    glazing_mask = Image.open(args.glazing_mask).convert("L")

    for path, image in (
        (args.closed, closed),
        (args.interior, interior),
        (args.near_background, near_background),
        (args.far_background, far_background),
        (args.near_scene_mask, near_scene_mask),
        (args.car_mask, car_mask),
        (args.outer_mask, outer_mask),
        (args.glazing_mask, glazing_mask),
    ):
        if image.size != MASTER_SIZE:
            raise ValueError(
                f"{path} is {image.size}; expected {MASTER_SIZE}"
            )

    far_background = scaled_far_background(far_background)

    # The static car plate comes from the approved open-door artwork, so seats,
    # dashboard, pillars and the complete opening remain physically behind the
    # moving leaf. Its keyed matte keeps scenery visible through all windows.
    car_base = interior.copy()
    car_base.putalpha(car_mask)
    near_scene = make_near_scene(near_background, near_scene_mask)

    outer_texture = closed.copy()
    outer_texture.putalpha(outer_mask)

    glass_texture = Image.new(
        "RGBA",
        MASTER_SIZE,
        (42, 76, 84, 0),
    )
    glass_alpha = np.asarray(glazing_mask, dtype=np.float32) * 0.22
    glass_texture.putalpha(
        Image.fromarray(np.clip(glass_alpha, 0, 255).astype(np.uint8))
    )

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
            travel = smootherstep(normalized)
            far_x = lerp(-12.0, 12.0, travel)
            near_x = lerp(-38.0, 38.0, travel)

            # Car, road, fence, café and house travel as one foreground plate.
            # Only the dedicated tree/sky plate moves proportionally slower.
            scene = edge_shifted_layer(far_background, far_x)
            scene.alpha_composite(edge_shifted_layer(near_scene, near_x))

            if args.night:
                add_night_headlight_spill(scene, near_x, travel)

            add_car_contact_shadow(scene, near_x, args.night)
            translated_composite(scene, car_base, near_x)

            door_progress = smoothstep((normalized - 0.13) / 0.70)
            angle = math.radians(FINAL_OPEN_ANGLE * door_progress)
            outer_destination = upright_door_destination(angle)

            shadow = Image.new("RGBA", MASTER_SIZE, (0, 0, 0, 0))
            shadow_draw = ImageDraw.Draw(shadow)
            shadow_draw.polygon(
                [
                    (float(x + near_x + 12), float(y + 10))
                    for x, y in outer_destination
                ],
                fill=(
                    9,
                    18,
                    16,
                    round(44 * math.sin(min(abs(angle), math.pi / 2))),
                ),
            )
            scene.alpha_composite(
                shadow.filter(ImageFilter.GaussianBlur(14))
            )

            # The door stays below 90 degrees, so the viewer continues to see
            # its exterior painted face and rear-mounted handle throughout.
            shade = 1.0 - 0.22 * math.sin(abs(angle))
            shaded_outer = ImageEnhance.Brightness(
                outer_texture
            ).enhance(shade)
            composite_door_surface(
                scene,
                shaded_outer,
                outer_destination,
                near_x,
            )
            composite_door_surface(
                scene,
                glass_texture,
                outer_destination,
                near_x,
            )

            frame = output_frame(scene)
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
    print(
        f"Rendered {args.output} "
        f"({DURATION_SECONDS:.1f}s, {FPS}fps)"
    )


if __name__ == "__main__":
    main()
