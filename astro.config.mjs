import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel/serverless';

export default defineConfig({
  site: 'https://parkingmap.kr',
  output: 'hybrid',
  adapter: vercel(),
  trailingSlash: 'always',
  prefetch: {
    prefetchAll: true,
  },
  integrations: [
    tailwind(),
    sitemap({
      filter: (page) => !page.includes('/admin/'),
    }),
  ],
  build: {
    format: 'directory'
  }
});
