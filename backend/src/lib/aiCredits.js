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
const TOKENS_PER_CREDIT = 12;

/**
 * Compute credit cost for a completed AI call.
 *   total tokens × multiplier / TOKENS_PER_CREDIT
 * Always rounds UP so we never under-charge.
 */
export function computeCreditCost({ model, promptTokens = 0, completionTokens = 0 }) {
  const multiplier = MODEL_COST_MULTIPLIER[model] || MODEL_COST_MULTIPLIER['gpt-4o-mini'];
  const totalTokens = promptTokens + completionTokens;
  if (totalTokens === 0) return 1; // minimum 1 credit per call
  return Math.max(1, Math.ceil((totalTokens * multiplier) / TOKENS_PER_CREDIT));
}

/**
 * Check if a model is allowed for the given plan.
 */
export function isModelAllowedForPlan(model, planId) {
  const tier = MODEL_TIER[model] || 'smart';
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
  return resolveModelForPlan(requestedModel, planId, provider);
}

/**
 * Check if the user has BYOK permission. Only owner + system_admin can use
 * their own API keys. Everyone else uses platform keys (Railway env vars).
 */
export function canUseBYOK(userRole) {
  return userRole === 'owner' || userRole === 'system_admin';
}
