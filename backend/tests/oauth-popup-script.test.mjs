// Behaviour test, kept in the repo so a reviewer can re-run the evidence. Run all: node backend/tests/run.mjs
//
// /api/oauth/popup.js is JavaScript emitted from inside a server-side TEMPLATE LITERAL. A single backslash in
// the server source collapses ("\/" -> "/"), so a regex like /\/+$/ was emitted as //+$/, which is a COMMENT:
// a syntax error that would have silently killed the whole popup script. Reading the source cannot catch that;
// only running the EMITTED script can. This does, in both situations the page can be in.
import vm from 'node:vm';

Object.assign(process.env, { SUPABASE_URL: 'http://127.0.0.1:1', SUPABASE_SERVICE_ROLE_KEY: 't', SUPABASE_ANON_KEY: 't', JWT_SECRET: 't', PORT: '3981' });
await import('../src/index.js');
await new Promise((r) => setTimeout(r, 1200));
const body = await (await fetch('http://127.0.0.1:3981/api/oauth/popup.js')).text();

let fail = 0;
const t = (name, ok, extra = '') => { if (!ok) fail++; console.log(ok ? 'PASS' : 'FAIL', name, ok ? '' : extra); };

let valid = true;
try { new Function(body); } catch { valid = false; }
t('emitted popup.js is syntactically valid', valid);
t('emitted regex is not a comment (the template-literal escape trap)', !body.includes('///+') && /replace\(\/\\\/\+\$\//.test(body), body.match(/replace\((.*?),/)?.[1]);

function run({ status, opener, target }) {
  const calls = { posted: null, replaced: null, closed: 0 };
  vm.runInNewContext(body, {
    document: { body: { dataset: { status, provider: 'Google', integration: 'gmail', target } } },
    window: { opener: opener ? { postMessage: (m, o) => { calls.posted = { m, o }; } } : null, close: () => { calls.closed++; } },
    location: { replace: (u) => { calls.replaced = u; } },
    setTimeout: (fn) => fn(), encodeURIComponent,
  });
  return calls;
}
let c = run({ status: 'success', opener: true, target: 'https://ai.bmapz.com' });
t('opener present -> posts to the EXACT origin, closes, no redirect', c.posted?.o === 'https://ai.bmapz.com' && c.posted.m.type === 'oauth_success' && c.closed === 1 && !c.replaced);
c = run({ status: 'success', opener: false, target: 'https://ai.bmapz.com' });
t('NO opener (severed popup / in-app browser) -> redirects into the app with the outcome', c.replaced === 'https://ai.bmapz.com/Integrations?oauth=success&provider=gmail' && !c.posted, c.replaced);
c = run({ status: 'error', opener: false, target: 'https://ai.bmapz.com/' });
t('NO opener + error + trailing slash on the target', c.replaced === 'https://ai.bmapz.com/Integrations?oauth=error&provider=gmail', c.replaced);
c = run({ status: 'success', opener: false, target: '' });
t('NO opener and no target configured -> only tries to close', !c.replaced && c.closed === 1);

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
