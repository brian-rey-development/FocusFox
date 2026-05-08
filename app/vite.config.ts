/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import path from 'path';
import manifest from './manifest.json';

export default defineConfig({
  plugins: [crx({ manifest })],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    emptyOutDir: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
