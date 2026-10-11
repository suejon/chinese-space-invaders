import { defineConfig } from 'vite';

// GitHub Pages serves the site from /<repo>/.
export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/chinese-space-invaders/' : '/',
  // Phaser alone is ~1.2 MB minified.
  build: { chunkSizeWarningLimit: 1600 },
});
