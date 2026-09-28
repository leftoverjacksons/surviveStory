/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `--mode single` produces one self-contained HTML file (used for sharing builds).
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'single' ? [viteSingleFile()] : [],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    chunkSizeWarningLimit: 2000,
    // main.ts loads a saved game with top-level await.
    target: 'es2022',
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
}));
