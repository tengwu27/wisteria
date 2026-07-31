from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
CAFE_ROOT = (
    ROOT
    / "assets/cinematic/scenes/cafe-gallery/transitions/garden-reveal/layers"
)
HOUSE_ROOT = (
    ROOT
    / "assets/cinematic/scenes/living-room/transitions/house-door/layers"
)
MASTER_SIZE = (1672, 941)


def build_theme(theme: str) -> None:
    source_path = CAFE_ROOT / theme / "04-foreground-garden.png"
    source = Image.open(source_path).convert("RGBA")
    if source.size != MASTER_SIZE:
        raise ValueError(
            f"{source_path} is {source.size}; expected {MASTER_SIZE}"
        )

    output_dir = HOUSE_ROOT / theme
    output_dir.mkdir(parents=True, exist_ok=True)

    # The café reveal's approved near-camera garden becomes a registered pair
    # of curtains. Mirroring preserves one coherent botanical language while
    # giving the house a symmetrical split reveal.
    source.save(output_dir / "01-left-garden.png")
    source.transpose(Image.Transpose.FLIP_LEFT_RIGHT).save(
        output_dir / "02-right-garden.png"
    )


def main() -> None:
    for theme in ("day", "night"):
        build_theme(theme)


if __name__ == "__main__":
    main()
