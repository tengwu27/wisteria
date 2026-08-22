import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';

import react from '@astrojs/react';

export default defineConfig({
  site: 'https://our-life-collected.example.com',
  output: 'static',
  redirects: {
    '/art/archive': '/library',
    '/lifestyle/archive': '/library',
    '/travel/archive': '/library',
    '/art/quiet-window-study': '/library',
    '/art/soft-geometry': '/library',
    '/lifestyle/a-found-essay': '/library',
    '/lifestyle/morning-table-notes': '/library',
    '/travel/garden-walk': '/library',
    '/travel/winter-coastline': '/library',
    '/travel/supabase-test-trip': '/library'
  },
  integrations: [tailwind({
    applyBaseStyles: false
  }), sitemap({
    filter: (page) =>
      !page.includes('/prototype/') &&
      !page.includes('/collection/') &&
      !/(\/art\/archive|\/lifestyle\/archive|\/travel\/archive|\/art\/quiet-window-study|\/art\/soft-geometry|\/lifestyle\/a-found-essay|\/lifestyle\/morning-table-notes|\/travel\/garden-walk|\/travel\/winter-coastline|\/travel\/supabase-test-trip)\/?$/.test(page)
  }), react()]
});
