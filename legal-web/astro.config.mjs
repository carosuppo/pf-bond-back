import { defineConfig } from 'astro/config';

export default defineConfig({
  site: process.env.PUBLIC_SITE_URL ?? 'https://srv2008002.hstgr.cloud',
  base: '/legal',
  output: 'static',
  trailingSlash: 'always',
  vite: {
    server: {
      proxy: {
        '/user': 'http://localhost:3000',
      },
    },
  },
});
