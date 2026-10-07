// Behaviour test: which browser origins the API accepts. The Android/iOS apps serve their pages from capacitor://localhost (iOS) and
// https://localhost (Android); without those two in the allow-list every call from the app fails its preflight and the app shows
// "Connection Error". Everything else must stay refused. Run all: node backend/tests/run.mjs. Starts the real server, no credentials.
import http from 'node:http';

let fail = 0;
const t = (name, ok, extra = '') => { if (!ok) fail++; console.log(ok ? 'PASS' : 'FAIL', name, ok ? '' : extra); };

Object.assign(process.env, {
  SUPABASE_URL: 'http://127.0.0.1:1', SUPABASE_SERVICE_ROLE_KEY: 't', SUPABASE_ANON_KEY: 't', JWT_SECRET: 't', PORT: '3993',
  FRONTEND_URL: 'https://ai.bmapz.com',
});
await import('../src/index.js');
for (let i = 0; i < 150; i++) {
  try { if ((await fetch('http://127.0.0.1:' + process.env.PORT + '/health')).ok) break; } catch { /* not listening yet */ }
  await new Promise((r) => setTimeout(r, 100));
}

// node's fetch hides nothing here, but http.request leaves no doubt that the Origin header is sent exactly as written
const call = (method, path, headers) => new Promise((resolve, reject) => {
  const req = http.request({ host: '127.0.0.1', port: 3993, method, path, headers }, (res) => {
    let body = '';
    res.on('data', (c) => { body += c; });
    res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
  });
  req.on('error', reject);
  req.end();
});
const preflight = (origin) => call('OPTIONS', '/api/auth/me', {
  Origin: origin, 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'authorization,content-type',
});

for (const origin of ['capacitor://localhost', 'https://localhost', 'https://ai.bmapz.com']) {
  const r = await preflight(origin);
  t(`preflight from ${origin} is answered and allowed`, (r.status === 204 || r.status === 200) && r.headers['access-control-allow-origin'] === origin, `${r.status} ${JSON.stringify(r.headers['access-control-allow-origin'])}`);
  t(`...and ${origin} may send the Authorization header`, /authorization/i.test(r.headers['access-control-allow-headers'] || ''), r.headers['access-control-allow-headers']);
}
let r = await preflight('capacitor://localhost');
t('the preflight answer is cacheable by the phone (fewer round trips on mobile data)', Number(r.headers['access-control-max-age']) >= 600, r.headers['access-control-max-age']);
t('the allowed origin is echoed exactly (not "*"), with Vary: Origin so a cache cannot hand it to another origin', r.headers['access-control-allow-origin'] === 'capacitor://localhost' && /origin/i.test(r.headers.vary || ''), JSON.stringify(r.headers));

for (const origin of ['https://evil.example', 'http://localhost', 'capacitor://localhost.evil.example', 'https://localhost.evil.example', 'capacitor://example', 'null', 'https://ai.bmapz.com.evil.example']) {
  r = await preflight(origin);
  t(`${origin} is still refused (no CORS headers granted)`, !r.headers['access-control-allow-origin'], `${r.status} ${r.headers['access-control-allow-origin']}`);
}

r = await call('GET', '/health', { Origin: 'https://localhost' });
t('a real request from the Android app origin gets its CORS header too', r.status === 200 && r.headers['access-control-allow-origin'] === 'https://localhost');
r = await call('GET', '/health', {});
t('server-to-server calls (no Origin header) are unaffected', r.status === 200);

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
// Flush stdout first: on Windows the process can exit before its piped output is written, and run.mjs then sees an empty file (a one-off
// "0 passed" failure of a file that had passed).
await new Promise((resolve) => process.stdout.write('', resolve));
process.exit(fail ? 1 : 0);
