// Behaviour test, kept in the repo so a reviewer can re-run the evidence. Run all: node backend/tests/run.mjs
import { askPerplexity, parseAgentResponse, AGENT_URL, LEGACY_URL } from '../src/lib/perplexity.js';
let pass = 0, fail = 0;
const t = async (name, fn) => { try { await fn(); console.log('PASS', name); pass++; } catch (e) { console.log('FAIL', name, '->', e.message); fail++; } };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m}: got ${JSON.stringify(a)} want ${JSON.stringify(b)}`); };
// A mock fetch that answers per URL, recording what was sent.
const mk = (map, log = []) => async (url, opts) => {
  log.push({ url, body: JSON.parse(opts.body), auth: opts.headers.Authorization });
  const r = map[url]; if (!r) throw new Error('unexpected url ' + url);
  return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body };
};

await t('agent: output_text + search_results item', async () => {
  const log = [];
  const r = await askPerplexity({ key: 'k', query: 'q', system: 'S', fetchImpl: mk({ [AGENT_URL]: { status: 200, body: { status: 'completed', output_text: 'Hello [1]', output: [{ type: 'search_results', results: [{ url: 'https://a.com' }, { url: 'https://b.com' }, { url: 'https://a.com' }] }] } } }, log) });
  eq(r.answer, 'Hello [1]', 'answer'); eq(r.citations, ['https://a.com', 'https://b.com'], 'deduped citations'); eq(r.surface, 'agent', 'surface');
  eq(Object.keys(log[0].body).sort(), ['input', 'max_output_tokens', 'preset'], 'ONLY documented fields sent (agent rejects unknown fields)');
  eq(log[0].auth, 'Bearer k', 'auth');
});
await t('agent: no output_text, answer from message content + annotations', async () => {
  const r = await askPerplexity({ key: 'k', query: 'q', fetchImpl: mk({ [AGENT_URL]: { status: 200, body: { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'Part1 ', annotations: [{ url: 'https://c.com' }] }, { text: 'Part2' }] }] } } }) });
  eq(r.answer, 'Part1 Part2', 'joined'); eq(r.citations, ['https://c.com'], 'annotation url');
});
await t('TRAP: HTTP 200 + status failed is NOT returned as an answer', async () => {
  let threw = false;
  try { await askPerplexity({ key: 'k', query: 'q', fetchImpl: mk({ [AGENT_URL]: { status: 200, body: { status: 'failed', error: { message: 'search backend down' }, output_text: 'partial junk' } } }) }); } catch (e) { threw = /failed: search backend down/.test(e.message); }
  if (!threw) throw new Error('a failed run was treated as success');
});
await t('incomplete run (max_output_tokens) is not returned as an answer', async () => {
  let threw = false;
  try { parseAgentResponse({ status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } }); } catch (e) { threw = /max_output_tokens/.test(e.message); }
  if (!threw) throw new Error('incomplete treated as success');
});
await t('agent 404 -> falls back to legacy and says so', async () => {
  const r = await askPerplexity({ key: 'k', query: 'q', system: 'S', fetchImpl: mk({ [AGENT_URL]: { status: 404, body: {} }, [LEGACY_URL]: { status: 200, body: { choices: [{ message: { content: 'legacy ans' } }], citations: ['https://d.com'] } } }) });
  eq(r.surface, 'legacy', 'surface'); eq(r.answer, 'legacy ans', 'answer'); eq(r.citations, ['https://d.com'], 'cit');
});
await t('agent 401 (bad key) does NOT fall back - would mask the real problem', async () => {
  const log = []; let st;
  try { await askPerplexity({ key: 'bad', query: 'q', fetchImpl: mk({ [AGENT_URL]: { status: 401, body: { error: { message: 'Invalid API key' } } } }, log) }); } catch (e) { st = e.status; }
  eq(st, 401, 'status'); eq(log.length, 1, 'legacy was not called');
});
await t('402/429 (no credit / rate limit) does NOT fall back', async () => {
  for (const code of [402, 429]) { const log = []; try { await askPerplexity({ key: 'k', query: 'q', fetchImpl: mk({ [AGENT_URL]: { status: code, body: {} } }, log) }); } catch { /* expected */ } eq(log.length, 1, 'no fallback on ' + code); }
});
await t('both surfaces reject -> one error naming BOTH statuses', async () => {
  let msg = '';
  try { await askPerplexity({ key: 'k', query: 'q', fetchImpl: mk({ [AGENT_URL]: { status: 400, body: { error: { message: 'unknown field preset' } } }, [LEGACY_URL]: { status: 410, body: { error: 'gone' } } }) }); } catch (e) { msg = e.message; }
  if (!/agent API: 400 unknown field preset; legacy: 410 gone/.test(msg)) throw new Error('message was: ' + msg);
});
await t('empty answer is an error, not an empty string', async () => {
  let threw = false; try { parseAgentResponse({ status: 'completed', output: [{ type: 'search_results', results: [] }] }); } catch (e) { threw = /no answer/.test(e.message); }
  if (!threw) throw new Error('empty answer accepted');
});
await t('timeout aborts instead of hanging', async () => {
  const slow = (url, opts) => new Promise((_, rej) => opts.signal.addEventListener('abort', () => rej(new Error('aborted'))));
  let threw = false; try { await askPerplexity({ key: 'k', query: 'q', timeoutMs: 30, fetchImpl: slow }); } catch (e) { threw = /abort/.test(e.message); }
  if (!threw) throw new Error('did not abort');
});
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
