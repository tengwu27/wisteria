# Frontend Integration

## Media model

Represent each theme as one coherent flattened-media or registered-layer bundle:

```ts
type ThemeMedia = {
  ambientVideo: string;
  ambientPoster: string;
  interactionVideo: string;
  interactionPoster: string;
};

type ThemeLayers = {
  fallbackVideo?: string;
  fallbackPoster: string;
  layers: Array<{
    id: string;
    src: string;
    owner: string;
    z: number;
    maxShiftPercent: number;
  }>;
};
```

Do not infer the interaction video from whichever element happens to be visible. Select both ambient and interaction assets from the same explicit theme state.

For registered stacks, decode all critical layer images before exposing the
incoming theme. Crossfade complete stacks atomically. If a critical plate fails
or exceeds the bounded loading interval, display the matching flattened
fallback and disable depth instead of revealing a partial stack.

## Theme initialization

1. Read a session-scoped manual choice if one exists.
2. Otherwise derive the initial theme from local time or product rules.
3. Apply the theme before starting playback.
4. Update accessible labels and status text.

Crossfade themes over roughly 400–600 ms. Start the incoming video before fading it in, then pause the outgoing video after the fade. Pause all ambient footage when the hero leaves the viewport or the document becomes hidden.

## Spatial alignment

Place hotspots in the video's master coordinate system, not with arbitrary viewport pixels. For a master width `W` and height `H`, store target bounds as percentages:

```ts
const left = x / W * 100;
const top = y / H * 100;
const width = targetWidth / W * 100;
const height = targetHeight / H * 100;
```

Put media or registered plates and their hotspot layers inside the same stage.
For multilayer scenes, transform a hotspot with the plane that owns the
depicted object. Apply identical crop assumptions across every plane. Test the
crop at desktop, ultrawide, tablet, and portrait sizes.

## Adaptive wide-world viewports

Do not decide whether a cinematic world needs horizontal exploration from a
fixed CSS breakpoint. A viewport can be wider than the nominal mobile
threshold and still crop important content, and future scene expansion changes
the required width without changing the device class.

Instead, measure the rendered geometry:

```ts
const hasOverflow = world.offsetWidth - viewport.clientWidth > 1;
```

Keep the media, overlays, and hotspots inside one registered world element.
Place fixed HUD controls, curtains, and transition overlays outside the
horizontal scroller.

When there is no measured overflow:

- center the world normally
- preserve the intended cover behavior
- allow only restrained pointer focus or camera motion when requested

When there is measured overflow:

- expose it through a native `overflow-x: auto` viewport
- keep touch momentum, trackpad scrolling, and horizontal overscroll
  containment
- support ArrowLeft, ArrowRight, Home, and End while the viewport is focused
- on fine pointers, map a bounded edge zone to damped scroll velocity; use a
  center dead zone and stop at exact scroll boundaries
- do not scale or translate the hotspot layer independently from the media

Give each scene an initial normalized focal point rather than a fixed pixel or
percentage transform. For example, `0.43` centers a subject slightly left of
the world midpoint and `0.62` centers one to the right:

```ts
scrollLeft =
  focalRatio * world.offsetWidth - viewport.clientWidth / 2;
```

Clamp the value to the real scroll range. While the visitor explores, update
the visible-center ratio:

```ts
centerRatio =
  (viewport.scrollLeft + viewport.clientWidth / 2) /
  viewport.scrollWidth;
```

Preserve that ratio through viewport resizes, orientation changes, and media
layout changes using `ResizeObserver` plus a window-resize fallback. Suspend
edge-pan during intros, transitions, hidden-document state, and reduced motion.
Never use hard-coded mobile crop offsets as a substitute for reachability.

Verify at a landscape size that does not overflow, an intermediate size that
does, and a portrait mobile size. At every size, confirm:

- both horizontal boundaries are reachable
- the initial and resized focal ratios are correct
- artwork-relative hotspots remain aligned
- the document body itself has no horizontal overflow
- fixed HUD and transition curtains do not move with the world

## Entry state machine

Use explicit states instead of loosely related classes:

```text
idle -> approaching -> playing -> curtain -> navigating
                     \-> fallback -> curtain -> navigating
```

On activation:

1. Reject the event unless state is `idle`.
2. Disable the hotspot and theme control.
3. Select the interaction video from the current theme.
4. Reset its `currentTime` and call `load()` when its source may have changed.
5. Apply a restrained approach transform if motion is allowed.
6. Crossfade a fixed fullscreen overlay above the viewport.
7. Call `play()` and listen once for `ended`.
8. Start a bounded timeout slightly longer than the asset duration.
9. On `ended`, playback rejection, media error, or timeout, fade to an opaque curtain.
10. Navigate only once through the client router.

Keep the curtain opaque until the destination page is ready. Integrate with the framework's view-transition mechanism when available.

### User-skippable transition clips

Treat a skip as another completion signal, never as a separate navigation
shortcut. While an entry, arrival, or reverse-exit transition clip is playing,
allow a subsequent pointer activation on its fullscreen overlay to call the
same idempotent finish function used by `ended`, media error, and timeout:

1. Reject the skip unless the transition is active and not already finishing.
2. Prevent and stop the pointer event so it cannot activate content beneath
   the overlay.
3. Pause the active transition clip.
4. Raise the opaque curtain.
5. Set any required return-handoff state.
6. Navigate only after the curtain has covered the viewport.

Bind the skip to the transition overlay, not the underlying hotspot, so the
activation that started the transition cannot also skip it. Provide a quiet
visible “skip” affordance, and keep reduced-motion behavior nearly immediate.
Apply the same guarded path to shared reverse-exit overlays. If a destination
has its own arrival clip before its ambient loop, skipping should settle to the
ambient scene; it must not stop or skip the ambient loop itself.

## Reduced motion

When `prefers-reduced-motion: reduce` matches:

- skip camera zoom and interaction-video playback
- use a short opacity fade to the curtain
- navigate immediately after the fade
- retain focus visibility and keyboard behavior

## Accessibility

- Implement the hotspot as a real button.
- Provide a descriptive accessible name, not just a place name.
- Show a visible focus ring that survives bright and dark scenes.
- Support mouse, touch, Enter, and Space through native button behavior.
- Verify Enter and Space in a live browser. If either only focuses the button, add an explicit guarded `keydown` handler that prevents the default action and calls the same activation function; confirm it does not double-fire with `click`.
- Announce manual theme changes with a polite live region.
- Do not place essential instructions only in hover content.

## Reset after client navigation

Run a reset on initial load, framework page-load events, browser history restoration, and persisted-page restoration:

```ts
function resetHero() {
  clearAllTimers();
  state = "idle";
  root.classList.remove("is-entering", "is-curtained");
  overlay.setAttribute("aria-hidden", "true");
  controls.forEach((control) => control.disabled = false);

  interactionVideos.forEach((video) => {
    video.pause();
    video.currentTime = 0;
    video.load();
  });

  applyTheme(readSessionTheme() ?? deriveThemeFromLocalTime());
  playVisibleAmbientVideo();
}
```

Explicit `load()` calls are important when a client router restores cached DOM containing video elements that were previously transitioned or paused.

## Failure handling

- Ignore repeated activation once the state leaves `idle`.
- Treat `play()` rejection as a normal fallback condition.
- Use both `ended` and a bounded timeout.
- Navigate through the curtain even if media fails.
- Avoid leaving an invisible fullscreen overlay intercepting input after return navigation.
- Keep poster images available for blocked autoplay and slow connections.

## Browser verification

Verify the authoritative state rather than appearance alone:

- current theme value
- active ambient and interaction video sources
- which video is playing and which are paused
- overlay state during entry
- final URL after completion or timeout
- restored video `readyState` and playback after returning home

Also inspect start, midpoint, and final video frames visually for animation artifacts.
