import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        ink: '#171412',
        paper: '#fbfaf7',
        stone: '#e8e1d8',
        graphite: '#37302b',
        moss: '#5d6a52',
        brass: '#b08a55',
        clay: '#9a6a52'
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
