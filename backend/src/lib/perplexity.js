/**
 * Perplexity web search.
 *
 * WHY THIS FILE EXISTS (2026-10-06)
 * Perplexity retired Sonar Chat Completions on 2026-09-27. The replacement is the
 * Agent API:  POST https://api.perplexity.ai/v1/agent
 *   request : { preset, input, max_output_tokens }          (messages -> input)
 *   response: { status, output_text, output: [ {type:'message', content:[{text}]},
 *                                              {type:'search_results', results:[{url}]} ] }
 * There is no top-level `citations`; sources live in the `search_results` output item.
 * Source: docs.perplexity.ai/docs/agent-api/migrate-from-sonar/overview and the
 * official migrate-sonar-to-agent-api skill in perplexityai/api-platform-developers.
 *
 * TWO TRAPS THE DOCS CALL OUT, BOTH HANDLED BELOW
 *  1. A failed, cancelled or incomplete run comes back as HTTP 200 with
 *     status:"failed" and an error object. Branching on the HTTP code alone would
 *     return a failure as if it were an answer.
 *  2. The Agent API rejects ANY unknown or leftover field with a 400, so the request
 *     body is kept to the documented minimum rather than carried over from Sonar.
 *
 * STATUS: written to the documented spec and unit-tested against the documented
 * response shapes, but NOT live-verified, because no PERPLEXITY_API_KEY exists yet.
 * It is dormant until one is set (webSearch skips providers with no key), and the
 * `perplexity` case in routes/integrations.js calls this same function, so the first
 * real key produces direct evidence of which surface actually answers.
 *
 * The legacy /chat/completions path is kept as a FALLBACK, not the primary: one
 * Perplexity page says legacy synchronous requests "keep working: they are being
 * reformulated as Agent API requests", another says support ended. Both cannot be
 * true, and a key is the only way to find out, so the code tolerates either.
 */

export const AGENT_URL = 'https://api.perplexity.ai/v1/agent';
export const LEGACY_URL = 'https://api.perplexity.ai/chat/completions';

/** Statuses that mean "this surface rejected the REQUEST SHAPE", not "your key is bad". */
const SHAPE_REJECTED = new Set([400, 404, 405, 410, 422]);

const uniq = (arr) => [...new Set(arr.filter((u) => typeof u === 'string' && u))];

/** Parse an Agent API response. Throws on a non-completed run or an empty answer. */
export function parseAgentResponse(body) {
  if (!body || typeof body !== 'object') throw new Error('empty response');

  // Trap 1: failure arrives as HTTP 200.
  if (body.status && body.status !== 'completed') {
    const why = body.error?.message || body.incomplete_details?.reason || body.status;
    throw new Error(`run ${body.status}: ${why}`);
  }

  const parts = [];
  const urls = [];
  for (const item of Array.isArray(body.output) ? body.output : []) {
    if (item?.type === 'message') {
      for (const c of Array.isArray(item.content) ? item.content : []) {
        if (typeof c?.text === 'string') parts.push(c.text);
        for (const a of Array.isArray(c?.annotations) ? c.annotations : []) if (a?.url) urls.push(a.url);
      }
    } else if (item?.type === 'search_results') {
      for (const r of Array.isArray(item.results) ? item.results : []) if (r?.url) urls.push(r.url);
    }
  }

  const answer = (typeof body.output_text === 'string' && body.output_text.trim())
    ? body.output_text
    : parts.join('').trim();
  if (!answer) throw new Error('no answer in response');
  return { answer, citations: uniq(urls).slice(0, 8) };
}

/** Parse the legacy chat-completions shape (kept only as the fallback). */
export function parseLegacyResponse(body) {
  const answer = body?.choices?.[0]?.message?.content;
  if (!answer) throw new Error('no answer in response');
  // Citations have appeared under different keys across versions; accept either.
  const raw = body?.citations || body?.search_results?.map((r) => r?.url) || [];
  return { answer, citations: uniq(raw).slice(0, 8) };
}

async function post(url, key, payload, timeoutMs, fetchImpl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const body = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}

function describe(r) {
  const d = r.body?.error?.message || r.body?.error || r.body?.detail || r.body?.message || '';
  return `${r.status}${d ? ` ${typeof d === 'string' ? d : JSON.stringify(d)}` : ''}`;
}

/**
 * Ask Perplexity a question.
 * @returns {{answer:string, citations:string[], surface:'agent'|'legacy'}}
 * Throws with .status set when a request is rejected, so callers can tell a bad key
 * (401) from a shape problem (400) from no credit (402/429).
 */
export async function askPerplexity({ key, query, system, maxTokens = 700, timeoutMs = 20000, fetchImpl = fetch }) {
  // The Agent API has no system role in the minimal form, so the guidance rides in
  // the input rather than adding an `instructions` field that REPLACES the preset's
  // own prompt (which carries the search/citation behaviour).
  const input = system ? `${system}\n\nQuestion: ${query}` : query;

  const agent = await post(AGENT_URL, key, { preset: 'fast', input, max_output_tokens: maxTokens }, timeoutMs, fetchImpl);
  if (agent.ok) return { ...parseAgentResponse(agent.body), surface: 'agent' };

  // A bad key or no credit will fail identically on the legacy path - do not mask it.
  if (!SHAPE_REJECTED.has(agent.status)) {
    const e = new Error(`agent API: ${describe(agent)}`);
    e.status = agent.status;
    throw e;
  }

  const legacy = await post(LEGACY_URL, key, {
    model: 'sonar',
    messages: [...(system ? [{ role: 'system', content: system }] : []), { role: 'user', content: query }],
    max_tokens: maxTokens,
    temperature: 0.2,
  }, timeoutMs, fetchImpl);
  if (legacy.ok) return { ...parseLegacyResponse(legacy.body), surface: 'legacy' };

  const e = new Error(`agent API: ${describe(agent)}; legacy: ${describe(legacy)}`);
  e.status = legacy.status;
  e.agentStatus = agent.status;
  throw e;
}
