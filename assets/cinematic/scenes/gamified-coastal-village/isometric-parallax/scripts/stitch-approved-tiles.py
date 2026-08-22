from __future__ import annotations

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


SCENE_ROOT = Path(__file__).resolve().parent.parent
TILE_ROOT = SCENE_ROOT / "source" / "tiles"
OUTPUT_PATH = SCENE_ROOT / "source" / "village-master.png"
CORE_MASTER_PATH = SCENE_ROOT / "source" / "core-village-master.png"

CORE_SIZE = (1672, 941)
MASTER_SIZE = (2412, 941)
TILE_WIDTH = 932
RIGHT_X = 740
TOP_HEIGHT = 542
BOTTOM_Y = 398
BOTTOM_HEIGHT = 543


def load_tile(name: str, size: tuple[int, int]) -> np.ndarray:
    image = Image.open(TILE_ROOT / f"{name}.png").convert("RGB")
    if image.size != size:
        image = image.resize(size, Image.Resampling.LANCZOS)
    return np.asarray(image, dtype=np.float32)


def save(array: np.ndarray, path: Path) -> None:
    Image.fromarray(np.clip(array, 0, 255).astype(np.uint8), "RGB").save(
        path,
        optimize=True,
    )


def smoothed_difference(first: np.ndarray, second: np.ndarray) -> np.ndarray:
    difference = np.mean(np.abs(first - second), axis=2)
    preview = Image.fromarray(np.clip(difference * 2.25, 0, 255).astype(np.uint8))
    preview = preview.filter(ImageFilter.GaussianBlur(radius=2.2))
    return np.asarray(preview, dtype=np.float32)


def minimum_vertical_seam(cost: np.ndarray, max_step: int = 3) -> np.ndarray:
    height, width = cost.shape
    cumulative = cost[0].copy()
    parents = np.zeros((height, width), dtype=np.int16)

    for row in range(1, height):
        candidates = []
        for offset in range(-max_step, max_step + 1):
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
        cumulative = cost[row] + np.take_along_axis(
            stack, choice[None, :], axis=0
        )[0]
        parents[row] = choice.astype(np.int16) - max_step

    seam = np.empty(height, dtype=np.int32)
    seam[-1] = int(np.argmin(cumulative))
    for row in range(height - 1, 0, -1):
        seam[row - 1] = np.clip(
            seam[row] - parents[row, seam[row]], 0, width - 1
        )
    return seam


def stitch_horizontal_pair(left: np.ndarray, right: np.ndarray) -> np.ndarray:
    overlap = TILE_WIDTH - RIGHT_X
    seam = minimum_vertical_seam(
        smoothed_difference(left[:, RIGHT_X:TILE_WIDTH], right[:, :overlap])
    )
    output = np.zeros((left.shape[0], CORE_SIZE[0], 3), dtype=np.float32)
    output[:, :TILE_WIDTH] = left
    output[:, RIGHT_X:] = right

    for row, local_seam in enumerate(seam):
        global_seam = RIGHT_X + int(local_seam)
        start = max(RIGHT_X, global_seam - 4)
        end = min(TILE_WIDTH, global_seam + 5)
        output[row, :start] = left[row, :start]
        output[row, end:] = right[row, end - RIGHT_X :]
        if end > start:
            alpha = np.linspace(0.0, 1.0, end - start, dtype=np.float32)[:, None]
            output[row, start:end] = (
                left[row, start:end] * (1.0 - alpha)
                + right[row, start - RIGHT_X : end - RIGHT_X] * alpha
            )
    return output


def stitch_vertical_pair(
    top: np.ndarray,
    bottom: np.ndarray,
    output_width: int,
) -> np.ndarray:
    overlap = TOP_HEIGHT - BOTTOM_Y
    seam = minimum_vertical_seam(
        smoothed_difference(top[BOTTOM_Y:TOP_HEIGHT], bottom[:overlap]).T
    ).astype(np.int32)
    output = np.zeros((CORE_SIZE[1], output_width, 3), dtype=np.float32)
    output[:TOP_HEIGHT] = top
    output[BOTTOM_Y:] = bottom

    for column, local_seam in enumerate(seam):
        global_seam = BOTTOM_Y + int(local_seam)
        start = max(BOTTOM_Y, global_seam - 4)
        end = min(TOP_HEIGHT, global_seam + 5)
        output[:start, column] = top[:start, column]
        output[end:, column] = bottom[end - BOTTOM_Y :, column]
        if end > start:
            alpha = np.linspace(0.0, 1.0, end - start, dtype=np.float32)[:, None]
            output[start:end, column] = (
                top[start:end, column] * (1.0 - alpha)
                + bottom[start - BOTTOM_Y : end - BOTTOM_Y, column] * alpha
            )
    return output


def stitch_west_to_core(west: np.ndarray, core: np.ndarray) -> np.ndarray:
    overlap = TILE_WIDTH - RIGHT_X
    cost = smoothed_difference(west[:, RIGHT_X:], core[:, :overlap])
    x = np.arange(overlap, dtype=np.float32)
    cost += (((x - (overlap - 1) / 2) / (overlap / 2)) ** 4 * 22)[None, :]
    seam = minimum_vertical_seam(cost)
    output = np.zeros((MASTER_SIZE[1], MASTER_SIZE[0], 3), dtype=np.float32)
    output[:, :TILE_WIDTH] = west
    output[:, RIGHT_X:] = core

    for row, local_seam in enumerate(seam):
        global_seam = RIGHT_X + int(local_seam)
        start = max(RIGHT_X, global_seam - 4)
        end = min(TILE_WIDTH, global_seam + 5)
        output[row, :start] = west[row, :start]
        output[row, end:] = core[row, end - RIGHT_X :]
        if end > start:
            alpha = np.linspace(0.0, 1.0, end - start, dtype=np.float32)[:, None]
            output[row, start:end] = (
                west[row, start:end] * (1.0 - alpha)
                + core[row, start - RIGHT_X : end - RIGHT_X] * alpha
            )
    return output


def connected_water_mask(image: np.ndarray) -> Image.Image:
    red, green, blue = np.moveaxis(image, 2, 0)
    candidate = (
        (blue > 67)
        & (blue > green * 1.08)
        & (blue > red * 1.35)
        & ((blue - green) > 10)
    )
    height, width = candidate.shape
    connected = np.zeros((height, width), dtype=bool)
    queue: deque[tuple[int, int]] = deque()
    for x in range(width):
        for y in (0, height - 1):
            if candidate[y, x] and not connected[y, x]:
                connected[y, x] = True
                queue.append((y, x))
    for y in range(height):
        for x in (0, width - 1):
            if candidate[y, x] and not connected[y, x]:
                connected[y, x] = True
                queue.append((y, x))
    while queue:
        y, x = queue.popleft()
        for next_y, next_x in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if (
                0 <= next_y < height
                and 0 <= next_x < width
                and candidate[next_y, next_x]
                and not connected[next_y, next_x]
            ):
                connected[next_y, next_x] = True
                queue.append((next_y, next_x))
    return Image.fromarray((connected * 255).astype(np.uint8), "L")


def quilt_port_water(
    reference: np.ndarray,
    reference_mask: Image.Image,
    size: tuple[int, int],
) -> np.ndarray:
    out_width, out_height = size
    patch_size = 96
    overlap = 24
    step = patch_size - overlap
    mask = np.asarray(reference_mask, dtype=np.float32) / 255.0
    patches: list[np.ndarray] = []
    for y in range(0, reference.shape[0] - patch_size + 1, 8):
        for x in range(0, reference.shape[1] - patch_size + 1, 8):
            if mask[y : y + patch_size, x : x + patch_size].mean() >= 0.985:
                patches.append(reference[y : y + patch_size, x : x + patch_size])
    if len(patches) < 12:
        raise RuntimeError(f"Only {len(patches)} clean port-water patches found")

    output = np.zeros((out_height, out_width, 3), dtype=np.float32)
    filled = np.zeros((out_height, out_width), dtype=bool)
    use_count = np.zeros(len(patches), dtype=np.float32)
    for y in range(0, out_height, step):
        for x in range(0, out_width, step):
            height = min(patch_size, out_height - y)
            width = min(patch_size, out_width - x)
            region_filled = filled[y : y + height, x : x + width]
            costs = np.empty(len(patches), dtype=np.float32)
            for index, patch in enumerate(patches):
                incoming = patch[:height, :width]
                if region_filled.any():
                    existing = output[y : y + height, x : x + width]
                    costs[index] = np.mean(
                        np.abs(existing[region_filled] - incoming[region_filled])
                    )
                else:
                    costs[index] = 0.0
                costs[index] += use_count[index] * 0.7
            chosen_index = int(np.argmin(costs))
            patch = patches[chosen_index][:height, :width]
            use_count[chosen_index] += 1

            take = np.ones((height, width), dtype=np.uint8) * 255
            if x > 0:
                left_width = min(overlap, width)
                seam = minimum_vertical_seam(
                    smoothed_difference(
                        output[y : y + height, x : x + left_width],
                        patch[:, :left_width],
                    )
                )
                for row, seam_x in enumerate(seam):
                    take[row, : int(seam_x)] = 0
            if y > 0:
                top_height = min(overlap, height)
                seam = minimum_vertical_seam(
                    smoothed_difference(
                        output[y : y + top_height, x : x + width],
                        patch[:top_height],
                    ).T
                )
                for column, seam_y in enumerate(seam):
                    take[: int(seam_y), column] = 0

            alpha = np.asarray(
                Image.fromarray(take, "L").filter(ImageFilter.GaussianBlur(0.65)),
                dtype=np.float32,
            )[..., None] / 255.0
            alpha[~region_filled] = 1.0
            region = output[y : y + height, x : x + width]
            output[y : y + height, x : x + width] = (
                region * (1 - alpha) + patch * alpha
            )
            filled[y : y + height, x : x + width] = True
    return output


def erode(mask: Image.Image, radius: int) -> Image.Image:
    return mask.filter(ImageFilter.MinFilter(radius * 2 + 1))


def apply_three_zone_water(
    base: np.ndarray,
    water_authority: np.ndarray,
    water_mask: Image.Image,
) -> np.ndarray:
    water = np.asarray(water_mask, dtype=np.float32) / 255.0
    e8 = np.asarray(erode(water_mask, 8), dtype=np.float32) / 255.0
    e16 = np.asarray(erode(water_mask, 16), dtype=np.float32) / 255.0
    e24 = np.asarray(erode(water_mask, 24), dtype=np.float32) / 255.0
    e32_image = erode(water_mask, 32)
    e32 = np.asarray(e32_image, dtype=np.float32) / 255.0

    ring0 = np.clip(water - e8, 0, 1)
    ring1 = np.clip(e8 - e16, 0, 1)
    ring2 = np.clip(e16 - e24, 0, 1)
    ring3 = np.clip(e24 - e32, 0, 1)
    apron = np.clip(ring0 + ring1 + ring2 + ring3, 0, 1)

    target_pixels = water_authority[e32 > 0.5]
    source_pixels = base[ring3 > 0.5]
    shift = (
        np.median(target_pixels, axis=0) - np.median(source_pixels, axis=0)
        if len(target_pixels) and len(source_pixels)
        else np.zeros(3, dtype=np.float32)
    )
    corrected = base + shift[None, None, :]
    corrected += ring0[..., None] * np.array([3, 13, 9], dtype=np.float32)
    corrected += ring1[..., None] * np.array([2, 9, 7], dtype=np.float32)
    corrected += ring2[..., None] * np.array([1, 5, 4], dtype=np.float32)
    corrected += ring3[..., None] * np.array([0, 2, 2], dtype=np.float32)

    output = base * (1 - apron[..., None]) + corrected * apron[..., None]
    deep_alpha = np.asarray(
        e32_image.filter(ImageFilter.GaussianBlur(radius=2.0)), dtype=np.float32
    )[..., None] / 255.0
    return output * (1 - deep_alpha) + water_authority * deep_alpha


def main() -> None:
    core_image = Image.open(CORE_MASTER_PATH).convert("RGB")
    if core_image.size != CORE_SIZE:
        raise ValueError(
            f"Core village master must remain {CORE_SIZE}, got {core_image.size}"
        )
    core = np.asarray(core_image, dtype=np.float32)

    west = stitch_vertical_pair(
        load_tile("north-west", (TILE_WIDTH, TOP_HEIGHT)),
        load_tile("south-west", (TILE_WIDTH, BOTTOM_HEIGHT)),
        TILE_WIDTH,
    )
    expanded = stitch_west_to_core(west, core)

    port = load_tile("bottom-left-lateen", (TILE_WIDTH, BOTTOM_HEIGHT))
    deep_water = quilt_port_water(
        port,
        connected_water_mask(port),
        (MASTER_SIZE[0], BOTTOM_HEIGHT),
    )
    water_authority = np.zeros_like(expanded)
    water_authority[BOTTOM_Y:] = deep_water
    expanded = apply_three_zone_water(
        expanded,
        water_authority,
        connected_water_mask(expanded),
    )
    save(expanded, OUTPUT_PATH)


if __name__ == "__main__":
    main()
