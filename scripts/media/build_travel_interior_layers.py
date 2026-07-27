import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
ASSET_ROOT = ROOT / "assets/cinematic/travel/active"
CHROMA_HELPER = (
    Path.home()
    / ".codex/skills/.system/imagegen/scripts/remove_chroma_key.py"
)
MASTER_SIZE = (1672, 941)
SEAT_CANVAS_SIZE = (1672, 1460)
SEAT_TARGET_WIDTH = 1650
SEAT_TOP_Y = 834
SEAT_END_Y = 12
CHARM_POSITION = (700, 228)


def require_size(path: Path, image: Image.Image) -> None:
    if image.size != MASTER_SIZE:
        raise ValueError(f"{path} is {image.size}; expected {MASTER_SIZE}")


def remove_chroma_key(source: Path, output: Path) -> None:
    subprocess.run(
        [
            sys.executable,
            str(CHROMA_HELPER),
            "--input",
            str(source),
            "--out",
            str(output),
            "--key-color",
            "#ff00ff",
            "--soft-matte",
            "--transparent-threshold",
            "12",
            "--opaque-threshold",
            "220",
            "--despill",
        ],
        check=True,
    )


def register_bench_seat(
    seat: Image.Image,
    crop_box: tuple[int, int, int, int],
    shared_alpha: Image.Image | None = None,
) -> Image.Image:
    seat = seat.crop(crop_box)
    target_height = round(
        seat.height * SEAT_TARGET_WIDTH / seat.width
    )
    seat = seat.resize(
        (SEAT_TARGET_WIDTH, target_height),
        Image.Resampling.LANCZOS,
    )
    if shared_alpha is not None:
        seat.putalpha(shared_alpha)

    if SEAT_TOP_Y + seat.height > SEAT_CANVAS_SIZE[1]:
        raise ValueError(
            "Registered bench seat exceeds declared overscan canvas"
        )

    canvas = Image.new("RGBA", SEAT_CANVAS_SIZE, (0, 0, 0, 0))
    canvas.alpha_composite(
        seat,
        ((SEAT_CANVAS_SIZE[0] - seat.width) // 2, SEAT_TOP_Y),
    )
    return canvas


def padded_charm(charm: Image.Image) -> Image.Image:
    padded = Image.new(
        "RGBA",
        (charm.width + 60, charm.height + 30),
        (0, 0, 0, 0),
    )
    padded.alpha_composite(charm, (30, 0))
    return padded


def main() -> None:
    if not CHROMA_HELPER.exists():
        raise FileNotFoundError(CHROMA_HELPER)

    keyed_interiors: dict[str, Image.Image] = {}
    keyed_seats: dict[str, Image.Image] = {}

    with tempfile.TemporaryDirectory(
        prefix="wisteria-travel-layers-"
    ) as temporary:
        temporary_root = Path(temporary)

        for theme in ("day", "night"):
            theme_dir = ASSET_ROOT / theme
            interior_source = theme_dir / "02-interior-keyed.png"
            seat_source = theme_dir / "04-bench-seat-keyed.png"
            interior = Image.open(interior_source).convert("RGBA")
            require_size(interior_source, interior)

            interior_cutout = temporary_root / f"{theme}-interior.png"
            seat_cutout = temporary_root / f"{theme}-seat.png"
            remove_chroma_key(interior_source, interior_cutout)
            remove_chroma_key(seat_source, seat_cutout)
            keyed_interiors[theme] = Image.open(
                interior_cutout
            ).convert("RGBA")
            keyed_seats[theme] = Image.open(seat_cutout).convert("RGBA")

        # The day key is the definitive aperture and seat geometry. Applying
        # the same alpha to the aligned night repaint prevents one-pixel theme
        # shifts along glass, trim, and upholstery edges.
        aperture = keyed_interiors["day"].getchannel("A")
        aperture.save(ASSET_ROOT / "masks/aperture-alpha.png")
        keyed_interiors["night"].putalpha(aperture)

        seat_crop = keyed_seats["day"].getchannel("A").point(
            lambda value: 255 if value >= 128 else 0
        ).getbbox()
        if seat_crop is None:
            raise ValueError("The generated bench seat has no opaque pixels")
        day_seat_crop = keyed_seats["day"].crop(seat_crop)
        target_height = round(
            day_seat_crop.height
            * SEAT_TARGET_WIDTH
            / day_seat_crop.width
        )
        shared_seat_alpha = day_seat_crop.getchannel("A").resize(
            (SEAT_TARGET_WIDTH, target_height),
            Image.Resampling.LANCZOS,
        )

        for theme in ("day", "night"):
            theme_dir = ASSET_ROOT / theme
            interior = keyed_interiors[theme]
            interior.save(theme_dir / "03-interior-cutout.png")

            seat = register_bench_seat(
                keyed_seats[theme],
                seat_crop,
                shared_seat_alpha,
            )
            seat.save(theme_dir / "04-front-seat.png")

            exterior_path = theme_dir / "01-exterior.png"
            exterior = Image.open(exterior_path).convert("RGBA")
            require_size(exterior_path, exterior)
            composite = exterior.copy()
            composite.alpha_composite(interior)
            composite.alpha_composite(
                padded_charm(
                    Image.open(
                        theme_dir / "06-buddha-charm.png"
                    ).convert("RGBA")
                ),
                CHARM_POSITION,
            )
            composite.alpha_composite(seat, (0, SEAT_END_Y))
            composite.convert("RGB").save(
                theme_dir / "00-composite-master.png"
            )

        keyed_seats["day"] = register_bench_seat(
            keyed_seats["day"],
            seat_crop,
            shared_seat_alpha,
        )
        keyed_seats["day"].getchannel("A").save(
            ASSET_ROOT / "masks/front-seat-alpha.png"
        )


if __name__ == "__main__":
    main()
