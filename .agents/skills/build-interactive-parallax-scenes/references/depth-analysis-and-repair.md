# Depth Analysis and Repair

## Analyze the flat composition

Lock one approved image as the geometry master. Record its canvas, camera,
crop, perspective, horizon, apertures, interaction targets, and protected
details.

Create a depth inventory from back to front:

1. sky or far environment
2. distant terrain, architecture, or water
3. independently moving subjects
4. structural room, vehicle, or village shell
5. separable near objects and their contact shadows
6. localized effects at the depth of their source or receiver

Assign every visible pixel to one owner. Include thin appendages, handles,
rigging, flagpoles, legs, trim, shadows, and reflections. Do not let two planes
contain the same object.

Define ownership by physical attachment and shared motion:

- walls, their window frames, fixed windows, doorsills, built-in counters, and
  attached cabinetry normally form one rigid structural shell
- content seen through glass or an opening becomes a separate plane only when
  the aperture edge is exact and the frame remains on the shell
- a foreground table includes its top, apron, visible legs, attached chair when
  treated as one grouping, every object resting on it, and its declared contact
  shadow
- a vehicle or motorcycle includes every visible mechanical appendage and open
  gap; it does not include the floor, wall, cabinet, or scenery around it

## Decide what to separate

Separate an object when:

- it is materially closer than its surroundings
- its complete silhouette can be generated or extracted
- the surface behind it can be plausibly reconstructed
- independent motion materially improves depth

Keep an object in the structural shell when:

- it is attached to a wall, floor, dashboard, or connected assembly
- separating it would require speculative large-area reconstruction
- its motion would imply physical detachment
- its visual contribution is too small to justify another fragile plate

A central coffee table with recoverable rug and floor behind it is a strong
candidate. A bar structurally attached to wall cabinetry usually is not.

## Reconstruct concealed pixels

1. Generate a clean removal plate from the approved master.
2. Remove the entire object, its props, legs, contact shadow, and borrowed
   background pixels.
3. Reconstruct only the concealed receiving surfaces.
4. Composite the generated repair through a localized feathered mask.
5. Copy every pixel outside that mask from the approved master.
6. Restore aperture alpha from the approved master after compositing.

When several connected landmarks are wrong, regenerate the smallest coherent
plate rather than accumulating corrective overlays.

## Consume approved aperture plates

When the scene contains a window, doorway, windshield, or other exact opening,
apply `$build-layered-aperture-scenes` before assigning interactive motion. It
owns aperture completion, structural alpha, exterior scale and registration,
threshold continuity, multi-opening coherence, and zone seams.

This workflow must still confirm that the approved shell and exterior remain
valid after near objects are removed and at both interactive displacement
extremes. Never retain old exterior pixels in the shell to hide a registration
error.

## Isolate foreground objects

Use keyed generation when exact native alpha is unreliable. Require a uniform
key, complete below-frame extent, complete appendages, and no cast shadow unless
the shadow is intentionally part of the object group.

Image generation may preserve appearance while changing scale or position.
Treat a generated isolation as artwork material, then deterministically resize
and register it into the approved footprint. Use one shared geometry or matte
for aligned day/night variants.

Do not infer registration from a plausible-looking keyed image. Compare its
landmarks against the master. Reject or deterministically realign it if any
edge, center, scale, or internal landmark moved. Prefer deterministic
segmentation or a hand-reviewed matte. Unless a redraw is intentional, take the
final plate's RGB from the approved master, using generated output only for the
matte or concealed-surface repair.

Repaint transparent or reflective materials as self-contained illustrated
surfaces. Glass must not preserve bookshelf, rug, shoreline, or other pixels
borrowed from the old flattened background.

## Approve the neutral stack

Before interaction, composite every plate at zero displacement and compare it
with the approved master:

- preserve registration outside declared repair and effect regions
- preserve exact aperture alpha
- reject object ghosts, duplicated shadows, clipped legs, and matte fringes
- reject changed camera, crop, perspective, or protected geometry
- inspect both theme stacks independently

Neutral reconstruction is necessary but insufficient because overlapping bad
plates can cancel at zero displacement. Before approval, create these proofs:

1. **Isolation proof:** every transparent plane over light, dark, and
   checkerboard backgrounds at full resolution.
2. **Backplate proof:** the shell alone, showing the complete reconstructed
   receiving surface with no object ghosts, old shadows, or holes.
3. **Ownership proof:** a written include/exclude list for every plane.
4. **Displacement proof:** both maximum parallax directions, where borrowed
   background pixels and duplicated structures become visible.
5. **Aperture proof:** the shell with separable occluders removed, plus neutral
   and displaced composites showing complete openings, continuous thresholds,
   believable exterior scale, and no exposed registration-zone seams.

Fail the stack if a near-object plane contains unrelated architecture or
receiving-surface pixels, even when the final neutral composite appears
correct. Fail broad feathered region crops and difference mattes that were not
converted into and visually verified as semantic object silhouettes.
