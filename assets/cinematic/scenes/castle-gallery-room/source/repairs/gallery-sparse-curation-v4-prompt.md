# Gallery sparse-curation donor — v4

Generated with the built-in image generation tool as a localized donor, not as
the authoritative scene master.

## Reference roles

- `castle-gallery-master-v3.png`: exact edit target and immutable authority for
  canvas, camera, crop, perspective, architecture, geometry, lighting, palette,
  and protected objects.
- `windmill-cafe-approved.png`: interior material rendering, aged walnut, brass
  ornament, botanical motifs, painterly contour quality, and warm/cool balance.
- `core-village-master.png`: broad Wisteria palette and craftsmanship only; its
  exterior camera, geography, and composition are excluded.

## Prompt

Create a sparse curated-gallery wall donor from the Gallery v3 master. Remove
every anonymous miniature painting and every small decorative picture frame
surrounding the three dominant display supports. Repair their former locations
as continuous terracotta plaster with the same hand-painted texture, age,
light falloff, and molding shadows as the master.

Keep the three dominant aged-walnut-and-brass display assemblies—the left
portrait support, center landscape 4:3 support, and right portrait support—and
keep all three linen apertures visibly blank. Change only the registered wall
exhibit band from normalized x=0.14 to 0.89 and y=0.14 to 0.70. Preserve the
center support's position, 4:3 aperture, stepped walnut molding, brass corner
details, and center ornaments; preserve both side supports, sconces, stone
columns, upper botanical frieze, lower walnut-and-ceramic wainscot, ceiling,
floor, seaside arch, and doorway.

No characters, art inside apertures, new supports, labels, plaques, readable
text, logos, watermarks, camera drift, relighting, blur, stippling, pepper noise,
halftone dots, edge crawling, doubled contours, halos, or mismatched grain.

## Deterministic use

`build-static-bundle.mjs` composites this donor exactly once onto the immutable
v3 master through `gallery-sparse-curation-v4-repair-mask.png`. The release gate
requires zero changed pixels outside that mask and zero mask pixels outside the
registered exhibit region.
