import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';

import react from '@astrojs/react';

export default defineConfig({
  site: 'https://our-life-collected.example.com',
  output: 'static',
  integrations: [tailwind({
    applyBaseStyles: false
  }), sitemap(), react()]
});