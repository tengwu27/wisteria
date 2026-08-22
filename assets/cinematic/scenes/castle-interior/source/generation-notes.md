# Castle interior candidate generation notes

## Immutable authority

- Master: `assets/cinematic/scenes/gamified-coastal-village/isometric-parallax/source/village-master.png`
- Master dimensions: `2412x941`
- Master SHA-256: `e7447f137434732aef9e91906d67d0ef6732830c037fd5527f3b8337c28c2abe`
- Architecture reference (local ignored archive): `assets/cinematic/archive/non-runtime/scenes/castle-interior/source/references/castle-village-architecture-reference.png`
- Reference derivation: crop master box `x=760, y=0, width=800, height=560`, then uniformly enlarge to `1600x1120` with Lanczos resampling.
- Reference SHA-256: `6c5f945267fea2de89d973b2d0bfb2e40e63d3b6ab289acdea5506a0c9d673b6`
- User bridgehead crop (local ignored archive): `assets/cinematic/archive/non-runtime/scenes/castle-interior/source/references/castle-front-gate-bridgehead-reference.png`
- User bridgehead crop SHA-256: `02fe7d37376ea2aa9f4b7f2c33853e2ab373c12b4b5d5fed2d90710553204f36`

The full master defines topology, geography, daylight, palette, and material language. The deterministic crop defines the castle's visible architectural identity. Every candidate was generated independently from these two images. Rejected generations were never reused as inputs.

The two reference crops are retained locally for authoring provenance but are
excluded from Git. They are not required by the website or the delivery build.

## Approved courtyard master

- File: `approved/castle-courtyard-approved.png`
- Dimensions: `1672x941`
- SHA-256: `8ccf2a9bf455c3a9373b92c9789445ae59c2a07621d3394eec1d69c3fed17d07`

Accepted prompt intent:

> Create a 16:9, human-eye-level panoramic view from immediately inside the central blue-roofed main building's existing front arch, looking outward across the existing courtyard toward the compact gatehouse and terraced defenses. The main building and its roof remain behind and above the camera and cannot appear as an exterior facade. Limit the interior to the known arch's pale-limestone jambs and soffit, a shallow threshold, and a narrow strip of stone floor. Preserve the compact asymmetric hill-castle scale, warm daylight, pale masonry, muted blue and restrained terracotta roofs, and reference-supported vegetation. Add no rooms, wings, towers, openings, stairs, props, people, heraldry, text, or narrative function.

The first generation was rejected because it displayed the central main building outside the camera and added unsupported courtyard stairs. The accepted version was regenerated directly from the immutable references with those constraints strengthened.

## Approved arcade master

- File: `approved/castle-arcade-approved.png`
- Dimensions: `1672x941`
- SHA-256: `68beebe0d01f5b95b8e371c902ea0a410330a002ea0dd7d38cc73bd1faf26ff7`

Accepted prompt intent:

> Create a 16:9, human-eye-level panoramic view beneath the existing short rear arcade. Show exactly three principal round arches in a compact gallery, looking diagonally along its pale-stone piers. Through the arches, reveal only a partial, subordinate view of the reference-supported courtyard and compact central blue-roofed castle cluster. Preserve the existing square terracotta-roofed end tower relationship, asymmetric scale, warm daylight, pale masonry, restrained blue and terracotta accents, and reference-supported vegetation. Do not turn the arcade into a cloister or new wing, and add no palace facade, Gothic cathedral, giant spire, extra arches, rooms, openings, stairs, furniture, people, heraldry, text, or narrative function.

The first generation was rejected because it enlarged the compact central block into an unsupported Gothic palace and added excessive spires. The accepted version was regenerated directly from the immutable references with the building made partial and subordinate and the arcade fixed to three openings.

## Approved gate master

- File: `approved/castle-gate-approved.png`
- Dimensions: `1672x941`
- SHA-256: `51ab56ee6bd6b361255261f22115b0ebf3db0351481f6b2f933abaca67a29559`

Accepted prompt intent:

> Create a 16:9, human-eye-level panoramic view from the head of the existing stone bridge/causeway, looking directly toward the compact front gatehouse. The causeway and plain low parapets lead to one open arched passage. Through that opening, reveal the courtyard and the compact castle hall beyond, identified by exactly one dominant muted-blue roof/tower mass and one adjacent orange/terracotta-roofed square tower. Keep the gatehouse near and dominant, preserve its short pale-stone form and restrained orange-roof corner turrets, and prevent the background hall from expanding into the complete castle skyline. Add no moat, drawbridge, portcullis, bridge ornaments, extra gates, extra towers, palace wings, props, people, heraldry, text, or narrative function.

The first generation was rejected because it inflated the compact castle into a large fantasy palace and multiplied the towers. The accepted version was regenerated independently from the immutable master, deterministic castle crop, and user-supplied bridgehead crop with the skyline locked to the requested blue and orange roof identities.

## Status

All three images were approved on 2026-08-20 as the immutable masters for the
castle gate, courtyard, and arcade routes. Delivery derivatives must be built
from these masters and never used as future generation inputs.
