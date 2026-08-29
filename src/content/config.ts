import { defineCollection, z } from 'astro:content';

const imageKey = z.enum([
  'heroStillness',
  'artPaperStudy',
  'artWindowLight',
  'artRetroStudio',
  'lifestyleTable',
  'lifestyleShelf',
  'lifestyleRetroMorning',
  'travelCoast',
  'travelGarden',
  'travelRetroCoast',
  'portraitPlaceholder'
]);

const bookPage = z
  .object({
    layout: z.enum(['title', 'prose', 'image', 'prose-image']),
    imageKey: imageKey.optional(),
    imageAlt: z.string().min(1).optional(),
    imageCaption: z.string().optional()
  })
  .superRefine((page, context) => {
    const needsImage = page.layout === 'image' || page.layout === 'prose-image';
    if (needsImage && (!page.imageKey || !page.imageAlt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${page.layout} pages require imageKey and imageAlt`
      });
    }
  });

const bookPresentation = z.object({
  artifactId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  kind: z.literal('book'),
  fixture: z.boolean().default(false),
  noindex: z.boolean().default(false),
  cover: z.object({
    titleZh: z.string().min(1),
    titleEn: z.string().min(1),
    emblem: z.enum(['wisteria', 'sun', 'wave']),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    foil: z.string().regex(/^#[0-9a-fA-F]{6}$/)
  }),
  pages: z.array(bookPage).min(1).max(64)
});

const galleryImage = z.object({
  imageKey,
  alt: z.string(),
  caption: z.string().optional()
});

const art = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    year: z.number(),
    creator: z.string(),
    medium: z.string(),
    category: z.enum(['painting', 'illustration', 'photography', 'digital art', 'design', 'objects', 'experiments']),
    dimensions: z.string().optional(),
    coverImage: imageKey,
    coverAlt: z.string(),
    excerpt: z.string(),
    caption: z.string().optional(),
    gallery: z.array(galleryImage).default([]),
    featured: z.boolean().default(false),
    published: z.boolean().default(true),
    tags: z.array(z.string()).default([]),
    order: z.number().default(0),
    book: bookPresentation.optional()
  })
});

const lifestyle = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    contentType: z.enum(['original', 'external']),
    author: z.string(),
    sourceName: z.string().optional(),
    externalUrl: z.string().url().optional(),
    embedUrl: z.string().url().optional(),
    coverImage: imageKey,
    coverAlt: z.string(),
    excerpt: z.string(),
    personalNote: z.string().optional(),
    featured: z.boolean().default(false),
    published: z.boolean().default(true),
    tags: z.array(z.string()).default([]),
    order: z.number().default(0),
    book: bookPresentation.optional()
  })
});

const travel = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    destination: z.string(),
    country: z.string(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date().optional(),
    year: z.number(),
    coordinates: z
      .object({
        lat: z.number(),
        lng: z.number()
      })
      .optional(),
    coverImage: imageKey,
    coverAlt: z.string(),
    excerpt: z.string(),
    tripCategory: z.string().optional(),
    gallery: z.array(galleryImage).default([]),
    highlights: z.array(z.string()).default([]),
    featured: z.boolean().default(false),
    published: z.boolean().default(true),
    tags: z.array(z.string()).default([]),
    order: z.number().default(0),
    book: bookPresentation.optional()
  })
});

export const collections = {
  art,
  lifestyle,
  travel
};
