// Behaviour test, kept in the repo so a reviewer can re-run the evidence. Run all: node backend/tests/run.mjs
//
// Sends REAL signed Stripe events (Stripe's own generateTestHeaderString) through the real webhook route, with a
// fake PostgREST recording every database write, and checks the money-handling paths; then the Resend sender.
import http from 'node:http';

let fail = 0;
const t = (name, ok, extra = '') => { if (!ok) fail++; console.log(ok ? 'PASS' : 'FAIL', name, ok ? '' : extra); };

// ── fake PostgREST that records everything and can be told to fail
const log = [];
const mode = { dup: false, failPatch: false };
const fake = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    let parsed = null; try { parsed = body ? JSON.parse(body) : null; } catch { /* not json */ }
    log.push({ method: req.method, url: req.url, body: parsed });
    const json = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(obj === undefined ? '' : JSON.stringify(obj)); };
    if (req.url.startsWith('/rest/v1/webhook_events') && req.method === 'POST') {
      return mode.dup ? json(409, { code: '23505', message: 'duplicate key value violates unique constraint "webhook_events_pkey"' }) : json(201);
    }
    if (req.url.startsWith('/rest/v1/subscriptions') && req.method === 'PATCH') {
      return mode.failPatch ? json(500, { message: 'boom' }) : json(200, []);
    }
    if (req.method === 'DELETE') return json(204);
    const wantsObject = String(req.headers.accept || '').includes('vnd.pgrst.object');
    return json(200, wantsObject ? {} : []);
  });
}).listen(3978);

Object.assign(process.env, {
  SUPABASE_URL: 'http://127.0.0.1:3978', SUPABASE_SERVICE_ROLE_KEY: 't', SUPABASE_ANON_KEY: 't', JWT_SECRET: 't', PORT: '3979',
  STRIPE_SECRET_KEY: 'sk_test_unit', STRIPE_WEBHOOK_SECRET: 'whsec_unit_test_secret',
});
await import('../src/index.js');
await new Promise((r) => setTimeout(r, 1500));

const Stripe = (await import('stripe')).default;
const stripe = new Stripe('sk_test_unit');
let n = 0;
async function send(type, object, { badSig = false } = {}) {
  const id = `evt_unit_${++n}`;
  const payload = JSON.stringify({ id, object: 'event', api_version: '2024-06-20', type, data: { object } });
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: badSig ? 'whsec_wrong' : process.env.STRIPE_WEBHOOK_SECRET });
  log.length = 0;
  const r = await fetch('http://127.0.0.1:3979/api/stripe/webhook', { method: 'POST', headers: { 'stripe-signature': header, 'content-type': 'application/json' }, body: payload });
  return { status: r.status, id, writes: log.filter((x) => x.method !== 'GET') };
}
const patches = (o) => o.writes.filter((w) => w.method === 'PATCH' && w.url.includes('/subscriptions'));
const deletes = (o) => o.writes.filter((w) => w.method === 'DELETE' && w.url.includes('/webhook_events'));

// ── subscription status mapping (the live table allows only five statuses)
let o = await send('customer.subscription.updated', { id: 'sub_1', customer: 'cus_1', status: 'unpaid' });
t('unpaid -> stored as past_due (access must stop)', o.status === 200 && patches(o)[0]?.body?.status === 'past_due', JSON.stringify(patches(o)));
o = await send('customer.subscription.updated', { id: 'sub_1', customer: 'cus_1', status: 'incomplete_expired' });
t('incomplete_expired -> canceled', patches(o)[0]?.body?.status === 'canceled');
o = await send('customer.subscription.updated', { id: 'sub_1', customer: 'cus_1', status: 'incomplete' });
t('incomplete -> past_due', patches(o)[0]?.body?.status === 'past_due');
o = await send('customer.subscription.updated', { id: 'sub_1', customer: 'cus_1', status: 'active' });
t('active stays active', patches(o)[0]?.body?.status === 'active');
o = await send('customer.subscription.updated', { id: 'sub_1', customer: 'cus_1', status: 'some_future_status' });
t('an unrecognised future status is NOT written (and the event is still acknowledged)', o.status === 200 && patches(o).length === 0, JSON.stringify(patches(o)));

// ── a failed write must make Stripe RETRY, and the retry must not be swallowed as a duplicate
mode.failPatch = true;
o = await send('customer.subscription.updated', { id: 'sub_2', customer: 'cus_2', status: 'active' });
t('a failed database write answers 5xx, not 200 (it used to fall through to 200)', o.status === 500, `status ${o.status}`);
t('...and hands the event back (deletes its idempotency row) so the retry is processed',
  deletes(o).length === 1 && deletes(o)[0].url.includes(o.id), JSON.stringify(deletes(o)));
o = await send('invoice.payment_failed', { customer: 'cus_3' });
t('invoice.payment_failed write failure -> 500 + unlock', o.status === 500 && deletes(o).length === 1);
mode.failPatch = false;

// ── delayed-payment checkout: no plan before the money
o = await send('checkout.session.completed', { id: 'cs_1', payment_status: 'unpaid', metadata: { company_id: 'co_1', plan: 'growth' }, customer: 'cus_9' });
t('checkout.session.completed with payment_status=unpaid grants NOTHING', o.status === 200 && o.writes.filter((w) => !w.url.includes('webhook_events')).length === 0,
  JSON.stringify(o.writes.map((w) => `${w.method} ${w.url}`)));

// ── pre-existing behaviour must survive
mode.dup = true;
o = await send('customer.subscription.updated', { id: 'sub_1', customer: 'cus_1', status: 'active' });
t('a duplicate delivery is still acknowledged and does no work', o.status === 200 && patches(o).length === 0);
mode.dup = false;
o = await send('customer.subscription.updated', { id: 'sub_1', customer: 'cus_1', status: 'active' }, { badSig: true });
t('a bad signature is still rejected with 400', o.status === 400, `status ${o.status}`);

// ── the status mapper on its own
const { toLocalSubscriptionStatus: map } = await import('../src/lib/stripeStatus.js');
t('mapper: all five local statuses pass through unchanged', ['trialing', 'active', 'past_due', 'canceled', 'paused'].every((s) => map(s) === s));
t('mapper: null for anything unknown', map('weird') === null && map(undefined) === null);

// ── Resend sender
const { sendViaResend } = await import('../src/lib/emailSender.js');
const realFetch = globalThis.fetch;
let sent = null;
const mockFetch = (status, body) => { globalThis.fetch = async (url, opts) => { sent = { url, body: JSON.parse(opts.body) }; return { ok: status < 300, status, json: async () => body }; }; };
mockFetch(200, { id: 're_123' });
let d = await sendViaResend('k', 'Bmapz <noreply@send.bmapz.com>', { to: 'a@b.co', subject: 's', html: '<p>x</p>', replyTo: 'support@bmapz.com' });
t('Resend success returns the message id', d.id === 're_123');
t('replyTo is sent as reply_to (it was silently dropped)', sent.body.reply_to === 'support@bmapz.com', JSON.stringify(sent.body));
t('From comes from RESEND_FROM_EMAIL', sent.body.from === 'Bmapz <noreply@send.bmapz.com>');
mockFetch(401, { statusCode: 401, name: 'validation_error', message: 'API key is invalid' });
let err = null; try { await sendViaResend('bad', 'x@y.co', { to: 'a@b.co', subject: 's' }); } catch (e) { err = e; }
t('a REJECTED send throws with Resend\'s message (it used to be reported as sent)', err?.message === 'API key is invalid' && err.status === 401 && err.code === 'validation_error', String(err?.message));
mockFetch(200, {});
err = null; try { await sendViaResend('k', 'x@y.co', { to: 'a@b.co', subject: 's' }); } catch (e) { err = e; }
t('a 200 with no message id is not a send', !!err);
let called = false; globalThis.fetch = async () => { called = true; return { ok: true, status: 200, json: async () => ({ id: 'x' }) }; };
err = null; try { await sendViaResend('k', undefined, { to: 'a@b.co', subject: 's' }); } catch (e) { err = e; }
t('no From address -> NO_FROM_ADDRESS, and Resend is never called with a made-up sender', err?.code === 'NO_FROM_ADDRESS' && !called);
globalThis.fetch = realFetch;

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
