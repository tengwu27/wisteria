# Wisteria

Static-first landing page foundation for a premium business blending real estate, investment, design, and lifestyle.

## Stack

- Astro + TypeScript for static site generation and content-driven pages
- Tailwind CSS for styling and design tokens
- Astro Content Collections for typed projects, insights, and testimonials
- Netlify for deployment, forms, and future serverless functions

## Getting Started

```bash
npm install
npm run dev
```

The local development server runs at `http://localhost:4321`.

## Scripts

```bash
npm run dev      # Start Astro dev server
npm run build    # Type-check content and build to dist/
npm run preview  # Preview the production build locally
```

## Deployment

This repo is configured for Netlify.

- Build command: `npm run build`
- Publish directory: `dist`
- Config file: `netlify.toml`

Netlify Forms are enabled on the contact page for first-pass lead capture without a custom backend.

## Content Model

Core business data lives in `src/data`. Structured editorial and proof content lives in `src/content`:

- `src/data/site.ts`: brand, contact, social links, and SEO defaults
- `src/data/services.ts`: real estate, investment, design, and lifestyle pillars
- `src/content/projects`: featured opportunities and project stories
- `src/content/insights`: market, design, and lifestyle editorial entries
- `src/content/testimonials`: client and partner proof points

## Recommended Next Steps

1. Replace placeholder content with real brand copy and proof points.
2. Select the final visual direction, typography, and imagery.
3. Add real project photography or generated brand imagery.
4. Connect Netlify Forms notifications or a CRM integration if needed.
