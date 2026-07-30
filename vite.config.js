import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './frontend-src') } },
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    // Route-level splitting (see pages.config.js) already moves each page into
    // its own chunk. These groups keep the big third-party libraries out of the
    // initial download too, so the first paint only needs React + the shell.
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      input: 'index.html',
      output: {
        // Only split libraries that genuinely belong to the initial shell.
        // Naming a chunk for a library that is used solely by a lazy page (charts,
        // PDF export, rich text) pulls it into the entry graph and gets it
        // preloaded on first paint — the opposite of what we want. Those are left
        // to Rollup, which attaches them to the lazy chunks that actually use them.
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-query': ['@tanstack/react-query'],
        },
      },
    },
  },
  server: { port: 5173, proxy: { '/api': { target: process.env.VITE_API_URL || 'http://localhost:3001', changeOrigin: true } } },
});
