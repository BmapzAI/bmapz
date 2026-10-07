// Behaviour test: GET /api/integrations/status reports PROVIDER-level sign-in state (oauth_connected / oauth_stamp) next to
// the per-service flags, and never returns a token. Run all: node backend/tests/run.mjs. Uses a fake Supabase.
//
// Why it exists: the connect dialog asked the per-service flag ("is Google Analytics connected") after the popup closed. That
// flag stays false after a successful sign-in until a property is chosen, so a perfectly good Google/Meta connection was
// reported as "not completed". oauth_connected says "signed in"; oauth_stamp changes on every new sign-in so a re-consent of an
// already-connected provider can be told apart from a cancelled one.
import http from 'node:http';

let fail = 0;
const t = (name, ok, extra = '') => { if (!ok) fail++; console.log(ok ? 'PASS' : 'FAIL', name, ok ? '' : extra); };

let apiKeys = {};
let integrationStatus = {};
const fake = http.createServer((req, res) => {
  const url = req.url || '';
  const wantsObject = String(req.headers.accept || '').includes('vnd.pgrst.object');
  const send = (payload) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(payload)); };
  if (url.startsWith('/auth/v1/user')) return send({ id: 'u1', email: 'a@example.com', aud: 'authenticated', role: 'authenticated' });
  if (url.startsWith('/rest/v1/users')) {
    const row = { id: 'u1', email: 'a@example.com', role: 'company_admin', company_id: 'c1', active_company_id: null, accessible_company_ids: [] };
    return send(wantsObject ? row : [row]);
  }
  if (url.startsWith('/rest/v1/companies')) {
    const row = { id: 'c1', name: 'Acme', api_keys: apiKeys, integration_status: integrationStatus };
    return send(wantsObject ? row : [row]);
  }
  return send(wantsObject ? null : []);
}).listen(3991);

Object.assign(process.env, {
  SUPABASE_URL: 'http://127.0.0.1:3991', SUPABASE_SERVICE_ROLE_KEY: 't', SUPABASE_ANON_KEY: 't', JWT_SECRET: 't', PORT: '3992',
});
for (const k of ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'STABILITY_API_KEY', 'PERPLEXITY_API_KEY', 'STRIPE_SECRET_KEY', 'RESEND_API_KEY', 'HUNTER_API_KEY']) delete process.env[k];
await import('../src/index.js');
// Wait until the server answers instead of sleeping a fixed time: a slow start (cold disk, OneDrive sync) made a fixed sleep flaky.
for (let i = 0; i < 150; i++) {
  try { if ((await fetch('http://127.0.0.1:' + process.env.PORT + '/health')).ok) break; } catch { /* not listening yet */ }
  await new Promise((r) => setTimeout(r, 100));
}

const status = async () => {
  const r = await fetch('http://127.0.0.1:3992/api/integrations/status', { headers: { Authorization: 'Bearer tok' } });
  return { code: r.status, text: await r.text() };
};

// Signed in to Google (Analytics scope granted) but no property chosen yet; Meta never connected.
apiKeys = {
  google_access_token: 'ya29.SECRET-ACCESS', google_refresh_token: '1//SECRET-REFRESH',
  google_scopes: 'https://www.googleapis.com/auth/analytics.readonly',
  google_token_expires_at: '2026-10-07T12:00:00.000Z',
};
let r = await status();
let body = {};
try { body = JSON.parse(r.text); } catch { /* reported below */ }
t('route answers 200', r.code === 200, `${r.code} ${r.text.slice(0, 200)}`);
t('signed in to Google -> oauth_connected.google is true', body.oauth_connected?.google === true, JSON.stringify(body.oauth_connected));
t('...while the per-service Analytics flag is still false (no property chosen) - the case the old check got wrong', body.status?.google_analytics === false, JSON.stringify(body.status?.google_analytics));
t('Meta never connected -> false', body.oauth_connected?.meta === false);
t('the stamp is the token expiry (changes on every new sign-in)', body.oauth_stamp?.google === '2026-10-07T12:00:00.000Z', JSON.stringify(body.oauth_stamp));
t('an unconnected provider has a null stamp', body.oauth_stamp?.meta === null);
t('every provider the popup flow uses is reported', ['google', 'meta', 'linkedin', 'twitter', 'tiktok', 'canva'].every((p) => p in (body.oauth_connected || {}) && p in (body.oauth_stamp || {})));
t('NO token or secret appears anywhere in the response', !/SECRET|ya29|1\/\//.test(r.text), r.text.slice(0, 300));

// Re-consent: new tokens are saved, the expiry (stamp) moves.
apiKeys = { ...apiKeys, google_token_expires_at: '2026-10-07T13:00:00.000Z' };
r = await status();
body = JSON.parse(r.text);
t('a re-consent changes the stamp while it stays connected', body.oauth_connected.google === true && body.oauth_stamp.google === '2026-10-07T13:00:00.000Z', JSON.stringify(body.oauth_stamp));

// Each provider reads its own token.
apiKeys = { meta_access_token: 'EAAB-SECRET', linkedin_access_token: 'li-SECRET', twitter_access_token: 'tw-SECRET', tiktok_access_token: 'tt-SECRET', canva_access_token: 'cv-SECRET' };
r = await status();
body = JSON.parse(r.text);
t('meta, linkedin, twitter, tiktok and canva each report their own token', ['meta', 'linkedin', 'twitter', 'tiktok', 'canva'].every((p) => body.oauth_connected[p] === true) && body.oauth_connected.google === false, JSON.stringify(body.oauth_connected));
t('still no secret in the response', !/SECRET/.test(r.text));

fake.close();
console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
