import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://seifenspender.example',
  base: '/',
  trailingSlash: 'always',
  integrations: [
    tailwind(),
    sitemap(),
  ],
  i18n: {
    defaultLocale: 'de',
    locales: ['de', 'en'],
    fallbackLocale: 'de',
    routing: {
      prefixDefaultLocale: true,
      redirectToDefaultLocale: true,
    },
  },
  vite: {
    build: {
      assetsInlineLimit: 4096,
    },
  },
  compressHTML: true,
  experimental: {
    contentIntellisense: true,
  },
});