from __future__ import annotations

import json
from pathlib import Path
from statistics import median

from PIL import Image, ImageChops, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[2]
MASTER_SIZE = (1672, 941)


def registered(image: Image.Image) -> Image.Image:
    image = image.convert("RGBA")
    if image.size != MASTER_SIZE:
        image = image.resize(MASTER_SIZE, Image.Resampling.LANCZOS)
    return image


def polygon_mask(polygons: list[list[tuple[int, int]]]) -> Image.Image:
    mask = Image.new("L", MASTER_SIZE, 0)
    draw = ImageDraw.Draw(mask)
    for polygon in polygons:
        draw.polygon(polygon, fill=255)
    return mask


def difference_matte(
    master: Image.Image,
    clean: Image.Image,
    region: Image.Image,
    threshold: int = 18,
    expand: int = 9,
    feather: float = 1.4,
) -> Image.Image:
    difference = ImageChops.difference(
        master.convert("RGB"),
        clean.convert("RGB"),
    ).convert("L")
    matte = difference.point(
        lambda value: 255 if value >= threshold else 0
    )
    matte = ImageChops.multiply(matte, region)
    if expand >= 3:
        if expand % 2 == 0:
            expand += 1
        matte = matte.filter(ImageFilter.MaxFilter(expand))
    if feather:
        matte = matte.filter(ImageFilter.GaussianBlur(feather))
    return matte


def transparent_plate(
    source: Image.Image,
    matte: Image.Image,
) -> Image.Image:
    plate = source.copy()
    plate.putalpha(matte)
    return plate


def source_alpha(path: Path) -> Image.Image:
    return registered(Image.open(path)).getchannel("A")


def keyed_aperture_matte(path: Path) -> Image.Image:
    """Extract only the authored magenta apertures from a keyed guide.

    The guide is never used for RGB. Restricting the key search to the three
    declared openings prevents similarly colored workshop objects or flowers
    from becoming accidental transparency.
    """
    keyed = registered(Image.open(path)).convert("RGB")
    matte = Image.new("L", MASTER_SIZE, 0)
    source_pixels = keyed.load()
    matte_pixels = matte.load()
    aperture_regions = (
        (58, 145, 222, 456),
        (558, 218, 737, 578),
        (1342, 145, 1424, 466),
    )
    key = (244, 2, 213)
    maximum_distance_squared = 38 * 38

    for left, top, right, bottom in aperture_regions:
        for y in range(top, bottom):
            for x in range(left, right):
                red, green, blue = source_pixels[x, y]
                distance_squared = (
                    (red - key[0]) ** 2
                    + (green - key[1]) ** 2
                    + (blue - key[2]) ** 2
                )
                if distance_squared <= maximum_distance_squared:
                    matte_pixels[x, y] = 255

    # The motorcycles overlap the lower doorway in the keyed guide. Complete
    # the simple open-air aperture behind them while following the door leaf's
    # handle-side edge and preserving the fixed frame and threshold.
    ImageDraw.Draw(matte).polygon(
        [
            (589, 228),
            (730, 228),
            (730, 576),
            (607, 576),
            (608, 255),
        ],
        fill=255,
    )

    # Cover the keyed antialias fringe without broadening past the physical
    # inner rim, then restore a small amount of edge softness.
    return matte.filter(ImageFilter.MaxFilter(3)).filter(
        ImageFilter.GaussianBlur(0.55)
    )


def cafe_aperture_matte(path: Path) -> Image.Image:
    """Extract only the authored doorway and arched-window apertures.

    The keyed guide contributes alpha only. The room shell retains RGB from
    the approved master and localized table-removal repair.
    """
    keyed = registered(Image.open(path)).convert("RGB")
    matte = Image.new("L", MASTER_SIZE, 0)
    source_pixels = keyed.load()
    matte_pixels = matte.load()
    aperture_regions = (
        (0, 25, 225, 815),
        (350, 175, 470, 515),
    )
    key = (249, 3, 231)
    maximum_distance_squared = 38 * 38

    for left, top, right, bottom in aperture_regions:
        for y in range(top, bottom):
            for x in range(left, right):
                red, green, blue = source_pixels[x, y]
                distance_squared = (
                    (red - key[0]) ** 2
                    + (green - key[1]) ** 2
                    + (blue - key[2]) ** 2
                )
                if distance_squared <= maximum_distance_squared:
                    matte_pixels[x, y] = 255

    # The old camera-near bouquet overlaps the lower doorway in the keyed
    # guide, but that bouquet now belongs to the independently moving table
    # plane. Complete the simple open-air region behind it while preserving the
    # left door leaf, right jamb, and diagonal interior threshold.
    ImageDraw.Draw(matte).polygon(
        [
            (82, 610),
            (188, 610),
            (188, 742),
            (85, 786),
            (82, 786),
        ],
        fill=255,
    )

    return matte.filter(ImageFilter.MaxFilter(3)).filter(
        ImageFilter.GaussianBlur(0.55)
    )


def cafe_foreground_matte(generated_root: Path) -> Image.Image:
    masks = [
        registered(
            Image.open(generated_root / "day-left-foreground-mask.png")
        ).convert("L"),
        registered(
            Image.open(generated_root / "day-right-table-mask.png")
        ).convert("L"),
        registered(
            Image.open(generated_root / "day-right-vessels-mask.png")
        ).convert("L"),
    ]
    masks = [
        mask.point(lambda value: 255 if value >= 128 else 0)
        for mask in masks
    ]

    props_source = Image.open(
        generated_root / "day-right-props-cutout.png"
    ).convert("RGBA")
    props = Image.new("L", MASTER_SIZE, 0)
    props.paste(props_source.getchannel("A"), (700, 520))
    masks.append(props)

    matte = masks[0]
    for mask in masks[1:]:
        matte = ImageChops.lighter(matte, mask)
    return matte.filter(ImageFilter.GaussianBlur(0.55))


def authored_keyed_subject(path: Path) -> Image.Image:
    """Extract one independently authored subject from its magenta key.

    Image generation can vary the nominal key slightly across the canvas. Use a
    sampled key with a deliberately narrow distance so enclosed negative space
    between chair spindles and table legs is removed without broadly deleting
    the pink and purple illustrated flowers.
    """
    source = Image.open(path).convert("RGB")
    samples: list[tuple[int, int, int]] = []
    sample_columns = range(0, source.width, max(1, source.width // 24))
    sample_rows = range(0, source.height, max(1, source.height // 24))
    for x in sample_columns:
        samples.extend(
            [source.getpixel((x, 0)), source.getpixel((x, source.height - 1))]
        )
    for y in sample_rows:
        samples.extend(
            [source.getpixel((0, y)), source.getpixel((source.width - 1, y))]
        )
    key = tuple(
        round(median(sample[channel] for sample in samples))
        for channel in range(3)
    )
    maximum_distance_squared = 42 * 42
    background = Image.new("L", source.size, 0)
    background.putdata(
        [
            255
            if (
                (pixel[0] - key[0]) ** 2
                + (pixel[1] - key[1]) ** 2
                + (pixel[2] - key[2]) ** 2
            )
            <= maximum_distance_squared
            else 0
            for pixel in source.get_flattened_data()
        ]
    )
    background = background.filter(ImageFilter.MaxFilter(3))
    alpha = ImageChops.invert(background).filter(
        ImageFilter.GaussianBlur(0.45)
    )
    subject = source.convert("RGBA")
    subject.putalpha(alpha)
    return registered(subject)


def transformed_subject(
    subject: Image.Image,
    scale: float,
    offset: tuple[int, int],
) -> Image.Image:
    scaled = subject.resize(
        (
            round(MASTER_SIZE[0] * scale),
            round(MASTER_SIZE[1] * scale),
        ),
        Image.Resampling.LANCZOS,
    )
    plate = Image.new("RGBA", MASTER_SIZE, (0, 0, 0, 0))
    plate.alpha_composite(scaled, offset)
    return plate


def cafe_authored_foreground(
    generated_root: Path,
    theme: str,
) -> Image.Image:
    authored_root = generated_root / "authored"
    left = authored_keyed_subject(
        authored_root / f"{theme}-left-table-chair-keyed-v3.png"
    )
    right = authored_keyed_subject(
        authored_root / f"{theme}-right-art-table-keyed-v3.png"
    )

    # Register the independently authored assemblies into the approved
    # camera-near footprints. Both continue beyond the lower canvas boundary,
    # so no generated body terminates in view.
    plate = transformed_subject(left, 0.72, (0, 398))
    plate.alpha_composite(
        transformed_subject(right, 0.48, (586, 500))
    )
    return plate


def position_cafe_exterior(image: Image.Image) -> Image.Image:
    """Register one continuous garden beyond both café apertures.

    The left shift places the patio umbrella in the open doorway while the
    adjacent arched window sees the same scene continue into foliage and bay.
    A slight uniform scale reduction gives the patio more distance and brings
    a readable strip of bay into the arched window. The paired registration
    shift keeps the patio and pavers aligned with the doorway threshold.
    """
    return transformed_subject(image, 0.90, (-370, 0))


def repaired_backplate(
    master: Image.Image,
    repair: Image.Image,
    object_matte: Image.Image,
    expand: int = 35,
    feather: float = 3.0,
    extra_repair_region: Image.Image | None = None,
) -> Image.Image:
    if expand % 2 == 0:
        expand += 1
    repair_region = object_matte.filter(ImageFilter.MaxFilter(expand))
    repair_region = repair_region.filter(ImageFilter.GaussianBlur(feather))
    if extra_repair_region is not None:
        repair_region = ImageChops.lighter(
            repair_region,
            extra_repair_region,
        )
    return Image.composite(repair, master, repair_region)


def position_garage_exterior(image: Image.Image) -> Image.Image:
    """Place the café beyond a readable garden approach.

    The side windows retain the full-scale nearby garden. A reduced registered
    copy owns the doorway zone, moving the patio pavers up to the threshold
    while keeping the café façade in the mid-distance. The zone boundary stays
    safely behind the opaque wall and doorway frame at every parallax extreme.
    """
    scale = 0.70
    offset = (150, 15)
    reduced = image.resize(
        (
            round(MASTER_SIZE[0] * scale),
            round(MASTER_SIZE[1] * scale),
        ),
        Image.Resampling.LANCZOS,
    )
    doorway_scene = Image.new("RGBA", MASTER_SIZE, (0, 0, 0, 0))
    doorway_scene.alpha_composite(reduced, offset)
    doorway_zone = polygon_mask(
        [[(520, 180), (790, 180), (790, 630), (520, 630)]]
    )
    return Image.composite(doorway_scene, image, doorway_zone)


def write_manifest(
    output: Path,
    theme: str,
    layers: list[dict[str, object]],
) -> None:
    payload = {
        "theme": theme,
        "canvas": list(MASTER_SIZE),
        "overscanPercent": 1.8,
        "registration": "full-canvas",
        "layers": [
            {
                "id": str(layer["owner"]),
                "file": layer["file"],
                "owner": layer["owner"],
                "z": index + 1,
                "maxShiftPercent": layer.get(
                    "maximum_horizontal_shift_percent",
                    0,
                ),
                "includes": layer.get("includes", []),
                "excludes": layer.get("excludes", []),
                "repairSource": layer.get("repair_source"),
                "matteSource": layer.get("matte_source"),
                "sourceArt": layer.get("source_art"),
                "registrationTransform": layer.get(
                    "registration_transform"
                ),
            }
            for index, layer in enumerate(layers)
        ],
    }
    (output / "layers.json").write_text(
        json.dumps(payload, indent=2) + "\n",
        encoding="utf-8",
    )


def prepare_cafe() -> None:
    source_root = (
        ROOT / "assets/cinematic/scenes/cafe-gallery/interior/sources"
    )
    generated_root = (
        ROOT / "assets/cinematic/scenes/cafe-gallery/interior/repairs"
    )
    public_root = ROOT / "public/media/cafe-gallery/parallax"
    removal_matte = cafe_foreground_matte(generated_root)
    removal_matte.save(
        generated_root / "day-foreground-removal-matte.png"
    )
    aperture_matte = cafe_aperture_matte(
        generated_root / "day-apertures-keyed-v1.png"
    )
    aperture_matte.save(
        generated_root / "day-aperture-matte-v1.png"
    )

    for theme in ("day", "night"):
        master = registered(
            Image.open(source_root / f"{theme}-master.png")
        )
        clean = registered(
            Image.open(generated_root / f"{theme}-room-clean.png")
        )
        output = public_root / theme
        output.mkdir(parents=True, exist_ok=True)

        shell = repaired_backplate(
            master,
            clean,
            removal_matte,
            expand=39,
            feather=3.2,
        )
        shell.putalpha(
            ImageChops.multiply(
                shell.getchannel("A"),
                ImageChops.invert(aperture_matte),
            )
        )
        exterior = position_cafe_exterior(
            registered(
                Image.open(
                    generated_root
                    / "exterior"
                    / f"{theme}-garden-bay-v2.png"
                )
            )
        )
        tables = cafe_authored_foreground(generated_root, theme)

        exterior.save(output / "01-garden-bay-exterior.png")
        shell.save(output / "02-gallery-shell.png")
        tables.save(output / "03-foreground-tables.png")
        write_manifest(
            output,
            theme,
            [
                {
                    "file": "01-garden-bay-exterior.png",
                    "owner": "garden-bay-exterior",
                    "maximum_horizontal_shift_percent": 0.22,
                    "includes": [
                        "one continuous purpose-built patio, garden, and bay exterior",
                        "mid-distance umbrella, café furniture, flowers, pavers, trees, sky, and coastline",
                    ],
                    "excludes": [
                        "door and window frames, mullions, sill, threshold, wall, indoor plants, and furniture",
                    ],
                    "source_art": [
                        f"exterior/{theme}-garden-bay-v2.png",
                    ],
                    "registration_transform": {
                        "scale": 0.9,
                        "offset": [-370, 0],
                        "purpose": (
                            "preserve the patio and threshold alignment while "
                            "revealing a more distant bay through the arched window"
                        ),
                    },
                },
                {
                    "file": "02-gallery-shell.png",
                    "owner": "room-shell",
                    "maximum_horizontal_shift_percent": 0.55,
                    "includes": [
                        "walls, arches, exact door and window frames, mullions, sill, and threshold",
                        "counter, espresso machine, shelves, and bar stool",
                        "mid-room table, chairs, bonsai, art, and sculpture",
                        "repaired floor behind the camera-near tables",
                    ],
                    "excludes": [
                        "all exterior scenery visible through the doorway and arched window",
                        "both camera-near foreground table assemblies",
                    ],
                    "repair_source": f"{theme}-room-clean.png",
                    "matte_source": (
                        "day-foreground-removal-matte.png; "
                        "day-aperture-matte-v1.png"
                    ),
                },
                {
                    "file": "03-foreground-tables.png",
                    "owner": "foreground-tables",
                    "maximum_horizontal_shift_percent": 1.35,
                    "includes": [
                        "bottom-left table, cup, saucer, vase, flowers, and foreground chair",
                        "lower-center/right table and every object resting on it",
                    ],
                    "excludes": [
                        "floor tiles, walls, windows, counter, mid-room furniture",
                    ],
                    "source_art": [
                        f"authored/{theme}-left-table-chair-keyed-v3.png",
                        f"authored/{theme}-right-art-table-keyed-v3.png",
                    ],
                    "registration_transform": {
                        "leftTableChair": {
                            "scale": 0.72,
                            "offset": [0, 398],
                        },
                        "rightArtTable": {
                            "scale": 0.48,
                            "offset": [586, 500],
                        },
                    },
                },
            ],
        )


def prepare_travel() -> None:
    source_root = (
        ROOT / "assets/cinematic/scenes/car-interior/interior/sources"
    )
    public_root = ROOT / "public/media/car-interior/parallax"
    charm_position = (700, 228)
    seat_position_y = 12

    for theme in ("day", "night"):
        source = source_root / theme
        output = public_root / theme
        output.mkdir(parents=True, exist_ok=True)

        exterior = registered(Image.open(source / "01-exterior.png"))
        cockpit = registered(
            Image.open(source / "03-interior-cutout.png")
        )

        charm_source = Image.open(
            source / "06-buddha-charm.png"
        ).convert("RGBA")
        charm = Image.new("RGBA", MASTER_SIZE, (0, 0, 0, 0))
        charm.alpha_composite(charm_source, charm_position)

        seat_source = Image.open(
            source / "04-front-seat.png"
        ).convert("RGBA")
        seat = Image.new("RGBA", MASTER_SIZE, (0, 0, 0, 0))
        seat.alpha_composite(seat_source, (0, seat_position_y))

        exterior.save(output / "01-exterior.png")
        cockpit.save(output / "02-cockpit-shell.png")
        charm.save(output / "03-buddha-charm.png")
        seat.save(output / "04-front-seat.png")
        write_manifest(
            output,
            theme,
            [
                {
                    "file": "01-exterior.png",
                    "owner": "exterior",
                    "maximum_horizontal_shift_percent": 0.3,
                },
                {
                    "file": "02-cockpit-shell.png",
                    "owner": "cockpit-shell",
                    "maximum_horizontal_shift_percent": 0.75,
                },
                {
                    "file": "03-buddha-charm.png",
                    "owner": "hanging-charm",
                    "maximum_horizontal_shift_percent": 1.05,
                },
                {
                    "file": "04-front-seat.png",
                    "owner": "front-seat",
                    "maximum_horizontal_shift_percent": 1.5,
                },
            ],
        )


def prepare_garage_interior() -> None:
    source_root = (
        ROOT / "assets/cinematic/scenes/garage-workshop/interior/sources"
    )
    exterior_root = source_root / "exterior"
    public_root = ROOT / "public/media/garage-workshop/parallax"
    motorcycle_matte = source_alpha(
        source_root / "day-motorcycles-cutout.png"
    )
    aperture_matte = keyed_aperture_matte(
        source_root / "day-apertures-keyed.png"
    )
    aperture_matte.save(source_root / "day-aperture-matte.png")
    shadow_repair_region = polygon_mask(
        [[
            (520, 575),
            (1285, 565),
            (1425, 690),
            (1450, 875),
            (510, 875),
        ]]
    ).filter(ImageFilter.GaussianBlur(12))

    for theme in ("day", "night"):
        master = registered(
            Image.open(source_root / f"{theme}-master.png")
        )
        repair = registered(
            Image.open(
                source_root / f"{theme}-motorcycles-removed.png"
            )
        )
        output = public_root / theme
        output.mkdir(parents=True, exist_ok=True)

        shell = repaired_backplate(
            master,
            repair,
            motorcycle_matte,
            expand=43,
            feather=3.4,
            extra_repair_region=shadow_repair_region,
        )
        shell.putalpha(ImageChops.invert(aperture_matte))
        motorcycles = transparent_plate(master, motorcycle_matte)
        exterior = position_garage_exterior(
            registered(
                Image.open(exterior_root / f"{theme}-garden-cafe.png")
            )
        )

        composite = Image.new("RGBA", MASTER_SIZE, (0, 0, 0, 255))
        composite.alpha_composite(exterior)
        composite.alpha_composite(shell)
        composite.alpha_composite(motorcycles)

        composite.convert("RGB").save(output / "00-composite.png")
        exterior.save(output / "01-garden-cafe-exterior.png")
        shell.save(output / "02-garage-shell.png")
        motorcycles.save(output / "03-motorcycles.png")
        write_manifest(
            output,
            theme,
            [
                {
                    "file": "01-garden-cafe-exterior.png",
                    "owner": "garden-cafe-exterior",
                    "maximum_horizontal_shift_percent": 0.22,
                    "includes": [
                        "purpose-built garden, café façade, awning, patio, path, and distant sky",
                    ],
                    "excludes": [
                        "garage walls, window frames, mullions, sills, door leaf, workshop objects, and motorcycles",
                    ],
                    "repair_source": f"exterior/{theme}-garden-cafe.png",
                    "registration_transform": {
                        "scale": 0.70,
                        "offset": [150, 15],
                        "zone": [520, 180, 790, 630],
                        "purpose": "raise the patio pavers into the doorway and place the café in the mid-distance while retaining near garden scale at the side windows",
                    },
                },
                {
                    "file": "02-garage-shell.png",
                    "owner": "garage-shell",
                    "maximum_horizontal_shift_percent": 0.55,
                    "includes": [
                        "gate frame, walls, exact window frames, mullions, sills, garden door leaf, and threshold",
                        "workbench, electric motors, stool, tools, shelves, cabinets, and lamps",
                        "both wall-mounted bicycles",
                        "repaired concrete floor behind the motorcycles",
                    ],
                    "excludes": [
                        "the garden and café exterior visible through the windows and door",
                        "the two standing motorcycles",
                    ],
                    "repair_source": f"{theme}-motorcycles-removed.png",
                    "matte_source": "day-aperture-matte.png",
                },
                {
                    "file": "03-motorcycles.png",
                    "owner": "motorcycles",
                    "maximum_horizontal_shift_percent": 1.3,
                    "includes": [
                        "purple and black motorcycles with complete silhouettes, spokes, stands, and contact shadows",
                    ],
                    "excludes": [
                        "floor, workbench, walls, windows, door, tools, cabinets, and bicycles",
                    ],
                    "matte_source": "day-motorcycles-cutout.png",
                },
            ],
        )


def prepare_garage_transition() -> None:
    source_root = (
        ROOT
        / "assets/cinematic/scenes/garage-workshop/transitions"
        / "garden-reveal/sources"
    )
    authored_root = source_root / "authored"
    active_root = (
        ROOT
        / "assets/cinematic/scenes/garage-workshop/transitions"
        / "garden-reveal/layers"
    )

    left_region = polygon_mask(
        [[(0, 0), (836, 0), (836, 941), (0, 941)]]
    )
    right_region = ImageChops.invert(left_region)

    for theme in ("day", "night"):
        clean = registered(
            Image.open(source_root / f"{theme}-clean.png")
        )
        output = active_root / theme
        output.mkdir(parents=True, exist_ok=True)

        lamp = registered(
            Image.open(authored_root / f"{theme}-lamp.png")
        )
        bushes = registered(
            Image.open(authored_root / f"{theme}-bushes.png")
        )
        left_bush = bushes.copy()
        left_bush.putalpha(
            ImageChops.multiply(bushes.getchannel("A"), left_region)
        )
        right_bush = bushes.copy()
        right_bush.putalpha(
            ImageChops.multiply(bushes.getchannel("A"), right_region)
        )

        clean.save(output / "01-garage-background.png")
        lamp.save(output / "02-street-lamp.png")
        left_bush.save(output / "03-left-bush.png")
        right_bush.save(output / "04-right-bush.png")
        write_manifest(
            output,
            theme,
            [
                {
                    "file": "01-garage-background.png",
                    "owner": "garage-background",
                    "includes": [
                        "garage exterior, lawn, path, fence, trees, and sky",
                    ],
                    "excludes": [
                        "authored street lamp and authored foreground bushes",
                    ],
                },
                {
                    "file": "02-street-lamp.png",
                    "owner": "near-street-lamp",
                    "includes": [
                        "complete independently authored teal-and-brass street lamp",
                    ],
                    "excludes": [
                        "garage, lawn, sky, fence, trees, and bushes",
                    ],
                    "source_art": [
                        f"authored/{theme}-lamp.png",
                    ],
                },
                {
                    "file": "03-left-bush.png",
                    "owner": "near-left-bush",
                    "includes": [
                        "complete independently authored lower-left bush cluster",
                    ],
                    "excludes": [
                        "lamp, right bush, garage, lawn, sky, fence, and trees",
                    ],
                    "source_art": [
                        f"authored/{theme}-bushes.png",
                    ],
                },
                {
                    "file": "04-right-bush.png",
                    "owner": "near-right-bush",
                    "includes": [
                        "complete independently authored lower-right bush cluster",
                    ],
                    "excludes": [
                        "lamp, left bush, garage, lawn, sky, fence, and trees",
                    ],
                    "source_art": [
                        f"authored/{theme}-bushes.png",
                    ],
                },
            ],
        )


def main() -> None:
    prepare_cafe()
    prepare_travel()
    prepare_garage_interior()
    prepare_garage_transition()


if __name__ == "__main__":
    main()
