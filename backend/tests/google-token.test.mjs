// Behaviour test: lib/googleToken.js, the ONE place that refreshes a company's Google access token (Gmail sync, Ads, Analytics,
// Search Console, Drive all use it now; routes/messaging.js and routes/ads.js used to carry private, drifting copies).
// Run all: node backend/tests/run.mjs. Needs no credentials: a fake PostgREST and an in-process stand-in for oauth2.googleapis.com.
import http from 'node:http';

let fail = 0;
const t = (name, ok, extra = '') => { if (!ok) fail++; console.log(ok ? 'PASS' : 'FAIL', name, ok ? '' : extra); };

// fake database: the stored api_keys row (so the merge-into-the-CURRENT-row behaviour is observable)
let storedKeys = {};
const dbWrites = [];
const fake = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(obj === undefined ? '' : JSON.stringify(obj)); };
    if (req.method === 'GET') return send(200, [{ api_keys: storedKeys }]);
    if (req.method === 'PATCH') { dbWrites.push(JSON.parse(body)); return send(204); }
    return send(200, []);
  });
}).listen(3998);
Object.assign(process.env, {
  SUPABASE_URL: 'http://127.0.0.1:3998', SUPABASE_SERVICE_ROLE_KEY: 't', SUPABASE_ANON_KEY: 't', JWT_SECRET: 't',
  GOOGLE_CLIENT_ID: 'platform-client', GOOGLE_CLIENT_SECRET: 'platform-secret',
});

// stand-in for Google's token endpoint
const calls = [];
let googleReply = { status: 200, body: { access_token: 'FRESH', expires_in: 3600 } };
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith('https://oauth2.googleapis.com/token')) {
    calls.push(Object.fromEntries(new URLSearchParams(String(init?.body))));
    return new Response(JSON.stringify(googleReply.body), { status: googleReply.status, headers: { 'content-type': 'application/json' } });
  }
  return realFetch(url, init);
};

const { getGoogleAccessToken } = await import('../src/lib/googleToken.js');
const inMinutes = (m) => new Date(Date.now() + m * 60000).toISOString();
const reset = () => { calls.length = 0; dbWrites.length = 0; googleReply = { status: 200, body: { access_token: 'FRESH', expires_in: 3600 } }; };

// 1. a token with time left needs no network call
reset();
let keys = { google_access_token: 'CURRENT', google_token_expires_at: inMinutes(30), google_refresh_token: 'RT' };
t('a token with 30 minutes left is returned without calling Google', (await getGoogleAccessToken('c1', keys)) === 'CURRENT' && calls.length === 0);

// 2. expired -> refresh with the unified grant and the platform client; the caller's object is kept fresh
reset();
storedKeys = { google_access_token: 'OLD', other_secret: 'KEEP-ME', google_refresh_token: 'RT' };
keys = { google_access_token: 'OLD', google_token_expires_at: inMinutes(-5), google_refresh_token: 'RT' };
let token = await getGoogleAccessToken('c1', keys);
t('an expired token is refreshed with the refresh token and the platform client', token === 'FRESH' && calls.length === 1 && calls[0].refresh_token === 'RT' && calls[0].client_id === 'platform-client' && calls[0].grant_type === 'refresh_token', JSON.stringify(calls));
t('the caller\'s own object now holds the fresh token (a second call in the same request does not refresh again)', keys.google_access_token === 'FRESH' && (await getGoogleAccessToken('c1', keys)) === 'FRESH' && calls.length === 1);
t('the refreshed token is saved MERGED into the current stored row (other credentials survive)', dbWrites.length === 1 && dbWrites[0].api_keys.google_access_token === 'FRESH' && dbWrites[0].api_keys.other_secret === 'KEEP-ME', JSON.stringify(dbWrites));

// 3. margin
reset();
keys = { google_access_token: 'ALMOST', google_token_expires_at: inMinutes(3), google_refresh_token: 'RT' };
t('3 minutes left is fine for the default 60-second margin', (await getGoogleAccessToken('c1', keys)) === 'ALMOST' && calls.length === 0);
t('...but not for the Ads routes\' 5-minute margin', (await getGoogleAccessToken('c1', keys, { marginMs: 5 * 60000 })) === 'FRESH' && calls.length === 1);

// 4. each refresh token is paired with ITS OWN client
reset();
keys = { google_token_expires_at: inMinutes(-1), google_refresh_token: 'UNIFIED-RT', google_ads_refresh_token: 'ADS-RT', google_ads_client_id: 'ads-client', google_ads_client_secret: 'ads-secret' };
await getGoogleAccessToken('c1', { ...keys });
t('a general caller uses the UNIFIED grant with the platform client (never the Ads client with the unified token)', calls[0]?.refresh_token === 'UNIFIED-RT' && calls[0]?.client_id === 'platform-client', JSON.stringify(calls[0]));
reset();
await getGoogleAccessToken('c1', { ...keys }, { preferAds: true });
t('an Ads caller uses the ADS grant with the Ads client', calls[0]?.refresh_token === 'ADS-RT' && calls[0]?.client_id === 'ads-client' && calls[0]?.client_secret === 'ads-secret', JSON.stringify(calls[0]));
reset();
await getGoogleAccessToken('c1', { google_token_expires_at: inMinutes(-1), google_ads_refresh_token: 'ADS-ONLY', google_ads_client_id: 'ads-client', google_ads_client_secret: 'ads-secret' });
t('with only an Ads grant on file, a general caller still gets a token (last resort), paired with the Ads client', calls[0]?.refresh_token === 'ADS-ONLY' && calls[0]?.client_id === 'ads-client', JSON.stringify(calls[0]));
reset();
await getGoogleAccessToken('c1', { google_token_expires_at: inMinutes(-1), gmail_refresh_token: 'GM-RT', gmail_client_id: 'gm-client', gmail_client_secret: 'gm-secret' });
t('the legacy per-company Gmail credentials (messaging.js used them) still work', calls[0]?.refresh_token === 'GM-RT' && calls[0]?.client_id === 'gm-client' && calls[0]?.client_secret === 'gm-secret', JSON.stringify(calls[0]));
reset();
await getGoogleAccessToken('c1', { google_token_expires_at: inMinutes(-1), google_refresh_token: 'RT', google_client_id: 'own-client', google_client_secret: 'own-secret' });
t('a company\'s own Google client is used with its own refresh token', calls[0]?.client_id === 'own-client' && calls[0]?.client_secret === 'own-secret', JSON.stringify(calls[0]));

// 5. nothing to refresh with
reset();
t('no refresh token -> the stored (possibly stale) token is returned, no call', (await getGoogleAccessToken('c1', { google_access_token: 'STALE', google_token_expires_at: inMinutes(-9) })) === 'STALE' && calls.length === 0);
t('nothing at all -> null', (await getGoogleAccessToken('c1', {})) === null);

// 6. Google refuses (revoked / expired grant): throws Google's own words, writes nothing
reset();
googleReply = { status: 400, body: { error: 'invalid_grant', error_description: 'Token has been expired or revoked.' } };
let message = '';
try { await getGoogleAccessToken('c1', { google_token_expires_at: inMinutes(-1), google_refresh_token: 'DEAD' }); } catch (e) { message = e.message; }
t('a revoked grant throws Google\'s message (so the route can say "reconnect Google")', /expired or revoked/i.test(message), message);
t('...and nothing is written to the database', dbWrites.length === 0);

fake.close();
globalThis.fetch = realFetch;
console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
