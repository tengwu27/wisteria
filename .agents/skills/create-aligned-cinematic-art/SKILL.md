---
name: create-aligned-cinematic-art
description: "Create or refine geometry-registered cinematic artwork from an approved illustration. Use for high-detail holistic panoramas, tiled detail enhancement, day/night or seasonal repaints, lighting variants, closed/open states, active/inactive apertures, interior reveals, and other artwork that must preserve camera, crop, silhouettes, coordinates, and identifying details."
---

# Create Aligned Cinematic Art

Derive every variant from one approved geometry master and preserve registration across the complete asset family.

## Lock invariants

Record resolution, aspect ratio, camera, crop, perspective, silhouettes, interaction coordinates, aperture geometry, and protected identifying details. Never independently reinvent continuity-sensitive frames.

Read [references/prompt-patterns.md](references/prompt-patterns.md) completely before generating theme art or matching interaction plates.

When a requested change is confined to part of an approved image, read
[references/localized-repair.md](references/localized-repair.md) completely
before generating. The immutable-master repair contract in that reference
takes priority over any older instruction to edit or reuse the latest generated
composite.

When a holistic scene lacks sufficient landmark or terrain detail, read
[references/holistic-detail-refinement.md](references/holistic-detail-refinement.md)
completely before generating crops. Refine the approved holistic master before
extracting semantic parallax plates.

## Workflow

1. Inspect all source and style references and assign each a precise role.
2. Freeze the approved holistic image. For a localized correction, generate a
   registered donor patch, composite it once through a contour-following mask,
   and keep every protected pixel from the immutable master.
3. When resolution is uneven, refine protected landmarks and overlapping scene
   tiles without changing the master composition. Before generating sibling
   tiles, identify rigid continuity bands. If columns, mullions, cornices,
   rails, roads, bridges, horizons, or waterlines cross their shared boundary,
   refine the complete band once from the immutable master and derive the
   child tiles by registered cropping; never generate those siblings
   independently.
4. For a lighting variant, define sources, occluders, receiving surfaces, and
   practical lights before repainting.
5. Repaint theme variants as genuine illustrations, not color filters, while
   preserving geometry.
6. Create matching active or interior plates by changing only the declared
   interaction aperture.
7. Preserve the complete closed leaf in the inactive frame. Exclude it from the
   active plate when a deterministic renderer will add and animate it.
8. When separating depth plates, reconstruct clean background pixels behind
   removed foreground objects. Do not leave borrowed fragments from umbrellas,
   foliage, vehicles, architecture, or other neighboring planes.
9. Compare registration overlays, mask proofs, and difference images before accepting the
   pair.
10. Save versioned source art, prompts, approved keyframes, and registration
   notes.

Reject camera shifts, crop changes, silhouette drift, moved targets, flat
lighting overlays, new objects, changes outside the requested aperture,
stippled or peppered texture, false halftone noise, broad blend softness, and
silent color-space or pixel-format changes.

Hand approved static artwork to `$render-parallax-transitions` for encoded
parallax reveals, `$build-interactive-parallax-scenes` for input-driven depth,
`$render-ambient-cinematic-loops` for environmental motion, or
`$render-hinged-cinematic-transitions` for mechanical opening motion.
