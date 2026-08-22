# Transparent-Window Multilayer Standard

Apply this standard to any artwork whose window, porthole, windshield, glass door, arch, or other opening must be transparent and reveal a background or another layer. Treat the exact transparent aperture as a reusable asset contract for both static composites and animation.

## 1. Lock the master

Choose one approved foreground artwork as the geometry master. Record its canvas size, aspect ratio, camera, crop, aperture bounds, horizon, and protected details. Keep every plate on that canvas unless a documented overscan layer deliberately extends beyond it.

## 2. Create the exact cutout

Use this cutout technique for every qualifying window:

1. Use the approved foreground as the image-edit target.
2. Replace only visible scenery or reflections inside the glazing with one perfectly flat chroma color. Prefer `#ff00ff` unless it appears in protected artwork.
3. Preserve the physical assembly: inner glazing edge, frame, rim, mullions,
   handles, latches, trim, lower sill, door panel, curtains, plants, furniture,
   and any object crossing the opening. Only the actual glass aperture becomes
   transparent; an exterior view below the inner sill is an alpha defect, not
   part of the window.
4. Remove the key locally:

   ```bash
   python "${CODEX_HOME:-$HOME/.codex}/skills/.system/imagegen/scripts/remove_chroma_key.py" \
     --input foreground-window-key.png \
     --out foreground-window-cutout.png \
     --key-color '#ff00ff' \
     --soft-matte \
     --transparent-threshold 12 \
     --opaque-threshold 220 \
     --despill
   ```

5. Inspect the alpha PNG on a checkerboard. Require transparent glazing, opaque
   outer corners, opaque protected details, clean antialiased edges, and no
   retained scenery or key fringe. At vehicle windows, inspect the full
   glass-to-door boundary at high zoom and require the lower trim, sill, and
   interior door surface to remain continuously opaque.

Do not trace detailed, curved, irregular, or ornamented glazing with a coarse polygon. Regenerate and key the exact opening. Use a deterministic geometric mask only when the aperture is genuinely simple and its exact source geometry is known.

### Complete apertures hidden by removable foreground

A keyed guide derived from a flattened composition may describe only visible
glass or doorway pixels. Before accepting it:

1. Temporarily remove every foreground object assigned to another plane.
2. Inspect the entire physical opening behind those objects.
3. Complete missing aperture regions from a clean unoccluded guide, or from
   deterministic geometry only when the opening is simple and known.
4. Reject retained wedges of the old exterior, opaque holes, and cutout
   boundaries that merely follow the foreground object's silhouette.

Generated key artwork may guide alpha extraction, but must not silently replace
the production shell's RGB. Unless a redraw is approved, take shell color from
the geometry master and localized repair, then apply the accepted aperture
matte.

## 3. Define the plate contract

Separate content by depth and motion, back to front:

1. `background`: sky, distant environment, or replacement scene.
2. `static-midground`: architecture, shoreline, terrain, or other locked scenery.
3. `moving-subject-*`: one independently animated opaque subject per RGBA plate.
4. `foreground-window-cutout`: the approved master with exact transparent openings.
5. `localized-effect-*`: steam, smoke, glow, reflection, rain-on-glass, or
   similar effects inserted immediately above the surface or subject they
   affect, not automatically at the top of the stack.

Assign every visible pixel to one plate. Keep each subject only on its own plate
and do not duplicate clouds, vehicles, structures, or effects across layers.
Generate transparent plates with the same chroma-key workflow when practical.

Define subject ownership at whole-object granularity, including thin appendages
such as masts, flagpoles, antennas, rigging, and handles. A moving plate must not
borrow adjacent scenery pixels; an anchored pole or structure must remain
entirely in the static midground. Assign static cast or reflected light to its
receiving surface and animated light to one localized-effect plate.

Record an occlusion order as well as a file order. Background lights such as a
moon belong behind cloud plates.

When the aperture belongs to a moving hinged leaf, create separate exact masks
for the opaque leaf assembly and its glazing. Keep metal, frame, seals, mirror,
handle, and trim on the opaque leaf; remove scenery seen through the glass from
the leaf texture. Apply the same rigid transform to the leaf and glazing masks,
then composite the newly exposed background at the correct depth.

## 4. Register before animating

Build a still stack first. Align scale, perspective, horizon, and visible
composition through the real aperture. Adjust plate scale and x/y registration
while keeping the foreground fixed.

Approve a composite poster before rendering motion. Do not compensate for a misregistered plate by warping the foreground, window, or camera.

Judge registration through each opening, not from the exterior plate alone:

- ground, pavers, water, or a path should continue naturally from a door or
  lower aperture threshold
- the horizon and major landmarks should occupy credible heights
- subject scale should communicate the requested near, middle, or far distance
- secondary windows should reveal intentional distant context rather than an
  accidental crop of foliage, wall, or empty sky
- every opening must remain filled at maximum intended displacement

When the exterior feels too close, scale that plate down uniformly and then
compensate with x/y registration. Never scale, stretch, or distort the physical
frame to create more view. Use the doorway threshold and every secondary window
as simultaneous constraints: for example, nearby pavers may still need to meet
the door while a smaller, shifted plate brings coastline or bay into an arched
window. A single physically continuous exterior should remain one continuous
plate across connected openings.

A scale reduction also reduces coverage. Require painted or transparent
overscan beyond every aperture plus the maximum intended motion. Reject a
registration that looks correct at neutral but exposes the exterior plate edge
through any opening at a displaced extreme.

Disconnected openings may use documented aperture-specific registration zones
when they genuinely reveal different depth bands, such as near foliage through
side windows and a distant building through a doorway. Keep every zone boundary
behind opaque frame or wall pixels at neutral and all displaced extremes.

If one layer has the wrong palette, lighting, silhouette, or matte, regenerate
only that layer against the same master. Re-key, re-register, and inspect the
whole composite. Do not flatten the exterior to hide a local ownership defect.

## 5. Hand off motion without flattening

Record each intended moving plate, its depth, motion primitive, relevant
parameters, and whether the result is a clip or loop. Let
`$render-ambient-cinematic-loops` own periodic subject motion and loop closure.
Let `$render-parallax-transitions` own one-way encoded scene reveals and
coordinated time-driven parallax. Let `$build-interactive-parallax-scenes` own
pointer- or scroll-driven depth.

- Keep foreground and static scenery at fixed coordinates for every frame.
- Preserve enough overscan when translation is intended.
- Composite the exact foreground cutout at its registered depth and insert
  localized effects at their declared depth.

Never warp, shear, or translate a flattened window view. Transform only the plate that owns the moving content.

## 6. Validate

Check the alpha cutout, the complete aperture with removable occluders hidden,
still registration through the real opening, layer order, edge coverage, and
whole-object ownership. Inspect neutral and maximum displaced composites for
threshold continuity, believable exterior scale, and hidden registration-zone
seams. If rendered media exists, also inspect start, midpoint, and end frames
and require zero change in protected foreground and static scenery outside
localized-effect regions. Inspect thin structures at high zoom for clipped or
borrowed fragments.

Reject outputs with moving frames or mullions, horizon drift, key fringes,
duplicated or partial subjects, borrowed neighboring pixels, exposed borders,
impossible occlusion, or effects on the wrong depth layer.

## 7. Deliver

Keep versioned approved source plates, the final cutout, the ownership and
occlusion manifest, registration settings, approved composite poster, and
verification results together. Retain a keyed intermediate only when it is
needed for deterministic regeneration; otherwise delete it after validating
the final alpha. Never ship disposable trial plates or verification frames.
When video is requested, hand the registered stack to the narrow motion skill
that matches the declared shot.
