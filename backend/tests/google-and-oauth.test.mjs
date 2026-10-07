// Behaviour test, kept in the repo so a reviewer can re-run the evidence. Run all: node backend/tests/run.mjs
import crypto from 'node:crypto';
const ROOT = new URL('../src/', import.meta.url).href;
let fail = 0;
const t = (name, ok, extra = '') => { if (!ok) fail++; console.log(ok ? 'PASS' : 'FAIL', name, ok ? '' : extra); };

// ── 1. googleAds helpers (env controls are read at call time / import time, so set first)
delete process.env.GOOGLE_ADS_SEND_DEV_TOKEN;
process.env.GOOGLE_ADS_DEVELOPER_TOKEN = 'stale-token-left-in-railway';
const ga = await import(ROOT + 'lib/googleAds.js');
t('default API version is v25', ga.GOOGLE_ADS_API_VERSION === 'v25', ga.GOOGLE_ADS_API_VERSION);
let h = ga.googleAdsHeaders({ token: 'T', keys: {} });
t('stale developer token is NOT sent by default', !('developer-token' in h), JSON.stringify(h));
t('bearer + content-type present', h.Authorization === 'Bearer T' && h['Content-Type'] === 'application/json');
h = ga.googleAdsHeaders({ token: 'T', keys: { google_ads_login_customer_id: '123-456-7890' } });
t('login-customer-id sent, digits only (manager accounts)', h['login-customer-id'] === '1234567890', JSON.stringify(h));
h = ga.googleAdsHeaders({ token: 'T', keys: { google_ads_login_customer_id: '"><script>' } });
t('hostile login id is stripped to nothing, not sent', !('login-customer-id' in h), JSON.stringify(h));
t('array-shaped searchStream error is detected', !!ga.googleAdsApiError([{ error: { message: 'm' } }]));
t('object-shaped error is detected', !!ga.googleAdsApiError({ error: { message: 'm' } }));
t('no error -> undefined', ga.googleAdsApiError([{ results: [] }]) === undefined);
t('real reason is extracted from details, not "HTTP 403"',
  ga.googleAdsErrorMessage([{ error: { code: 403, message: 'The caller does not have permission', details: [{ errors: [{ message: 'User doesn\'t have permission to access customer' }] }] } }], 403) === "User doesn't have permission to access customer");
t('falls back to HTTP status when body is unusable', ga.googleAdsErrorMessage(null, 502) === 'HTTP 502');

// ── 2. the real /google/initiate route: scopes and incremental authorisation
import('node:http').then(()=>{});
const http = (await import('node:http')).default;
// Minimal fake PostgREST: every GET returns an empty-keys company, enough for getCompanyKeys().
const fake = http.createServer((req, res) => {
  const wantsObject = String(req.headers.accept || '').includes('vnd.pgrst.object');
  const row = { api_keys: {}, integration_status: {} };
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(wantsObject ? row : [row]));
}).listen(3986);
process.env.SUPABASE_URL = 'http://127.0.0.1:3986'; process.env.SUPABASE_SERVICE_ROLE_KEY = 't'; process.env.SUPABASE_ANON_KEY = 't'; process.env.JWT_SECRET = 't';
process.env.OAUTH_STATE_SECRET = 'test-secret-for-ticket'; process.env.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
process.env.API_URL = 'https://api.bmapz.com'; process.env.APP_URL = 'https://ai.bmapz.com'; process.env.PORT = '3987';
await import(ROOT + 'index.js');
// Wait until the server answers instead of sleeping a fixed time: a slow start (cold disk, OneDrive sync) made a fixed sleep flaky.
for (let i = 0; i < 150; i++) {
  try { if ((await fetch('http://127.0.0.1:' + process.env.PORT + '/health')).ok) break; } catch { /* not listening yet */ }
  await new Promise((r) => setTimeout(r, 100));
}

const ticket = () => {
  const body = Buffer.from(JSON.stringify({ userId: 'u1', companyId: 'c1', purpose: 'launch', issuedAt: Date.now() })).toString('base64url');
  return `${body}.${crypto.createHmac('sha256', process.env.OAUTH_STATE_SECRET).update(body).digest('base64url')}`;
};
const initiate = async (type) => {
  const r = await fetch(`http://127.0.0.1:3987/api/oauth/google/initiate?t=${ticket()}&type=${type}`, { redirect: 'manual' });
  const loc = r.headers.get('location');
  return { status: r.status, loc, url: loc ? new URL(loc) : null };
};

for (const type of ['gmail', 'google_calendar', 'youtube', 'google_drive']) {
  const o = await initiate(type);
  const scopes = (o.url?.searchParams.get('scope') || '').split(' ').filter(Boolean);
  const short = scopes.map((s) => s.replace('https://www.googleapis.com/auth/', ''));
  console.log(`   ${type.padEnd(16)} -> status ${o.status} scopes: ${short.join(', ')}`);
  t(`${type}: redirects to Google`, o.status === 302 && /accounts\.google\.com/.test(o.loc || ''), `${o.status} ${o.loc}`);
  t(`${type}: asks Google to MERGE previously granted scopes`, o.url?.searchParams.get('include_granted_scopes') === 'true');
  t(`${type}: redirect_uri is the api.bmapz.com callback`, o.url?.searchParams.get('redirect_uri') === 'https://api.bmapz.com/api/oauth/google/callback', o.url?.searchParams.get('redirect_uri'));
  t(`${type}: NO restricted scope requested by default`, !scopes.some((s) => /gmail\.readonly|auth\/drive/.test(s)), short.join(','));
  t(`${type}: never asks for gmail.compose or youtube.upload`, !scopes.some((s) => /gmail\.compose|youtube\.upload/.test(s)), short.join(','));
}
const g = await initiate('gmail');
t('gmail still gets the SEND permission (sensitive, no assessment needed)', (g.url?.searchParams.get('scope') || '').includes('gmail.send'));

// the OAuth popup carries a fresh anti-CSRF cookie and the opener-safe page keeps working
const cb = await fetch('http://127.0.0.1:3987/api/oauth/google/callback?error=access_denied');
const html = await cb.text();
t('callback error page still renders with exact opener origin', /data-target="https:\/\/ai\.bmapz\.com"/.test(html));
const h2 = await (await fetch('http://127.0.0.1:3987/health')).json();
t('/health reports the OAuth host from API_URL', h2.oauth_host === 'api.bmapz.com', JSON.stringify(h2));

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
// Flush stdout first: on Windows the process can exit before its piped output is written, and run.mjs then sees an empty file (a one-off
// "0 passed" failure of a file that had passed).
await new Promise((resolve) => process.stdout.write('', resolve));
process.exit(fail ? 1 : 0);
