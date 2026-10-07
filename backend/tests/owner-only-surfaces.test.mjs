// Behaviour test for two business rules the platform owner treats as absolute:
//   1. BYOK (a company's OWN AI provider keys) is for owner / system_admin only. A company admin must not be able to store one, even with a
//      plain API call that skips the settings screen.
//   2. Design Studio is the owner's trade secret: its image-edit endpoint answers 404 to everyone but the App Owner, and the error text of a
//      neighbouring feature (task sections) never names it.
// Run all: node backend/tests/run.mjs. Real routes behind a fake Supabase (auth + a mutable role); needs no credentials.
import http from 'node:http';

let fail = 0;
const t = (name, ok, extra = '') => { if (!ok) fail++; console.log(ok ? 'PASS' : 'FAIL', name, ok ? '' : extra); };

let role = 'company_admin';
let company = { id: 'c1', name: 'Acme', api_keys: { smtp_host: 'old.example.com', resend_api_key: 're_keepme' }, settings: {}, integration_status: {} };
const patches = [];
const fake = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    const url = req.url || '';
    const wantsObject = String(req.headers.accept || '').includes('vnd.pgrst.object');
    const send = (code, payload) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(payload === undefined ? '' : JSON.stringify(payload)); };
    if (url.startsWith('/auth/v1/user')) return send(200, { id: 'u1', email: 'a@example.com', aud: 'authenticated', role: 'authenticated' });
    if (url.startsWith('/rest/v1/users')) {
      const row = { id: 'u1', email: 'a@example.com', role, company_id: 'c1', active_company_id: null, accessible_company_ids: [] };
      return send(200, wantsObject ? row : [row]);
    }
    if (url.startsWith('/rest/v1/companies')) {
      if (req.method === 'PATCH') {
        const update = JSON.parse(body || '{}');
        patches.push(update);
        company = { ...company, ...update };
        return send(200, wantsObject ? company : [company]);
      }
      return send(200, wantsObject ? company : [company]);
    }
    return send(200, wantsObject ? null : []);
  });
}).listen(3994);

Object.assign(process.env, { SUPABASE_URL: 'http://127.0.0.1:3994', SUPABASE_SERVICE_ROLE_KEY: 't', SUPABASE_ANON_KEY: 't', JWT_SECRET: 't', PORT: '3995' });
await import('../src/index.js');
for (let i = 0; i < 150; i++) {
  try { if ((await fetch('http://127.0.0.1:' + process.env.PORT + '/health')).ok) break; } catch { /* not listening yet */ }
  await new Promise((r) => setTimeout(r, 100));
}

const call = async (method, path, payload) => {
  const r = await fetch('http://127.0.0.1:3995' + path, {
    method, headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' }, body: payload ? JSON.stringify(payload) : undefined,
  });
  let json = null; try { json = await r.json(); } catch { /* no body */ }
  return { status: r.status, json };
};
const KEYS = { openai_api_key: 'sk-customer-openai', anthropic_api_key: 'sk-ant-customer', stability_api_key: 'sk-stab-customer' };

// ── 1. BYOK write path
for (const r of ['company_admin', 'user']) {
  role = r; patches.length = 0; company = { ...company, api_keys: { smtp_host: 'old.example.com', resend_api_key: 're_keepme' } };
  const out = await call('PATCH', '/api/companies/current', { ...KEYS, smtp_host: 'mail.example.com', ai_provider: 'anthropic', openai_model: 'gpt-4o-mini' });
  const saved = patches[0]?.api_keys || {};
  if (r === 'user') { t('a plain team member cannot change company settings at all (unchanged behaviour)', out.status === 403 && patches.length === 0, `${out.status}`); continue; }
  t(`${r}: the request still succeeds (other fields are saved)`, out.status === 200 && saved.smtp_host === 'mail.example.com', `${out.status} ${JSON.stringify(saved)}`);
  t(`${r}: their own OpenAI / Anthropic / Stability keys are NOT stored`, !('openai_api_key' in saved) && !('anthropic_api_key' in saved) && !('stability_api_key' in saved), JSON.stringify(Object.keys(saved)));
  t(`${r}: model and provider PREFERENCES are not keys and still save`, saved.ai_provider === 'anthropic' && saved.openai_model === 'gpt-4o-mini', JSON.stringify(saved));
  t(`${r}: credentials already stored are kept`, saved.resend_api_key === 're_keepme', JSON.stringify(saved));
}
for (const r of ['owner', 'system_admin']) {
  role = r; patches.length = 0; company = { ...company, api_keys: { resend_api_key: 're_keepme' } };
  const out = await call('PATCH', '/api/companies/current', { ...KEYS });
  const saved = patches[0]?.api_keys || {};
  t(`${r}: may store the platform-team BYOK keys`, out.status === 200 && saved.openai_api_key === KEYS.openai_api_key && saved.anthropic_api_key === KEYS.anthropic_api_key && saved.stability_api_key === KEYS.stability_api_key, `${out.status} ${JSON.stringify(Object.keys(saved))}`);
}

// ── 2. Design Studio's image editor
for (const r of ['company_admin', 'system_admin', 'user']) {
  role = r;
  const out = await call('POST', '/api/ai/edit-image', { image_url: 'https://example.com/x.png', prompt: 'make it blue' });
  t(`${r}: /api/ai/edit-image answers 404 (it does not even confirm the feature exists)`, out.status === 404, `${out.status} ${JSON.stringify(out.json)}`);
}
role = 'owner';
let out = await call('POST', '/api/ai/edit-image', {});
t('owner: gets past the gate (the empty request is then refused for its content, not hidden)', out.status === 400, `${out.status} ${JSON.stringify(out.json)}`);

// ── 3. the task-section error text does not name the Design section
role = 'company_admin';
out = await call('POST', '/api/tasks', { title: 'x', section: 'not-a-section' });
t('an invalid task section is refused', out.status === 400, `${out.status} ${JSON.stringify(out.json)}`);
t('...and the message lists the sections WITHOUT naming "design"', !/design/i.test(JSON.stringify(out.json)) && /general/.test(JSON.stringify(out.json)), JSON.stringify(out.json));

// ── 4. the apps are consumption-only: no checkout or portal session for a request from the apps' pages
const withOrigin = (method, path, origin) => new Promise((resolve, reject) => {
  const req = http.request({ host: '127.0.0.1', port: 3995, method, path, headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) } }, (res) => {
    let b = '';
    res.on('data', (c) => { b += c; });
    res.on('end', () => resolve({ status: res.statusCode, body: b }));
  });
  req.on('error', reject);
  req.end('{}');
});
role = 'company_admin';
for (const origin of ['capacitor://localhost', 'https://localhost']) {
  for (const path of ['/api/billing/checkout', '/api/billing/portal']) {
    const r = await withOrigin('POST', path, origin);
    t(`${path} from ${origin} answers 404`, r.status === 404, `${r.status} ${r.body}`);
  }
}
let web = await withOrigin('POST', '/api/billing/checkout', 'https://ai.bmapz.com');
t('the website still reaches checkout (refused only for its content here: no price given)', web.status === 400, `${web.status} ${web.body}`);
web = await withOrigin('POST', '/api/billing/checkout', undefined);
t('a call with no Origin header (server to server) is not treated as the app', web.status === 400, `${web.status} ${web.body}`);

fake.close();
console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
