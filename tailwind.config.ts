import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        ink: '#24231f', paper: '#fff8e7', milk: '#fffdf4', mist: '#f3e6c8',
        graphite: '#4d493f', ash: '#746e60', accent: '#ef526f', moss: '#69ad62', dusk: '#244d5a',
        sky: '#75d7ed', sunshine: '#ffd64f', mint: '#91d979', tomato: '#ff6c57'
      },
      fontFamily: {
        sans: ['LXGW WenKai', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        hand: ['LXGW WenKai', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        comic: ['ZCOOL KuaiLe', 'LXGW WenKai', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['Cormorant Garamond', 'Georgia', 'serif']
      },
      boxShadow: {
        soft: '7px 8px 0 #24231f'
      }
    }
  },
  plugins: [typography]
} satisfies Config;
