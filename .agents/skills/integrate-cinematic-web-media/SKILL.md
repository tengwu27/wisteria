---
name: integrate-cinematic-web-media
description: "Integrate approved cinematic videos, posters, or registered image-layer bundles into accessible, resilient web experiences. Use for atomic theme stacks, aligned layer-owned hotspots, fullscreen entry transitions, client-side navigation, reduced-motion behavior, autoplay and decode fallbacks, state reset, responsive exploration, production delivery optimization, performance budgets, and live browser verification."
---

# Integrate Cinematic Web Media

Connect approved media to the frontend without allowing playback, routing, crop, or restored-page failures to trap the visitor.

Read [references/frontend-integration.md](references/frontend-integration.md) completely before implementing or reviewing the web experience.

For production, deployment, loading-performance, or temporary prototype-bypass
work, also read
[references/production-performance.md](references/production-performance.md)
completely. Treat its production gates as mandatory unless the user explicitly
keeps the work in a temporary prototype profile.

## Workflow

1. Inspect the framework, router, existing components, media paths, and build commands.
2. Represent each theme as one explicit flattened-media bundle or registered
   image-layer bundle. Never mix partial themes.
3. Place hotspots in the master coordinate system and transform each with the
   plane that owns its depicted object. When the rendered
   world is wider than its viewport, use measured overflow, a scene-specific
   normalized focal point, and native horizontal exploration instead of
   breakpoint-specific crop offsets.
4. Implement entry and reverse-exit behavior as guarded state machines with
   playback rejection, error, timeout, and user-skip paths that all converge
   on the same opaque-curtain completion routine.
5. Keep the transition curtain opaque until the destination is ready.
6. Implement reduced motion, native button semantics, focus visibility, and keyboard activation.
7. Reset timers, controls, media sources, and playback after client navigation and history restoration.
8. Classify every active scene as `prototype` or `production`. Require a reason
   and expiry for prototype bypasses; never allow one through a production build.
9. Verify authoritative state and interaction behavior in a live browser, then run lint and the production build.
10. Load and switch complete theme bundles atomically. After verification, keep only the active
   public video/poster bundles and remove superseded outputs and disposable
   validation artifacts; retain reproducibility sources outside the public
   delivery directory.

Use `$build-interactive-parallax-scenes` when flat artwork also requires depth
analysis, plate reconstruction, effect anchoring, and input-driven motion. Use
`$coordinate-cinematic-interactions` for another broad multi-stage request that
also requires generating or rendering assets.
