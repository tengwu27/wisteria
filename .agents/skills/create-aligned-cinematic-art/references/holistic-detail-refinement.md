# High-Detail Holistic Scene Refinement

Use this workflow when a village, landscape, or interior composition is
approved but important structures or terrain lack pixel detail. The approved
holistic image remains the geometry authority.

## 1. Freeze composition before detail

Record the master dimensions, camera, projection, crop, horizon, roads,
waterlines, structure footprints, contact edges, silhouettes, and protected
landmarks. Do not ask a whole-scene generation to rediscover these decisions.

Keep the previous approved master. A detail pass is accepted only when it
improves local resolution without weakening composition or landmark identity.

Every generative unit must be derived directly from this immutable master.
That unit may be one tile or a complete continuity band. Never use an already
refined tile, generated band, stitched row, or completed composite as the next
generative input; recursive generation causes cumulative texture drift and
detail erosion.

## 2. Allocate pixels deliberately

Whole-scene generation distributes a finite pixel budget across every object.
Use two complementary passes:

1. Refine priority landmarks with enlarged contextual crops when their identity
   or architecture matters more than surrounding terrain.
2. Refine the remaining scene through an overlapping grid, commonly `2×2` for
   a 16:9 panorama. Increase the grid only when each tile still contains enough
   context to preserve perspective and circulation.

Place split lines away from major façades, thin appendages, text, faces,
waterlines, and critical road junctions when practical. A grid is an authoring
device, never a semantic depth partition.

## 3. Slice with overlap

Give every internal edge approximately `8–12%` overlap, or at least `64–128`
master pixels for a large panorama. Record each tile's exact master-space box.

Overlap must include complete contextual anchors: adjoining roads, retaining
walls, rooflines, terrain shelves, horizon segments, and receiving vegetation.
Never refine four exact butt-jointed rectangles.

Use `scripts/refine_grid.py slice` to create registered crops and a manifest
when the project has no equivalent authoring tool. Run it with an imaging
Python that provides Pillow and NumPy; in Codex desktop, load the bundled
workspace dependencies and use the returned Python executable.

## 3A. Promote rigid continuity bands above individual tiles

Before refining sibling tiles, trace the geometry that crosses every proposed
split. Treat a row or column as one continuity band when a rigid or visually
continuous feature spans multiple children, including:

- columns, window mullions, arches, cornices, balcony rails, and shelves
- roads, bridges, retaining walls, horizons, shorelines, and waterlines
- long counters, carpets, floor patterns, pipes, and other shared axes

The fact that sibling source crops share the same master-space origin is not
enough. Separate ImageGen calls may translate, rescale, or non-rigidly redraw
the same feature differently, so two individually plausible tiles can never
join cleanly.

For a continuity band:

1. Crop the complete band directly from the immutable master with sufficient
   context on both orthogonal edges.
2. Refine that whole band in one generation call.
3. Register it with one uniform cover crop and one band-level translation.
4. Verify at least three distributed anchors across the band, such as
   left/center/right or top/center/bottom.
5. Derive its child tiles deterministically from the registered band. Do not
   apply independent child offsets or resample the children separately.

Use independent tile generation only when the shared boundary crosses
low-salience organic material and no rigid feature or continuous environmental
line needs to agree across it.

## 4. Refine one tile at a time

Inspect every source crop before generation. Use the crop as the edit target,
not merely a style reference. State these invariants in every prompt:

- exact framing, aspect, camera, projection, and crop-edge content
- unchanged landmark silhouettes, footprints, scale, and orientation
- unchanged roads, thresholds, waterlines, contact edges, and occlusion
- increased material, architectural, vegetation, prop, and inhabitant detail
- no zoom, shift, stretch, structural redesign, or unrelated additions

Give each tile a local detail priority. For example, ask a castle tile for
masonry, parapets, roofs, windows, stairs, and courtyards; ask a harbor tile for
docks, ropes, posts, boat completeness, water contact, and bridge masonry.
Generic "make it detailed" prompts are insufficient.

## 5. Register without distortion

Inspect the generated file's natural dimensions. Prefer a generator-supported
tile aspect from the start. If output aspect differs, use a uniform cover crop
back to the registered tile box and verify anchors; never use independent X/Y
scaling to force a fit.

Reject and regenerate a tile when uniform registration cannot reconcile at
least three distributed anchors or when a protected landmark changes identity.
Do not hide geometry drift with a wide blend.

## 6. Recompose through content-aware seams

Find the join inside each overlap, favoring low-difference, low-salience areas
such as foliage, rock, soil, or quiet water. Protect façades, roads, rails,
rooflines, waterlines, and thin structures from seam placement.

When a continuity band meets an orthogonal row or column, assign explicit
pixel ownership through the overlap. Let the band own every protected rigid
feature from one stable contour to the next; route the content-aware seam
around those ownership ranges. Do not alternate ownership halfway through a
column, mullion, rail, road edge, or other continuous feature.

Use a narrow `2–6px` feather around the accepted seam. Broad crossfades create
double windows, ghosted roads, soft masonry, and duplicated foliage. Never
blend the entire overlap by default.

Use the same imaging Python with `scripts/refine_grid.py stitch` for a
content-aware baseline. Supply a global protection mask when the automatic seam
could cross important geometry.

## 7. Pass the detail-composite gate

Review the recomposed master at full resolution and at delivery size. Inspect:

- every internal seam and the central grid intersection
- sibling continuity inside every generated band and the orthogonal handoff
  from that band to neighboring rows or columns
- landmark silhouettes, rooflines, windows, blades, masts, rails, and lamps
- road, bridge, stair, wall, cliff, horizon, and waterline continuity
- material scale, color balance, line weight, and noise consistency
- edge coverage and the absence of stretch, blur, ghosts, or duplicated objects

Compare priority crops against both the coarse master and refined tiles. If one
tile is stronger but cannot register cleanly, keep the old pixels until a
corrected tile is approved.

## 8. Promote the refined master

Save the final lossless composite, tile manifest, accepted refined tiles,
prompts, protection masks, and stitch settings. Remove rejected variants after
approval.

For every continuity band, preserve its source crop, accepted generated band,
band-level registration transform, deterministically derived children,
protected ownership ranges, and full-resolution seam proof.

The refined holistic composite becomes the new geometry master. Only then
begin semantic layer extraction, receiver repair, parallax calibration, theme
variants, or delivery encoding. Do not treat grid tiles as parallax planes.

If a later correction is local, apply the localized-repair workflow to this
approved master. Do not run the entire refined composite through ImageGen again.
