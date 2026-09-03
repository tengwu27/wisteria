# Self-Revealing Art Curation Session

## Authority split

- Notion owns title, artistic prompt, preview imagery, editorial status, and
  page/comment annotations.
- Git owns immutable canonical media and hashes, scene masters, composition
  manifests, masks, proxies, delivery assets, inspectors, and release history.
- A Notion preview may differ in encoding or size from the canonical Git asset.
  The `Canonical SHA-256` property must identify the Git source exactly.

## Candidate boundary

An explicit request such as “hang a new painting in the Castle Gallery” permits
temporary image generation and comparison only. Store candidates outside active
project manifests. Show both the unframed canonical candidate and the complete
scene candidate so approval covers artwork identity and placement together.

Approval must identify the candidate or clearly accept the currently shown
pair. Before persistence, confirm that the active base commit, room reservation,
composition version/hash, canonical inventory, and Notion data source still
match the approved state. A mismatch invalidates approval and requires a new
candidate or impact review.

## Composition rules

- Recompose only inside `exhibitRegion`; preserve every pixel outside it.
- Frames, pedestals, mounts, apertures, and placements belong to the composition
  version, not to permanent room slots.
- Existing canonical art can be translated, uniformly scaled, or perspective-
  registered for the scene, but its depicted identity cannot be regenerated.
- Every visible work must map one-to-one to a composition placement, Git
  canonical source, and Notion record. Anonymous visible artwork is forbidden.
- Empty supports and non-art ornament may remain when they strengthen the room.
- A changed placement advances the scene composition version without changing
  the artwork's canonical hash.

## Publication transaction

1. Reserve `room:<structure>/<room>` in the draft construction PR.
2. Persist the approved canonical source and hash.
3. Build the new immutable scene master from the prior approved master using an
   exhibit-contained repair mask.
4. Persist the composition manifest and every placement's support geometry,
   aperture, mask, proxy, layer order, and hotspot.
5. Rebuild responsive layered and fallback delivery plus the canonical
   inspector.
6. Idempotently upsert Notion by `Wisteria ID` with `Art Type`, canonical hash,
   composition version, preview/PR URL, and `Processing`.
7. Keep the PR draft until all deterministic, framework, build, loading, and
   desktop/mobile navigation checks pass.

If the Notion write fails, keep candidate output out of active publication and
leave the PR draft. Never create a duplicate record to work around an upsert
failure.
