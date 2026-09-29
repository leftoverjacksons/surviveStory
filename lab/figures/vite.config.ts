// The figure studio's own dev server (the game's vite.config.ts is untouched).
//   npx vite --config lab/figures/vite.config.ts   (or: npm run figures)
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: here,
  server: {
    port: 5181,
    strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:5180' },
    // The studio shows figures through the game's own character code and clips.
    fs: { allow: [path.resolve(here, '../..')] },
  },
});
