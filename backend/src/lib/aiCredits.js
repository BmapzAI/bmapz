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
  // OpenAI
  'gpt-4o-mini': 1,            // baseline
  'gpt-4o': 17,                 // $5/M blended vs $0.30/M
  'gpt-4-turbo': 30,
  'gpt-3.5-turbo': 1.7,
  // Anthropic
  'claude-3-5-haiku-20241022': 6,
  'claude-haiku-3-5': 6,
  'claude-3-5-sonnet-20241022': 23,
  'claude-sonnet-3-5': 23,
  'claude-sonnet-4-5': 25,      // assume similar to Sonnet 3.5
  'claude-3-opus-20240229': 117,
  'claude-opus-4-5': 80,
};

// Human-friendly tier label for each model
export const MODEL_TIER = {
  'gpt-4o-mini': 'smart',
  'gpt-3.5-turbo': 'smart',
  'claude-3-5-haiku-20241022': 'smart',
  'claude-haiku-3-5': 'smart',

  'gpt-4o': 'smarter',
  'gpt-4-turbo': 'smarter',
  'claude-3-5-sonnet-20241022': 'smarter',
  'claude-sonnet-3-5': 'smarter',

  'claude-sonnet-4-5': 'smartest',
  'claude-3-opus-20240229': 'smartest',
  'claude-opus-4-5': 'smartest',
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

// Default model per provider when user hasn't chosen
export const DEFAULT_MODEL_PER_PROVIDER = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-haiku-20241022',
};

// 1 credit ≈ this many tokens of baseline gpt-4o-mini
/**
 * How many baseline (gpt-4o-mini-equivalent) tokens one AI credit buys.
 *
 * Raised 12 → 60 deliberately. At 12 the allowances were unusable in practice:
 * on the Anthropic default (claude-3-5-haiku, multiplier 6) a Starter customer's
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
  if (m.includes('opus')) return 90;
  if (m.includes('fable')) return 30;      // Claude Fable family
  if (m.includes('sonnet')) return 25;
  if (m.includes('haiku')) return 6;
  if (m.includes('nano')) return 0.5;
  if (m.includes('mini')) return 1;
  if (m.startsWith('o1') || m.startsWith('o3') || m.startsWith('o4')) return 40; // reasoning models
  if (m.startsWith('gpt-5')) return 20;
  if (m.startsWith('gpt-4.1')) return 12;
  if (m.startsWith('gpt-4')) return 17;
  if (m.startsWith('gpt-3')) return 1.7;
  return 17; // unknown → assume mid-tier so we never undercharge badly
}

export function inferModelTier(model) {
  if (!model) return 'smart';
  if (MODEL_TIER[model]) return MODEL_TIER[model];
  const mult = inferModelMultiplier(model);
  if (mult >= 40) return 'smartest';
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
    return requestedModel;
  }
  // Downgrade: pick the cheapest allowed model for the given provider
  const allowedTiers = PLAN_MODEL_ACCESS[planId] || PLAN_MODEL_ACCESS.starter;
  if (provider === 'anthropic') {
    if (allowedTiers.includes('smartest')) return 'claude-3-5-sonnet-20241022';
    if (allowedTiers.includes('smarter')) return 'claude-3-5-sonnet-20241022';
    return 'claude-3-5-haiku-20241022';
  }
  // OpenAI
  if (allowedTiers.includes('smartest') || allowedTiers.includes('smarter')) return 'gpt-4o-mini';
  return 'gpt-4o-mini';
}

/**
 * For "heavy" actions (brand scans, full marketing plans) — force the cheapest
 * model regardless of user selection or plan tier. Saves ~20× per action.
 */
export function resolveActionModel(action, requestedModel, planId, provider) {
  if (action && FORCE_CHEAP_MODEL_ACTIONS.has(action)) {
    return provider === 'anthropic' ? 'claude-3-5-haiku-20241022' : 'gpt-4o-mini';
  }
  // Latency-sensitive actions: route to the fast tier so interactive surfaces
  // (SDR replies, ad copy variants, help chat) respond in seconds.
  if (action && FAST_MODEL_ACTIONS.has(action)) {
    return provider === 'anthropic' ? 'claude-3-5-haiku-20241022' : 'gpt-4o-mini';
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
