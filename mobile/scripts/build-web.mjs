// Builds the web app into mobile/www for the native shell.
//
// Why a separate output folder: the production site is built into dist/ with the production API URL and deployed to
// Cloudflare Pages by .github/workflows/deploy.yml. The native bundle must never overwrite that, so it goes to mobile/www.
// The bundle is the SAME code; only the build-time environment differs (see below).
//
// Required in the environment (public values: they are baked into the production site too):
//   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
// Optional:
//   VITE_API_URL          default https://api.bmapz.com (a native app has no same-origin API, so it must be absolute)
//   VITE_GOOGLE_CLIENT_ID default is the web client already compiled into the site
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = path.join(root, 'mobile', 'www');

const missing = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'].filter((k) => !String(process.env[k] || '').trim());
if (missing.length) {
  console.error(`Missing ${missing.join(' and ')}. Export them first (the same public values the website is built with).`);
  process.exit(1);
}

const env = {
  ...process.env,
  VITE_API_URL: process.env.VITE_API_URL || 'https://api.bmapz.com',
  VITE_NATIVE_BUILD: '1',
};

const bin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const r = spawnSync(process.execPath, [bin, 'build', '--outDir', out, '--emptyOutDir'], { cwd: root, env, stdio: 'inherit' });
if (r.status !== 0) process.exit(r.status ?? 1);
console.log(`\nNative web bundle written to ${path.relative(root, out)} (API: ${env.VITE_API_URL})`);
