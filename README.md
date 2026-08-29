# Our Life, Collected

Static-first personal world for art, lifestyle notes, travel stories, and meaningful discoveries.

## Stack

- Astro + TypeScript for static site generation and content-driven pages
- Tailwind CSS for styling and design tokens
- Astro Content Collections for typed Art, Lifestyle, and Travel entries
- Supabase-ready content adapter with local Markdown fallback
- Netlify for deployment

## Getting Started

```bash
npm install
npm run dev
```

The local development server runs at `http://localhost:4321`.

## Scripts

```bash
npm run dev      # Start Astro dev server
npm run lint     # Run Astro content/type checks
npm run build    # Type-check content and build to dist/
npm run preview  # Preview the production build locally
```

## Nested Library Notion Pilot

The Library mirrors physical containment in Notion: **Rooms → Grand Hall →
Scenes → Reading Table or West Shelf → Items**. Each database exposes only a
name, a construction prompt, and Wisteria Status. Page bodies hold descriptions,
writing, links, credits, and editorial media.

Notion is authoritative for content and creative intent. Git remains
authoritative for room identity, spatial topology, geometry, descendant locks,
hotspots, cinematic media, and construction history. Open labeled GitHub pull
requests coordinate construction in progress.

The canonical contract and machine-readable state are in
`world/structures/library/`:

- `CHARACTER.md` defines the Library's atmosphere and construction boundaries.
- `locations.json` registers the spatial graph, rooms, scenes, and visible slots.
- `construction-ledger.json` registers every entity and its dependency locks.
- `protected-assets.json` detects unapproved cinematic-media changes in CI.
- `notion.json` records the connected Notion page and data-source identities.

Configure local or Netlify environment variables from `.env.example`. The
Notion integration must be connected to the Library hierarchy and have
read/update content capabilities.

```bash
npm run notion:library:process         # Analyze Ready entities; never constructs
npm run notion:library:sync            # Mirror registered item content and media
npm run notion:library:verify          # Enforce registry, lock, and cinematic hashes
npm run notion:library:verify-notion   # Verify the live nested schemas and identities
npm run test:library-framework         # Exercise intents, descendant locks, and releases
npm run test:wisteria-reservations    # Exercise competing PR and lifecycle locks

# Explicitly allow exact registered descendants to change
npm run notion:library:unlock -- --root <id> --affected <id,id> --scope room --reason "reason" --approved-by "name"

# Prepare approved preview records before merging the construction PR
npm run notion:library:release -- --ids <id,id> --confirm-approved-preview
```

`npm run dev` syncs registered nested Items before opening the local site.
If the API token is temporarily unavailable, local development may reuse the
last valid generated preview snapshot; production never uses this fallback.
Production builds include only records with a repository Release ID. Notion
status alone cannot publish. Notion-hosted attachments are
downloaded, validated, hashed, and emitted under
`/media/notion/library/<entry>/<content-hash>.<ext>`; runtime pages never use
Notion's expiring signed URLs.

Netlify production and deploy previews set `WISTERIA_NOTION_REQUIRED=1`, so a
missing API token fails the deployment instead of publishing a stale or
unexpectedly empty Library. Preview builds may show registered unreleased
items; production builds always require a Release ID.

The Netlify function at `/.netlify/functions/notion-library-webhook` accepts the
Notion webhook. Set `NOTION_WEBHOOK_VERIFICATION_TOKEN` after the subscription
handshake and set `NETLIFY_LIBRARY_BUILD_HOOK` to the site's build hook. The
webhook may trigger content builds for registered items, but it never invokes
Codex or generative construction.

Use the project skill **Process Ready Wisteria entities** for construction. It
first writes `.wisteria-cache/library-impact.json` and waits for explicit user
approval. Only then does Codex create a construction branch and draft PR. The
open PR owns the Grand Hall reservation until merged or closed.
An abandoned open reservation never expires silently: close the PR or invoke
the manual **Wisteria Force Release** workflow with an audit reason.

## Deployment

This repo is configured for Netlify.

- Build command: `npm run build`
- Publish directory: `dist`
- Config file: `netlify.toml`

No analytics, cookies, or public login are required for this version.

## Supabase Content

The site now reads content through `src/lib/content.ts`.

- Without Supabase environment variables, it falls back to local Markdown in `src/content`.
- With `SUPABASE_URL` and `SUPABASE_ANON_KEY`, it reads published rows from `public.content_entries`.
- The expected Supabase schema is in `supabase/schema.sql`.

Each Supabase row uses:

- `collection`: `art`, `lifestyle`, or `travel`
- `slug`: route slug, for example `soft-geometry`
- `published`: whether the row is visible
- `data`: JSON matching the current front matter shape for that collection
- `body_markdown`: Markdown body text, rendered during the Astro build
- `body_html`: optional pre-rendered HTML override

Add the same environment variables in Netlify, then create a Netlify build hook and call it after Supabase content changes.

## Content Model

Core site settings live in `src/data`. Structured content lives in `src/content`:

- `src/data/site.ts`: site title, tagline, hero settings, introduction, SEO defaults, and replacement placeholders
- `src/content/art`: artworks, studies, experiments, and detail stories
- `src/content/lifestyle`: original stories and external discoveries
- `src/content/travel`: timeline entries and travel-story pages

Every collection schema is defined in `src/content/config.ts`.

## Adding Content

Add a new Markdown file to the relevant collection folder:

```text
src/content/art/my-artwork.md
src/content/lifestyle/my-story.md
src/content/travel/my-trip.md
```

Use the existing sample entries as templates. Keep `published: true` for entries that should appear on the site. Replace all placeholder names, dates, locations, image captions, and biography text before publishing real content.

For Lifestyle entries:

- Use `contentType: "original"` for writing created by you.
- Use `contentType: "external"` for discoveries from elsewhere.
- External entries should include `externalUrl` and a short `personalNote`.

## Replacing Hero Media

Hero content is configured in `src/data/site.ts`.

```ts
hero: {
  mediaType: 'image',
  imageKey: 'heroStillness',
  title: 'Our Life, Collected',
  subtitle: 'Art, places, and fragments of a life together.',
  alignment: 'left'
}
```

Placeholder images are mapped in `src/assets/images/placeholders.ts`. Add new local media files under `src/assets/images`, import them in that file, and use the new key in content front matter or hero settings.

Do not autoplay video with sound.

## Village Artwork Architecture

- `assets/cinematic/scenes/gamified-coastal-village/isometric-parallax/source/`:
  approved geometry master and overlapping high-detail authoring tiles.
- `assets/cinematic/scenes/gamified-coastal-village/isometric-parallax/registered/`:
  optimized village, cloud, and flattened fallback plates imported by Astro.
- `assets/cinematic/scenes/gamified-coastal-village/isometric-parallax/proofs/`:
  the accepted neutral registered composite used for visual validation.
- `scripts/`: asset validation, content generation, and media-rendering tools,
  grouped by responsibility.

The approved tile-stitch recipe lives beside the scene under
`isometric-parallax/scripts/` so the master can be reproduced without retaining
experimental generations.

## Privacy Notes

Before publishing real media, remove unintended EXIF location metadata from photos. Avoid public home addresses, exact live locations, private travel plans, and sensitive personal details.

## Recommended Next Steps

1. Replace anonymous placeholders with real names, biography, and copy.
2. Replace abstract placeholder images with real photographs, artwork, or video.
3. Update `astro.config.mjs`, `src/data/site.ts`, and `public/robots.txt` with the final production URL.
4. Deploy to Netlify using the build command and publish directory above.
