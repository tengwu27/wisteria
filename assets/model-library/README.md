# Modular Model Asset Library

This library uses the house package as its visual and technical reference.

## Repository layout

Asset files are separated by responsibility so authoring work cannot be
mistaken for a runtime dependency:

```text
assets/model-library/              canonical authoring packages and contracts
  <object>/v<N>/                   versioned production sheets and sources
  house/experiments/keyframes/     retained motion/keyframe experiments
assets/cinematic/                  cinematic source frames, masks, and renders
assets/archive/                    superseded prototypes retained for reference
src/assets/images/world/           runtime-imported lossless layers only
  landscape/                       world backgrounds
  <object>/v<N>/                   versioned modular object packages
public/media/village/              browser-delivered cinematic media
  ambient/                         day/night environmental loops
  interactions/<object>/           bounded object interaction transitions
```

- New source art belongs in `assets/model-library`, never directly in `src`.
- Cinematic keyframes, masks, and master renders belong in `assets/cinematic`,
  never at the repository root.
- A build script may copy an accepted package into `src/assets/images/world`.
  This intentional source/runtime duplication is the delivery boundary.
- Superseded trials move to `assets/archive`; they must not be imported or
  shipped from `public`.
- Every versioned package keeps its contract beside its production layers.

## Shared standard

- Lossless RGBA PNG output with transparent backgrounds.
- Cozy retro-modern, hand-painted isometric RPG rendering.
- Consistent three-quarter isometric camera (roughly 30° elevation).
- Static shells own permanent structure, casings, sills, thresholds, rails,
  sockets, and mounting brackets.
- Doors, windows, lamps, rotors, flags, sails, wheels, and other moving or
  stateful parts are separate assets.
- Open/closed and on/off variants preserve the same scale, viewpoint,
  attachment footprint, and pivot.
- Rotating parts should be animated from one canonical drawing with a fixed
  center. Do not use independently painted frames when exact rotation matters.
- Illuminated variants change the internal lens only; runtime glow belongs in
  the renderer so the sprite silhouette remains reusable.
- Source sheets retain a flat magenta chroma background. Files without
  `source` in their name are the transparent production sheets.

## Component contract

- Each package chooses one canonical authoring canvas and native facing. Every
  shell, state, mask, and occluder is exported on that complete canvas.
- A socket owns an aperture/fit mask, a canonical pivot, a motion envelope,
  state metadata, and explicit layer order. These values are asset data, not
  scene-specific CSS offsets.
- The shell owns all permanent geometry: walls, casings, sills, thresholds,
  hinge mounts, rails, and brackets. Door and window state files contain only
  moving leaves/panels.
- Closed-state alpha must match its fit mask within a one-pixel antialiasing
  tolerance. Open states may leave the aperture but must stay inside their
  declared motion envelope and keep the same pivot.
- Hinged components record the complete fixed hinge line, not only a pivot
  point. An inward open endpoint preserves that line exactly while projecting
  the free edge into the aperture; the free top recedes downward and the free
  bottom recedes upward. Never simulate this state by squeezing the leaf into
  a vertical strip.
- New packages are mirrored once at the assembled-object root when the world
  placement faces the opposite direction. Per-layer flipping is legacy-only.

## Physical depth and attachment

- `behind-aperture`: render the interior and component first, then render the
  parent shell above them. Doors and windows may underlap their openings; the
  shell's casing is the authoritative stencil and hides seams.
- `foreground-mounted`: render the parent shell first, then the complete rigid
  component at its socket. Flags, lamps, signs, and antennas use this mode.
- `sandwiched`: split an assembly according to its physical depth. A turbine is
  mast/backplate → rotating rotor → fixed hub cap; clock hands are face → hands
  → bezel when a separate bezel is present.
- Layer order follows physical depth, never a universal “all components above”
  or “all components below” rule. Whole-object facing changes happen at the
  assembled root, while a component's local transform stays socket-relative.

## Motion classification

- Pure rotation/translation: one canonical asset plus a pivot (rotors, wheels,
  hands, simple sway). Do not paint duplicate frames.
- Relocating a rigid component on the same illustrated plane is a translation,
  not a new render. Preserve the component's original pixels, lighting,
  projection, and silhouette; do not mirror, rotate, skew, rescale, or ask a
  generator to reinterpret it. Only its attachment coordinates may change.
- Stateful silhouette, perspective, or occlusion: authored endpoint assets
  (door/window open and closed). Add intermediate frames only after review.
- Lighting: stable geometry plus off/on lens state; halos and bloom are runtime
  effects.
- Smoke, glow, bobbing, ripples, and similar continuous effects belong to the
  renderer rather than raster frame families.

## Integration gates

1. Validate one component in its isolated asset lab at 100% and 200%.
2. Validate the assembled object against a crop of its intended world site.
3. Run the complete world only after the first two gates pass.

Fix failed alignment in the package/socket contract. Never compensate with a
child-layer offset in a scene. The main-house v2 pilot and its machine-readable
contract live in `house/v2/`.

## Packages

| Package | Production sheet | Included state families |
| --- | --- | --- |
| House | `house/v1/house-interactive-world-v1.png` | windows, doors, turbine, flag, lamp, clock |
| Coffee shop | `coffee-shop/v1/coffee-shop-modular-v1.png` | doors, windows, awning, sign, lamp, steam, flower box |
| Garage | `garage/v1/garage-modular-v1.png` | bay door, service door, window, lamp, exhaust fan, tools |
| Car | `car/v1/car-modular-v1.png` | doors, hatch, wheels, headlamps, luggage, exhaust |
| Sailboat | `sailboat/v1/sailboat-modular-v1.png` | mainsail, jib, flag, anchor, tiller, lamp, cabin door, wake |
| Airplane | `airplane/v1/airplane-modular-v1.png` | propeller, canopy, landing gear, lights, rudder, flaps, exhaust |
| Harbor | `harbor/v1/harbor-modular-v1.png` | beacon, reflector, doors/windows, crane, gangway, flag, lamp, buoy |

The machine-readable inventory is in `manifest.json`.
