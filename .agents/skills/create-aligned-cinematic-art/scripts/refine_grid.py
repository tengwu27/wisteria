#!/usr/bin/env python3
"""Slice and content-aware stitch overlapping cinematic-art detail tiles."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter, ImageOps


def edges(length: int, count: int) -> list[int]:
    return [round(index * length / count) for index in range(count + 1)]


def slice_grid(args: argparse.Namespace) -> None:
    source_path = Path(args.input).resolve()
    output = Path(args.output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    image = Image.open(source_path).convert("RGB")
    width, height = image.size
    x_edges = edges(width, args.cols)
    y_edges = edges(height, args.rows)
    tiles = []

    for row in range(args.rows):
        for col in range(args.cols):
            box = (
                max(0, x_edges[col] - (args.overlap_x if col else 0)),
                max(0, y_edges[row] - (args.overlap_y if row else 0)),
                min(width, x_edges[col + 1] + (args.overlap_x if col + 1 < args.cols else 0)),
                min(height, y_edges[row + 1] + (args.overlap_y if row + 1 < args.rows else 0)),
            )
            name = f"r{row}-c{col}"
            image.crop(box).save(output / f"{name}-source.png", optimize=True)
            tiles.append({"name": name, "row": row, "col": col, "box": list(box)})

    manifest = {
        "source": str(source_path),
        "canvas": [width, height],
        "rows": args.rows,
        "cols": args.cols,
        "overlap": [args.overlap_x, args.overlap_y],
        "tiles": tiles,
    }
    (output / "grid-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


def difference(first: np.ndarray, second: np.ndarray) -> np.ndarray:
    raw = np.mean(np.abs(first - second), axis=2)
    image = Image.fromarray(np.clip(raw * 2.0, 0, 255).astype(np.uint8))
    return np.asarray(image.filter(ImageFilter.GaussianBlur(radius=2.0)), dtype=np.float32)


def minimum_vertical_seam(cost: np.ndarray, max_step: int = 3) -> np.ndarray:
    height, width = cost.shape
    cumulative = cost[0].copy()
    parents = np.zeros((height, width), dtype=np.int16)
    offsets = range(-max_step, max_step + 1)

    for row in range(1, height):
        candidates = []
        for offset in offsets:
            shifted = np.full(width, np.inf, dtype=np.float32)
            if offset < 0:
                shifted[:offset] = cumulative[-offset:]
            elif offset > 0:
                shifted[offset:] = cumulative[:-offset]
            else:
                shifted[:] = cumulative
            shifted += abs(offset) * 1.4
            candidates.append(shifted)
        stack = np.stack(candidates)
        choice = np.argmin(stack, axis=0)
        cumulative = cost[row] + np.take_along_axis(stack, choice[None, :], axis=0)[0]
        parents[row] = choice.astype(np.int16) - max_step

    seam = np.empty(height, dtype=np.int32)
    seam[-1] = int(np.argmin(cumulative))
    for row in range(height - 1, 0, -1):
        seam[row - 1] = np.clip(seam[row] - parents[row, seam[row]], 0, width - 1)
    return seam


def add_protection(cost: np.ndarray, mask: np.ndarray | None, scale: float) -> np.ndarray:
    if mask is None:
        return cost
    return cost + mask.astype(np.float32) / 255.0 * scale


def blend_vertical(
    left: np.ndarray,
    right: np.ndarray,
    right_x: int,
    feather: int,
    protection: np.ndarray | None,
) -> np.ndarray:
    overlap = left.shape[1] - right_x
    if overlap <= 0:
        raise ValueError("Tiles must overlap horizontally")
    cost = difference(left[:, right_x:], right[:, :overlap])
    cost = add_protection(cost, protection, 4000.0)
    seam = minimum_vertical_seam(cost)
    output = np.zeros((left.shape[0], right_x + right.shape[1], 3), dtype=np.float32)
    output[:, : left.shape[1]] = left
    output[:, right_x:] = right

    for row, local in enumerate(seam):
        join = right_x + int(local)
        start = max(right_x, join - feather)
        end = min(left.shape[1], join + feather + 1)
        output[row, :start] = left[row, :start]
        output[row, end:] = right[row, end - right_x:]
        if end > start:
            alpha = np.linspace(0, 1, end - start, dtype=np.float32)[:, None]
            output[row, start:end] = left[row, start:end] * (1 - alpha) + right[
                row, start - right_x : end - right_x
            ] * alpha
    return output


def blend_horizontal(
    top: np.ndarray,
    bottom: np.ndarray,
    bottom_y: int,
    feather: int,
    protection: np.ndarray | None,
) -> np.ndarray:
    overlap = top.shape[0] - bottom_y
    if overlap <= 0:
        raise ValueError("Tiles must overlap vertically")
    cost = difference(top[bottom_y:], bottom[:overlap])
    cost = add_protection(cost, protection, 4000.0)
    seam = minimum_vertical_seam(cost.T)
    output = np.zeros((bottom_y + bottom.shape[0], top.shape[1], 3), dtype=np.float32)
    output[: top.shape[0]] = top
    output[bottom_y:] = bottom

    for col, local in enumerate(seam):
        join = bottom_y + int(local)
        start = max(bottom_y, join - feather)
        end = min(top.shape[0], join + feather + 1)
        output[:start, col] = top[:start, col]
        output[end:, col] = bottom[end - bottom_y :, col]
        if end > start:
            alpha = np.linspace(0, 1, end - start, dtype=np.float32)[:, None]
            output[start:end, col] = top[start:end, col] * (1 - alpha) + bottom[
                start - bottom_y : end - bottom_y, col
            ] * alpha
    return output


def registered_tile(path: Path, size: tuple[int, int], tolerance: float) -> np.ndarray:
    image = Image.open(path).convert("RGB")
    source_ratio = image.width / image.height
    target_ratio = size[0] / size[1]
    drift = abs(source_ratio / target_ratio - 1.0)
    if drift > tolerance:
        raise ValueError(
            f"{path.name}: aspect drift {drift:.3%} exceeds {tolerance:.3%}; regenerate"
        )
    image = ImageOps.fit(image, size, method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))
    return np.asarray(image, dtype=np.float32)


def protection_crop(mask: np.ndarray | None, box: tuple[int, int, int, int]) -> np.ndarray | None:
    if mask is None:
        return None
    x0, y0, x1, y1 = box
    return mask[y0:y1, x0:x1]


def stitch_grid(args: argparse.Namespace) -> None:
    manifest = json.loads(Path(args.manifest).read_text())
    refined_dir = Path(args.refined_dir).resolve()
    width, height = manifest["canvas"]
    protection = None
    if args.protection_mask:
        protection = np.asarray(
            Image.open(args.protection_mask).convert("L").resize((width, height), Image.Resampling.NEAREST)
        )

    by_position = {(tile["row"], tile["col"]): tile for tile in manifest["tiles"]}
    row_images: list[tuple[np.ndarray, int, int]] = []

    for row in range(manifest["rows"]):
        first = by_position[(row, 0)]
        x0, y0, x1, y1 = first["box"]
        image = registered_tile(
            refined_dir / f"{first['name']}{args.suffix}", (x1 - x0, y1 - y0), args.aspect_tolerance
        )
        current_right = x1
        for col in range(1, manifest["cols"]):
            tile = by_position[(row, col)]
            tx0, ty0, tx1, ty1 = tile["box"]
            candidate = registered_tile(
                refined_dir / f"{tile['name']}{args.suffix}",
                (tx1 - tx0, ty1 - ty0),
                args.aspect_tolerance,
            )
            protect = protection_crop(protection, (tx0, y0, current_right, y1))
            image = blend_vertical(image, candidate, tx0 - x0, args.feather, protect)
            current_right = tx1
        row_images.append((image, y0, y1))

    image, top, current_bottom = row_images[0]
    for candidate, y0, y1 in row_images[1:]:
        protect = protection_crop(protection, (0, y0, width, current_bottom))
        image = blend_horizontal(image, candidate, y0 - top, args.feather, protect)
        current_bottom = y1

    final = Image.fromarray(np.clip(image, 0, 255).astype(np.uint8), "RGB")
    if final.size != (width, height):
        raise ValueError(f"Composite size {final.size} does not match manifest {(width, height)}")
    output = Path(args.output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    final.save(output, optimize=True)


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    commands = result.add_subparsers(dest="command", required=True)
    slice_command = commands.add_parser("slice", help="create overlapping source tiles")
    slice_command.add_argument("--input", required=True)
    slice_command.add_argument("--output", required=True)
    slice_command.add_argument("--cols", type=int, default=2)
    slice_command.add_argument("--rows", type=int, default=2)
    slice_command.add_argument("--overlap-x", type=int, default=96)
    slice_command.add_argument("--overlap-y", type=int, default=72)
    slice_command.set_defaults(handler=slice_grid)

    stitch_command = commands.add_parser("stitch", help="recompose refined registered tiles")
    stitch_command.add_argument("--manifest", required=True)
    stitch_command.add_argument("--refined-dir", required=True)
    stitch_command.add_argument("--output", required=True)
    stitch_command.add_argument("--suffix", default="-refined.png")
    stitch_command.add_argument("--feather", type=int, default=4)
    stitch_command.add_argument("--aspect-tolerance", type=float, default=0.05)
    stitch_command.add_argument("--protection-mask")
    stitch_command.set_defaults(handler=stitch_grid)
    return result


def main() -> None:
    args = parser().parse_args()
    args.handler(args)


if __name__ == "__main__":
    main()
