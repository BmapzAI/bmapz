// Behaviour test: refundFlat() gives credits back through the refund_ai_credits RPC and writes a 'refund' ledger row.
// chargeFlat deducts BEFORE the provider is called, so without this a failed image/edit billed 40-320 credits for a 502.
// Run all: node backend/tests/run.mjs. Uses a fake PostgREST; needs no credentials.
import http from 'node:http';

let fail = 0;
const t = (name, ok, extra) => {
  if (!ok) fail++;
  console.log(ok ? 'PASS' : 'FAIL', name, ok ? '' : `| ${extra ?? ''}`);
};

const seen = { rpc: [], tx: [] };
let rpcStatus = 200;
let subRows = [{ id: 's1', ai_credits_total: 1000, topup_credits_purchased: 200 }];
const fake = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    const url = req.url || '';
    const json = (status, payload) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(payload)); };
    if (url.startsWith('/rest/v1/rpc/refund_ai_credits')) {
      seen.rpc.push(JSON.parse(body || '{}'));
      return rpcStatus === 200 ? json(200, 120) : json(rpcStatus, { message: 'boom' });
    }
    if (url.startsWith('/rest/v1/credit_transactions') && req.method === 'POST') {
      seen.tx.push(JSON.parse(body || '{}'));
      return json(201, {});
    }
    if (url.startsWith('/rest/v1/subscriptions')) {
      const wantsObject = String(req.headers.accept || '').includes('vnd.pgrst.object');
      return json(200, wantsObject ? (subRows[0] ?? null) : subRows);
    }
    return json(200, []);
  });
}).listen(3990);

process.env.SUPABASE_URL = 'http://127.0.0.1:3990';
process.env.SUPABASE_SERVICE_ROLE_KEY = 't';
process.env.SUPABASE_ANON_KEY = 't';
process.env.JWT_SECRET = 't';
const { refundFlat } = await import('../src/routes/ai.js');

await refundFlat({ companyId: 'c1', action: 'generate_image', quantity: 2, reason: 'every image provider failed' });
t('calls the RPC once', seen.rpc.length === 1, JSON.stringify(seen.rpc));
t('refunds 2 images x 40 credits = 80', seen.rpc[0]?.p_credits === 80 && seen.rpc[0]?.p_subscription_id === 's1', JSON.stringify(seen.rpc[0]));
const row = seen.tx[0] || {};
t('writes exactly one ledger row', seen.tx.length === 1, JSON.stringify(seen.tx));
t('ledger type is "refund" (allowed by the table CHECK)', row.type === 'refund', row.type);
t('ledger delta is POSITIVE 80', row.credits_delta === 80, row.credits_delta);
t('ledger balance after = total + topup - used-after-refund (1200 - 120)', row.credits_after === 1080, row.credits_after);
t('ledger names the feature and the reason', row.feature === 'generate_image' && /every image provider failed/.test(row.description || ''), JSON.stringify(row));

seen.rpc.length = 0; seen.tx.length = 0;
await refundFlat({ companyId: 'c1', action: 'edit_image', reason: 'x' });
t('a single edit refunds 40 (quantity defaults to 1)', seen.rpc[0]?.p_credits === 40, JSON.stringify(seen.rpc));

seen.rpc.length = 0; seen.tx.length = 0;
subRows = [];
await refundFlat({ companyId: 'c1', action: 'edit_image', reason: 'x' });
t('no subscription -> nothing to refund, no RPC, no ledger row', seen.rpc.length === 0 && seen.tx.length === 0, JSON.stringify(seen));

subRows = [{ id: 's1', ai_credits_total: 1000, topup_credits_purchased: 0 }];
rpcStatus = 500;
let threw = false;
try { await refundFlat({ companyId: 'c1', action: 'edit_image', reason: 'x' }); } catch { threw = true; }
t('an RPC failure throws (so the caller logs it) and writes no ledger row', threw && seen.tx.length === 0, `threw=${threw} tx=${seen.tx.length}`);

fake.close();
console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
