# Cinematic Production Performance

Apply this contract whenever cinematic media may reach production or a deployed
preview. Allow relaxed delivery only through an explicit, temporary prototype
profile. Never let a prototype bypass weaken interaction safety,
accessibility, registration, or failure recovery.

## Delivery profiles

Declare every active scene as either `prototype` or `production` in the
repository's delivery configuration.

For `prototype`:

- Permit source-format artwork, larger payloads, eager loading, or incomplete
  caching only when needed for temporary visual testing.
- Require a meaningful reason and an ISO expiry date for every bypass.
- Emit conspicuous audit warnings.
- Keep experimental assets outside active production manifests.
- Fail an expired or malformed bypass.
- Fail every normal production build while any active scene remains a
  prototype.

For `production`:

- Reject all active bypasses.
- Enforce deterministic asset, loading, code-size, caching, and cleanup gates.
- Verify the deployed result in addition to the local build.

## Non-bypassable correctness

Preserve these requirements in both profiles:

- Keep registered layers, apertures, hotspots, and effect anchors aligned.
- Load complete themes atomically; never expose a mixed or partial stack.
- Keep navigation reachable through playback rejection, decode error, timeout,
  reduced motion, and user skip.
- Raise an opaque curtain before removing a transition clip or navigating.
- Guard repeated input and prevent skip events from reaching content below.
- Retain native keyboard, touch, focus, and accessible-name behavior.
- Reset timers, overlays, media state, and controls after client navigation and
  history restoration.
- Keep the document free of body-level overflow and preserve complete scene
  reachability.

## Production asset contract

- Store authoring masters, masks, source renders, and validation inputs outside
  the public delivery directory.
- Reference only optimized browser assets from production code.
- Preserve exact dimensions and alpha for registered image plates.
- Prefer WebP or AVIF; retain PNG only for a documented compatibility or
  fidelity requirement.
- Encode transition video as browser-compatible H.264 MP4 with fast-start
  metadata. Preserve frame rate, frame count, duration, and endpoints.
- Inspect first, middle, penultimate, and final video frames. Reject endpoint
  glitches even when aggregate quality metrics pass.
- Avoid recompressing an already compact ambient loop unless savings are
  material and visual gates pass.
- Subset immersive fonts to the glyphs and weights the interface uses.
- Use content-hashed or versioned names before applying immutable caching.
- Remove superseded production media and disposable validation artifacts after
  verifying replacements.

## Runtime loading contract

Load in this order:

1. Route shell and initial poster.
2. Critical plates for the active theme.
3. Active ambient media.
4. Interaction media on intent or activation.
5. Inactive themes during data-aware idle time.

Do not warm inactive media when Data Saver is enabled, the connection is
constrained, the document is hidden, or a transition is active. Do not place
eager `src` or `poster` attributes on deferred videos and layer images. Decode
every critical plate before revealing a registered stack; use its matching
flattened fallback if the bounded decode interval expires.

Pause hidden and inactive media. Resume only the currently authoritative scene.
Route every transition completion signal through one idempotent finish routine:

```text
ended | rejection | error | timeout | user skip
                     ↓
pause clip → raise opaque curtain → navigate once
```

## Repository budgets

Keep numeric budgets in a checked-in repository configuration rather than in
component code. Start with budgets the approved production baseline already
passes, then reduce them intentionally. Do not raise a budget solely to silence
a failed build.

Use these default ceilings when a project has no measured baseline:

| Resource | Default ceiling |
| --- | ---: |
| Immersive fonts | 100 KiB and two requests |
| Initial compressed JavaScript and CSS | 350 KiB |
| Mobile initial visual bundle | 2.5 MiB |
| Desktop initial visual bundle | 4 MiB |
| Individual registered image | 1.5 MiB |
| Inactive-theme requests before idle | 0 |
| Transition-video requests before intent | 0 |

Treat route-specific ceilings as authoritative when they are stricter than
these defaults.

## Automated audit

Make the production build fail for:

- an active `prototype` scene or performance bypass
- malformed or expired bypass metadata
- source-format or authoring assets in public delivery roots
- missing posters, fallbacks, route bundles, or registered plates
- unexpected registered-plate dimensions
- eager deferred media or inactive-theme loading
- route-code, font, image, video, or visual-bundle budget violations
- incompatible transition encoding or endpoint drift
- missing production cache contracts
- unreferenced or superseded public cinematic media when reliable ownership
  metadata exists

Provide a separate prototype audit command. Downgrade only explicitly scoped,
bypassable performance violations to warnings. Continue to fail correctness,
safety, malformed configuration, and expired bypasses.

## Release verification

Before declaring production readiness:

1. Run the deterministic production audit, lint, and production build.
2. Test direct load, client navigation, history restoration, theme switching,
   entry, reverse exit, transition skip, reduced motion, hidden-tab recovery,
   and media failure paths.
3. Verify desktop, intermediate overflow, and portrait mobile layouts.
4. Inspect authoritative media sources, playback state, hotspot ownership, and
   console output—not appearance alone.
5. Inspect the deployed preview for real cache headers, request order, transfer
   sizes, and unexpected eager downloads.

Do not describe a prototype audit as production validation. Promote a scene by
removing its bypass, changing its status to `production`, optimizing delivery,
and passing the complete production build.
