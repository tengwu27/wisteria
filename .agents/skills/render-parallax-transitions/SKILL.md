---
name: render-parallax-transitions
description: "Render deterministic time-driven parallax transition videos from registered depth plates. Use when foreground foliage parts to reveal a subject, near and far planes move at different speeds during an encoded shot, a vehicle must remain locked to its ground while the camera passes, or a timeline-driven reveal must coordinate with an independently rendered door or hinge transition. Do not use for pointer- or scroll-driven DOM parallax."
---

# Render Parallax Transitions

Render registered plates as one controlled shot without changing the approved
camera, geometry, or object ownership.

## Declare the shot

Record the master canvas, duration, frame rate, camera model, start and end
composition, and protected pixels. Distinguish object motion from camera-motion
illusion before assigning transforms.

- For horizontal-only motion, lock scale, y position, rotation, and camera.
  Do not add zoom, push-in, bob, or breathing.
- Keep objects that must appear rigidly connected on one transform. A parked
  vehicle, its contact shadow, and its supporting ground must not slide against
  one another.
- Use parallax only between intentionally separated depth groups. Near groups
  travel farther than distant groups; a declared static sky remains fixed.
- Define the final reveal composition explicitly. When a foreground curtain
  should stop blocking the subject, move most of it outside the frame; roughly
  80% outside is a useful starting target, not a universal constant.

## Prepare registered plates

1. Use one geometry master and keep every plate registered to its canvas.
2. Assign whole objects and thin appendages to one owning group.
3. Reconstruct clean pixels behind removed foreground content. Regenerate a
   matching background when extraction would leave umbrellas, foliage,
   buildings, or other near-scene fragments.
4. Scale only the intended depth plate. If distant scenery must appear 30%
   smaller, render that plate at 70% while leaving the near scene unchanged.
5. Add coherent overscan after scaling. Prefer painted or reflected extensions
   that do not expose hard seams; never stretch edge pixels across the frame.
6. Make every translated foreground occluder a complete object with below-frame
   overscan. Do not stretch a clipped top edge into a fake body or let a
   partially generated seat, bush, or prop float into view.
7. Prefer independently authored clean RGBA or keyed foreground objects over
   broad crops from flattened artwork. If independently moving objects overlap
   in the source, author them separately or reconstruct their concealed pixels;
   splitting one combined flat plate produces holes and borrowed fragments.
8. Approve isolated checkerboard proofs for every moving occluder, then approve
   the still start and end composites before rendering.

Use `$create-aligned-cinematic-art` when a clean registered plate is missing.
Use `$build-layered-aperture-scenes` when any plate is viewed through glass or
an aperture. Use `$build-interactive-parallax-scenes` instead when movement is
driven by pointer focus or native scrolling rather than a fixed timeline.

## Render

- Drive a one-way reveal with one monotonic normalized progress function. Do
  not bounce unless reversal is physically intended. Choose easing by perceived
  speed, not only mathematical continuity: quintic smootherstep can compress
  too much travel into the middle of a short shot, while a gentle cosine or
  tuned cubic ease often reads more evenly.
- Preserve fractional translation and scale throughout raster compositing.
  Do not round every layer transform to whole master-canvas pixels; slow
  high-contrast motion will advance in uneven steps.
- Match delivery cadence to motion and resolution. For restrained full-HD
  lateral or scale motion, prefer 60 fps when 30 fps produces visible stepping.
  Keep 30 fps only after inspecting playback at delivery size. Higher cadence
  does not repair a discontinuous path or invalid ownership.
- Apply one transform per ownership group. Effects attached to an object,
  including contact shadows and localized light, inherit that group transform.
- Preserve exact layer order and alpha edges at every frame.
- Apply depth-of-field blur only to the plate that owns the distant content,
  before its transform. Keep rigid near groups such as a vehicle, its ground,
  contact shadow, door, fence, and nearby architecture sharp; never blur a
  flattened composite to simulate distance.
- Enforce edge coverage for every rendered frame. When a full-canvas
  foreground plate touches a viewport boundary, its outer plate edge must
  remain on or beyond that boundary by a declared safety margin after the
  current scale and translation are applied. Clamp the transform to available
  overscan; do not rely on alpha content to hide a rectangular plate edge.
- Apply the same edge-coverage invariant to the reversed sequence. Reversing a
  timeline does not repair an invalid forward transform.
- When a hinged leaf is present, render it in registered master coordinates and
  apply the same parent translation as its owning body. Do not flatten the leaf
  into a parallax plate or add a second camera transform.

Use `$render-hinged-cinematic-transitions` for the leaf geometry itself. Use
`$render-ambient-cinematic-loops` only for periodic environmental motion, not
for the one-way reveal.

## Verify and deliver

Programmatically validate edge coverage on every frame, especially when scale
or easing changes nonlinearly. Inspect real-time playback and start, midpoint,
and end frames at delivery size. Confirm encoded frame rate, frame count, and
duration. Reject whole-pixel stepping, midpoint speed surges, relative slip
within a rigid group, unintended zoom, foreground remnants in far plates,
exposed borders, scale changes on the wrong layer, incomplete appendages, or
an end frame that still obscures the intended subject.

Render reversal from the same progress function and transforms. Require the
forward start to equal the reverse end and the forward end to equal the reverse
start at the decoded-frame level; a crossfade must not conceal a mismatched
handoff.

Deliver the registered plates, ownership manifest, transforms, approved endpoint
stills, encoded video, poster, and verification results under one versioned
asset contract.
