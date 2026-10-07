import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The Android / iOS app build (mobile/scripts/build-web.mjs sets VITE_NATIVE_BUILD=1) is consumption-only: it must not contain any way to buy.
// The stores require their own payment system for digital subscriptions and reject apps that route around it, so instead of hiding the
// Billing and Pricing screens at run time this REPLACES them with a neutral stand-in, which also drops their Stripe calls from the bundle.
// mobile/scripts/check-bundle.mjs fails the app build if any purchase call is still in it. The website build is not touched.
function nativeBillingRemoved() {
  const stand_in = path.resolve(__dirname, './frontend-src/native/NotInApp.jsx');
  return {
    name: 'bmapz-native-billing-removed',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (process.env.VITE_NATIVE_BUILD !== '1') return null;
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      if (resolved && /[\\/]frontend-src[\\/]pages[\\/](Billing|Pricing)\.jsx$/.test(resolved.id)) return stand_in;
      return null;
    },
  };
}
export default defineConfig({
  plugins: [nativeBillingRemoved(), react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './frontend-src'),
      // Ad-platform structure is shared verbatim with the Express server so the
      // UI and the publisher can never disagree about a platform's fields.
      '@shared': path.resolve(__dirname, './backend/src/lib'),
    },
  },
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
