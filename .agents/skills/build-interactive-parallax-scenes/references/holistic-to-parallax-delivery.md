# Holistic Artwork to Interactive Parallax

Use this workflow when an approved holistic illustration must become a
high-detail registered parallax page.

## 1. Freeze the holistic authority

Record the master canvas, crop, horizon, perspective, camera height, landmark
footprints, roads, contact surfaces, apertures, foreground occluders, and focal
point. The holistic image is the geometry and neutral-composition authority;
independently generated plates provide detail but do not redefine it.

Do not reuse a rejected semantic stack as a geometry source.

If important landmarks or terrain lack sufficient delivery-scale detail, use
`$create-aligned-cinematic-art`'s high-detail holistic refinement workflow
before semantic extraction. Freeze the accepted recomposed result as the new
geometry master. Overlapping detail tiles are authoring windows, not semantic
planes, and must never receive independent parallax motion.

## 2. Plan semantic ownership

Split by physical depth and rigid motion, not by convenient rectangles. A
permanent structure stays with its foundation, attached terrace, stairs,
retaining walls, connected road or courtyard, fixed lamps, and declared contact
edge. A foreground porch stays with its handrail, balusters, floor, columns,
and attached vines.

Write include/exclude ownership before generation. Middle layers must exclude
sky and clouds unless they explicitly own them.

## 3. Regenerate detail plates

Generate one coherent semantic assembly at a time, preferably at the complete
master canvas size. Require:

- complete structures and thin appendages
- foundations and receiving edges needed to sit on the terrain
- consistent camera and perspective
- removable chroma or reviewable alpha
- no unrelated scenery, sky, clouds, or neighboring objects

Inspect the actual source dimensions and alpha bounds. Never infer them from a
generator preset or preview.

## 4. Build receivers before registration

Create clean continuous receivers for areas exposed when layers move: sky,
ocean or water, terrain, floor, garden, road, and concealed structure.

Preserve texture scale. Do not vertically stretch a narrow ocean, floor, or
terrain strip to fill the canvas. Use a larger clean repair, seamless tiling at
native scale, deterministic reconstruction, or a newly generated receiver.

## 5. Register rigid assemblies

Use one uniform scale and translation for a rigid generated assembly. Never use
axis-specific scale or a nonlinear vertical warp to force multiple landmarks
onto mismatched anchors; it elongates cliffs, ports, buildings, and lower
details. If one uniform transform cannot reconcile the horizon, footprint, and
contact anchors, regenerate the plate with corrected perspective.

Record the final scale and translation in the scene contract.

## 6. Repair incomplete silhouettes locally

Generated semantic plates often end before a foreground occluder. Repair the
missing receiving surface on the plane that owns it.

1. Mark the full potentially visible region, including a safety margin behind
   the occluder.
2. Include every opening through which the receiver can appear: window panes,
   doorways, balusters, railings, chair legs, and gaps beneath furniture.
3. Copy from a pixel-registered accepted receiver or generate a localized clean
   repair.
4. Intersect the repair mask with the inverse of the accepted foreground alpha,
   so existing generated pixels are not overwritten.
5. Feather only the repair boundary, not the whole semantic assembly.

For a balcony or porch, inspect the entire span beneath the handrail—not only
the neighboring column or road edge. A small uncovered area will reveal water,
sky, or transparency through the balusters during parallax.

## 7. Require an offline composite approval gate

Before touching the live page, render at full master resolution:

- every semantic plane over a checkerboard
- every repaired receiver without its occluder
- the neutral composite
- critical crops at horizons, layer overlaps, contact edges, and apertures

Inspect for gaps, duplicated objects, borrowed background pixels, clipped
silhouettes, matte fringes, hard seams, perspective mismatch, and any apparent
stretching. Stop for approval of the neutral composite.

Do not use the flattened fallback as evidence that the interactive planes are
correct. The neutral composite and isolated-plane proofs are separate gates.

## 8. Promote exactly what was approved

Promotion must package the same in-memory or saved plates used to render the
approved proof. Do not rerun an older builder or a different registration path.

1. Add symmetric overscan exceeding maximum motion.
2. Save lossless registered authoring plates.
3. Encode optimized browser plates from those exact files.
4. Derive the flattened fallback from the same approved neutral composite.
5. Keep stable asset identifiers when the frontend contract is unchanged.

## 9. Add and validate motion

Only after promotion, assign monotonic depth motion: far planes move least,
near planes move most, and all reveal direction consistently. Keep ambient
motion nested under the owning parallax wrapper.

Verify the actual decoded layer stack in a browser:

- every critical plate has the expected natural dimensions
- the atomic ready state is active and fallback state is inactive
- the initial focal ratio is correct
- both horizontal exploration limits are reachable
- no foreground opening reveals an invalid receiver at either limit
- no plate edge, gap, stretch, hotspot drift, or console error appears

Run the project lint, build, and cinematic audit after visual verification.

## Failure signatures

- **Lower scene looks elongated:** nonlinear or axis-specific registration.
- **Water appears beneath a porch or railing:** incomplete owning-layer repair
  or a mask that did not cover the full occluder span.
- **Clouds move with terrain:** background pixels leaked into a middle plate.
- **Neutral looks correct but motion ghosts:** duplicated or borrowed pixels
  are hidden by overlap.
- **Fallback looks correct but live scene fails:** promoted plates differ from
  the approved composite or the browser exposed a partial bundle.
