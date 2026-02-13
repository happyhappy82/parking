import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.string(),
    category: z.enum(['블로그', '주차장']).optional().default('블로그'),
    notionPageId: z.string().optional(),
    breadcrumbName: z.string().optional(),
  }),
});

const parkingEditorial = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.string(),
    category: z.literal('주차장').optional().default('주차장'),
    notionPageId: z.string().optional(),
    breadcrumbName: z.string().optional(),
    sido: z.string().optional(),
    sigungu: z.string().optional(),
    dong: z.string().optional(),
    parkingSlug: z.string().optional(),
  }),
});

export const collections = { blog, 'parking-editorial': parkingEditorial };
