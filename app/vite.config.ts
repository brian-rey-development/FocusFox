/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import path from 'path';
import manifest from './manifest.json';

export default defineConfig({
  plugins: [crx({ manifest, browser: 'firefox' })],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    emptyOutDir: true,
    rollupOptions: {
      input: {
        blocked: path.resolve(__dirname, 'src/blocked/index.html'),
        dashboard: path.resolve(__dirname, 'src/dashboard/index.html'),
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
