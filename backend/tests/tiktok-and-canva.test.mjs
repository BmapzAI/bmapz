// Behaviour test, kept in the repo so a reviewer can re-run the evidence. Run all: node backend/tests/run.mjs
import http from 'node:http';
const ROOT = new URL('../src/', import.meta.url).href;
let fail = 0;
const t = (name, ok, extra = '') => { if (!ok) fail++; console.log(ok ? 'PASS' : 'FAIL', name, ok ? '' : extra); };

// fake PostgREST: GET returns a company with a Canva refresh token; PATCH accepted
let patches = 0;
const fake = http.createServer((req, res) => {
  if (req.method === 'PATCH') { patches++; res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end('[]'); }
  const wantsObject = String(req.headers.accept || '').includes('vnd.pgrst.object');
  const row = { api_keys: { canva_refresh_token: 'RT1', canva_access_token: 'OLD' }, integration_status: {} };
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(wantsObject ? row : [row]));
}).listen(3982);
Object.assign(process.env, { SUPABASE_URL: 'http://127.0.0.1:3982', SUPABASE_SERVICE_ROLE_KEY: 't', SUPABASE_ANON_KEY: 't', JWT_SECRET: 't', CANVA_CLIENT_ID: 'cid', CANVA_CLIENT_SECRET: 'sec', API_URL: 'https://api.bmapz.com' });

// ── TikTok
const { getTikTokAccessToken } = await import(ROOT + 'lib/tiktokApi.js');
const NOW = Date.parse('2026-10-06T12:00:00Z');
const resp = (status, body) => async () => ({ ok: status >= 200 && status < 300, status, json: async () => body });
let saved = null; const save = async (id, patch) => { saved = patch; };
let tok = await getTikTokAccessToken('c', { tiktok_access_token: 'LIVE', tiktok_token_expires_at: new Date(NOW + 3600e3).toISOString() }, { fetchImpl: resp(200, {}), save, now: NOW });
t('TikTok: unexpired token returned untouched', tok === 'LIVE');
let sent;
tok = await getTikTokAccessToken('c', { tiktok_access_token: 'OLD', tiktok_refresh_token: 'R1', tiktok_client_key: 'ck', tiktok_client_secret: 'cs', tiktok_token_expires_at: new Date(NOW - 1).toISOString() },
  { fetchImpl: async (u, o) => { sent = { u, o }; return { ok: true, status: 200, json: async () => ({ access_token: 'NEW', refresh_token: 'R2', expires_in: 86400, refresh_expires_in: 31536000, open_id: 'oid' }) }; }, save, now: NOW });
t('TikTok: 24h-expired token is refreshed', tok === 'NEW');
t('TikTok: refresh hits the v2 token endpoint with the refresh grant', sent.u === 'https://open.tiktokapis.com/v2/oauth/token/' && /grant_type=refresh_token/.test(String(sent.o.body)) && /refresh_token=R1/.test(String(sent.o.body)), `${sent.u} ${sent.o.body}`);
t('TikTok: rotated refresh token + open_id + both expiries stored', saved.tiktok_refresh_token === 'R2' && saved.tiktok_open_id === 'oid' && !!saved.tiktok_refresh_expires_at && saved.tiktok_token_expires_at === new Date(NOW + 86400e3).toISOString());
let msg = '';
try { await getTikTokAccessToken('c', { tiktok_access_token: 'x', tiktok_refresh_token: 'R', tiktok_client_key: 'a', tiktok_client_secret: 'b', tiktok_token_expires_at: new Date(NOW - 1).toISOString() }, { fetchImpl: resp(200, { error: 'invalid_grant', error_description: 'Refresh token is expired.' }), save, now: NOW }); } catch (e) { msg = e.message; }
t('TikTok: HTTP-200-with-error-body is treated as a failure, with TikTok\'s message', msg === 'Refresh token is expired.', msg);

// ── Canva single-flight: two concurrent refreshes must make ONE provider call
const realFetch = globalThis.fetch;
let canvaCalls = 0;
globalThis.fetch = async (url, opts) => {
  if (String(url).startsWith('https://api.canva.com/rest/v1/oauth/token')) {
    canvaCalls++;
    await new Promise((r) => setTimeout(r, 120));        // slow enough that the second call overlaps
    return { ok: true, status: 200, json: async () => ({ access_token: 'FRESH', refresh_token: 'RT2', expires_in: 14400 }) };
  }
  return realFetch(url, opts);
};
const { refreshCanvaToken } = await import(ROOT + 'routes/oauth.js');
const [a, b, c] = await Promise.all([refreshCanvaToken('co1'), refreshCanvaToken('co1'), refreshCanvaToken('co1')]);
t('Canva: three concurrent refreshes -> exactly ONE call to Canva (refresh tokens are single use)', canvaCalls === 1, `calls=${canvaCalls}`);
t('Canva: every caller gets the same fresh token', a === 'FRESH' && b === 'FRESH' && c === 'FRESH');
const d = await refreshCanvaToken('co1');
t('Canva: a LATER refresh (nothing in flight) calls Canva again', canvaCalls === 2 && d === 'FRESH', `calls=${canvaCalls}`);
const [e, f] = await Promise.all([refreshCanvaToken('coA'), refreshCanvaToken('coB')]);
t('Canva: DIFFERENT companies never share a refresh', canvaCalls === 4, `calls=${canvaCalls}`);
globalThis.fetch = realFetch;

// scope string
const src = (await import('node:fs')).readFileSync(new URL('../src/routes/oauth.js', import.meta.url), 'utf8');
t('Canva: design:meta:read is requested (the design picker needs it)', /CANVA_SCOPES = '[^']*design:meta:read/.test(src));

console.log(fail ? `\n${fail} FAILED` : '\nall passed'); process.exit(fail ? 1 : 0);
