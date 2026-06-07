import { defineCollection, z } from 'astro:content';

const imageKey = z.enum([
  'heroStillness',
  'artPaperStudy',
  'artWindowLight',
  'lifestyleTable',
  'lifestyleShelf',
  'travelCoast',
  'travelGarden',
  'portraitPlaceholder'
]);

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
    order: z.number().default(0)
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
    order: z.number().default(0)
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
    order: z.number().default(0)
  })
});

export const collections = {
  art,
  lifestyle,
  travel
};
