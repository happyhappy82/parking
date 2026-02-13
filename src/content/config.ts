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

export const collections = { blog };
