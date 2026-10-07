// Behaviour test: paid add-ons are granted and recorded, a plan change made in the Stripe Customer Portal reaches the
// subscription, and no code writes a ledger/purchase type the LIVE database would reject.
// Run all: node backend/tests/run.mjs. Signed Stripe events go through the real webhook route; the fake PostgREST ENFORCES the
// live CHECK constraints (copied from the production database on 2026-10-07) so a type the database refuses fails here too.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let fail = 0;
const t = (name, ok, extra = '') => { if (!ok) fail++; console.log(ok ? 'PASS' : 'FAIL', name, ok ? '' : extra); };

// Live CHECK constraints (pg_get_constraintdef, 2026-10-07). If a migration changes these, update them here.
const LEDGER_TYPES = ['usage', 'topup', 'monthly_grant', 'bonus', 'refund'];
const PURCHASE_TYPES = ['credit_topup', 'full_scan', 'extra_user', 'extra_company_profile', 'plan_upgrade'];
const PURCHASE_STATUSES = ['pending', 'paid', 'failed', 'refunded'];
const SUB_PLANS = ['trial', 'starter', 'growth', 'scale', 'enterprise'];
const SUB_STATUSES = ['trialing', 'active', 'past_due', 'canceled', 'paused'];

// ── 1. static guard: every literal ledger / purchase type written anywhere in backend/src is one the database accepts
const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.js') ? [path.join(d, e.name)] : []));
const bad = [];
for (const file of walk(srcRoot)) {
  const text = fs.readFileSync(file, 'utf8');
  for (const [table, allowed] of [['credit_transactions', LEDGER_TYPES], ['billing_purchases', PURCHASE_TYPES]]) {
    let from = 0;
    for (;;) {
      const i = text.indexOf(`from('${table}')`, from);
      if (i < 0) break;
      from = i + 1;
      const slice = text.slice(i, i + 900);
      const ins = slice.indexOf('.insert(');
      if (ins < 0) continue;
      const body = slice.slice(ins, ins + 700);
      const m = body.match(/\btype:\s*'([a-z_]+)'/);
      if (m && !allowed.includes(m[1])) bad.push(`${path.relative(srcRoot, file)}: ${table}.type='${m[1]}'`);
    }
  }
  for (const m of text.matchAll(/\btxnType\s*=\s*'([a-z_]+)'/g)) if (!LEDGER_TYPES.includes(m[1])) bad.push(`${path.relative(srcRoot, file)}: txnType='${m[1]}'`);
}
t('no literal credit_transactions / billing_purchases type in backend/src violates the live CHECK', bad.length === 0, bad.join('; '));

// ── 2. fake database that enforces the same constraints
const state = {
  sub: { id: 's1', company_id: 'co_1', plan: 'starter', status: 'active', stripe_customer_id: 'cus_1', ai_credits_total: 15000, ai_credits_used: 3000, topup_credits_purchased: 0, scan_tokens_total: 0, scan_tokens_addon: 0, contacts_limit: 1500, created_at: '2026-01-01' },
  ledger: [],
  purchases: [],
  patches: [],
  rejected: [],
};
const fake = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    let parsed = null; try { parsed = body ? JSON.parse(body) : null; } catch { /* not json */ }
    const url = decodeURIComponent(req.url);
    const table = url.split('?')[0].replace('/rest/v1/', '');
    const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(obj === undefined ? '' : JSON.stringify(obj)); };
    const violate = (what) => { state.rejected.push(what); return send(400, { code: '23514', message: `new row violates check constraint (${what})` }); };
    if (table === 'webhook_events') return req.method === 'POST' ? send(201) : send(204);
    if (table === 'subscriptions') {
      if (req.method === 'GET') return send(200, [state.sub]);
      if (req.method === 'PATCH') {
        if (parsed?.plan && !SUB_PLANS.includes(parsed.plan)) return violate(`subscriptions.plan=${parsed.plan}`);
        if (parsed?.status && !SUB_STATUSES.includes(parsed.status)) return violate(`subscriptions.status=${parsed.status}`);
        state.patches.push({ url, body: parsed });
        Object.assign(state.sub, parsed);
        return send(204);
      }
      if (req.method === 'POST') return send(201);
    }
    if (table === 'credit_transactions') {
      if (req.method === 'GET') {
        const ref = url.match(/payment_ref=eq\.([^&]+)/)?.[1];
        return send(200, ref ? state.ledger.filter((r) => r.metadata?.payment_ref === ref).slice(0, 1) : []);
      }
      if (req.method === 'POST') {
        if (!LEDGER_TYPES.includes(parsed?.type)) return violate(`credit_transactions.type=${parsed?.type}`);
        const ref = parsed?.metadata?.payment_ref;
        if (ref && state.ledger.some((r) => r.metadata?.payment_ref === ref)) return send(409, { code: '23505', message: 'duplicate key value violates unique constraint "uq_credit_tx_payment_ref"' });
        state.ledger.push(parsed);
        return send(201);
      }
    }
    if (table === 'billing_purchases') {
      if (req.method === 'GET') {
        const ref = url.match(/provider_reference=eq\.([^&]+)/)?.[1];
        return send(200, state.purchases.filter((p) => p.provider_reference === ref).slice(0, 1));
      }
      if (req.method === 'POST') {
        if (!PURCHASE_TYPES.includes(parsed?.type)) return violate(`billing_purchases.type=${parsed?.type}`);
        if (!PURCHASE_STATUSES.includes(parsed?.status)) return violate(`billing_purchases.status=${parsed?.status}`);
        state.purchases.push(parsed);
        return send(201);
      }
    }
    return send(200, []);
  });
}).listen(3996);

Object.assign(process.env, {
  SUPABASE_URL: 'http://127.0.0.1:3996', SUPABASE_SERVICE_ROLE_KEY: 't', SUPABASE_ANON_KEY: 't', JWT_SECRET: 't', PORT: '3997',
  STRIPE_SECRET_KEY: 'sk_test_unit', STRIPE_WEBHOOK_SECRET: 'whsec_unit_test_secret',
  STRIPE_PRICE_ID_STARTER_MONTHLY: 'price_starter_m', STRIPE_PRICE_ID_GROWTH_MONTHLY: 'price_growth_m', STRIPE_PRICE_ID_SCALE_ANNUAL: 'price_scale_a', STRIPE_PRICE_ID_ENTERPRISE: 'price_ent_plain',
});
await import('../src/index.js');
for (let i = 0; i < 150; i++) {
  try { if ((await fetch('http://127.0.0.1:' + process.env.PORT + '/health')).ok) break; } catch { /* not listening yet */ }
  await new Promise((r) => setTimeout(r, 100));
}

const Stripe = (await import('stripe')).default;
const stripe = new Stripe('sk_test_unit');
let n = 0;
async function send(type, object) {
  const id = `evt_ledger_${++n}`;
  const payload = JSON.stringify({ id, object: 'event', api_version: '2024-06-20', type, data: { object } });
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET });
  const before = { ledger: state.ledger.length, purchases: state.purchases.length, patches: state.patches.length };
  const r = await fetch('http://127.0.0.1:3997/api/stripe/webhook', { method: 'POST', headers: { 'stripe-signature': header, 'content-type': 'application/json' }, body: payload });
  return {
    status: r.status,
    ledger: state.ledger.slice(before.ledger),
    purchases: state.purchases.slice(before.purchases),
    patches: state.patches.slice(before.patches),
  };
}
const addonSession = (id, addon, quantity = 1, amount = 80000) => ({ id, payment_status: 'paid', metadata: { company_id: 'co_1', addon_type: addon, quantity: String(quantity) }, customer: 'cus_1', payment_intent: `pi_${id}`, amount_total: amount });

// ── 3. add-ons: granted AND recorded, with types the database accepts
let o = await send('checkout.session.completed', addonSession('cs_scan', 'extra_full_scan'));
t('a paid Full Scan add-on is GRANTED (it used to throw on the ledger CHECK and never be delivered)', o.status === 200 && state.sub.scan_tokens_addon === 1, `status ${o.status} addon ${state.sub.scan_tokens_addon} rejected ${state.rejected}`);
t('...with a ledger row the database accepts', o.ledger.length === 1 && LEDGER_TYPES.includes(o.ledger[0].type) && o.ledger[0].feature === 'extra_full_scan', JSON.stringify(o.ledger));
t('...and a purchase row typed full_scan with the scan token counted', o.purchases.length === 1 && o.purchases[0].type === 'full_scan' && o.purchases[0].scan_tokens_granted === 1 && o.purchases[0].status === 'paid', JSON.stringify(o.purchases));

o = await send('checkout.session.completed', addonSession('cs_pack', 'extra_credit_pack', 2, 15980));
t('a credit pack x2 adds 30000 top-up credits', state.sub.topup_credits_purchased === 30000, `topup ${state.sub.topup_credits_purchased}`);
t('...recorded as credit_topup with the credits granted', o.purchases[0]?.type === 'credit_topup' && o.purchases[0]?.credits_granted === 30000 && o.purchases[0]?.quantity === 2 && o.ledger[0]?.type === 'topup', JSON.stringify([o.purchases, o.ledger]));

o = await send('checkout.session.completed', addonSession('cs_co', 'extra_company', 1, 75000));
t('extra_company is recorded as extra_company_profile (the add-on id is not a legal purchase type)', o.purchases[0]?.type === 'extra_company_profile', JSON.stringify(o.purchases));
o = await send('checkout.session.completed', addonSession('cs_user', 'extra_user', 1, 7990));
t('extra_user is recorded as extra_user', o.purchases[0]?.type === 'extra_user', JSON.stringify(o.purchases));

const topupBefore = state.sub.topup_credits_purchased;
o = await send('checkout.session.completed', addonSession('cs_pack', 'extra_credit_pack', 2, 15980));
t('a re-delivery of the same add-on payment grants and records nothing more', o.status === 200 && o.ledger.length === 0 && o.purchases.length === 0 && state.sub.topup_credits_purchased === topupBefore, JSON.stringify(o));
t('the database rejected nothing so far', state.rejected.length === 0, state.rejected.join('; '));

// ── 4. Customer Portal plan changes
const portal = (priceId, status = 'active', extra = {}) => ({ id: 'sub_1', customer: 'cus_1', status, items: { data: [{ price: { id: priceId } }] }, ...extra });
state.patches.length = 0;
o = await send('customer.subscription.updated', portal('price_growth_m'));
t('upgrade starter -> growth in the portal: plan, credits, contacts and scan tokens follow', state.sub.plan === 'growth' && state.sub.ai_credits_total === 40000 && state.sub.contacts_limit === 10000 && state.sub.scan_tokens_total === 1,
  JSON.stringify(state.sub));
t('...used credits are kept (an upgrade is headroom, not a reset)', state.sub.ai_credits_used === 3000);
t('...and the increase is in the ledger as a grant of +25000', o.ledger.length === 1 && o.ledger[0].type === 'monthly_grant' && o.ledger[0].feature === 'plan_change' && o.ledger[0].credits_delta === 25000 && o.ledger[0].credits_after === 40000 + 30000 - 3000, JSON.stringify(o.ledger));

o = await send('customer.subscription.updated', portal('price_growth_m'));
t('the same event again is a no-op (plan already applied: no write, no second grant)', o.status === 200 && o.ledger.length === 0 && o.patches.filter((p) => p.body?.plan).length === 0, JSON.stringify(o));

o = await send('customer.subscription.updated', portal('price_unknown'));
t('an UNKNOWN price changes nothing', state.sub.plan === 'growth' && o.patches.filter((p) => p.body?.plan).length === 0);

o = await send('customer.subscription.updated', portal('price_starter_m', 'past_due'));
t('a past_due subscription never changes plan (status is still written)', state.sub.plan === 'growth' && state.sub.status === 'past_due', JSON.stringify(state.sub));
state.sub.status = 'active';

o = await send('customer.subscription.updated', portal('price_starter_m'));
t('downgrade growth -> starter takes effect: credits cut to the starter allowance, used kept', state.sub.plan === 'starter' && state.sub.ai_credits_total === 15000 && state.sub.ai_credits_used === 3000 && state.sub.contacts_limit === 1500 && state.sub.scan_tokens_total === 0, JSON.stringify(state.sub));
t('...no ledger row for a reduction (the ledger has no type for one)', o.ledger.length === 0);

o = await send('customer.subscription.updated', portal('price_scale_a'));
t('the ANNUAL price of a plan maps to that plan', state.sub.plan === 'scale' && state.sub.ai_credits_total === 150000, JSON.stringify(state.sub));
o = await send('customer.subscription.updated', portal('price_ent_plain'));
t('a plan configured with the plain STRIPE_PRICE_ID_<PLAN> variable maps too', state.sub.plan === 'enterprise' && state.sub.contacts_limit === 100000, JSON.stringify(state.sub));
o = await send('customer.subscription.updated', { id: 'sub_1', customer: 'cus_1', status: 'active' });
t('an event with no items (older shape) still works and changes no plan', o.status === 200 && state.sub.plan === 'enterprise');
t('the database rejected nothing in the portal flow either', state.rejected.length === 0, state.rejected.join('; '));

fake.close();
console.log(fail ? `\n${fail} FAILED` : '\nall passed');
// Flush stdout first: on Windows the process can exit before its piped output is written, and run.mjs then sees an empty file (a one-off
// "0 passed" failure of a file that had passed).
await new Promise((resolve) => process.stdout.write('', resolve));
process.exit(fail ? 1 : 0);
