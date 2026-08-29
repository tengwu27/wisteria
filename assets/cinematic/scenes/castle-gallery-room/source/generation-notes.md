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
- `castle-gallery-master-v2.png` is the immutable geometry authority for the
  Gallery after approval.

## Approved master

- File: `castle-gallery-master-v2.png`
- Dimensions: `1672x941`
- SHA-256: `19588aeef66bbd26f71777c9efa61b4dcc8d8a0be5c67296b17315104eb76d7b`
- Camera: independent eye-level viewpoint near 1.6 m, level horizon,
  rectilinear natural wide angle near 30 mm, facing the principal wall nearly
  straight-on.

The first candidate was rejected because its center frame was nearly square
and could not host the approved landscape art without excessive matting. The
accepted v2 candidate was regenerated independently from the original brief.
It was not edited from the rejected candidate.

## Framed-art contract

The three warm-linen openings are simple known rectangles and therefore use
deterministic masks. The accepted room master remains unchanged. Runtime art
is placed only within the declared opening, then the exact foreground shell is
reasserted above it. The center artwork uses `contain-with-mat`; it is never
cropped or stretched.
