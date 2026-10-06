// Behaviour test, kept in the repo so a reviewer can re-run the evidence. Run all: node backend/tests/run.mjs
process.env.SUPABASE_URL = 'http://127.0.0.1:1'; process.env.SUPABASE_SERVICE_ROLE_KEY = 't';
const { getXAccessToken, pkceChallenge, X_API_BASE, X_AUTH_URL } = await import('../src/lib/xApi.js');
let fail = 0;
const t = (name, ok, extra = '') => { if (!ok) fail++; console.log(ok ? 'PASS' : 'FAIL', name, ok ? '' : extra); };
const NOW = Date.parse('2026-10-06T12:00:00Z');
const resp = (status, body) => async () => ({ ok: status >= 200 && status < 300, status, json: async () => body });

t('hosts are the documented x.com ones', X_API_BASE === 'https://api.x.com' && X_AUTH_URL === 'https://x.com/i/oauth2/authorize', `${X_API_BASE} ${X_AUTH_URL}`);
// RFC 7636 Appendix B test vector: the one value that proves S256 is implemented correctly
t('PKCE S256 matches the RFC 7636 test vector', pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk') === 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
t('PKCE challenge is NOT the verifier (the old plain mode leaked the secret)', pkceChallenge('abc') !== 'abc');

let calls = 0; const counting = (r) => async (...a) => { calls++; return r(...a); };
let saved = null; const save = async (id, patch) => { saved = { id, patch }; };

// 1. unexpired token: no network, no write
calls = 0; saved = null;
let tok = await getXAccessToken('c1', { twitter_access_token: 'LIVE', twitter_token_expires_at: new Date(NOW + 3600e3).toISOString() }, { fetchImpl: counting(resp(200, {})), save, now: NOW });
t('unexpired token returned untouched, no refresh call', tok === 'LIVE' && calls === 0 && saved === null);

// 2. legacy row with no recorded expiry: cannot know, so it must not be refreshed away
tok = await getXAccessToken('c1', { twitter_access_token: 'LEGACY' }, { fetchImpl: counting(resp(200, {})), save, now: NOW });
t('legacy row (no expiry recorded) returned as-is', tok === 'LEGACY' && calls === 0);

// 3. expired: refresh with Basic auth + rotated refresh token persisted
let sent = null;
const rotating = async (url, opts) => { sent = { url, opts }; return { ok: true, status: 200, json: async () => ({ access_token: 'NEW', refresh_token: 'ROTATED', expires_in: 7200 }) }; };
tok = await getXAccessToken('c1', { twitter_access_token: 'OLD', twitter_refresh_token: 'R1', twitter_client_id: 'cid', twitter_client_secret: 'sec', twitter_token_expires_at: new Date(NOW - 1000).toISOString() }, { fetchImpl: rotating, save, now: NOW });
t('expired token is refreshed and the new one returned', tok === 'NEW');
t('refresh goes to the x.com token endpoint', sent.url === 'https://api.x.com/2/oauth2/token', sent.url);
t('refresh uses HTTP Basic client auth', sent.opts.headers.Authorization === 'Basic ' + Buffer.from('cid:sec').toString('base64'));
t('refresh body is grant_type=refresh_token with the stored token', String(sent.opts.body) === 'grant_type=refresh_token&refresh_token=R1', String(sent.opts.body));
t('ROTATED refresh token is stored (X invalidates the old one)', saved.patch.twitter_refresh_token === 'ROTATED' && saved.patch.twitter_access_token === 'NEW');
t('expiry recorded ~2h ahead', saved.patch.twitter_token_expires_at === new Date(NOW + 7200e3).toISOString(), saved.patch.twitter_token_expires_at);

// 4. response without a new refresh token keeps the old one
saved = null;
await getXAccessToken('c1', { twitter_access_token: 'OLD', twitter_refresh_token: 'KEEP', twitter_client_id: 'a', twitter_client_secret: 'b', twitter_token_expires_at: new Date(NOW - 1).toISOString() }, { fetchImpl: resp(200, { access_token: 'N2' }), save, now: NOW });
t('no new refresh token in response -> old one kept', saved.patch.twitter_refresh_token === 'KEEP');

// 5. revoked grant: X reports problem+json, not OAuth-style fields
let msg = '';
try { await getXAccessToken('c1', { twitter_refresh_token: 'R', twitter_client_id: 'a', twitter_client_secret: 'b', twitter_access_token: 'x', twitter_token_expires_at: new Date(NOW - 1).toISOString() }, { fetchImpl: resp(400, { title: 'Invalid Request', detail: 'Value passed for the token was invalid.' }), save, now: NOW }); } catch (e) { msg = e.message; }
t('revoked grant throws with X\'s own detail (so the UI can say reconnect)', msg === 'Value passed for the token was invalid.', msg);

// 6. nothing to refresh with
tok = await getXAccessToken('c1', { twitter_access_token: 'STALE', twitter_token_expires_at: new Date(NOW - 1).toISOString() }, { fetchImpl: counting(resp(200, {})), save, now: NOW });
t('expired token but no refresh token / client creds -> returns stale token rather than crashing', tok === 'STALE');
tok = await getXAccessToken('c1', {}, { fetchImpl: resp(200, {}), save, now: NOW });
t('no token at all -> null', tok === null);

console.log(fail ? `\n${fail} FAILED` : '\nall passed'); process.exit(fail ? 1 : 0);
