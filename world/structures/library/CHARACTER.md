# Library Character Contract

The Library is Wisteria's warm cathedral of memory: a quiet, inhabited place
where books and discoveries are found through attention rather than presented
as a catalogue.

## Canonical identity

- The approved Grand Hall, Reading Table, and West Shelf artwork remains the
  authority for geometry, camera, crop, architecture, materials, lighting,
  objects, and interaction anchors.
- Preserve pale carved stone, dark walnut, patinated teal metalwork, aged
  brass, oxblood leather, botanical ornament, and pools of amber practical
  light.
- Keep the space calm, tactile, romantic, and Mediterranean. Evidence of
  unseen daily life is welcome; visible characters are not.

## Existing world identities

- Room: `library-grand-hall`
- Scene: `reading-table`
- Scene: `west-shelf`

Every room and scene is one unique physical place with its own stable ID,
artwork, geometry, objects, version, and construction lock. Wisteria has no
reusable room templates, scene templates, clones, or derived locations.
Multiple routes may target the same ID only when they genuinely lead to the
same physical place.

## Nested construction boundary

- Notion mirrors containment: Library → room → scene → item. It does not
  own geometry or navigation topology.
- A registered page-body or editorial-media edit is `content-only` and never
  unlocks construction.
- New items first bind to an unoccupied, already-visible compatible slot.
- If no slot fits, classify the request as additive construction and present
  the exact visual impact before any artwork is generated.
- New rooms and scenes require registered identities, parent anchors,
  protected regions, and approved navigation changes.
- Main structures remain manually constructed outside Notion.

## Protected construction

Once a preview is constructed, its placement and cinematic media lock. Text,
headings, links, attribution, and ordinary inline editorial media may continue
to change without unlocking construction.

- A room preserves camera, perspective, architecture, navigation, child
  apertures, and layer ownership.
- A scene preserves its parent anchor, camera relationship, geometry,
  materials, item masks, and hotspots.
- An item preserves its physical appearance, bounds, mask, hotspot, and
  content binding.
- Parent reconstruction may relight registered child regions coherently, but
  it cannot implicitly alter their geometry, materials, identity, anchors,
  masks, hotspots, or existence.
- A destructive parent prompt must stop until the user confirms every affected
  Wisteria ID. Record that confirmation as a narrowly scoped cascading unlock.

Any construction affecting Grand Hall holds the `room:library/library-grand-hall`
GitHub reservation until its pull request is merged or closed. Content-only
updates do not require a reservation.

## Delivery checks

- Preserve approved camera relationships, continuity anchors, and protected
  pixels.
- Keep hotspots legible but subtle at final display size.
- Validate keyboard navigation, reduced motion, mobile single-page reading,
  and desktop two-page spreads.
- Runtime pages must use stable Wisteria media paths, never temporary Notion
  download URLs.
