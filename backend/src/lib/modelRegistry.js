/**
 * Live model registry — the "auto-update" layer for AI models.
 *
 * Periodically pulls the model catalogs straight from OpenAI and Anthropic
 * using the PLATFORM keys, filters to chat-capable models, and classifies
 * each with the tier/credit heuristics in aiCredits.js. New models released
 * by either provider therefore become available to plans, settings and the
 * token-usage math WITHOUT a code deploy.
 *
 * - Cached in-process for 12 hours (providers rarely change intra-day).
 * - Falls back to the static known list if a provider call fails.
 */
import { inferModelTier, inferModelMultiplier, MODEL_TIER } from './aiCredits.js';

const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
let cacheAt = 0;
let cached = null;

// Static fallback (mirrors the pre-auto-update hardcoded list)
const STATIC_MODELS = Object.keys(MODEL_TIER).map(id => ({
  id,
  provider: id.startsWith('claude') ? 'anthropic' : 'openai',
}));

// OpenAI returns EVERYTHING (tts, whisper, embeddings, dall-e…). Keep chat models.
function isOpenAIChatModel(id) {
  const m = id.toLowerCase();
  if (/(embed|whisper|tts|audio|dall-e|image|moderation|realtime|transcribe|search|davinci|babbage|instruct)/.test(m)) return false;
  return m.startsWith('gpt') || m.startsWith('o1') || m.startsWith('o3') || m.startsWith('o4') || m.startsWith('chatgpt');
}

async function fetchOpenAIModels() {
  const key = (process.env.OPENAI_API_KEY || '').trim();
  if (!key) return [];
  const res = await fetch('https://api.openai.com/v1/models', {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`OpenAI models list ${res.status}`);
  const body = await res.json();
  return (body.data || [])
    .map(m => m.id)
    .filter(isOpenAIChatModel)
    .map(id => ({ id, provider: 'openai' }));
}

async function fetchAnthropicModels() {
  const key = (process.env.ANTHROPIC_API_KEY || '').trim();
  if (!key) return [];
  const res = await fetch('https://api.anthropic.com/v1/models?limit=50', {
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
  });
  if (!res.ok) throw new Error(`Anthropic models list ${res.status}`);
  const body = await res.json();
  return (body.data || []).map(m => ({ id: m.id, provider: 'anthropic', display_name: m.display_name }));
}

/**
 * Return the live model catalog, classified with tier + credit multiplier.
 * Shape: [{ id, provider, display_name?, tier, credit_multiplier }]
 */
export async function getLiveModels({ force = false } = {}) {
  if (!force && cached && Date.now() - cacheAt < CACHE_TTL_MS) return cached;

  const [openaiRes, anthropicRes] = await Promise.allSettled([
    fetchOpenAIModels(),
    fetchAnthropicModels(),
  ]);

  let models = [];
  if (openaiRes.status === 'fulfilled') models.push(...openaiRes.value);
  else console.warn('[modelRegistry] OpenAI list failed:', openaiRes.reason?.message);
  if (anthropicRes.status === 'fulfilled') models.push(...anthropicRes.value);
  else console.warn('[modelRegistry] Anthropic list failed:', anthropicRes.reason?.message);

  // Both failed / no keys → static fallback so the app keeps working
  if (models.length === 0) models = [...STATIC_MODELS];

  // Dedup + classify
  const seen = new Set();
  const classified = [];
  for (const m of models) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    classified.push({
      ...m,
      tier: inferModelTier(m.id),
      credit_multiplier: inferModelMultiplier(m.id),
    });
  }
  // Sort: provider, then cheapest first within tier ordering
  const tierOrder = { smart: 0, smarter: 1, smartest: 2 };
  classified.sort((a, b) =>
    a.provider.localeCompare(b.provider) ||
    (tierOrder[a.tier] - tierOrder[b.tier]) ||
    a.credit_multiplier - b.credit_multiplier
  );

  cached = classified;
  cacheAt = Date.now();
  console.log(`[modelRegistry] refreshed: ${classified.length} models (openai=${classified.filter(m => m.provider === 'openai').length}, anthropic=${classified.filter(m => m.provider === 'anthropic').length})`);
  return classified;
}

/** Kick off a background refresh on boot + every 12h (fire-and-forget). */
export function startModelRegistryRefresh() {
  getLiveModels().catch(() => {});
  setInterval(() => getLiveModels({ force: true }).catch(() => {}), CACHE_TTL_MS).unref?.();
}
