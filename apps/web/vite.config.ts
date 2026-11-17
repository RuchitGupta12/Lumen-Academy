import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Resolve the shared workspace by path as well as by npm workspace symlink, so
// builds also work when an install only sees apps/web (e.g. Vercel).
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// In Vercel services mode the api service binding is injected as API_SERVICE_URL.
// Locally there is no binding, so fall back to the bundled dev server on :4000.
const apiTarget = process.env.API_SERVICE_URL || 'http://localhost:4000';

// Vercel may install only this service's dependencies, so the shared source
// cannot rely on a hoisted root-level zod. Prefer the web-local copy when it
// exists, otherwise fall back to the workspace root copy.
const webZod = path.resolve(rootDir, 'apps/web/node_modules/zod');
const rootZod = path.resolve(rootDir, 'node_modules/zod');
const zodDir = fs.existsSync(webZod) ? webZod : rootZod;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@lumen/shared': path.resolve(rootDir, 'packages/shared/src/index.ts'),
      zod: zodDir,
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
      '/media': { target: apiTarget, changeOrigin: true },
      '/socket.io': { target: apiTarget, changeOrigin: true, ws: true },
    },
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1200,
  },
});
