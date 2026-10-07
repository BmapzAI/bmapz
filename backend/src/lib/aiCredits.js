/**
 * AI Credit System — model pricing tiers, plan gating, and credit math.
 *
 * Strategy: 1 Bmapz credit ≈ 12 tokens of gpt-4o-mini (the cheapest model).
 * More expensive models cost MORE credits per token so margins stay healthy
 * across plans. See docs in AGENT_HANDOFF.md "Session 6" for the analysis.
 */

// Cost multiplier vs the baseline (gpt-4o-mini). Used to compute credit cost.
// Derived from blended (2:1 input:output) provider pricing as of mid-2026.
export const MODEL_COST_MULTIPLIER = {
  // multiplier = ((2 x input $/M + output $/M) / 3) / 0.30, i.e. the blended price (2:1 input:output) relative to the
  // gpt-4o-mini baseline of $0.30/M. Recomputed 2026-10-07 from the vendors' own price pages; the old table priced
  // models that have since been RETIRED and mis-priced the current ones in both directions (Claude Fable was billed
  // 30x against a real 78x, an ~2.6x undercharge; gpt-5-mini 1x against 2.8x).
  // OpenAI
  'gpt-4o-mini': 1,            // baseline
  'gpt-4o': 17,
  'gpt-4.1': 13,
  'gpt-4.1-mini': 3,
  'gpt-4.1-nano': 0.7,
  'gpt-5': 14,
  'gpt-5-mini': 3,
  'gpt-5-nano': 0.6,
  'o3': 13,
  'o3-mini': 7,
  'o1': 100,
  // Anthropic (platform.claude.com/docs/en/about-claude/pricing)
  'claude-haiku-4-5-20251001': 8,   // $1 / $5
  'claude-haiku-4-5': 8,
  'claude-sonnet-4-5': 23,          // $3 / $15  (deprecated, retires 2026-11-30)
  'claude-sonnet-4-6': 23,
  'claude-sonnet-5': 16,            // $2 / $10
  'claude-sonnet-5-5': 16,
  'claude-opus-4-5': 39,            // $5 / $25
  'claude-opus-4-6': 39,
  'claude-opus-4-7': 39,
  'claude-opus-4-8': 39,
  'claude-opus-5': 39,
  'claude-opus-5-5': 31,            // $4 / $20
  'claude-fable-5': 78,             // $10 / $50
  'claude-fable-5-1': 78,
};

// Human-friendly tier label for each model
export const MODEL_TIER = {
  // These keys also feed the static fallback model list (lib/modelRegistry.js), so nothing here may be shut down soon.
  // Removed because OpenAI shuts them down on 2026-10-23: gpt-4.1-nano, o1 (and o3-mini, gpt-4-turbo, gpt-3.5-turbo earlier).
  // Still listed but dated (check the vendor deprecation pages after each date): claude-sonnet-4-5 retires 2026-11-30,
  // claude-opus-4-5 has a retirement floor of 2026-11-24. Their prices stay in MODEL_COST_MULTIPLIER for old settings.
  // Explicit rather than price-derived: Claude Fable (the most expensive model) landed in the "smarter" band that the
  // Growth plan may use, while it should be reachable only on the plans that get "smartest".
  'gpt-4o-mini': 'smart',
  'gpt-4.1-mini': 'smart',
  'gpt-5-nano': 'smart',
  'gpt-5-mini': 'smart',
  'claude-haiku-4-5-20251001': 'smart',
  'claude-haiku-4-5': 'smart',

  'gpt-4o': 'smarter',
  'gpt-4.1': 'smarter',
  'gpt-5': 'smarter',
  'claude-sonnet-4-5': 'smarter',
  'claude-sonnet-4-6': 'smarter',
  'claude-sonnet-5': 'smarter',
  'claude-sonnet-5-5': 'smarter',

  'o3': 'smartest',
  'claude-opus-4-5': 'smartest',
  'claude-opus-4-6': 'smartest',
  'claude-opus-4-7': 'smartest',
  'claude-opus-4-8': 'smartest',
  'claude-opus-5': 'smartest',
  'claude-opus-5-5': 'smartest',
  'claude-fable-5': 'smartest',
  'claude-fable-5-1': 'smartest',
};

// Which tiers each plan can use. Higher plans inherit lower-tier access.
export const PLAN_MODEL_ACCESS = {
  trial:      ['smart'],
  starter:    ['smart'],
  growth:     ['smart', 'smarter'],
  scale:      ['smart', 'smarter', 'smartest'],
  enterprise: ['smart', 'smarter', 'smartest'],
};

// Heavy actions FORCED to the cheapest model regardless of user pick.
// These actions consume 30k-200k tokens per call and would blow margins.
export const FORCE_CHEAP_MODEL_ACTIONS = new Set([
  'brand_scan',
  'full_scan',
  'lite_scan',
  'marketing_plan',
  'sales_marketing_plan',
  'campaign_plan',
]);

// Interactive / short-output actions where response TIME dominates UX and a
// fast model is plenty (short-form output, grounded by the Company Brain).
// Long-form strategy work (ads_strategy, ads_generate, automations) stays on
// the smart tier — quality dominates there, not latency.
export const FAST_MODEL_ACTIONS = new Set([
  'ads_copy',
  'lead_scoring',
  'help_assistant',
  'sdr_chat',
  'whatsapp_chat',
]);

// Scan-class actions consume "scan tokens" — a separate budget from AI credits.
// These are NOT part of the 14-day trial (trial.scan_tokens = 0).
// Each plan defines how many scans are included per month; extras are purchased.
export const SCAN_ACTIONS = new Set([
  'brand_scan',
  'full_scan',
  'lite_scan',
]);

// How many scan tokens each plan includes per month.
// Keep in sync with frontend-src/lib/plans.js → PLANS[*].scan_tokens / lite_scans_monthly.
export const PLAN_SCAN_TOKENS = {
  trial:      0,
  starter:    0,
  growth:     1, // 1 Lite Scan per month
  scale:      2, // 2 Full Scan tokens per month
  enterprise: 5, // 5 Full Scan tokens per month
};

// Per-plan AI credits granted on each monthly cycle reset.
// Keep in sync with frontend-src/lib/plans.js → PLANS[*].ai_credits.
export const PLAN_MONTHLY_CREDITS = {
  trial:      8000,
  starter:    15000,
  growth:     40000,
  scale:      150000,
  enterprise: 400000,
};

/**
 * Determine whether a scan action is allowed for a given plan based on
 * REMAINING scan tokens. Pass scan_tokens_remaining from the subscription
 * (= base monthly grant + addon purchases - tokens consumed this cycle).
 */
export function canRunScanAction(action, planId, scanTokensRemaining) {
  if (!SCAN_ACTIONS.has(action)) return true;
  if (typeof scanTokensRemaining === 'number') return scanTokensRemaining > 0;
  // Fallback to plan-default if remaining count not available
  return (PLAN_SCAN_TOKENS[planId] || 0) > 0;
}

// ─── Live model availability ────────────────────────────────────────────────────
//
// The ids hard-coded in this file (and a few elsewhere) are a snapshot: Anthropic
// retires models on a published schedule, and a retired id does not degrade — the
// call is rejected. Worse, the "known-good fallback" the retry path falls back to
// was itself a retired model, so a request would fail twice and then silently move
// to the OTHER provider, changing cost and behaviour with nothing in the UI to say so.
//
// lib/modelRegistry.js already pulls each provider's live catalog every 12h; this is
// the missing link that lets the resolvers below USE it. It only changes an answer in
// the one case that would otherwise have been a rejected call: the chosen id is not in
// that provider's live catalog. If the catalog is not loaded yet, or a provider has no
// key (so no catalog), behaviour is exactly what it was before.
const LIVE_CATALOG = { anthropic: [], openai: [] };

/** Called by modelRegistry after a provider's catalog was fetched SUCCESSFULLY. */
export function setLiveCatalog(provider, models) {
  if (!LIVE_CATALOG[provider]) return;
  // An empty list is a failed/blank fetch, not "the provider has no models": keep
  // the last good catalog rather than treating every model as retired.
  if (Array.isArray(models) && models.length) LIVE_CATALOG[provider] = models;
}

const providerOfModel = (id) => (String(id || '').toLowerCase().startsWith('claude') ? 'anthropic' : 'openai');

/**
 * Return `preferred` if the provider still serves it; otherwise the live model of the
 * SAME tier whose credit multiplier is closest (so a stand-in for a retired Sonnet is
 * another Sonnet-class model, not a nano). Catalog order is the provider's own
 * newest-first order, which breaks ties toward the newest.
 */
export function liveModelFor(preferred, providerHint) {
  if (!preferred) return preferred;
  const provider = providerHint || providerOfModel(preferred);
  const live = LIVE_CATALOG[provider] || [];
  if (!live.length) return preferred;                       // no catalog → unchanged
  // Aliases (claude-haiku-4-5) and dated snapshots (claude-haiku-4-5-20251001) name the same model, and the docs do
  // not say which form /v1/models returns, so compare without the date suffix: otherwise a live alias is judged
  // "not served" and silently swapped for a model in a different tier.
  const base = (s) => String(s).replace(/-\d{8}$/, '');
  if (live.some((m) => m.id === preferred || base(m.id) === base(preferred))) return preferred;

  const tier = inferModelTier(preferred);
  const sameTier = live.filter((m) => (m.tier || inferModelTier(m.id)) === tier);
  const pool = sameTier.length ? sameTier : live;
  const want = inferModelMultiplier(preferred);
  return pool
    .map((m) => ({ id: m.id, d: Math.abs((m.credit_multiplier ?? inferModelMultiplier(m.id)) - want) }))
    .sort((a, b) => a.d - b.d)[0].id;                        // stable sort keeps newest-first on ties
}

// The cheap and mid-tier Claude models the downgrade, forced-cheap and retry paths use. These were
// claude-3-5-haiku-20241022 (retired 2026-02-19) and claude-3-5-sonnet-20241022 (retired 2025-10-28); the only thing
// keeping them alive was liveModelFor(), which does nothing until the first catalog refresh finishes after a boot and
// never does anything when the platform ANTHROPIC_API_KEY is unset. Overridable by env so the next retirement is a
// config change.
export const ANTHROPIC_CHEAP_MODEL = process.env.ANTHROPIC_CHEAP_MODEL || 'claude-haiku-4-5-20251001';
export const ANTHROPIC_MID_MODEL = process.env.ANTHROPIC_MID_MODEL || 'claude-sonnet-5-5';

// Default model per provider when user hasn't chosen
export const DEFAULT_MODEL_PER_PROVIDER = {
  openai: 'gpt-4o-mini',
  anthropic: ANTHROPIC_CHEAP_MODEL,
};

/** The default model for a provider, corrected against the live catalog. */
export function defaultModelFor(provider) {
  return liveModelFor(DEFAULT_MODEL_PER_PROVIDER[provider], provider);
}

/**
 * Claude 4.7 and later (Opus 4.7/4.8/5/5.5, Sonnet 5/5.5, Fable, Mythos) REJECT any non-default temperature, top_p or
 * top_k with HTTP 400 (confirmed by several independent integrations hitting it; Anthropic's guidance is to omit all
 * three). The chat path always sent temperature (default 0.7), so on every current flagship the request failed, was
 * mis-read as an invalid MODEL, retried on a retired fallback, and then silently moved to the other provider.
 * callAnthropic also retries once without sampling parameters if a 400 names them, for ids this pattern does not cover.
 */
export function anthropicRejectsSampling(model) {
  return /^claude-(opus-(4-([7-9]|\d{2}(?!\d))|[5-9])|sonnet-[5-9]|fable|mythos)/i.test(String(model || ''));
}

/**
 * Prompt tokens for BILLING from an Anthropic usage block. usage.input_tokens EXCLUDES cache reads and cache writes,
 * so charging on it alone billed only the uncached tail of every prompt-cached call (often a few dozen tokens out of
 * tens of thousands) - the heavy, repeated-context calls (SDR agent, Company Brain) were the ones under-billed.
 * Weighted by what Anthropic charges for each kind: a 5-minute cache write is 1.25x input and a read is 0.1x.
 */
export function weightedPromptTokens(usage) {
  const u = usage || {};
  return (u.input_tokens || 0)
    + Math.round((u.cache_creation_input_tokens || 0) * 1.25)
    + Math.round((u.cache_read_input_tokens || 0) * 0.1);
}

// 1 credit ≈ this many tokens of baseline gpt-4o-mini
/**
 * How many baseline (gpt-4o-mini-equivalent) tokens one AI credit buys.
 *
 * Raised 12 → 60 deliberately. At 12 the allowances were unusable in practice:
 * on the Anthropic default (then claude-3-5-haiku, multiplier 6; now claude-haiku-4-5, 8) a Starter customer's
 * 15,000 credits bought about TWO ads strategies or THREE blog posts a month, and
 * on claude-sonnet-4-5 a single strategy cost 25,000 credits — more than the whole
 * monthly allowance, so the feature could not be used at all.
 *
 * At 60 the same Starter plan gets ~12 strategies or ~18 blog posts on the
 * default model, and 3 strategies even on Sonnet. Gross margin on AI moves from
 * ~99.6% to ~98.2% (worst case: burning an entire Scale allowance costs about
 * R$ 15 of provider spend against R$ 785 of revenue), so the product becomes
 * usable at negligible cost.
 *
 * This changes only what a generation COSTS, never what a plan GRANTS — existing
 * balances are untouched and simply go five times further.
 */
const TOKENS_PER_CREDIT = 60;

/**
 * Family-based heuristics so NEW models released by Anthropic/OpenAI are
 * automatically priced and tiered without a code change (auto-update).
 * Exact entries in MODEL_COST_MULTIPLIER / MODEL_TIER always win; these
 * heuristics only fire for model ids we've never seen.
 */
export function inferModelMultiplier(model) {
  if (!model) return 1;
  const m = model.toLowerCase();
  if (MODEL_COST_MULTIPLIER[model] != null) return MODEL_COST_MULTIPLIER[model];
  // An id we have never seen: guess its family, deliberately on the HIGH side of what the family has cost, so an
  // unknown model is never billed far below its price.
  if (m.includes('fable') || m.includes('mythos')) return 78;
  if (m.includes('opus')) return 39;
  if (m.includes('sonnet')) return 23;
  if (m.includes('haiku')) return 8;
  // Reasoning families BEFORE the generic "mini"/"nano" tests: o3-mini and o4-mini contain "mini" and are not cheap
  // (o3-mini is ~7x the baseline); the old order billed them at 1x.
  if (m.startsWith('o1')) return 100;
  if (/^o[34]/.test(m)) return m.includes('mini') ? 7 : 13;
  if (m.startsWith('gpt-5')) return m.includes('nano') ? 0.6 : m.includes('mini') ? 3 : 14;
  if (m.startsWith('gpt-4.1')) return m.includes('nano') ? 0.7 : m.includes('mini') ? 3 : 13;
  if (m.includes('nano')) return 0.6;
  if (m.includes('mini')) return 1;
  if (m.startsWith('gpt-4')) return 17;
  if (m.startsWith('gpt-3')) return 1.7;
  return 17; // unknown -> assume mid-tier so we never undercharge badly
}

export function inferModelTier(model) {
  if (!model) return 'smart';
  if (MODEL_TIER[model]) return MODEL_TIER[model];
  const m = model.toLowerCase();
  // An id we have never seen keeps its FAMILY's tier. Deriving it from the price alone put an unknown Opus (priced 39)
  // one point under the "smartest" cutoff, so a retired Opus was replaced by a Sonnet and the plan gate treated a new
  // Opus as mid-tier.
  if (/fable|mythos|opus/.test(m)) return 'smartest';
  if (m.includes('sonnet')) return 'smarter';
  if (m.includes('haiku')) return 'smart';
  const mult = inferModelMultiplier(model);
  if (mult >= 39) return 'smartest';
  if (mult >= 10) return 'smarter';
  return 'smart';
}

/**
 * Compute credit cost for a completed AI call.
 *   total tokens × multiplier / TOKENS_PER_CREDIT
 * Always rounds UP so we never under-charge.
 */
export function computeCreditCost({ model, promptTokens = 0, completionTokens = 0 }) {
  const multiplier = inferModelMultiplier(model);
  const totalTokens = promptTokens + completionTokens;
  if (totalTokens === 0) return 1; // minimum 1 credit per call
  return Math.max(1, Math.ceil((totalTokens * multiplier) / TOKENS_PER_CREDIT));
}

/**
 * Check if a model is allowed for the given plan.
 */
export function isModelAllowedForPlan(model, planId) {
  const tier = inferModelTier(model);
  const allowedTiers = PLAN_MODEL_ACCESS[planId] || PLAN_MODEL_ACCESS.starter;
  return allowedTiers.includes(tier);
}

/**
 * Given user's requested model and plan, return the model that should actually
 * be used. Returns the requested model if allowed; otherwise downgrades to the
 * cheapest model the plan permits.
 */
export function resolveModelForPlan(requestedModel, planId, provider) {
  if (requestedModel && isModelAllowedForPlan(requestedModel, planId)) {
    // A saved preference can name a model that has since been retired.
    return liveModelFor(requestedModel);
  }
  // Downgrade: pick the cheapest allowed model for the given provider
  const allowedTiers = PLAN_MODEL_ACCESS[planId] || PLAN_MODEL_ACCESS.starter;
  if (provider === 'anthropic') {
    if (allowedTiers.includes('smartest')) return liveModelFor(ANTHROPIC_MID_MODEL, 'anthropic');
    if (allowedTiers.includes('smarter')) return liveModelFor(ANTHROPIC_MID_MODEL, 'anthropic');
    return liveModelFor(ANTHROPIC_CHEAP_MODEL, 'anthropic');
  }
  // OpenAI
  return liveModelFor('gpt-4o-mini', 'openai');
}

/**
 * For "heavy" actions (brand scans, full marketing plans) — force the cheapest
 * model regardless of user selection or plan tier. Saves ~20× per action.
 */
export function resolveActionModel(action, requestedModel, planId, provider) {
  if (action && FORCE_CHEAP_MODEL_ACTIONS.has(action)) {
    return provider === 'anthropic' ? liveModelFor(ANTHROPIC_CHEAP_MODEL, 'anthropic') : liveModelFor('gpt-4o-mini', 'openai');
  }
  // Latency-sensitive actions: route to the fast tier so interactive surfaces
  // (SDR replies, ad copy variants, help chat) respond in seconds.
  if (action && FAST_MODEL_ACTIONS.has(action)) {
    return provider === 'anthropic' ? liveModelFor(ANTHROPIC_CHEAP_MODEL, 'anthropic') : liveModelFor('gpt-4o-mini', 'openai');
  }
  return resolveModelForPlan(requestedModel, planId, provider);
}

/**
 * Check if the user has BYOK permission. Only owner + system_admin can use
 * their own API keys. Everyone else uses platform keys (Railway env vars).
 */
export function canUseBYOK(userRole) {
  return userRole === 'owner' || userRole === 'system_admin';
}
