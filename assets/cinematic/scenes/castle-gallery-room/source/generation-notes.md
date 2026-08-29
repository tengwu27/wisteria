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
- `castle-gallery-master-v2.png` is the immutable full-scene authority for the
  Gallery camera, wall, lighting, neighboring art, and every pixel outside the
  approved center-frame repair mask.
- `still-life-with-wisteria-v1.png` governs only the center item's 4:3 source
  identity and the uncropped inspector representation.

## Immutable master and approved localized repair

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

## Framed-art contract

The wall placement envelope and center anchor belong to the room. The active
frame and aperture belong to the item's construction version. The center frame
uses active bounds `(636, 272, 400, 288)` inside envelope
`(612, 272, 450, 288)`. Its exact artwork aperture is
`(658, 292, 356, 267)`, a true 4:3 opening centered at canvas x=836.

The warm-linen openings are simple known rectangles and therefore use
deterministic masks. Runtime art is placed only within the declared opening,
then the exact foreground shell is reasserted above it. The center source and
wall proxy fill all 356x267 pixels with no crop, stretch, or mat. The full
1448x1086 source remains unchanged for inspection.

Future framed art uses `match-source-frame`: measure source dimensions, propose
a custom frame within the fixed envelope, require no more than 0.5% aspect-ratio
error and a 96px minimum aperture short side, and obtain explicit construction
approval before rebuilding the registered frame. An extreme ratio that cannot
meet those constraints is a placement blocker. Content-only changes retain the
existing geometry; source replacement or physical reconstruction requires a new
construction version.
