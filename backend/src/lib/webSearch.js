/**
 * Live web access for the agent and the company brain.
 *
 * WHY: everything the agent knew came from what users had typed into Bmapz. It
 * could not check a competitor's site, look up a market fact, or read anything
 * current — and because it is under a strict no-fabrication rule, the honest
 * answer was often "I don't have that", which is correct but not useful.
 *
 * PROVIDER CHAIN: Perplexity first (it returns a synthesised answer WITH
 * citations, which is what a no-fabrication rule needs), then OpenAI's web-search
 * model, then Anthropic's web-search tool. Each provider is tried in turn and any
 * failure — missing key, bad response shape, network error, rate limit — falls
 * through to the next.
 *
 * DEGRADES, NEVER THROWS. If no provider is configured or all fail, this returns
 * null and the caller carries on exactly as before. Web access is an enhancement;
 * it must never be able to break a chat reply or a brain build. Callers treat null
 * as "no external context available", which is the pre-existing behaviour.
 *
 * Company keys take precedence over platform keys, matching how BYOK works
 * everywhere else in the app.
 */
import { supabaseAdmin } from './supabase.js';

const clean = (k) => (typeof k === 'string' && k.trim() ? k.trim() : null);

/** Short in-process cache: the same question inside a conversation is common. */
const cache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX = 200;

const cacheGet = (key) => {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) { cache.delete(key); return null; }
  return hit.value;
};
const cacheSet = (key, value) => {
  // Bounded so a long-lived process cannot grow without limit.
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(key, { at: Date.now(), value });
};

/** Company-configured keys, falling back to the platform's own. */
async function resolveKeys(companyId) {
  let companyKeys = {};
  if (companyId) {
    const { data, error } = await supabaseAdmin
      .from('companies').select('api_keys').eq('id', companyId).maybeSingle();
    if (error) console.error('[webSearch] key lookup failed:', error.message);
    companyKeys = data?.api_keys || {};
  }
  return {
    perplexity: clean(companyKeys.perplexity_api_key) || clean(process.env.PERPLEXITY_API_KEY),
    openai: clean(companyKeys.openai_api_key) || clean(process.env.OPENAI_API_KEY),
    anthropic: clean(companyKeys.anthropic_api_key) || clean(process.env.ANTHROPIC_API_KEY),
  };
}

/** Abort rather than hang: a slow search must not stall a chat reply. */
async function fetchJson(url, options, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const detail = body?.error?.message || body?.error || res.statusText;
      throw new Error(`${res.status} ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

/* ── Providers ──────────────────────────────────────────────────────────── */

async function viaPerplexity(query, key) {
  const body = await fetchJson('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'sonar',
      messages: [
        { role: 'system', content: 'Answer factually and concisely from current sources. If sources disagree or are thin, say so.' },
        { role: 'user', content: query },
      ],
      max_tokens: 700,
      temperature: 0.2,
    }),
  });

  const answer = body?.choices?.[0]?.message?.content;
  if (!answer) throw new Error('no answer in response');
  // Perplexity has returned citations under different keys across versions;
  // accept either rather than losing them.
  const citations = body?.citations || body?.search_results?.map(r => r?.url) || [];
  return { answer, citations: citations.filter(Boolean).slice(0, 8), provider: 'perplexity' };
}

async function viaOpenAI(query, key) {
  const body = await fetchJson('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4.1',
      tools: [{ type: 'web_search' }],
      input: query,
    }),
  });

  const answer = body?.output_text
    || body?.output?.flatMap(o => o?.content || [])
      .map(c => c?.text).filter(Boolean).join('\n');
  if (!answer) throw new Error('no answer in response');

  const citations = (body?.output || [])
    .flatMap(o => o?.content || [])
    .flatMap(c => c?.annotations || [])
    .map(a => a?.url)
    .filter(Boolean);
  return { answer, citations: [...new Set(citations)].slice(0, 8), provider: 'openai' };
}

async function viaAnthropic(query, key) {
  const body = await fetchJson('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 900,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
      messages: [{ role: 'user', content: query }],
    }),
  });

  const answer = (body?.content || [])
    .filter(b => b?.type === 'text')
    .map(b => b.text)
    .join('\n')
    .trim();
  if (!answer) throw new Error('no answer in response');

  const citations = (body?.content || [])
    .flatMap(b => b?.citations || [])
    .map(c => c?.url)
    .filter(Boolean);
  return { answer, citations: [...new Set(citations)].slice(0, 8), provider: 'anthropic' };
}

/**
 * Search the web. Returns { answer, citations, provider } or null.
 *
 * Null means "no external context available" — not an error the caller has to
 * handle. Every failure path is logged so a misconfigured key is visible in the
 * Railway logs rather than silently degrading forever.
 */
export async function webSearch({ companyId, query }) {
  const q = String(query || '').trim();
  if (!q) return null;

  const cacheKey = `${companyId || 'platform'}::${q.slice(0, 300)}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  let keys;
  try {
    keys = await resolveKeys(companyId);
  } catch (e) {
    console.error('[webSearch] could not resolve keys:', e.message);
    return null;
  }

  const attempts = [
    keys.perplexity ? ['perplexity', () => viaPerplexity(q, keys.perplexity)] : null,
    keys.openai ? ['openai', () => viaOpenAI(q, keys.openai)] : null,
    keys.anthropic ? ['anthropic', () => viaAnthropic(q, keys.anthropic)] : null,
  ].filter(Boolean);

  if (!attempts.length) {
    console.log('[webSearch] no provider configured — skipping web lookup');
    return null;
  }

  for (const [name, run] of attempts) {
    try {
      const result = await run();
      console.log(`[webSearch] "${q.slice(0, 60)}" answered by ${name} (${result.citations.length} citation(s))`);
      cacheSet(cacheKey, result);
      return result;
    } catch (err) {
      // Fall through to the next provider. Logged individually so one broken key
      // does not look like "the internet is down".
      console.error(`[webSearch] ${name} failed: ${err.message}`);
    }
  }

  console.error('[webSearch] all providers failed — continuing without web context');
  return null;
}

/** Render a result as a block for a system prompt, with its sources. */
export function formatForPrompt(result) {
  if (!result?.answer) return '';
  const sources = result.citations?.length
    ? `\nSources: ${result.citations.join(' | ')}`
    : '';
  return [
    `LIVE WEB RESULTS (retrieved just now via ${result.provider}). Treat these as current fact,`,
    'and prefer them over your training data where they conflict. Cite the source when you use one.',
    '',
    result.answer,
    sources,
  ].join('\n');
}

export default webSearch;
