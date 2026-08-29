# Gallery center frame v3 repair record

## Input roles

- `../castle-gallery-master-v2.png`: immutable Gallery camera, architecture,
  terracotta wall, lighting, neighboring paintings, and registration authority.
- `../../../windmill-cafe-interior/source/windmill-cafe-approved.png`: Wisteria
  interior material rendering, painterly finish, carved ornament, walnut, and
  aged-brass authority only.
- `../../../gamified-coastal-village/isometric-parallax/source/core-village-master.png`:
  shared Mediterranean palette and ornamental lineage only; its camera is not
  used.
- `../../../../art-pieces/still-life-with-wisteria/source/still-life-with-wisteria-v1.png`:
  4:3 aspect and item identity only; it is not repainted into the room donor.

## Localized donor prompt

Edit only the complete center picture-frame assembly and the terracotta wall
newly exposed by narrowing it. Preserve the approved Gallery camera, lighting,
wall texture, architecture, neighboring paintings, and all unrelated objects.
Build a centered landscape frame in the existing Wisteria treatment: dark aged
walnut, fine aged-brass inner trim, and balanced botanical corner ornaments.
Use a flat, axis-aligned chroma-magenta opening as a construction guide so the
registered aperture can be extracted deterministically. Do not add people,
text, matting, new props, or another artwork.

## Registration and acceptance

- Donor file: `gallery-center-frame-v3-donor.png`
- Donor dimensions: `1456x1080`
- Donor SHA-256: `0b57a306f1cd72d3659750921cf6970f57d2d8bee5d3b324b76343d825f8975a`
- Repair context: `(560, 220, 552, 410)`
- Repair ownership: `(575, 225, 522, 400)` with a 4px feather and the exact
  aperture hard-excluded
- Frame envelope: `(612, 272, 450, 288)`
- Active frame: `(636, 272, 400, 288)`
- Exact aperture: `(658, 292, 356, 267)`

The build registers the donor uniformly by opening height, replaces residual
chroma outside the exact opening from adjacent frame trim, applies the repair
mask once to v2, and proves zero changed pixels outside the mask. The aperture,
shell, wall proxy, fallback, responsive assets, and difference proofs are then
rebuilt deterministically from that registered master.
