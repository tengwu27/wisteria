---
name: render-ambient-cinematic-loops
description: "Turn approved static or layered artwork into subtle ambient video loops without structural drift. Use for clouds, boats, water, steam, smoke, flags, vegetation, propellers, vehicles, light flicker, or other restrained environmental motion while architecture, windows, horizons, and the camera remain stable."
---

# Render Ambient Cinematic Loops

Animate only plausible moving regions and preserve every locked structural pixel.

## Define the motion contract

For each moving subject, record its owning layer, depth, motion primitive,
amplitude or travel, duration or period, phase, easing, and delivery type.
Record direction and speed ratio only for translation.

If the scene is viewed through glass or an aperture, use
`$build-layered-aperture-scenes` first and composite through its approved exact
cutout.

Use `$render-parallax-transitions` instead when the primary motion is a
time-driven scene-entry reveal or coordinated encoded parallax. Use
`$build-interactive-parallax-scenes` when the same depth plates must respond to
pointer focus or scrolling.

Choose one loop model:

- Use a one-way monotonic clip when the endpoint may differ from the start.
- Prefer periodic rocking, bobbing, pulsing, flicker, or shimmer for seamless
  ambient loops when displacement is unnecessary.
- Use wrapped translation or a deliberate seam dissolve when translation must
  loop.
- Use ping-pong only when reversal is physically plausible or explicitly
  requested.

Never label a positional reset as seamless or mix contradictory one-way and
bouncing behavior.

## Render

- Prefer independent RGBA plates or deterministic procedural effects.
- Keep the camera, foreground, architecture, horizon, and static scenery fixed.
- Use floating-point transforms with bicubic or better resampling; never rely on
  integer-pixel stepping.
- Share one normalized phase or progress function only when multiple effects
  must remain synchronized.
- Overscan translated plates so no empty edge enters the visible aperture.
- Place localized effects at the correct depth rather than drawing every effect last.
- Avoid global warping, breathing structures, moving masks, artificial shoreline bands, and causeless shadow motion.
- Construct seamless motion from a periodic phase so every animated property
  returns to its initial value at the loop boundary. For deterministic loops,
  render the final verification sample at the same phase as the first.
- Couple localized lighting effects to their source: keep moon glints beneath
  the moon, lighthouse glow at the lamp, and reflected light on the receiving
  surface. Preserve the scene's depth order when compositing them.

## Deliver and verify

Review the loop at actual display size and inspect start, adjacent, midpoint,
and end frames. Require zero pixel difference in protected static regions
outside intentional effects. For deterministic periodic loops, require
pixel-identical uncompressed verification endpoints. Check declared motion
parameters, edge coverage, thin-feature completeness, and the loop boundary.
Watch several consecutive rollovers because encoding or playback timing can
still reveal a closed seam.

Default to H.264 MP4, 1920×1080, 30 fps, `yuv420p`, muted playback, `faststart`, and a matching poster unless the consuming application specifies another contract.
