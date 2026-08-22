# Prompt Patterns

Use these patterns as scaffolds. Replace bracketed fields with concrete visual details and explicitly assign each reference image a role.

## Geometry-only reference

When a real photograph is supplied only to correct proportions or physical
layout, state that narrow role explicitly:

```text
Use Image 1 as the exact approved artwork, camera, palette, and style target.
Use Image 2 only as a physical geometry reference for [object center, diameter,
mounting point, door state, or relative scale]. Repaint the corrected setup in
Image 1's established design language. Do not copy Image 2's brand, materials,
colors, scenery, crop, or photographic style.
```

Express important landmarks as canvas-relative measurements when possible. For
a vehicle cockpit, record steering-wheel center and diameter, dashboard height,
windshield aperture, driver/passenger door states, and seat extent. If several
connected landmarks are wrong, regenerate the smallest coherent registered
plate—such as the complete interior—instead of stacking a mismatched prop over
the old geometry.

## Theme repaint

```text
Use Image 1 as the exact edit target and geometry source. Use Image 2 only as the [night/day] art-direction, palette, and lighting reference.

Recreate Image 1 as a genuinely repainted [theme] keyframe, not a brightness adjustment or color filter. Preserve the exact camera, crop, perspective, resolution, silhouettes, architecture, target coordinates, and placement of every object. Protect these identifying details: [details].

Apply [sky and ambient palette], [surface illumination], and [practical lights]. Integrate light with believable falloff, shadow, and reflected color. Match [style description].

Do not add objects, move geometry, change the camera, alter the target design, introduce motion blur, or add text or watermarks.
```

## Night lighting plan

Before generating a night repaint, inventory each light source and its visible
consequences:

- Keep the moon or key light on the correct depth layer so nearer clouds can
  occlude it.
- Paint cool edge light onto clouds and a restrained reflection path onto water
  beneath the source.
- Give lighthouse lamps, windows, and other practical lights a visible warm core
  plus localized falloff.
- Preserve warm/cool separation: deep navy or cobalt ambient surfaces, cool
  silver exterior highlights, and warm interior or architectural lights.
- Match the approved reference by region rather than using one global hue,
  brightness, or contrast adjustment.

Regenerate only the mismatched plate when geometry and other layers are already
approved. Rebuild and inspect the full registered composite at delivery size
before accepting the repaint.

## Matching active or interior plate

```text
Use Image 1 as the exact approved themed frame and definitive source for every pixel outside [interaction aperture]. Use Image 2 only as the opening geometry and interior-content reference. Use Image 3 only as secondary style direction.

Create the matching active plate. Change only [interaction aperture]: remove [closed leaf or cover] and reveal [interior or active state]. Keep the exact same frame, threshold, dimensions, position, perspective, and surrounding lighting.

Critical continuity requirement: preserve Image 1 outside the aperture. Do not show the removed leaf; deterministic rendering will add and animate it separately.

No camera shift, crop change, exterior redesign, new objects, people, text, watermark, or motion blur.
```

## Localized donor patch

Use this only after reading `localized-repair.md`. The generated result is a
donor, not a replacement frame:

```text
Use Image 1 as the immutable geometry, palette, lighting, texture, and detail
authority. Change only [coherent repair subject] inside [registered repair
bounds]. Preserve these anchors exactly: [three or more distributed anchors].
Protect [windows, exterior view, trim, thresholds, props, or other exclusions].

Generate clean, continuous illustrated surfaces with the same line density and
material grain as Image 1. No stippling, pepper noise, false halftone dots,
edge crawling, blur, duplicated details, or texture drift. Do not alter the
camera, crop, scale, perspective, lighting, or any protected region.

This output will be used only as a donor patch and composited deterministically
onto Image 1 through a contour-following mask.
```

## Consistency checklist

Before accepting an output, compare it with the geometry master:

- Same resolution and aspect ratio
- Same camera and crop
- Same silhouette and roofline
- Same target dimensions and coordinates
- Same protected windows, handles, markings, and trim
- No changes outside the requested aperture
- Theme lighting is painted into surfaces rather than pasted on top
- Light reflections and illuminated surfaces align with their source
- Foreground occluders remain in front of background lights
- Practical lights retain a readable core at final display size
- No unrequested motion or newly invented objects

If alignment is poor, regenerate the donor from the immutable approved master
with better anchors or a more coherent repair region. Do not recursively edit
the latest composite. Use deterministic compositing to restrict an active plate
to the aperture when only its interior pixels are needed.
