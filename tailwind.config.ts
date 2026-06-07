import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        ink: '#1c1a17',
        paper: '#fbfaf6',
        milk: '#fffdf8',
        mist: '#e8e3da',
        graphite: '#4b4740',
        ash: '#777168',
        accent: '#8b735d',
        moss: '#6f7768',
        dusk: '#2f3030'
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['Cormorant Garamond', 'Georgia', 'serif']
      },
      boxShadow: {
        soft: '0 24px 80px rgba(23, 20, 18, 0.10)'
      }
    }
  },
  plugins: [typography]
} satisfies Config;
