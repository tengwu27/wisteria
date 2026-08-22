---
name: render-hinged-cinematic-transitions
description: "Render deterministic hinged-door, gate, hatch, panel, or cover transitions from registered closed and active plates. Use when the moving leaf must retain exact windows, handles, trim, markings, hinge geometry, shading, and perspective while opening toward an interior or active state."
---

# Render Hinged Cinematic Transitions

Animate rigid hinged motion deterministically instead of asking a video model to reinvent the structure frame by frame.

## Prepare registered inputs

Require closed and active plates with identical dimensions, camera, crop, and exterior pixels. Keep the complete leaf in the closed frame and remove it from the active plate. Prefer explicit full-canvas masks for irregular leaves and openings.

Use `$create-aligned-cinematic-art` first when the paired plates do not yet exist.

Before rendering, infer the physical hinge from hardware rather than the leaf
silhouette. When a car-door handle is on the rear edge, place the conventional
hinge on the opposite front edge. Do not mistake a slanted window frame for the
hinge axis: an upright vehicle door rotates mainly around a near-vertical world
axis, so its swing should foreshorten horizontally without pitching upward.
Keep the viewer-facing exterior artwork and handle visible while an outward
swing remains below edge-on; reveal the inner face only when the geometry
actually exposes it.

Treat the complete moving assembly as one rigid object. Preserve handles,
mirrors, trim, markings, seals, and thin attachments. When the leaf contains a
window, use separate exact opaque-leaf and glazing masks so background scenery
is not painted into the moving glass.

## Render

Use [scripts/render_hinged_transition.py](scripts/render_hinged_transition.py). Supply the leaf box, optional opening box and masks, hinge side, camera anchor, duration, and zoom.

```bash
python scripts/render_hinged_transition.py closed.png active.png door-open.mp4 \
  --door-box 760,452,914,713 \
  --opening-box 762,449,912,713 \
  --hinge right \
  --anchor 838,575 \
  --duration 3 \
  --poster door-open-poster.jpg
```

Install [scripts/requirements.txt](scripts/requirements.txt) in an isolated environment when Pillow or NumPy is unavailable. Ensure FFmpeg is installed or pass `--ffmpeg`.

Use zoom only when the shot contract explicitly calls for a push-in. For a
horizontal-only layered transition, lock the camera at 1× and apply the same
parent translation to the leaf, body, contact shadow, and supporting ground.
Let `$render-parallax-transitions` own that time-driven parallax contract, or
`$build-interactive-parallax-scenes` own it when the parent motion is
input-driven.

## Verify

Inspect registration overlays before rendering and start, midpoint, and final video frames afterward. Reject exterior jumps, detached handles or trim, incorrect hinge direction, leaf distortion, mask leaks, implausible shading, or a final pose that disappears too quickly.

Confirm H.264, dimensions, frame rate, duration, `yuv420p`, muted output, `faststart`, and the poster.
