# Castle Gallery Room generation notes

## Reference roles

- `core-village-master.png` governs Wisteria's Mediterranean world identity,
  exterior architectural lineage, palette, and relationship to the coast.
- `windmill-cafe-approved.png` governs interior material rendering, eye-level
  scale, carved ornament, warm walnut, aged brass, ceramics, and warm/cool
  lighting separation.
- The approved Castle gate, courtyard, and arcade masters govern castle-local
  pale masonry, compact scale, roof and opening language, and continuity with
  the existing Castle routes. The Gallery is an independent viewpoint and is
  not pixel-registered to those views.
- Samuel F. B. Morse's *Gallery of the Louvre* governs only salon density,
  varied frame rhythm, warm collected atmosphere, and open-floor hierarchy.
  No figure, sculpture, individual painting, or exact composition is copied.
- `castle-gallery-master-v3.png` is the immutable full-scene authority for the
  Gallery camera, architecture, lighting, three dominant supports, and every
  pixel outside the sparse-curation repair mask.
- `still-life-with-wisteria-v1.png` governs only the center item's 4:3 source
  identity and the uncropped inspector representation.

## Immutable masters and approved localized repairs

- Immutable file: `castle-gallery-master-v2.png`
- Dimensions: `1672x941`
- SHA-256: `19588aeef66bbd26f71777c9efa61b4dcc8d8a0be5c67296b17315104eb76d7b`
- Approved repaired file: `castle-gallery-master-v3.png`
- Approved repaired SHA-256: `e6990de01e997e37e719eef045a11ab908d3db7c26d1604c8c54e71b02c24fd6`
- Camera: independent eye-level viewpoint near 1.6 m, level horizon,
  rectilinear natural wide angle near 30 mm, facing the principal wall nearly
  straight-on.

The first room candidate was rejected because its center frame was nearly
square. The accepted v2 room candidate was regenerated independently from the
original brief and was not edited from the rejected candidate. The approved v3
master is a deterministic composite from v2 plus the registered localized donor
documented in `repairs/gallery-center-frame-v3-prompt.md`.

Gallery composition v1 uses `castle-gallery-master-v3.png` as its immutable
input and `repairs/gallery-sparse-curation-v4-donor.png` only as a localized
donor. `repairs/gallery-sparse-curation-v4-repair-mask.png` removes every
anonymous miniature painting and frame while protecting the three dominant
supports. The deterministic composite is `castle-gallery-master-v4.png`
(`1672x941`, SHA-256
`7ca409906a0a6ddfac733f57ed52dd904789e7be1a655824a58088eb2744b4c3`).
The build proves that the repair mask never leaves the registered exhibit
region `{x: 0.14, y: 0.14, width: 0.75, height: 0.56}` and that no pixel outside
the repair mask changes.

## Curated-exhibit contract

The exhibit region belongs to the room. Frame assemblies, apertures, supports,
and hotspots belong to scene composition v1. The sole occupied placement,
`gallery-placement-still-life-v1`, uses frame bounds `(636, 272, 400, 288)`.
Its exact artwork aperture is
`(658, 292, 356, 267)`, a true 4:3 opening centered at canvas x=836.

The warm-linen openings are simple known rectangles and therefore use
deterministic masks. Runtime art is placed only within the declared opening,
then the exact foreground shell is reasserted above it. The center source and
wall proxy fill all 356x267 pixels with no crop, stretch, or mat. The full
1448x1086 source remains unchanged for inspection.

Future paintings use `match-source-frame`: measure the canonical source, propose
a custom support within the exhibit region, require no more than 0.5%
aspect-ratio error and a 96px minimum aperture short side, and obtain explicit
visual approval before persistence. Each approved addition rebuilds the scene
composition from the latest immutable master and all existing canonical works.
Existing artwork identity hashes cannot change when placements move. Sculpture
and installation remain reserved schema values, not executable construction in
v1.
