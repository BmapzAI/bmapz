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
Object.assign(process.env, {
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
  return { status: r.status, url: loc ? new URL(loc) : null, loc };
};
const scopesOf = (o) => (o.url?.searchParams.get('scope') || '').split(' ').filter(Boolean);

// ── X
const x = await go('twitter/initiate?type=twitter');
t('X: redirects to x.com (the documented host), not twitter.com', x.status === 302 && x.url?.host === 'x.com' && x.url.pathname === '/i/oauth2/authorize', x.loc);
t('X: PKCE method is S256', x.url?.searchParams.get('code_challenge_method') === 'S256');
// the verifier travels in the (signed, readable) state; the challenge must be its SHA-256, and not equal to it
const stateBody = JSON.parse(Buffer.from(String(x.url?.searchParams.get('state')).split('.')[0], 'base64url').toString());
const verifier = stateBody.codeVerifier;
const challenge = x.url?.searchParams.get('code_challenge');
t('X: challenge is the SHA-256 of the verifier', challenge === crypto.createHash('sha256').update(verifier).digest('base64url'));
t('X: challenge is NOT the verifier itself', challenge !== verifier);
t('X: still asks for offline.access so a refresh token is issued', (x.url?.searchParams.get('scope') || '').includes('offline.access'));
t('X: redirect_uri is the api.bmapz.com callback', x.url?.searchParams.get('redirect_uri') === 'https://api.bmapz.com/api/oauth/twitter/callback');

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
