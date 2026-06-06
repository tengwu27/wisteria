import { defineCollection, z } from 'astro:content';

const projects = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    category: z.enum(['Real Estate', 'Investment', 'Design', 'Lifestyle']),
    location: z.string(),
    image: z.string().optional(),
    featured: z.boolean().default(false),
    order: z.number().default(0)
  })
});

const insights = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    category: z.enum(['Market', 'Investment', 'Design', 'Lifestyle']),
    publishedAt: z.date(),
    author: z.string().default('Wisteria'),
    featured: z.boolean().default(false)
  })
});

const testimonials = defineCollection({
  type: 'content',
  schema: z.object({
    author: z.string(),
    role: z.string(),
    quote: z.string(),
    featured: z.boolean().default(false),
    order: z.number().default(0)
  })
});

export const collections = {
  projects,
  insights,
  testimonials
};
