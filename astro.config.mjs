import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: 'https://wisteria.example.com',
  output: 'static',
  integrations: [
    tailwind({
      applyBaseStyles: false
    }),
    sitemap()
  ]
});
