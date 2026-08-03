#!/usr/bin/env python3
"""Build the compact font used by the five production immersive routes.

Requires fonttools with WOFF2 support:
  python3 -m pip install 'fonttools[woff]>=4.59,<5'
"""

from pathlib import Path

from fontTools import subset


ROOT = Path(__file__).resolve().parents[2]
SOURCE = (
    ROOT
    / "node_modules/@fontsource/zcool-kuaile/files/"
    / "zcool-kuaile-chinese-simplified-400-normal.woff2"
)
OUTPUT = ROOT / "public/fonts/wisteria-immersive-ui.woff2"
TEXT_SOURCES = [
    ROOT / "src/layouts/ImmersiveLayout.astro",
    ROOT / "src/components/media/CinematicSceneExitOverlay.astro",
    ROOT / "src/components/sections/CinematicVillageHero.astro",
    ROOT / "src/components/sections/VisualNovelLivingRoom.astro",
    ROOT / "src/components/sections/VisualNovelCafeGallery.astro",
    ROOT / "src/components/sections/VisualNovelCarInterior.astro",
    ROOT / "src/components/sections/VisualNovelGarage.astro",
    ROOT / "src/data/navigation.ts",
    ROOT / "src/pages/index.astro",
    ROOT / "src/pages/lifestyle/index.astro",
    ROOT / "src/pages/art/index.astro",
    ROOT / "src/pages/travel/index.astro",
    ROOT / "src/pages/garage/index.astro",
]


def main() -> None:
    missing = [path for path in [SOURCE, *TEXT_SOURCES] if not path.exists()]
    if missing:
        raise SystemExit(f"Missing font input: {missing[0]}")

    # Keep Latin-1 for runtime labels and collect every non-ASCII glyph used by
    # the immersive UI. Missing future glyphs safely fall through to system UI.
    unicodes = set(range(0x20, 0x100))
    for path in TEXT_SOURCES:
        unicodes.update(ord(character) for character in path.read_text())

    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["*"]
    options.name_IDs = [0, 1, 2, 3, 4, 5, 6]
    options.name_languages = [0x409]
    options.recalc_bounds = True
    options.recalc_timestamp = False
    options.canonical_order = True

    font = subset.load_font(str(SOURCE), options)
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes=unicodes)
    subsetter.subset(font)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    subset.save_font(font, str(OUTPUT), options)
    print(f"Wrote {OUTPUT.relative_to(ROOT)} ({OUTPUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
