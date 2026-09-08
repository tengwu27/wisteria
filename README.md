# Wisteria

Wisteria is a living digital town for memories, writing, discoveries, art, and
places that matter. It is designed to feel less like browsing a website and
more like entering a place: content is encountered as a book on a shelf, a
painting in a salon, a letter on a table, or a room reached through quiet
exploration.

The project joins three systems without confusing their responsibilities:
Notion is the town's living editorial memory, Git is its durable physical and
visual construction record, and Netlify turns both into the public Astro
experience.

## The Flow Design Thesis

Wisteria is organized around **attention, continuity, and gentle discovery**.
The goal is not to maximize clicks or expose every piece of content at once.
It is to help a visitor settle into a place, notice something with curiosity,
and remain with it long enough for reading or reflection to become effortless.

The intended rhythm is:

```text
arrive → orient → notice → approach → focus → dwell → return
```

- **Arrive without interruption.** A cinematic establishing view gives the
  visitor time to understand the atmosphere and geography before asking for an
  action.
- **Orient spatially.** Buildings, rooms, tables, shelves, paths, and apertures
  create a memorable world model. Navigation is a movement through that model,
  not a jump between unrelated templates.
- **Discover through attention.** Hotspots remain legible but quiet. They
  reveal themselves through proximity, focus, and exploration instead of
  competing as a wall of cards or calls to action.
- **Move from world to detail.** Each interaction progressively narrows the
  field—from village, to building, to room, to object, to content—while
  preserving a clear way back.
- **Protect the focused state.** Reading and artwork inspection reduce visual
  noise, preserve comfortable pacing, and let the content become the dominant
  layer.
- **Keep motion meaningful.** Parallax, pans, aperture reveals, and route
  transitions communicate depth and continuity. They are not decoration, and
  reduced-motion and keyboard paths remain first-class experiences.
- **Reward return visits.** Discovered rooms and familiar spatial anchors make
  the town feel increasingly known without turning exploration into a game
  checklist.

This produces a quiet form of flow: the challenge of exploration stays small
and readable, feedback is immediate, and each action has an obvious relation
to the place the visitor is already inhabiting.

## Notion as the Living Content Layer

Notion is Wisteria's **only editorial and runtime content database**. It is
where writing is drafted, revised, organized, and given publishing intent.
The Notion hierarchy mirrors the physical town, so authors work in context
rather than managing coordinates or implementation records:

```text
Notion authoring
  → nested building / room / scene / item
  → verified page identity and status
  → webhook or scheduled Netlify build
  → read-only content synchronization
  → stable local media and content snapshot
  → Astro pages inside the registered Wisteria world
```

A Notion page owns living editorial material: title, body, description,
ordinary media, credits, annotations, appearance intent, and lifecycle status.
Its stable page ID binds that material to one constructed Wisteria entity.
Editing the body of a registered page updates content without moving the book,
repainting the room, changing a hotspot, or unlocking a cinematic asset.

Git owns what must remain spatially and visually exact: Wisteria IDs,
containment contracts, navigation topology, camera and geometry, canonical
artwork, masks, hotspots, composition versions, locks, releases, and history.
This division lets Notion stay pleasant for everyday authors while preventing
an editorial edit from silently reconstructing the town.

`Draft` and `Ready` express author intent. `Ready` is deliberately not an
automatic generation button: Codex first analyzes impact, explains the exact
construction change, and waits for approval. Approved structural or visual
work then moves through a branch, preview, pull request, release record, and
production verification. Ordinary edits to already registered content can
flow directly through the build pipeline.

Netlify reads from Notion during a build, verifies registered identities and
schemas, downloads media, hashes it, and emits stable public paths. The public
site never depends on temporary Notion attachment URLs, and a build cannot
write back to Notion or initiate generative construction.

## The Wisteria Town Style

Wisteria is a romantic Mediterranean world rendered as high-detail,
hand-painted cinematic environment art. Its identity combines gentle
storybook environmental storytelling with intricate Gothic and Art Nouveau
architecture. The town should feel inhabited, cared for, and slightly
weathered by salt air—even when no person is visible.

The shared material and color language includes pale carved limestone, warm
walnut, patinated teal metalwork, aged brass, blue-and-white ceramics, mustard
textiles, oxblood leather, botanical ornament, hanging flowers, terraced
vegetation, luminous coastal blues, and pools of amber practical light.
Whimsical machinery is handcrafted and functional rather than futuristic.

The visual grammar follows a few durable rules:

- exterior village views preserve the approved isometric geography, coastline,
  roads, terraces, docks, landmarks, and layered depth;
- interiors use an inviting eye-level viewpoint, believable wide-angle
  perspective, tactile materials, and a clear foreground, midground, and
  background;
- warm interiors are balanced against cool coastal daylight, with focal
  objects and navigation apertures immediately readable;
- small props and signs of unseen daily life carry the story, while clutter,
  invented text, visible characters, modern minimalism, neon science fiction,
  and photorealistic treatment are avoided;
- each room may have a distinct local character, but it must remain recognizably
  part of the same coastal town.

The canonical visual authorities are the
[`core-village-master.png`](assets/cinematic/scenes/gamified-coastal-village/isometric-parallax/source/core-village-master.png)
for the exterior world and
[`windmill-cafe-approved.png`](assets/cinematic/scenes/windmill-cafe-interior/source/windmill-cafe-approved.png)
for the interior language. Scene-specific approved masters govern local
geometry, lighting, props, and interaction anchors.

## The Everyday Authoring Flow

The Library is organized like a physical place:

```text
Wisteria
└── Library
    └── Rooms
        └── Grand Hall
            └── Scenes
                ├── Reading Table
                │   └── Items
                └── West Shelf
                    └── Items
```

Containment determines location. An item created in Reading Table's Items
database already belongs to Library → Grand Hall → Reading Table, so the author
does not choose its building, room, scene, coordinates, hotspot, or technical
representation in a large table.

All registered Notion databases are inline by default. Their primary view is a
`Tiles` gallery with every property visible and wrapped.

### Edit a book that already exists in Wisteria

1. Open the book's Notion page.
2. Edit its title or page body, or add/remove ordinary editorial photographs,
   scans, links, and credits.
3. Leave its construction prompt and placement alone.
4. Save normally.

This is a content-only change. The existing book, hotspot, scene, artwork, and
navigation stay locked. If the Notion webhook is configured, the edit triggers
a Netlify build automatically. Otherwise it appears on the next manual or
scheduled build. Long text is repaginated by the reader without scene
construction or code changes.

### Add a new container-revealed item or change its physical appearance

1. Enter the Items database inside the intended scene, such as Reading Table
   or West Shelf.
2. Create a new tile and write the content in the page body.
3. Fill the three visible properties:

   - `Title`
   - `Appearance Prompt`—how the physical item should look, not its article
     content
   - `Wisteria Status`

4. Keep the item in `Draft` while writing.
5. Change it to `Ready` only when you want Codex to analyze construction.
6. Ask Codex: **Process Ready Wisteria entities.**

`Ready` never starts generative work by itself. Codex first produces an impact
plan and stops. It explains whether the item can bind to an existing visible
slot or needs new artwork, a hotspot, masks, or other scene changes. No branch,
pull request, or artwork is created until that exact plan is approved in chat.

After approval, Codex creates a fresh construction branch and draft pull
request, acquires the room reservation, constructs a pending preview, and asks
for preview approval. Existing production remains unchanged throughout this
process.

### Curate a painting into a scene

Paintings are self-revealing: their content is physically visible in the room,
so a generic slot cannot hide changes in size, aspect ratio, or composition.
They use a Codex-first curation flow instead of the Ready-item flow:

1. Ask Codex to create or hang a painting in a named curated scene and provide
   the artistic brief.
2. Codex verifies the latest scene composition and every existing canonical art
   hash, then generates a temporary standalone painting and updated room view.
3. Review both together. Nothing is written to Git, Notion, a PR, or the active
   scene before visual approval.
4. After approval, Codex reserves the room in a draft PR, persists the canonical
   painting and next composition version, rebuilds masks/proxies/hotspots and
   the inspector, then idempotently catalogs the work in Notion as `Processing`.

Notion owns the painting's title, artistic prompt, preview image, status, and
annotations. Git owns its immutable canonical source and SHA-256, scene masters,
composition manifests, and release history. A Notion `Ready` value is
informational for self-revealing art and never generates, binds, or rearranges
it. Paintings execute in v1; sculpture and installation are reserved schema
types.

### Change a room or scene

Rooms and scenes follow the same deliberate pattern:

| Entity | Name property | Construction property | Status property |
| --- | --- | --- | --- |
| Room | `Room Name` | `Room Prompt` | `Wisteria Status` |
| Scene | `Scene Name` | `Scene Prompt` | `Wisteria Status` |
| Item | `Title` | `Appearance Prompt` | `Wisteria Status` |

The page body is the living authoring space for description, atmosphere,
history, references, and content. Prompt edits remain inert until the entity is
deliberately marked `Ready` and processed through Codex.

Registered descendants are protected. For example, reconstructing Grand Hall
cannot silently remove the Reading Table, West Shelf, their books, masks, or
hotspots. A destructive change stops until the user confirms every affected
Wisteria ID in Codex chat. New main village structures remain a manual design
process outside Notion.

Do not casually move or delete a registered Notion page: its Notion page ID is
part of the permanent content binding. Unbinding or relocating a constructed
item requires an explicit construction decision.

## Status Lifecycle

```text
Draft
  ↓ user requests construction
Ready
  ↓ user approves Codex's impact plan and a PR reserves the room
Processing
  ↓ construction PR merges into main
Landed
  ↓ that exact commit is verified in production
Alive
```

- The author normally controls `Draft` and `Ready`.
- Codex and deployment verification control `Processing`, `Landed`, and
  `Alive`.
- Manually typing a system state has no publishing or unlocking authority.
- Page-body edits to an already registered item remain content-only in any
  lifecycle state.
- A prompt change requires explicit processing; `Ready` alone cannot publish.
- Closing an unmerged construction PR releases its reservation and returns the
  affected entities to `Ready`.

## What Lives Where

| System | Authority |
| --- | --- |
| Notion | Editorial content, descriptions, prompts, preview media, statuses, annotations, and author intent |
| Git | Stable Wisteria IDs, canonical art hashes/media, hierarchy, spatial graph, composition versions, geometry, masks, hotspots, locks, cinematic assets, and history |
| GitHub pull requests | Construction currently in progress and its room reservation |
| Netlify | Preview builds, production delivery, and evidence that a landed commit is `Alive` |

Notion attachments are downloaded during the build, validated, hashed, and
emitted at stable runtime paths under `/media/notion/library/`. The website
never depends on Notion's temporary signed download URLs. Cinematic masters,
masks, manifests, geometry, and prompts remain in Git during the pilot.

The Castle Gallery is registered as a `curated-exhibit`. Its exhibit region is
fixed, while painting frames, apertures, supports, placements, and hotspots are
owned by the composition version. Every visible painting must map to one Git
canonical asset, one manifest placement, and one Notion catalog record; anonymous
visible artwork is not allowed.

The permanent Library contract is in `world/structures/library/`:

- `CHARACTER.md` defines atmosphere, identity, and construction boundaries.
- `locations.json` registers rooms, scenes, visible slots, and spatial edges.
- `construction-ledger.json` records stable identities, placements, versions,
  locks, releases, and construction history.
- `protected-assets.json` detects cinematic changes without an approved unlock.
- `notion.json` records Notion identities and database-view defaults.

The Library map and direct navigation use the Git-managed spatial graph.
Notion mirrors containment but does not control navigation topology.

## Content Synchronization

The webhook endpoint is:

```text
/.netlify/functions/notion-library-webhook
```

For a registered item, a trusted Notion page event can trigger the configured
Netlify build hook. The webhook only requests content synchronization; it never
invokes Codex or generative construction. New, unregistered items stay out of
the website until they complete the explicit construction workflow.

Production and deploy previews require a working Notion connection. Production
also requires a locked construction record and repository Release ID. Preview
builds may show registered items that have not yet been released; production
does not.

Netlify builds are read-only toward Notion: they verify the registered schemas,
views, page identities, and canonical hashes, then synchronize content into
local build snapshots. Schema creation, gallery-view configuration, and
approved artwork upserts are separate maintainer commands and never run as a
side effect of `npm run build`.

Required environment variables are documented in `.env.example`:

```text
NOTION_TOKEN
NOTION_WEBHOOK_VERIFICATION_TOKEN
NETLIFY_LIBRARY_BUILD_HOOK
WISTERIA_NOTION_REQUIRED
WISTERIA_NOTION_MAX_MEDIA_BYTES
```

The Notion integration must be connected to the Library hierarchy and be able
to read and update content. Netlify and GitHub require their own configured
secret; Codex's managed Notion connection cannot be exported to them.

## Local Development

```bash
npm install
npm run dev
```

The local site runs at `http://localhost:4321`. Development synchronizes
registered Library items and prepares the bilingual book font before Astro
starts. Without `NOTION_TOKEN`, local development may reuse the last valid
preview snapshot. Netlify fails closed when its required token is missing.

Core checks:

```bash
npm run lint
npm run build
npm run preview
npm run test:library-framework
npm run test:wisteria-reservations
```

Application builds consume the committed, hash-locked cinematic delivery
assets; they never regenerate scene masters or layer bundles. Run a scene's
dedicated `assets:*:build` command only during an explicitly approved
construction session, then review and register the resulting hashes before
committing them.

Castle art-catalog operations:

```bash
npm run notion:castle:ensure-art-catalog
npm run notion:castle:catalog-approved
npm run notion:castle:sync
npm run notion:castle:verify
```

`notion:castle:ensure-art-catalog` is a read-only schema and identity check.
`notion:castle:catalog-approved` is only for a visually approved curation
transaction; it may extend the schema and creates or updates canonical art
metadata as `Processing`.

Library operations:

```bash
npm run notion:library:sync
npm run notion:library:process
npm run notion:library:verify
npm run notion:library:verify-notion
npm run notion:library:ensure-inline
npm run notion:library:ensure-gallery
```

`notion:library:process` is analysis-only. It writes
`.wisteria-cache/library-impact.json` and does not construct, create a branch,
open a pull request, change Notion status, or publish anything.

Maintainer-only construction commands:

```bash
# Narrowly allow exact registered descendants to change
npm run notion:library:unlock -- --root <id> --affected <id,id> --scope room --reason "reason" --approved-by "name"

# Prepare an explicitly approved preview for landing
npm run notion:library:release -- --ids <id,id> --confirm-approved-preview

# Prepare a release for any registered structure after preview approval
npm run notion:release -- --structure <structure> --ids <id,id> --pr <number> \
  --base-commit <40-char-sha> --preview-commit <40-char-sha> \
  --preview-url <https-url> --confirm-approved-preview
```

The generic release command fails closed on a stale base, mismatched PR or
construction hash, missing reservation, or non-exact commit SHA. A successful
run locks the approved construction hashes, creates stable Release IDs, records
the approved preview in history, and releases the room reservation. It does not
mark Notion `Landed` or `Alive`: a `main` push performs the former, and a
successful production deployment of that exact commit performs the latter.
The **Wisteria Deployment Lifecycle** workflow also provides a manual dispatch
for first-run reconciliation.

Construction affecting Grand Hall conservatively reserves
`room:library/library-grand-hall`. The oldest eligible open construction PR
owns that scope. An abandoned reservation never expires silently: close its PR
or use the manual **Wisteria Force Release** workflow with an audit reason.

## Stack and Deployment

- Astro + TypeScript for the static-first experience
- Tailwind CSS for styling and design tokens
- Notion for nested Library authoring
- GitHub Actions for reservation and deployment lifecycle checks
- Netlify for previews and production deployment

Notion is Wisteria's only editorial and runtime content database. Git retains
stable identities, spatial construction, visual presentation, canonical media,
locks, releases, and history; these construction records are not an alternate
content source.

Netlify uses `npm run build` and publishes `dist/`; configuration lives in
`netlify.toml`.

## Village Artwork Architecture

- `assets/cinematic/scenes/gamified-coastal-village/isometric-parallax/source/`
  contains the approved geometry master and authoring material.
- `assets/cinematic/scenes/gamified-coastal-village/isometric-parallax/registered/`
  contains optimized registered plates and the flattened fallback imported by
  Astro.
- `assets/cinematic/scenes/gamified-coastal-village/isometric-parallax/proofs/`
  contains the accepted neutral-composite evidence.
- Scene-specific `CHARACTER.md`, manifests, geometry, and delivery assets live
  beside their owning structure or scene.

The village overview currently uses a native two-axis `1.03×` exploration
canvas. Hotspots remain nested with their owning artwork planes so scrolling
and parallax cannot detach interaction geometry from the image.

## Privacy

Before publishing real media, remove unintended EXIF location metadata. Avoid
public home addresses, exact live locations, private travel plans, and other
sensitive personal details.
