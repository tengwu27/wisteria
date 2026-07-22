import math
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter


CLOSED, INTERIOR, OUT, OUTER_MASK, WINDOW_MASK, OPENING_MASK = map(Path, sys.argv[1:7])

closed = Image.open(CLOSED).convert("RGBA")
interior = Image.open(INTERIOR).convert("RGBA")
if closed.size != interior.size:
    raise SystemExit("Closed and interior images must have identical dimensions")

width, height = closed.size
output_size = (1920, 1080)
fps = 30
frame_count = 90
duration = frame_count / fps

# Four corners of the rigid door plane: rear-top, hinge-top, hinge-bottom,
# rear-bottom. The hinge follows the real slanted front edge of the car door.
source_quad = np.asarray(
    [(558.0, 278.0, 0.0), (888.0, 278.0, 0.0),
     (949.0, 655.0, 0.0), (565.0, 634.0, 0.0)],
    dtype=float,
)
hinge_top = source_quad[1].copy()
hinge_bottom = source_quad[2].copy()
hinge_axis = hinge_bottom - hinge_top
hinge_axis /= np.linalg.norm(hinge_axis)

# Door thickness is modeled behind the painted exterior skin. The camera sits
# on the driver's side, so the free edge moves toward the camera as it opens.
door_thickness = 9.0
camera_center = np.asarray((760.0, 485.0), dtype=float)
focal_distance = 3600.0
camera_anchor = np.asarray((760.0, 485.0), dtype=float)

outer_mask = Image.open(OUTER_MASK).convert("L")
window_mask = Image.open(WINDOW_MASK).convert("L")
opening_mask = Image.open(OPENING_MASK).convert("L")
for mask_path, mask in (
    (OUTER_MASK, outer_mask), (WINDOW_MASK, window_mask), (OPENING_MASK, opening_mask)
):
    if mask.size != closed.size:
        raise SystemExit(f"Mask {mask_path} must match source dimensions")

background = Image.composite(interior, closed, opening_mask)

outer_texture = closed.copy()
outer_texture.putalpha(outer_mask)

glass_texture = Image.new("RGBA", closed.size, (31, 66, 72, 0))
glass_texture.putalpha(window_mask)

# A distinct inner door panel is rendered on the reverse face. It is not a
# mirrored exterior texture: it has its own upholstery, pull handle and pocket.
inner_texture = Image.new("RGBA", closed.size, (0, 0, 0, 0))
inner_draw = ImageDraw.Draw(inner_texture)
inner_leaf = [(558, 278), (888, 278), (949, 655), (565, 634)]
inner_window = [(691, 293), (869, 293), (928, 423), (692, 418)]
inner_draw.polygon(inner_leaf, fill=(35, 79, 73, 255))
inner_draw.polygon(inner_window, fill=(0, 0, 0, 0))
inner_draw.polygon(
    [(588, 438), (923, 446), (926, 612), (582, 605)],
    fill=(29, 68, 63, 255),
    outline=(145, 132, 91, 220),
    width=4,
)
inner_draw.line([(617, 486), (865, 488)], fill=(67, 111, 98, 255), width=7)
inner_draw.rounded_rectangle(
    (809, 468, 872, 487), radius=8, fill=(171, 145, 88, 255),
    outline=(35, 38, 31, 230), width=3,
)
inner_draw.rounded_rectangle(
    (650, 535, 868, 584), radius=18, fill=(25, 60, 56, 255),
    outline=(76, 112, 96, 230), width=3,
)
inner_texture = inner_texture.filter(ImageFilter.GaussianBlur(0.35))

window_quad = np.asarray(
    [(691.0, 293.0, 0.0), (869.0, 293.0, 0.0),
     (928.0, 423.0, 0.0), (692.0, 418.0, 0.0)],
    dtype=float,
)


def smoothstep(value: float) -> float:
    value = max(0.0, min(1.0, value))
    return value * value * (3.0 - 2.0 * value)


def rotate_about_hinge(points: np.ndarray, angle: float, depth: float = 0.0) -> np.ndarray:
    points_3d = points.copy()
    points_3d[:, 2] += depth
    relative = points_3d - hinge_top
    axis = hinge_axis
    cosine = math.cos(angle)
    sine = math.sin(angle)
    rotated = (
        relative * cosine
        + np.cross(axis, relative) * sine
        + axis * np.sum(relative * axis, axis=1, keepdims=True) * (1.0 - cosine)
    )
    return rotated + hinge_top


def project(points: np.ndarray) -> np.ndarray:
    scale = focal_distance / (focal_distance + points[:, 2])
    projected = np.empty((len(points), 2), dtype=float)
    projected[:, 0] = camera_center[0] + (points[:, 0] - camera_center[0]) * scale
    projected[:, 1] = camera_center[1] + (points[:, 1] - camera_center[1]) * scale
    return projected


def homography(source: np.ndarray, destination: np.ndarray) -> tuple[float, ...]:
    matrix_rows = []
    results = []
    for (x, y), (u, v) in zip(source, destination):
        matrix_rows.append([x, y, 1, 0, 0, 0, -u * x, -u * y])
        results.append(u)
        matrix_rows.append([0, 0, 0, x, y, 1, -v * x, -v * y])
        results.append(v)
    solved = np.linalg.solve(np.asarray(matrix_rows, float), np.asarray(results, float))
    forward = np.asarray(
        [[solved[0], solved[1], solved[2]],
         [solved[3], solved[4], solved[5]],
         [solved[6], solved[7], 1.0]],
        dtype=float,
    )
    inverse = np.linalg.inv(forward)
    inverse /= inverse[2, 2]
    return tuple(inverse.flatten()[:8])


def transform_layer(
    layer: Image.Image,
    source: np.ndarray,
    destination: np.ndarray,
) -> Image.Image:
    coefficients = homography(source[:, :2], destination)
    return layer.transform(
        closed.size,
        Image.Transform.PERSPECTIVE,
        coefficients,
        resample=Image.Resampling.BICUBIC,
        fillcolor=(0, 0, 0, 0),
    )


def scale_alpha(layer: Image.Image, factor: float) -> Image.Image:
    result = layer.copy()
    alpha = result.getchannel("A").point(lambda value: round(value * factor))
    result.putalpha(alpha)
    return result


ffmpeg = shutil.which("ffmpeg")
if not ffmpeg:
    raise SystemExit("FFmpeg is required")

Path(OUT).parent.mkdir(parents=True, exist_ok=True)
command = [
    ffmpeg, "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
    "-s", f"{output_size[0]}x{output_size[1]}", "-r", str(fps),
    "-i", "-", "-an", "-c:v", "libx264", "-preset", "slow",
    "-crf", "17", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(OUT),
]
process = subprocess.Popen(command, stdin=subprocess.PIPE)
if process.stdin is None:
    raise SystemExit("Could not open FFmpeg input pipe")

for frame in range(frame_count):
    normalized = frame / (frame_count - 1)
    travel = smoothstep(normalized)
    door_progress = smoothstep((normalized - 0.11) / 0.76)
    # Negative rotation brings the free/rear edge toward the driver's-side camera.
    angle = math.radians(-69.0 * door_progress)

    outer_3d = rotate_about_hinge(source_quad, angle, depth=0.0)
    inner_3d = rotate_about_hinge(source_quad, angle, depth=door_thickness)
    outer_destination = project(outer_3d)
    inner_destination = project(inner_3d)

    scene = background.copy()

    # A door-shaped shadow moves independently from the rigid object.
    shadow = Image.new("RGBA", closed.size, (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_points = [(float(x + 14), float(y + 12)) for x, y in outer_destination]
    shadow_draw.polygon(shadow_points, fill=(10, 19, 17, round(54 * math.sin(abs(angle)))))
    scene.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(14)))

    visibility = math.sin(abs(angle))
    transformed_inner = transform_layer(inner_texture, source_quad, inner_destination)
    scene.alpha_composite(scale_alpha(transformed_inner, visibility))

    # Render the physical thickness of all four door edges.
    edge_layer = Image.new("RGBA", closed.size, (0, 0, 0, 0))
    edge_draw = ImageDraw.Draw(edge_layer)
    edge_colors = [
        (103, 126, 104, round(170 * visibility)),
        (48, 77, 69, round(185 * visibility)),
        (56, 87, 76, round(185 * visibility)),
        (39, 67, 61, round(195 * visibility)),
    ]
    for index in range(4):
        next_index = (index + 1) % 4
        polygon = [
            tuple(outer_destination[index]),
            tuple(outer_destination[next_index]),
            tuple(inner_destination[next_index]),
            tuple(inner_destination[index]),
        ]
        edge_draw.polygon(polygon, fill=edge_colors[index])

    # Add depth to the separate metal window frame around the transparent glass.
    window_outer = project(rotate_about_hinge(window_quad, angle, depth=0.0))
    window_inner = project(rotate_about_hinge(window_quad, angle, depth=door_thickness))
    for index in range(4):
        next_index = (index + 1) % 4
        edge_draw.polygon(
            [tuple(window_outer[index]), tuple(window_outer[next_index]),
             tuple(window_inner[next_index]), tuple(window_inner[index])],
            fill=(77, 103, 84, round(185 * visibility)),
        )
    scene.alpha_composite(edge_layer.filter(ImageFilter.GaussianBlur(0.45)))

    shade = 1.0 - 0.17 * math.sin(abs(angle))
    shaded_outer = ImageEnhance.Brightness(outer_texture).enhance(shade)
    transformed_outer = transform_layer(shaded_outer, source_quad, outer_destination)
    transformed_glass = transform_layer(glass_texture, window_quad, window_outer)
    scene.alpha_composite(transformed_outer)
    scene.alpha_composite(transformed_glass)

    # Human-height walk toward the door, independent of the rigid hinge motion.
    zoom = 1.0 + 0.22 * travel
    crop_width = width / zoom
    crop_height = height / zoom
    initial_screen_x = camera_anchor[0] / width
    initial_screen_y = camera_anchor[1] / height
    screen_x = initial_screen_x * (1.0 - travel) + 0.5 * travel
    screen_y = initial_screen_y * (1.0 - travel) + 0.53 * travel
    bob = 1.35 * math.sin(2.0 * math.pi * 1.1 * (frame / fps)) * math.sin(math.pi * normalized)
    left = camera_anchor[0] - screen_x * crop_width
    top = camera_anchor[1] - screen_y * crop_height + bob
    output = scene.convert("RGB").transform(
        output_size,
        Image.Transform.EXTENT,
        (left, top, left + crop_width, top + crop_height),
        resample=Image.Resampling.BICUBIC,
    )
    process.stdin.write(output.tobytes())

process.stdin.close()
if process.wait() != 0:
    raise SystemExit("Encoding failed")

print(f"Rendered {OUT} ({duration:.1f}s, {fps}fps)")
