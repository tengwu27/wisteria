# Immutable-Master Localized Repair

Use this workflow when an approved image needs a confined correction: machinery,
architecture, a vehicle, shoreline contact, a window, a prop assembly, or a
small texture defect. The objective is to change only the owned subject while
leaving the rest of the approved artwork pixel-identical.

## 1. Freeze the authority

Copy the approved lossless image to a versioned immutable master. Record its
dimensions, color mode, embedded profile, and checksum. Never overwrite it and
never feed a later composite back into ImageGen.

The newest learning wins: if another instruction suggests editing the closest
generated composite, this immutable-master rule takes priority for localized
repairs.

## 2. Define ownership and protection

Describe one coherent repair subject, not an arbitrary rectangle. Record:

- the tight subject bounds and a modest contextual overlap
- at least three distributed registration anchors
- the physical contact edges and attachment points
- protected regions inside the box, such as exterior views, windows, trim,
  counters, floors, or neighboring props
- acceptable seam materials, preferably quiet wood, stone, wall, foliage, or
  shadow rather than high-salience edges

If the correction spans several connected parts whose geometry depends on each
other, include the complete assembly. Do not patch disconnected fragments or
clip the subject at an attachment point.

## 3. Generate a donor, not a frame

Generate only the registered contextual crop or narrow coherent region from the
immutable master. Treat the result as a donor patch. The generator is allowed
to repaint pixels inside the donor; it is never allowed to replace the complete
approved image.

Prompt for clean material continuity and explicitly reject stippling, pepper
noise, false halftone dots, edge crawling, blur, doubled contours, copied
speckles, and unrelated redesign. Preserve camera, scale, perspective, lighting,
and the named anchors.

Reject the donor before compositing if it changes protected geometry, cannot
align at three distributed anchors, or carries a noticeably different line
density, grain scale, sharpness, or palette.

## 4. Register without distortion

Use translation, uniform scale, and crop only. Do not stretch X and Y
independently and do not warp a donor to hide perspective drift. Recheck contact
points, verticals, curves, and thin appendages at full resolution.

When the donor cannot register cleanly, regenerate it from the immutable master
with clearer anchors or a more complete subject. Do not increase feather width
to conceal the mismatch.

## 5. Build a contour-following mask

Create a deterministic mask around the accepted subject silhouette. Exclude all
protected regions even when they sit inside the donor bounds. Follow physical
edges and place the seam through quiet receiving material.

Use a narrow `2–6px` feather at delivery resolution; `3–5px` is the normal
starting range. Never use a broad rectangular crossfade for an irregular
subject. Broad blends soften details, duplicate edges, and spread generated
texture into pixels that were not meant to change.

## 6. Composite exactly once

Composite the registered donor through the approved mask onto a fresh copy of
the immutable master. Do not generate from the resulting composite and do not
re-encode untouched regions through a lossy intermediate.

Force an explicit RGB or RGBA working format and preserve the master profile.
Some compositors silently negotiate grayscale, indexed color, YUV subsampling,
or a different transfer curve when a mask is present. Treat any such mode change
as a failure, even when the image looks superficially correct.

## 7. Pass the repair gate

Deliver and inspect:

1. immutable master crop
2. registered donor crop
3. binary or grayscale mask proof
4. repaired composite crop
5. full-frame composite
6. amplified difference proof

The difference proof must be empty outside the declared mask, allowing only the
intentional feather boundary. Compare protected areas pixel-for-pixel and verify
that exterior scenery, furniture, lines, and material texture remain unchanged.

At 100% and 200% zoom, reject:

- black or bright pepper dots
- false halftone or stippled texture
- contour crawling or broken thin lines
- halos, dark seams, or rectangular patch boundaries
- softened details or resolution changes outside the subject
- duplicated cups, bolts, pipes, foliage, masonry, or trim
- color-profile, gamma, or grain mismatch

## 8. Separate local repair from global refinement

If the whole image needs more detail, do not enlarge the localized mask. Use
independent overlapping contextual tiles derived from the immutable master and
stitch them once through content-aware seams. A local repair solves one owned
subject; a tile refinement redistributes pixel detail across a region. Keep
those operations separate and validate each before promotion.

After approval, preserve the immutable master, donor, mask, prompt, alignment
settings, composite, and difference proof. Remove rejected candidates only
after the accepted repair is safely versioned.
