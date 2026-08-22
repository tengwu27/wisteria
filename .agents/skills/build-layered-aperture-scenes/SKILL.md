---
name: build-layered-aperture-scenes
description: "Build exact transparent or active apertures as registered multilayer composites. Use when scenery, animation, or replacement content must appear behind a window, porthole, windshield, glass door, arch, hatch opening, or similar framed opening while its physical foreground assembly remains fixed."
---

# Build Layered Aperture Scenes

Create a reusable foreground cutout and a registered stack of independently owned depth and motion plates.

## Preserve the foreground contract

Choose one approved artwork as the geometry master. Keep its canvas, camera, crop, frame, mullions, trim, and foreground objects unchanged.

Read [references/transparent-window-layering.md](references/transparent-window-layering.md) completely before extracting an aperture, generating plates, registering layers, or animating scenery behind glass.

## Workflow

1. Create the exact alpha cutout from the approved foreground.
2. Define depth, whole-object ownership, occlusion, and intended motion in a
   layer manifest.
3. Generate and register isolated plates against the unchanged master.
4. Approve the still composite and cutout edges.
5. Remove separately owned occluders and prove that the complete physical
   aperture still exists behind them with no retained old scenery.
6. Approve exterior scale, horizon, landmarks, and threshold continuity through
   the actual opening at neutral and maximum displacement.
7. Preserve the registered stack for downstream motion rendering.
8. Validate the complete plate contract using the reference standard.

Use the image-generation skill for painted or keyed raster plates. After the
registered stack is approved, use `$render-ambient-cinematic-loops` for periodic
environmental motion, `$render-parallax-transitions` for a one-way encoded
reveal, or `$build-interactive-parallax-scenes` for input-driven depth.
