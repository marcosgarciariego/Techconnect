// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import vercel from '@astrojs/vercel';

export default defineConfig({
  integrations: [
    react(),
    tailwind(),
  ],
  output: 'server',
  adapter: vercel(),
  server: {
    port: 4321,
    host: true,
  },
  vite: {
    optimizeDeps: {
      exclude: ['@prisma/client'],
    },
  },
});
