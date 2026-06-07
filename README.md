# Our Life, Collected

Static-first personal website for a married couple’s art, lifestyle notes, travel stories, and meaningful discoveries.

## Stack

- Astro + TypeScript for static site generation and content-driven pages
- Tailwind CSS for styling and design tokens
- Astro Content Collections for typed Art, Lifestyle, and Travel entries
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

## Deployment

This repo is configured for Netlify.

- Build command: `npm run build`
- Publish directory: `dist`
- Config file: `netlify.toml`

No backend, analytics, cookies, login, or CMS are included in this first version.

## Content Model

Core site settings live in `src/data`. Structured content lives in `src/content`:

- `src/data/site.ts`: site title, tagline, hero settings, introduction, SEO defaults, and replacement placeholders
- `src/data/services.ts`: home page chapter links for Art, Lifestyle, and Travel
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

Future public videos can be stored under `public/videos`. Do not autoplay video with sound.

## Privacy Notes

Before publishing real media, remove unintended EXIF location metadata from photos. Avoid public home addresses, exact live locations, private travel plans, and sensitive personal details.

## Recommended Next Steps

1. Replace anonymous placeholders with real names, biography, and copy.
2. Replace abstract placeholder images with real photographs, artwork, or video.
3. Update `astro.config.mjs`, `src/data/site.ts`, and `public/robots.txt` with the final production URL.
4. Deploy to Netlify using the build command and publish directory above.
