# Modular World Assets

This directory is the single source of truth for versioned world packages and
the lossless runtime layers imported by Astro. Keep each package's geometry
contract beside its production assets; do not maintain a second authoring copy.

## Shared standard

- Use lossless RGBA PNGs with transparent backgrounds.
- Keep a consistent cozy, retro-modern isometric viewpoint.
- Export every layer in a package on one canonical canvas with one declared
  native facing.
- Static shells own permanent structure, openings, casing, thresholds, hinges,
  brackets, and mounting details.
- Doors, windows, lamps, rotors, flags, wheels, and other moving or stateful
  parts remain separate layers.
- Mirror the assembled object at its root when its world-facing direction
  differs from its native direction. Never compensate with per-layer offsets.

## Geometry and motion

- A socket records its fit mask, pivot or hinge line, motion envelope, states,
  and layer order in the package contract.
- Closed components fit their aperture within a one-pixel antialiasing
  tolerance. Open states may leave the aperture only within their motion
  envelope.
- Pure rotation or translation uses one canonical asset plus a runtime
  transform. Do not paint duplicate frames for rotors, wheels, or clock hands.
- Author separate endpoints only when silhouette, perspective, occlusion, or
  visible state changes, such as open/closed doors or an on/off lamp lens.
- Moving hardware on the same illustrated plane is translation only: preserve
  its original pixels, lighting, projection, scale, and orientation.

## Physical depth

- `behind-aperture`: render the interior and moving component, then the shell;
  the shell opening conceals edge seams.
- `foreground-mounted`: render the shell first, then the complete component at
  its socket.
- `sandwiched`: split by physical depth, such as turbine mast, rotating rotor,
  then fixed hub.

## Integration gates

1. Validate one component in the isolated asset lab at 100% and 200%.
2. Validate the assembled object against a crop of its intended world site.
3. Run the full world only after the first two gates pass.

Fix alignment in the package or socket contract, never with scene-specific
child offsets. The main-house pilot lives in `house/v2`; validate it with
`npm run assets:house:validate`.
