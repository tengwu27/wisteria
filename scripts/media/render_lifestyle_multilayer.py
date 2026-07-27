import argparse
import math
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


FPS = 30
DURATION = 8
FRAMES = FPS * DURATION
OUTPUT_SIZE = (1920, 1080)
SKY_SCALE = 0.55
SKY_REGISTRATION_X = 550
SKY_REGISTRATION_Y = -140
HARBOR_OFFSET_X = 380
HARBOR_SCALE = 0.76
BOAT_SCALE = 0.30
BOAT_TARGET_CENTER = (1000, 225)
BOAT_ROCK_DEGREES = 0.9
BOAT_BOB_PX = 0.55
BOAT_ROCK_CYCLES = 2
MOON_REFLECTION_CENTER_X = 968


def parse_args():
    parser = argparse.ArgumentParser(
        description="Render the lifestyle room from independently animated window layers."
    )
    parser.add_argument("asset_dir", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("poster", type=Path)
    parser.add_argument("--verification-dir", type=Path)
    parser.add_argument("--theme", choices=("day", "night"), default="day")
    parser.add_argument("--night-layer-dir", type=Path)
    return parser.parse_args()


def threshold_bbox(image, threshold=128):
    alpha = image.getchannel("A")
    return alpha.point(lambda value: 255 if value > threshold else 0).getbbox()


def scale_boat_on_canvas(boat, canvas_size):
    bbox = threshold_bbox(boat)
    if bbox is None:
        raise ValueError("Sailboat layer has no opaque pixels")

    padding = 8
    crop_box = (
        max(0, bbox[0] - padding),
        max(0, bbox[1] - padding),
        min(boat.width, bbox[2] + padding),
        min(boat.height, bbox[3] + padding),
    )
    sprite = boat.crop(crop_box)
    sprite = sprite.resize(
        (round(sprite.width * BOAT_SCALE), round(sprite.height * BOAT_SCALE)),
        Image.Resampling.LANCZOS,
    )

    position = (
        round(BOAT_TARGET_CENTER[0] - sprite.width / 2),
        round(BOAT_TARGET_CENTER[1] - sprite.height / 2),
    )
    layer = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
    layer.alpha_composite(sprite, position)
    return layer, position, sprite.size


def rock_boat_layer(layer, position, size, phase):
    cycle = 2 * math.pi * BOAT_ROCK_CYCLES * phase
    angle = BOAT_ROCK_DEGREES * math.sin(cycle)
    bob_y = BOAT_BOB_PX * math.cos(cycle)
    pivot = (
        position[0] + size[0] / 2,
        position[1] + size[1] * 0.9,
    )
    return layer.rotate(
        angle,
        resample=Image.Resampling.BICUBIC,
        center=pivot,
        translate=(0, bob_y),
        fillcolor=(0, 0, 0, 0),
    )


def steam_layer(canvas_size, phase, theme):
    width, height = canvas_size
    layer = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)

    # The approved foreground fixes the mug rim near (1024, 603).
    for index in range(7):
        age = (phase * 3.0 + index / 7.0) % 1.0
        x = (
            1023
            - 10 * age
            + 3.0
            * math.sin(
                2 * math.pi * (age + phase * 2.0 + index * 0.11)
            )
        )
        y = 594 - 62 * age
        radius_x = 2.5 + 7.0 * age
        radius_y = 5.0 + 10.0 * age
        max_alpha = 88 if theme == "night" else 78
        alpha = int(max_alpha * (math.sin(math.pi * age) ** 1.45))
        draw.ellipse(
            (x - radius_x, y - radius_y, x + radius_x, y + radius_y),
            fill=(246, 238, 213, alpha),
        )

    return layer.filter(ImageFilter.GaussianBlur(3.2))


def moon_reflection_layer(canvas_size, phase, theme):
    layer = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
    if theme != "night":
        return layer

    draw = ImageDraw.Draw(layer)
    shimmer_phase = 2 * math.pi * phase
    for index in range(34):
        amount = index / 33
        y = 176 + amount * 166
        primary = math.sin(shimmer_phase * 4 + index * 1.53)
        secondary = math.sin(shimmer_phase * 7 - index * 0.79)
        center_x = (
            MOON_REFLECTION_CENTER_X
            + 3.0 * primary
            + 1.7 * secondary
        )
        envelope = math.sin(math.pi * amount) ** 0.75
        width = (5 + 48 * amount) * (0.64 + 0.36 * abs(primary))
        alpha = round((12 + 58 * envelope) * (0.74 + 0.26 * secondary))
        draw.rounded_rectangle(
            (
                center_x - width / 2,
                y - 0.55,
                center_x + width / 2,
                y + 0.55,
            ),
            radius=1,
            fill=(190, 221, 255, max(5, alpha)),
        )
    return layer.filter(ImageFilter.GaussianBlur(0.55))


def practical_light_layer(canvas_size, phase, theme):
    layer = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
    if theme != "night":
        return layer

    flicker = (
        0.72
        + 0.17 * math.sin(2 * math.pi * 3.0 * phase)
        + 0.11 * math.sin(2 * math.pi * 7.0 * phase)
    )
    flicker = max(0.42, min(1.0, flicker))
    draw = ImageDraw.Draw(layer)
    for center, radius, strength in (
        ((340, 151), 92, 34),
        ((1374, 126), 138, 18),
        ((684, 652), 38, 15),
    ):
        alpha = round(strength * flicker)
        draw.ellipse(
            (
                center[0] - radius,
                center[1] - radius,
                center[0] + radius,
                center[1] + radius,
            ),
            fill=(255, 174, 70, alpha),
        )

    return layer.filter(ImageFilter.GaussianBlur(38))


def lighthouse_light_layer(canvas_size, phase, theme):
    layer = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
    if theme != "night":
        return layer

    pulse = (
        0.86
        + 0.08 * math.sin(2 * math.pi * 2.0 * phase)
        + 0.06 * math.sin(2 * math.pi * 5.0 * phase)
    )
    pulse = max(0.72, min(1.0, pulse))
    glow = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(glow)
    draw.ellipse(
        (669, 69, 723, 125),
        fill=(255, 188, 88, round(48 * pulse)),
    )
    layer.alpha_composite(glow.filter(ImageFilter.GaussianBlur(16)))
    core = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
    core_draw = ImageDraw.Draw(core)
    core_draw.ellipse(
        (692, 91, 708, 107),
        fill=(255, 210, 126, round(82 * pulse)),
    )
    layer.alpha_composite(core.filter(ImageFilter.GaussianBlur(3.4)))
    return layer


def main():
    args = parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.poster.parent.mkdir(parents=True, exist_ok=True)
    if args.verification_dir:
        args.verification_dir.mkdir(parents=True, exist_ok=True)

    sky = Image.open(args.asset_dir / "01-sky-clouds.png").convert("RGBA")
    harbor = Image.open(args.asset_dir / "02-harbor-bay.png").convert("RGBA")
    boat_source = Image.open(args.asset_dir / "03-sailboat.png").convert("RGBA")
    foreground = Image.open(args.asset_dir / "04-foreground-interior.png").convert("RGBA")
    width, height = foreground.size

    for name, layer in (("sky", sky), ("harbor", harbor), ("boat", boat_source)):
        if layer.size != foreground.size:
            raise ValueError(
                f"{name} plate is {layer.size}; expected foreground size {foreground.size}"
            )

    boat, boat_position, boat_size = scale_boat_on_canvas(
        boat_source, foreground.size
    )
    night_layered = args.theme == "night"

    if night_layered:
        if not args.night_layer_dir:
            raise ValueError("--night-layer-dir is required for the night theme")
        layer_paths = {
            "sky": args.night_layer_dir / "01-sky-moon.png",
            "clouds": args.night_layer_dir / "02-clouds.png",
            "harbor": args.night_layer_dir
            / "03-harbor-water-lighthouse.png",
            "boat": args.night_layer_dir / "04-sailboat.png",
            "foreground": args.night_layer_dir
            / "05-foreground-interior.png",
        }
        loaded = {
            name: Image.open(path).convert("RGBA")
            for name, path in layer_paths.items()
        }
        for name, image in loaded.items():
            if image.size != foreground.size:
                raise ValueError(
                    f"Night {name} layer is {image.size}; "
                    f"expected {foreground.size}"
                )
        sky = loaded["sky"]
        clouds = loaded["clouds"]
        harbor = loaded["harbor"]
        boat_source = loaded["boat"]
        foreground = loaded["foreground"]
        boat, boat_position, boat_size = scale_boat_on_canvas(
            boat_source,
            foreground.size,
        )

    sky_canvas = Image.new("RGBA", foreground.size, (0, 0, 0, 0))
    clouds_canvas = Image.new("RGBA", foreground.size, (0, 0, 0, 0))
    if night_layered:
        sky_canvas.alpha_composite(sky)
        clouds_canvas.alpha_composite(clouds)
    else:
        sky = sky.resize(
            (round(width * SKY_SCALE), round(height * SKY_SCALE)),
            Image.Resampling.LANCZOS,
        )
        sky_base = (SKY_REGISTRATION_X, SKY_REGISTRATION_Y)
        sky_canvas.alpha_composite(sky, sky_base)
    harbor = harbor.resize(
        (round(width * HARBOR_SCALE), round(height * HARBOR_SCALE)),
        Image.Resampling.LANCZOS,
    )
    ffmpeg = "/opt/homebrew/bin/ffmpeg"
    encoder = subprocess.Popen(
        [
            ffmpeg,
            "-y",
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

    verification_indices = {
        0,
        FRAMES // 8,
        FRAMES // 4,
        3 * FRAMES // 8,
        FRAMES // 2,
        5 * FRAMES // 8,
        3 * FRAMES // 4,
        7 * FRAMES // 8,
        FRAMES - 1,
    }
    poster_frame = None
    motion_samples = []

    for frame_index in range(FRAMES):
        progress = frame_index / (FRAMES - 1)
        seconds = progress * DURATION
        boat_cycle = 2 * math.pi * BOAT_ROCK_CYCLES * progress
        boat_angle = BOAT_ROCK_DEGREES * math.sin(boat_cycle)
        boat_bob = BOAT_BOB_PX * math.cos(boat_cycle)

        canvas = Image.new("RGBA", foreground.size, (0, 0, 0, 255))
        canvas.alpha_composite(sky_canvas)
        if night_layered:
            canvas.alpha_composite(clouds_canvas)
        canvas.alpha_composite(harbor, (HARBOR_OFFSET_X, 0))
        if night_layered:
            canvas.alpha_composite(
                moon_reflection_layer(
                    foreground.size,
                    progress,
                    args.theme,
                )
            )
            canvas.alpha_composite(
                lighthouse_light_layer(
                    foreground.size,
                    progress,
                    args.theme,
                )
            )
        canvas.alpha_composite(
            rock_boat_layer(boat, boat_position, boat_size, progress)
        )
        canvas.alpha_composite(foreground)
        canvas.alpha_composite(
            practical_light_layer(foreground.size, progress, args.theme)
        )
        canvas.alpha_composite(
            steam_layer(foreground.size, progress, args.theme)
        )

        if frame_index == 0:
            poster_frame = canvas.convert("RGB")
        if frame_index in verification_indices and args.verification_dir:
            canvas.convert("RGB").save(
                args.verification_dir / f"frame-{frame_index:03d}.png"
            )
            motion_samples.append(
                {
                    "frame": frame_index,
                    "seconds": seconds,
                    "boat_angle_degrees": round(boat_angle, 4),
                    "boat_bob_px": round(boat_bob, 4),
                }
            )

        delivery = canvas.convert("RGB").resize(
            OUTPUT_SIZE, Image.Resampling.LANCZOS
        )
        encoder.stdin.write(delivery.tobytes())

    encoder.stdin.close()
    if encoder.wait() != 0:
        raise SystemExit("ffmpeg encoding failed")

    poster_frame.resize(OUTPUT_SIZE, Image.Resampling.LANCZOS).save(
        args.poster, quality=92, optimize=True
    )

    print(
        {
            "canvas": [width, height],
            "delivery": [OUTPUT_SIZE[0], OUTPUT_SIZE[1]],
            "fps": FPS,
            "duration_seconds": DURATION,
            "frames": FRAMES,
            "theme": args.theme,
            "loop_type": "periodic rocking",
            "boat_horizontal_travel_px": 0,
            "boat_rock_degrees": BOAT_ROCK_DEGREES,
            "boat_bob_px": BOAT_BOB_PX,
            "boat_rock_cycles": BOAT_ROCK_CYCLES,
            "cloud_motion": "static",
            "night_layered": night_layered,
            "night_exterior_source": (
                "registered active night layers" if night_layered else None
            ),
            "moon_cloud_order": (
                "moon background, clouds composited above"
                if night_layered
                else None
            ),
            "moon_reflection": (
                "painted water path plus periodic localized glints"
                if night_layered
                else False
            ),
            "lighthouse_light": args.theme == "night",
            "sky_scale": SKY_SCALE,
            "sky_registration_x": SKY_REGISTRATION_X,
            "sky_registration_y": SKY_REGISTRATION_Y,
            "harbor_scale": HARBOR_SCALE,
            "harbor_registration_x": HARBOR_OFFSET_X,
            "boat_sprite_position": list(boat_position),
            "boat_sprite_size": list(boat_size),
            "motion_samples": motion_samples,
        }
    )


if __name__ == "__main__":
    main()
