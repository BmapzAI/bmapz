// Behaviour test, kept in the repo so a reviewer can re-run the evidence. Run all: node backend/tests/run.mjs
import crypto from 'node:crypto';
import http from 'node:http';
const ROOT = new URL('../src/', import.meta.url).href;
let fail = 0;
const t = (name, ok, extra = '') => { if (!ok) fail++; console.log(ok ? 'PASS' : 'FAIL', name, ok ? '' : extra); };

// Fake PostgREST whose company row can be changed between calls.
let status = {};
const fake = http.createServer((req, res) => {
  const wantsObject = String(req.headers.accept || '').includes('vnd.pgrst.object');
  const row = { api_keys: {}, integration_status: status };
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(wantsObject ? row : [row]));
}).listen(3984);
// Fake X token endpoint: records what the callback sends so the PKCE verifier can be checked end to end.
const tokenCalls = [];
http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    if (req.method === 'POST' && req.url.startsWith('/2/oauth2/token')) tokenCalls.push(Object.fromEntries(new URLSearchParams(body)));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ access_token: 'x-at', refresh_token: 'x-rt', expires_in: 7200 }));
  });
}).listen(3985);
// Canva's token URL is fixed, so intercept it in-process (everything else, including calls to this server, goes through).
const realFetch = globalThis.fetch;
const canvaCalls = [];
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith('https://api.canva.com/rest/v1/oauth/token')) {
    canvaCalls.push(Object.fromEntries(new URLSearchParams(String(init?.body))));
    return new Response(JSON.stringify({ access_token: 'cv-at', refresh_token: 'cv-rt', expires_in: 14400 }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  return realFetch(url, init);
};
Object.assign(process.env, {
  CANVA_CLIENT_ID: 'canva-client', CANVA_CLIENT_SECRET: 'canva-secret',
  X_API_BASE: 'http://127.0.0.1:3985',
  SUPABASE_URL: 'http://127.0.0.1:3984', SUPABASE_SERVICE_ROLE_KEY: 't', SUPABASE_ANON_KEY: 't', JWT_SECRET: 't',
  OAUTH_STATE_SECRET: 'test-secret-for-ticket', LINKEDIN_CLIENT_ID: 'li-client', TWITTER_CLIENT_ID: 'x-client',
  API_URL: 'https://api.bmapz.com', APP_URL: 'https://ai.bmapz.com', PORT: '3983',
});
delete process.env.LINKEDIN_ADS_WRITE;
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
const go = async (path) => {
  const r = await fetch(`http://127.0.0.1:3983/api/oauth/${path}${path.includes('?') ? '&' : '?'}t=${ticket()}`, { redirect: 'manual' });
  const loc = r.headers.get('location');
  return { status: r.status, url: loc ? new URL(loc) : null, loc, cookies: r.headers.getSetCookie ? r.headers.getSetCookie() : [] };
};
const nonceCookie = (o) => (o.cookies || []).map((c) => c.split(';')[0]).find((c) => c.startsWith('bmapz_oauth_nonce=')) || '';
const stateOf = (o) => String(o.url?.searchParams.get('state'));
const stateBodyOf = (o) => JSON.parse(Buffer.from(stateOf(o).split('.')[0], 'base64url').toString());
const callback = async (provider, o, cookie, code = 'auth-code') => {
  const r = await fetch('http://127.0.0.1:3983/api/oauth/' + provider + '/callback?code=' + code + '&state=' + encodeURIComponent(stateOf(o)), { headers: cookie ? { cookie } : {} });
  return r.text();
};
const scopesOf = (o) => (o.url?.searchParams.get('scope') || '').split(' ').filter(Boolean);

// ── X
const x = await go('twitter/initiate?type=twitter');
t('X: redirects to x.com (the documented host), not twitter.com', x.status === 302 && x.url?.host === 'x.com' && x.url.pathname === '/i/oauth2/authorize', x.loc);
t('X: PKCE method is S256', x.url?.searchParams.get('code_challenge_method') === 'S256');
// The state is SIGNED, not encrypted: it must not carry the PKCE verifier (it used to). The verifier is derived from the nonce
// cookie, so the proof is end to end: what the callback SENDS to X must hash to the challenge the authorize URL showed.
const stateBody = stateBodyOf(x);
const challenge = x.url?.searchParams.get('code_challenge');
t('X: the readable state does NOT contain the PKCE verifier', !('codeVerifier' in stateBody) && !JSON.stringify(stateBody).includes('erifier'), JSON.stringify(Object.keys(stateBody)));
t('X: the state still carries the nonce HASH that binds it to this browser', typeof stateBody.nonceHash === 'string' && stateBody.nonceHash.length > 20);
const cookie = nonceCookie(x);
t('X: the initiating browser gets an httpOnly nonce cookie', cookie.length > 30 && (x.cookies || []).some((c) => /HttpOnly/i.test(c) && /SameSite=Lax/i.test(c)), JSON.stringify(x.cookies));
let page = await callback('twitter', x, cookie);
t('X: callback with the right cookie completes', /data-status="success"/.test(page), page.slice(0, 300));
const sent = tokenCalls[0] || {};
t('X: the verifier sent to X hashes to the challenge in the authorize URL (PKCE intact)', !!sent.code_verifier && crypto.createHash('sha256').update(sent.code_verifier).digest('base64url') === challenge, JSON.stringify(sent));
t('X: the verifier is a valid RFC 7636 verifier (43-128 URL-safe characters)', /^[A-Za-z0-9_-]{43,128}$/.test(sent.code_verifier || ''));
t('X: challenge is NOT the verifier itself', challenge !== sent.code_verifier);
const before = tokenCalls.length;
page = await callback('twitter', x, '');
t('X: a callback WITHOUT the nonce cookie is refused and never reaches X', /data-status="error"/.test(page) && tokenCalls.length === before, page.slice(0, 200));
const x2 = await go('twitter/initiate?type=twitter');
page = await callback('twitter', x2, 'bmapz_oauth_nonce=someone-elses-nonce');
t('X: a callback carrying a different browser nonce is refused too', /data-status="error"/.test(page) && tokenCalls.length === before, page.slice(0, 200));
t('X: two flows get different verifiers (nonce per flow)', (() => { const a = nonceCookie(x), b = nonceCookie(x2); return a && b && a !== b; })());
t('X: still asks for offline.access so a refresh token is issued', (x.url?.searchParams.get('scope') || '').includes('offline.access'));
t('X: redirect_uri is the api.bmapz.com callback', x.url?.searchParams.get('redirect_uri') === 'https://api.bmapz.com/api/oauth/twitter/callback');

// ── Canva (same derived-verifier design)
const cv = await go('canva/initiate?type=canva');
const cvChallenge = cv.url?.searchParams.get('code_challenge');
t('Canva: redirects to canva.com with S256', cv.status === 302 && cv.url?.host === 'www.canva.com' && cv.url?.searchParams.get('code_challenge_method') === 'S256', cv.loc);
t('Canva: the readable state does NOT contain the PKCE verifier', !('codeVerifier' in stateBodyOf(cv)), JSON.stringify(Object.keys(stateBodyOf(cv))));
const cvPage = await callback('canva', cv, nonceCookie(cv));
t('Canva: callback with the right cookie completes', /data-status="success"/.test(cvPage), cvPage.slice(0, 300));
t('Canva: the verifier sent to Canva hashes to the challenge', !!canvaCalls[0]?.code_verifier && crypto.createHash('sha256').update(canvaCalls[0].code_verifier).digest('base64url') === cvChallenge, JSON.stringify(canvaCalls[0]));
const cvBefore = canvaCalls.length;
const cvNo = await callback('canva', await go('canva/initiate?type=canva'), '');
t('Canva: a callback without the nonce cookie never reaches Canva', /data-status="error"/.test(cvNo) && canvaCalls.length === cvBefore, cvNo.slice(0, 200));

// ── LinkedIn scope union
status = {};
let li = await go('linkedin/initiate?type=linkedin');
t('LinkedIn posting only: sign-in + w_member_social, NO ads scopes', JSON.stringify(scopesOf(li)) === JSON.stringify(['openid', 'profile', 'email', 'w_member_social']), scopesOf(li).join(' '));

li = await go('linkedin/initiate?type=linkedin_ads');
t('LinkedIn ads only (nothing else connected): read-only reporting scopes, no posting', JSON.stringify(scopesOf(li)) === JSON.stringify(['openid', 'profile', 'email', 'r_ads', 'r_ads_reporting']), scopesOf(li).join(' '));

status = { linkedin_ads: true };
li = await go('linkedin/initiate?type=linkedin');
t('Connecting posting WHILE ads is connected: UNION (does not strip ads)', scopesOf(li).includes('w_member_social') && scopesOf(li).includes('r_ads') && scopesOf(li).includes('r_ads_reporting'), scopesOf(li).join(' '));

status = { linkedin: true };
li = await go('linkedin/initiate?type=linkedin_ads');
t('Connecting ads WHILE posting is connected: UNION (does not strip posting)', scopesOf(li).includes('w_member_social') && scopesOf(li).includes('r_ads'), scopesOf(li).join(' '));

status = { linkedin: true };
li = await go('linkedin/initiate?type=linkedin');
t('Re-connecting posting alone never asks for ads scopes the app may not have', !scopesOf(li).some((s) => /ads/.test(s)), scopesOf(li).join(' '));

process.env.LINKEDIN_ADS_WRITE = 'true'; status = {};
li = await go('linkedin/initiate?type=linkedin_ads');
t('LINKEDIN_ADS_WRITE=true opts in to rw_ads (and drops r_ads)', scopesOf(li).includes('rw_ads') && !scopesOf(li).includes('r_ads'), scopesOf(li).join(' '));

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
