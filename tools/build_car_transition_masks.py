from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


SIZE = (1672, 941)
ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "assets/cinematic/village/interactions/car/masks"
OUT_DIR.mkdir(parents=True, exist_ok=True)


def save_mask(name: str, polygon: list[tuple[int, int]], feather: float) -> None:
    mask = Image.new("L", SIZE, 0)
    draw = ImageDraw.Draw(mask)
    draw.polygon(polygon, fill=255)
    # The side mirror and its stem are attached to the moving driver door.
    draw.ellipse((875, 384, 932, 449), fill=255)
    draw.polygon([(900, 426), (929, 449), (918, 458), (891, 433)], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(feather))
    mask.save(OUT_DIR / name)


save_mask(
    "car-driver-door-leaf-mask-v1.png",
    [(558, 278), (888, 278), (951, 431), (949, 655), (565, 634), (554, 316)],
    1.15,
)
save_mask(
    "car-driver-door-opening-mask-v1.png",
    [(563, 284), (884, 284), (944, 435), (943, 647), (570, 627), (560, 318)],
    1.8,
)

# The 3D renderer treats the metal skin/window frame and transparent glass as
# separate surfaces. This prevents the scenery visible through the closed
# window from being rotated as if it were painted onto the door.
leaf_polygon = [(558, 278), (888, 278), (951, 431), (949, 655), (565, 634), (554, 316)]
window_polygon = [(691, 293), (869, 293), (928, 423), (692, 418)]

outer_mask = Image.new("L", SIZE, 0)
outer_draw = ImageDraw.Draw(outer_mask)
outer_draw.polygon(leaf_polygon, fill=255)
outer_draw.polygon(window_polygon, fill=0)
outer_draw.ellipse((875, 384, 932, 449), fill=255)
outer_draw.polygon([(900, 426), (929, 449), (918, 458), (891, 433)], fill=255)
outer_mask.filter(ImageFilter.GaussianBlur(1.0)).save(
    OUT_DIR / "car-driver-door-outer-mask-v2.png"
)

window_mask = Image.new("L", SIZE, 0)
window_draw = ImageDraw.Draw(window_mask)
window_draw.polygon(window_polygon, fill=150)
window_mask.filter(ImageFilter.GaussianBlur(1.2)).save(
    OUT_DIR / "car-driver-door-window-mask-v2.png"
)
