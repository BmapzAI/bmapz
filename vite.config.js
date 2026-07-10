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
  build: { outDir: 'dist', rollupOptions: { input: 'index.html' } },
  server: { port: 5173, proxy: { '/api': { target: process.env.VITE_API_URL || 'http://localhost:3001', changeOrigin: true } } },
});
