# Motion, Effects, and Validation

## Define one normalized focus signal

Use a signed focus value in `[-1, 1]`. Positive focus reveals more of the
artwork's left side by translating plates right. Multiply the same signal by a
per-plane maximum displacement.

Assign displacement monotonically by depth: far planes move least and near
planes most. Starting values may range from roughly `0.1%` of stage width for a
far sky to `1.5%` for a very near object, but derive final values from the
composition. Treat project values as starting points, not universal constants.

Keep a horizontal-only contract free of vertical camera motion, zoom, or
rotation. Ambient child motion such as steam rise or boat bobbing may still use
its physically justified axis.

Scale the registered camera enough to cover the largest shift, including
antialiased edges. Verify actual extremes instead of assuming an overscan value.

## Map input responsively

Without measured world overflow:

- map fine-pointer x position to focus
- damp with request-animation-frame interpolation
- recenter on pointer exit

With measured overflow:

- preserve native touch, trackpad, and keyboard scrolling
- derive focus from the visible-center ratio relative to the neutral focal ratio
- keep existing edge-pan responsible only for scrolling
- preserve the explored focal ratio across resize and orientation changes

Suspend input during transitions, theme loading, hidden-document state, and
reduced motion. Reset focus on client swaps and restored history.

## Keep transform ownership explicit

Use one parallax wrapper per plane. Put ambient transforms in a nested child:

```text
parallax wrapper: translateX(depth signal)
└── ambient wrapper: rock, bob, flicker, shimmer, or rise
    └── registered plate or localized effect
```

Put each hotspot inside the owning plane or apply that plane's exact transform
to a dedicated hotspot wrapper.

## Anchor effects to objects

Record effect anchors in master coordinates and convert them to registered
percentages only at integration time.

- **Steam:** anchor its base to the cup or vessel opening, not the vessel body.
  Start narrow enough to fit the rim, then widen with overlapping staggered
  wisps, alternating lateral sway, rotation, expansion, and dissipation. Avoid
  a single narrow vertical stream.
- **Glare and lamp light:** retain a readable source core and localized falloff.
  Move the effect with its source plane and keep reflected light on its
  receiving plane.
- **Water reflection:** align beneath the light source and move with the harbor
  or water plate.
- **Rocking subject:** use its contact point or waterline as transform origin;
  avoid unintended horizontal displacement.
- **Clouds:** keep them on their own depth plate when they must occlude a moon or
  react at a different focus speed.

## Load and switch complete stacks

Represent each theme as an explicit plate bundle. Decode all critical plates
before exposing the stack. Crossfade complete stacks atomically. If the target
bundle fails within a bounded interval, display its matching flattened poster
or video and disable depth.

Lazy-load inactive themes after the initial arrival. Pause media and ambient
effects while hidden, and make reduced motion static without removing
navigation or focus visibility.

## Validate

Inspect:

- isolated planes on contrasting checkerboards
- repaired backplates without their foreground objects
- per-plane include/exclude ownership lists
- neutral composite against the approved master
- left and right focus extremes
- the aperture workflow's alpha and registration proof, when applicable
- same-direction monotonic depth movement
- overscan at every extreme
- effect anchors at every parallax position
- hotspot alignment and native keyboard activation
- native horizontal reach and focal preservation
- atomic theme switching and fallback behavior
- navigation, history restoration, and hidden-tab recovery

Reject partial theme mixtures, wrong-depth effects, hotspot drift, structural
motion, exposed edges, vertical camera drift in horizontal-only scenes, and
generated changes outside declared repair regions.

Reject any layer with semantically unrelated pixels, even if its dimensions,
alpha channel, or neutral composite pass automated checks. In particular,
reject windows moving separately from their fixed wall/frame, foreground tables
without all resting props, vehicle cutouts that include ground or scenery, and
repairs that leave an object's silhouette or old cast shadow behind.
