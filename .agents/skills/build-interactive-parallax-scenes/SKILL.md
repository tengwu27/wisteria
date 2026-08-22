---
name: build-interactive-parallax-scenes
description: "Turn flat or partially layered artwork into a registered interactive depth scene with practical plate reconstruction, pointer-focus or scroll-linked parallax, layer-owned ambient effects, aligned hotspots, responsive exploration, and resilient frontend fallbacks. Use for villages, visual-novel interiors, landscapes, cockpits, rooms, or other 2D scenes that should feel spatial without becoming a pre-rendered parallax video."
---

# Build Interactive Parallax Scenes

Convert one approved composition into an input-driven multilayer scene while
preserving its camera, identity, and neutral appearance.

Read both core references completely before planning or editing:

- [references/depth-analysis-and-repair.md](references/depth-analysis-and-repair.md)
- [references/motion-effects-and-validation.md](references/motion-effects-and-validation.md)

When starting from an approved holistic illustration, replacing a rejected
semantic stack, or promoting artwork into a live page, also read
[references/holistic-to-parallax-delivery.md](references/holistic-to-parallax-delivery.md)
completely. It defines the composite-first approval and promotion gates.

## Establish the scene contract

Record the geometry master, canvas, protected pixels, apertures, neutral focal
point, themes, interaction targets, intended input modes, and fallback media.
Use `$create-aligned-cinematic-art` when matching theme or repair plates are
missing. If the scene contains a window, doorway, windshield, or other exact
opening, use `$build-layered-aperture-scenes` first and consume its approved
cutout, registered exterior, and aperture proof without redefining them here.

Do not begin motion or update the live page until both the ownership proof and
offline neutral registered composite are approved. A correct neutral composite
alone does not prove that its layers are valid. Promote the exact approved
plates and fallback; never silently rebuild them through a different algorithm.

## Analyze and rebuild depth

1. Inventory visible objects, surfaces, occlusions, apertures, and likely motion.
2. Group pixels by physical depth and rigid ownership, not by convenient crop.
3. Select separable near objects whose complete silhouettes can be recovered
   and whose concealed background can be plausibly reconstructed.
4. Rebuild the smallest clean backplate behind each removed object.
5. Restrict generated changes to declared repair masks and restore structural
   alpha from the approved master.
6. Register every plate to the immutable canvas and write an ownership manifest.

Prefer a few convincing planes over many fragile cutouts. Keep wall-attached
furniture and connected architecture together unless their hidden geometry is
fully recoverable.

## Pass the semantic-ownership gate

Treat this as blocking:

1. Render every isolated plane alone over a contrasting checkerboard.
2. Render every repaired backplate alone without the removed object.
3. Confirm that each near plane contains one complete physical object or rigid
   assembly, including its attached props, thin appendages, and declared
   contact shadow.
4. Reject any unrelated floor, wall, window, door, counter, cabinet, scenery,
   or neighboring-object pixels in that plane.
5. Keep windows, frames, walls, attached workbenches, counters, and connected
   architecture on one rigid shell. Treat an approved aperture matte as shell
   geometry, not as an independently moving window plane.
6. Require the aperture workflow's proof whenever an opening is present. Do
   not accept a stack that lacks complete-opening, threshold-continuity, and
   maximum-displacement evidence.
7. Inspect displaced extremes; neutral overlap can hide duplicated pixels,
   background fragments, incomplete repair, and invalid ownership.

Broad polygons, soft regional crops, and unreviewed difference mattes are not
object extraction. Generated isolation art may guide a mask, but reject it if
scale, position, silhouette, or internal geometry drift. Unless the user
approves a redraw, copy final foreground RGB from the geometry master through
an accepted matte and reuse that matte across aligned themes.

## Assign interactive motion

- Move all planes in the same signed direction; move nearer planes farther.
- For pointer focus, pointer-left moves artwork right to reveal the left side.
- Keep the camera axis locked unless the user explicitly requests another axis.
- Make overscan exceed the largest visible displacement.
- Put each ambient animation inside a child wrapper so it cannot overwrite its
  parent parallax transform.
- Transform hotspots with the plane that owns the depicted object.

Use measured overflow rather than a device breakpoint. Without overflow, use
damped fine-pointer focus and recenter on exit. With overflow, let native
horizontal scroll drive the same normalized depth signal; preserve the focal
ratio across resize and orientation changes.

Use `$render-parallax-transitions` only when the deliverable also includes a
time-driven encoded reveal. It does not own interactive DOM motion.

## Anchor auxiliary effects

Assign every effect to one owning source or receiving surface. Derive anchors
from the registered artwork, not viewport pixels:

- steam begins at the vessel opening, broadens, curls, and moves with the vessel
- glare and practical light remain localized to their source and receiver
- reflections move with water or glass, not with unrelated foreground
- rocking subjects use a believable contact or waterline pivot
- clouds preserve physical occlusion order around moons, buildings, and frames

Use `$render-ambient-cinematic-loops` for rendered periodic assets and physical
motion contracts. Implement browser-native effects through
`$integrate-cinematic-web-media` when they must respond with their DOM plane.

## Integrate atomically

Load the initial theme bundle as one unit and reveal it only after all critical
plates decode. Lazy-load inactive themes. On failure or timeout, reveal one
matching flattened fallback and disable depth rather than showing a partial
stack.

Suspend tracking during arrivals, exits, theme loading, hidden-document state,
and reduced motion. Reset transforms, timers, and media during client
navigation and history restoration.

## Validate and deliver

Use the project's registered-stack validator when one exists; otherwise render
deterministic neutral, pointer-left, and pointer-right composites at delivery
size. Do not cite validation scripts that are absent from the project or skill.

Require exact aperture alpha, complete silhouettes, clean repairs, correct
effect ownership, reachable responsive bounds, aligned hotspots, zero vertical
camera drift when horizontal-only, and no exposed plate edges.

Also deliver isolated-plane and backplate proof images. Do not report success
when a stack passes dimension or neutral-composite checks but fails semantic
ownership.

Keep only active registered plates, source repairs, manifests, scripts, and
approved fallback media. Remove trial generations and disposable verification
outputs after acceptance.
