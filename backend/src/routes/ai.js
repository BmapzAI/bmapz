import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import {
  computeCreditCost,
  resolveActionModel,
  canUseBYOK,
  DEFAULT_MODEL_PER_PROVIDER,
  MODEL_TIER,
} from '../lib/aiCredits.js';

const router = Router();

/**
 * Helper: get company AI settings (provider, model, keys) AND active plan.
 * Keys are stored in the api_keys JSONB column — must select that column.
 */
async function getCompanyAISettings(companyId) {
  const { data: company } = await supabaseAdmin
    .from('companies')
    .select('api_keys')
    .eq('id', companyId)
    .single();
  return company?.api_keys || {};
}

/**
 * Trial defaults — mirror PLANS.trial in frontend-src/lib/plans.js.
 */
const TRIAL_CREDITS = 8000;
const TRIAL_DAYS = 14;

/**
 * Get the active plan_id for a company. If no subscription exists, AUTO-CREATE
 * a 14-day trial with TRIAL_CREDITS so existing companies that predate the
 * credit system (or any new signup that missed the initial seeding) can use
 * AI immediately.
 */
async function getCompanyPlan(companyId) {
  if (!companyId) {
    console.warn('[ai/getCompanyPlan] called with no companyId');
    return { planId: 'trial', creditsTotal: 0, creditsUsed: 0, subscriptionId: null, status: 'inactive' };
  }

  let { data: sub, error: selectErr } = await supabaseAdmin
    .from('subscriptions')
    .select('id, plan_id, ai_credits_total, ai_credits_used, topup_credits_purchased, status, trial_ends_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (selectErr) console.error('[ai/getCompanyPlan] select error:', selectErr.message);

  // Case A: no subscription at all → create a fresh trial sub with credits
  if (!sub) {
    const trialEnds = new Date(Date.now() + TRIAL_DAYS * 86400_000).toISOString();
    const { data: newSub, error: createErr } = await supabaseAdmin
      .from('subscriptions')
      .insert({
        company_id: companyId,
        plan_id: 'trial',
        status: 'trialing',
        ai_credits_total: TRIAL_CREDITS,
        ai_credits_used: 0,
        topup_credits_purchased: 0,
        trial_ends_at: trialEnds,
      })
      .select()
      .single();
    if (createErr) {
      console.error('[ai/getCompanyPlan] auto-create trial sub failed:', createErr.message, createErr.code);
    } else {
      console.log(`[ai/getCompanyPlan] auto-created trial sub for company ${companyId} (+${TRIAL_CREDITS} credits)`);
      sub = newSub;
      await supabaseAdmin.from('credit_transactions').insert({
        company_id: companyId,
        subscription_id: newSub.id,
        type: 'monthly_grant',
        feature: 'trial_grant',
        credits_delta: TRIAL_CREDITS,
        credits_after: TRIAL_CREDITS,
        description: 'Auto-granted 14-day trial credits',
        metadata: { auto_seeded: true, reason: 'no_subscription' },
      });
    }
  }
  // Case B: sub EXISTS but with 0 credits total AND 0 used — e.g. an empty
  // placeholder row created somewhere without seeding credits. Top it up.
  else if ((sub.ai_credits_total || 0) === 0 && (sub.ai_credits_used || 0) === 0 && (sub.topup_credits_purchased || 0) === 0) {
    console.log(`[ai/getCompanyPlan] sub ${sub.id} has 0 credits — seeding ${TRIAL_CREDITS}`);
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('subscriptions')
      .update({ ai_credits_total: TRIAL_CREDITS, status: sub.status || 'trialing' })
      .eq('id', sub.id)
      .select()
      .single();
    if (updateErr) {
      console.error('[ai/getCompanyPlan] backfill credits failed:', updateErr.message);
    } else {
      sub = updated;
      await supabaseAdmin.from('credit_transactions').insert({
        company_id: companyId,
        subscription_id: sub.id,
        type: 'monthly_grant',
        feature: 'trial_grant',
        credits_delta: TRIAL_CREDITS,
        credits_after: TRIAL_CREDITS,
        description: 'Auto-granted trial credits (existing empty sub)',
        metadata: { auto_seeded: true, reason: 'empty_existing_sub' },
      });
    }
  }

  const result = {
    planId: sub?.plan_id || 'trial',
    creditsTotal: (sub?.ai_credits_total || 0) + (sub?.topup_credits_purchased || 0),
    creditsUsed: sub?.ai_credits_used || 0,
    subscriptionId: sub?.id || null,
    status: sub?.status || 'inactive',
  };
  console.log(`[ai/getCompanyPlan] company=${companyId} plan=${result.planId} total=${result.creditsTotal} used=${result.creditsUsed} remaining=${result.creditsTotal - result.creditsUsed}`);
  return result;
}

/**
 * Deduct credits from the active subscription and log the transaction.
 * Returns { remaining } or throws if insufficient credits.
 */
async function deductCredits({ companyId, userId, userEmail, credits, feature, model, tokens }) {
  const { data: sub } = await supabaseAdmin
    .from('subscriptions')
    .select('id, ai_credits_total, ai_credits_used, topup_credits_purchased')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sub) {
    const err = new Error('No active subscription found. Start your 14-day trial or pick a plan.');
    err.code = 'NO_SUBSCRIPTION';
    throw err;
  }

  const total = (sub.ai_credits_total || 0) + (sub.topup_credits_purchased || 0);
  const used = sub.ai_credits_used || 0;
  const remaining = total - used;
  if (remaining < credits) {
    const err = new Error(`Insufficient AI credits: ${remaining} remaining, ${credits} needed. Upgrade your plan or buy a credit pack.`);
    err.code = 'CREDITS_EXHAUSTED';
    err.publicMessage = err.message;
    throw err;
  }

  const newUsed = used + credits;
  await supabaseAdmin.from('subscriptions').update({ ai_credits_used: newUsed }).eq('id', sub.id);
  await supabaseAdmin.from('credit_transactions').insert({
    company_id: companyId,
    subscription_id: sub.id,
    type: 'usage',
    feature: feature || 'ai_chat',
    credits_delta: -credits,
    credits_after: total - newUsed,
    description: `${feature || 'ai_chat'} — ${model} (${tokens} tokens)`,
    metadata: {
      user_id: userId || null,
      user_email: userEmail || null,
      model,
      tokens,
      tier: MODEL_TIER[model] || 'smart',
    },
  });
  return { remaining: total - newUsed, charged: credits };
}

/**
 * Helper: normalize an API key — trim whitespace, strip stray quotes/newlines
 * that can happen if the user pastes a key with a trailing newline or wraps it.
 */
function cleanKey(rawKey) {
  if (!rawKey) return null;
  return String(rawKey)
    .trim()
    .replace(/^["']|["']$/g, '') // strip surrounding quotes
    .replace(/\s+/g, '');          // strip any internal whitespace (keys never contain spaces)
}

/**
 * Helper: get OpenAI client. If keyOverride passed, use it. Otherwise resolve
 * from company settings, falling back to platform env var.
 */
async function getOpenAIClient(companyId, keyOverride) {
  let apiKey = cleanKey(keyOverride);
  if (!apiKey) {
    const settings = await getCompanyAISettings(companyId);
    apiKey = cleanKey(settings.openai_api_key) || cleanKey(process.env.OPENAI_API_KEY);
  }
  if (!apiKey) {
    const err = new Error('OpenAI API key not configured. Add your key in Settings > API Keys.');
    err.code = 'MISSING_API_KEY';
    throw err;
  }
  const OpenAI = (await import('openai')).default;
  return new OpenAI({ apiKey });
}

/**
 * Helper: get Anthropic client with optional key override.
 */
async function getAnthropicClient(companyId, keyOverride) {
  let apiKey = cleanKey(keyOverride);
  if (!apiKey) {
    const settings = await getCompanyAISettings(companyId);
    apiKey = cleanKey(settings.anthropic_api_key) || cleanKey(process.env.ANTHROPIC_API_KEY);
  }
  if (!apiKey) {
    const err = new Error('Anthropic API key not configured. Add your key in Settings > API Keys.');
    err.code = 'MISSING_API_KEY';
    throw err;
  }
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  return new Anthropic({ apiKey });
}

// ─── Error categorization ────────────────────────────────────────────────────

function categorizeProviderError(err, providerLabel) {
  const status = err?.status || err?.statusCode || 0;
  const rawMsg = `${err?.message || ''} ${err?.error?.message || ''} ${JSON.stringify(err?.error || {})}`.toLowerCase();
  const errorType = err?.error?.type || err?.type || '';

  // 401 — invalid/expired API key
  if (status === 401 || rawMsg.includes('invalid api key') || rawMsg.includes('incorrect api key') || rawMsg.includes('authentication') || errorType === 'authentication_error') {
    return { kind: 'AUTH', msg: `${providerLabel} API key is invalid or expired. Update it in Settings > API Keys.` };
  }
  // 404 / invalid model
  if (status === 404 || rawMsg.includes('model_not_found') || rawMsg.includes('does not exist') || rawMsg.includes('invalid model') || (errorType === 'invalid_request_error' && rawMsg.includes('model'))) {
    return { kind: 'INVALID_MODEL', msg: `${providerLabel} model not available. Pick a different model in Settings > API Keys.` };
  }
  // 429 with insufficient_quota / billing / credit balance — true quota/billing issue
  if (rawMsg.includes('insufficient_quota') || rawMsg.includes('exceeded your current quota') || rawMsg.includes('credit balance') || rawMsg.includes('purchase credits') || rawMsg.includes('billing details') || errorType === 'insufficient_quota') {
    return { kind: 'QUOTA', msg: `${providerLabel} account has no available credits/quota. Check billing on the ${providerLabel} dashboard.` };
  }
  // 429 plain — temporary rate limit, retry possible
  if (status === 429 || rawMsg.includes('rate limit') || errorType === 'rate_limit_error') {
    return { kind: 'RATE_LIMIT', msg: `${providerLabel} is rate-limiting requests. Try again in a moment.` };
  }
  // 5xx — provider outage
  if (status >= 500) {
    return { kind: 'PROVIDER_DOWN', msg: `${providerLabel} is having issues right now (HTTP ${status}). Try again shortly.` };
  }
  return { kind: 'OTHER', msg: `${providerLabel} error: ${err?.message || 'unknown'}` };
}

// ─── Model normalization ─────────────────────────────────────────────────────

// Anthropic models change over time and use dated suffixes.
// Strategy: pass the user's requested model AS-IS to Anthropic. If they reject
// it as invalid (e.g. typo or deprecated), auto-retry with a known-good fallback
// that has been stable for a long time.
const ANTHROPIC_FALLBACK_MODEL = 'claude-3-5-sonnet-20241022';
function resolveAnthropicModel(requested) {
  if (!requested) return ANTHROPIC_FALLBACK_MODEL;
  return requested;
}

const OPENAI_FALLBACK_MODEL = 'gpt-4o-mini';

// ─── Provider calls ──────────────────────────────────────────────────────────

async function callOpenAI({ companyId, settings, messages, model, temperature, max_tokens, response_format, system, keyOverride }) {
  const client = await getOpenAIClient(companyId, keyOverride);
  const requestedModel = model && !model.startsWith('claude') ? model : null;
  const openaiModel = requestedModel || settings.openai_model || OPENAI_FALLBACK_MODEL;
  const msgs = [];
  if (system) msgs.push({ role: 'system', content: system });
  msgs.push(...(messages || []));

  const params = { model: openaiModel, messages: msgs, temperature };
  if (max_tokens) params.max_tokens = max_tokens;
  if (response_format) params.response_format = response_format;

  try {
    const completion = await client.chat.completions.create(params);
    return {
      content: completion.choices[0].message.content,
      usage: completion.usage,
      provider_used: 'openai',
      model_used: openaiModel,
      key_source: keyOverride ? 'override' : (settings.openai_api_key ? 'company' : 'platform'),
    };
  } catch (err) {
    // Retry once with safe fallback model if invalid model
    const cat = categorizeProviderError(err, 'OpenAI');
    if (cat.kind === 'INVALID_MODEL' && openaiModel !== OPENAI_FALLBACK_MODEL) {
      console.warn(`[ai] OpenAI model ${openaiModel} invalid; retrying with ${OPENAI_FALLBACK_MODEL}`);
      const retryParams = { ...params, model: OPENAI_FALLBACK_MODEL };
      const completion = await client.chat.completions.create(retryParams);
      return {
        content: completion.choices[0].message.content,
        usage: completion.usage,
        provider_used: 'openai',
        model_used: OPENAI_FALLBACK_MODEL,
        key_source: keyOverride ? 'override' : (settings.openai_api_key ? 'company' : 'platform'),
      };
    }
    err._category = cat;
    throw err;
  }
}

async function callAnthropic({ companyId, settings, messages, model, temperature, max_tokens, system, response_format, keyOverride }) {
  const client = await getAnthropicClient(companyId, keyOverride);
  const requested = model && model.startsWith('claude') ? model : (settings.anthropic_model || null);
  const anthropicModel = resolveAnthropicModel(requested);

  const anthropicMessages = (messages || []).filter(m => m.role !== 'system');
  let systemPrompt = system || (messages || []).find(m => m.role === 'system')?.content;

  // Anthropic doesn't have OpenAI-style response_format: json_object.
  // When JSON is requested, prepend a strict JSON-only instruction to the system prompt.
  const wantsJson = response_format && (response_format.type === 'json_object' || response_format === 'json');
  if (wantsJson) {
    const jsonInstr = 'You MUST respond with valid JSON only. No prose, no markdown fences, no explanation outside the JSON object. The response must be parseable by JSON.parse().';
    systemPrompt = systemPrompt ? `${systemPrompt}\n\n${jsonInstr}` : jsonInstr;
  }

  const params = {
    model: anthropicModel,
    messages: anthropicMessages,
    max_tokens: max_tokens || 4096,
    temperature,
  };
  // Prompt caching: if system prompt is substantial (>1KB), mark it as cacheable.
  // Anthropic charges 10% of normal input cost on cache hits — huge savings on
  // repeated calls with the same system prompt (e.g. AI Sales Agent context).
  if (systemPrompt) {
    if (systemPrompt.length >= 1024) {
      params.system = [
        { type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } },
      ];
    } else {
      params.system = systemPrompt;
    }
  }

  try {
    const response = await client.messages.create(params);
    return {
      content: response.content[0]?.text || '',
      usage: {
        prompt_tokens: response.usage?.input_tokens,
        completion_tokens: response.usage?.output_tokens,
        total_tokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
      },
      provider_used: 'anthropic',
      model_used: anthropicModel,
    };
  } catch (err) {
    const cat = categorizeProviderError(err, 'Anthropic');
    // Retry with known-good fallback model if invalid model
    if (cat.kind === 'INVALID_MODEL' && anthropicModel !== ANTHROPIC_FALLBACK_MODEL) {
      console.warn(`[ai] Anthropic model ${anthropicModel} invalid; retrying with ${ANTHROPIC_FALLBACK_MODEL}`);
      const response = await client.messages.create({ ...params, model: ANTHROPIC_FALLBACK_MODEL });
      return {
        content: response.content[0]?.text || '',
        usage: {
          prompt_tokens: response.usage?.input_tokens,
          completion_tokens: response.usage?.output_tokens,
          total_tokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
        },
        provider_used: 'anthropic',
        model_used: ANTHROPIC_FALLBACK_MODEL,
      };
    }
    err._category = cat;
    throw err;
  }
}

/**
 * Unified AI chat completion with full credit enforcement, plan-based model
 * gating, BYOK restriction, and bidirectional provider fallback.
 *
 * Flow:
 *   1. Look up the company's active plan (trial / starter / growth / scale / enterprise).
 *   2. Check user role — only owner/system_admin can use BYOK keys.
 *      All other users use ONLY platform keys (Railway env vars).
 *   3. Resolve the model based on plan tier and action type. Heavy actions
 *      (brand_scan, marketing_plan) are forced to the cheapest model.
 *   4. Pre-flight credit check — make sure the company has at least 1 credit
 *      before calling the provider (avoids billing for failed calls).
 *   5. Call providers in order, with fallback. Track tokens.
 *   6. On success: deduct credits based on model multiplier × tokens used.
 */
async function runAIChat({ companyId, userId, userRole, userEmail, messages, model, temperature = 0.7, max_tokens, response_format, system, action }) {
  const settings = await getCompanyAISettings(companyId);
  const { planId, creditsTotal, creditsUsed } = await getCompanyPlan(companyId);
  const remainingCredits = Math.max(0, creditsTotal - creditsUsed);

  // BYOK is only allowed for owner + system_admin. Everyone else uses platform keys.
  const allowBYOK = canUseBYOK(userRole);

  const provider = settings.ai_provider || 'openai';

  const companyOpenAI = allowBYOK ? cleanKey(settings.openai_api_key) : null;
  const platformOpenAI = cleanKey(process.env.OPENAI_API_KEY);
  const companyAnthropic = allowBYOK ? cleanKey(settings.anthropic_api_key) : null;
  const platformAnthropic = cleanKey(process.env.ANTHROPIC_API_KEY);

  if (!companyOpenAI && !platformOpenAI && !companyAnthropic && !platformAnthropic) {
    const err = new Error('No AI provider configured on the platform. Contact your administrator.');
    err.code = 'MISSING_API_KEY';
    err.publicMessage = err.message;
    throw err;
  }

  // Pre-flight credit check (only when using PLATFORM keys — BYOK doesn't deduct)
  const willUsePlatformKey = !companyOpenAI && !companyAnthropic;
  if (willUsePlatformKey && remainingCredits < 1) {
    const err = new Error(`Out of AI credits (${remainingCredits} remaining). Upgrade your plan or buy a credit pack.`);
    err.code = 'CREDITS_EXHAUSTED';
    err.publicMessage = err.message;
    throw err;
  }

  // Resolve which model to actually use given plan tier + action type
  const requestedModel = model
    || (provider === 'anthropic' ? settings.anthropic_model : settings.openai_model)
    || DEFAULT_MODEL_PER_PROVIDER[provider];
  const resolvedModel = resolveActionModel(action, requestedModel, planId, provider);

  // Build attempt list: each entry is { provider, key, source }
  const buildAttempts = (p) => {
    const list = [];
    if (p === 'openai') {
      if (companyOpenAI) list.push({ provider: 'openai', key: companyOpenAI, source: 'company' });
      if (platformOpenAI && platformOpenAI !== companyOpenAI) list.push({ provider: 'openai', key: platformOpenAI, source: 'platform' });
    } else {
      if (companyAnthropic) list.push({ provider: 'anthropic', key: companyAnthropic, source: 'company' });
      if (platformAnthropic && platformAnthropic !== companyAnthropic) list.push({ provider: 'anthropic', key: platformAnthropic, source: 'platform' });
    }
    return list;
  };

  const primaryAttempts = buildAttempts(provider);
  const secondaryAttempts = buildAttempts(provider === 'openai' ? 'anthropic' : 'openai');
  const attempts = [...primaryAttempts, ...secondaryAttempts];

  const errors = [];
  for (const attempt of attempts) {
    try {
      const fn = attempt.provider === 'openai' ? callOpenAI : callAnthropic;
      // For Anthropic, swap in resolvedModel if it's an OpenAI model (cross-provider fallback)
      const modelForAttempt = attempt.provider === 'anthropic'
        ? (resolvedModel.startsWith('claude') ? resolvedModel : DEFAULT_MODEL_PER_PROVIDER.anthropic)
        : (resolvedModel.startsWith('claude') ? DEFAULT_MODEL_PER_PROVIDER.openai : resolvedModel);

      const result = await fn({
        companyId, settings, messages,
        model: modelForAttempt,
        temperature, max_tokens, response_format, system,
        keyOverride: attempt.key,
      });
      if (errors.length > 0) console.log(`[ai] succeeded with ${attempt.provider}/${attempt.source} after ${errors.length} failure(s)`);

      // Deduct credits ONLY when using platform key (BYOK doesn't deduct — admin's cost).
      let creditsCharged = 0;
      let remainingAfter = remainingCredits;
      if (attempt.source === 'platform') {
        try {
          const tokens = (result.usage?.prompt_tokens || 0) + (result.usage?.completion_tokens || 0);
          creditsCharged = computeCreditCost({
            model: result.model_used,
            promptTokens: result.usage?.prompt_tokens || 0,
            completionTokens: result.usage?.completion_tokens || 0,
          });
          const deduction = await deductCredits({
            companyId, userId, userEmail,
            credits: creditsCharged,
            feature: action || 'ai_chat',
            model: result.model_used,
            tokens,
          });
          remainingAfter = deduction.remaining;
        } catch (deductErr) {
          // Log but don't fail the request — user already got the response
          console.error('[ai] credit deduction failed:', deductErr.message);
        }
      }

      return {
        ...result,
        key_source: attempt.source,
        credits_charged: creditsCharged,
        credits_remaining: remainingAfter,
        plan_id: planId,
        model_requested: requestedModel,
        model_resolved: resolvedModel,
      };
    } catch (err) {
      const cat = err._category || categorizeProviderError(err, attempt.provider === 'openai' ? 'OpenAI' : 'Anthropic');
      console.warn(`[ai] ${attempt.provider}/${attempt.source} failed: ${cat.kind} — ${cat.msg}`);
      errors.push({ provider: attempt.provider, source: attempt.source, ...cat, raw: err?.message });
      continue;
    }
  }

  // All attempts failed. Surface the most actionable error.
  // Prefer AUTH > QUOTA > INVALID_MODEL > RATE_LIMIT > PROVIDER_DOWN > OTHER
  const priority = { AUTH: 5, QUOTA: 4, INVALID_MODEL: 3, RATE_LIMIT: 2, PROVIDER_DOWN: 1, OTHER: 0 };
  const sortedErrors = [...errors].sort((a, b) => (priority[b.kind] || 0) - (priority[a.kind] || 0));
  const top = sortedErrors[0] || { kind: 'OTHER', msg: 'AI request failed', provider: 'unknown' };

  // Build an actionable message based on what failed
  const allQuota = errors.every(e => e.kind === 'QUOTA');
  const allAuth = errors.every(e => e.kind === 'AUTH');
  let publicMessage;
  if (allQuota) {
    publicMessage = 'Both AI providers have no available credits. Either add credits/billing to your OpenAI account (platform.openai.com/settings/organization/billing) OR to your Anthropic workspace (console.anthropic.com/settings/billing). New free-tier accounts often have no credits until billing is set up.';
  } else if (allAuth) {
    publicMessage = 'Both AI API keys were rejected as invalid. Re-paste fresh keys in Settings > API Keys — make sure there are no extra spaces or quotes.';
  } else {
    publicMessage = errors.length > 1
      ? `All AI attempts failed: ${errors.map(e => `${e.provider}(${e.source}) → ${e.kind}: ${e.msg}`).join(' | ')}`
      : top.msg;
  }

  const finalErr = new Error(top.msg);
  finalErr.code = top.kind;
  finalErr.publicMessage = publicMessage;
  finalErr._errors = errors;
  throw finalErr;
}

// GET /api/ai/diagnose — health check for AI providers (no PII returned)
router.get('/diagnose', requireAuth, async (req, res) => {
  const settings = await getCompanyAISettings(req.companyId);
  // Include plan + credits in diagnose so users can see exactly why AI is blocked
  const plan = await getCompanyPlan(req.companyId);
  const diag = {
    plan: {
      id: plan.planId,
      status: plan.status,
      credits_total: plan.creditsTotal,
      credits_used: plan.creditsUsed,
      credits_remaining: Math.max(0, plan.creditsTotal - plan.creditsUsed),
      subscription_id: plan.subscriptionId,
    },
    company_id: req.companyId,
    active_provider: settings.ai_provider || 'openai',
    openai: {
      has_key: !!(settings.openai_api_key || process.env.OPENAI_API_KEY),
      key_source: settings.openai_api_key ? 'company' : (process.env.OPENAI_API_KEY ? 'platform' : 'none'),
      key_prefix: settings.openai_api_key ? `${settings.openai_api_key.slice(0, 7)}...` : null,
      model: settings.openai_model || OPENAI_FALLBACK_MODEL,
      test_result: null,
    },
    anthropic: {
      has_key: !!(settings.anthropic_api_key || process.env.ANTHROPIC_API_KEY),
      key_source: settings.anthropic_api_key ? 'company' : (process.env.ANTHROPIC_API_KEY ? 'platform' : 'none'),
      key_prefix: settings.anthropic_api_key ? `${settings.anthropic_api_key.slice(0, 7)}...` : null,
      model_requested: settings.anthropic_model || null,
      model_resolved: resolveAnthropicModel(settings.anthropic_model),
      test_result: null,
    },
  };

  // Live test: send a minimal "ping" to each configured provider
  if (diag.openai.has_key) {
    try {
      const result = await callOpenAI({ companyId: req.companyId, settings, messages: [{ role: 'user', content: 'ping' }], model: null, temperature: 0, max_tokens: 5, system: null });
      diag.openai.test_result = { ok: true, model_used: result.model_used };
    } catch (err) {
      const cat = err._category || categorizeProviderError(err, 'OpenAI');
      diag.openai.test_result = { ok: false, kind: cat.kind, msg: cat.msg, raw_status: err?.status, raw_error: err?.message };
    }
  }
  if (diag.anthropic.has_key) {
    try {
      const result = await callAnthropic({ companyId: req.companyId, settings, messages: [{ role: 'user', content: 'ping' }], model: null, temperature: 0, max_tokens: 5, system: null });
      diag.anthropic.test_result = { ok: true, model_used: result.model_used };
    } catch (err) {
      const cat = err._category || categorizeProviderError(err, 'Anthropic');
      diag.anthropic.test_result = { ok: false, kind: cat.kind, msg: cat.msg, raw_status: err?.status, raw_error: err?.message };
    }
  }

  res.json(diag);
});

// POST /api/ai/chat
router.post('/chat', requireAuth, async (req, res) => {
  try {
    const { messages, model, temperature = 0.7, max_tokens, response_format, system, action } = req.body;
    const result = await runAIChat({
      companyId: req.companyId,
      userId: req.dbUser?.id,
      userRole: req.dbUser?.role,
      userEmail: req.dbUser?.email,
      messages, model, temperature, max_tokens, response_format, system, action,
    });
    res.json(result);
  } catch (err) {
    console.error('[ai/chat]', err.code || 'ERR', err.publicMessage || err.message, err._errors || '');
    const status =
      err.code === 'MISSING_API_KEY' || err.code === 'AUTH' ? 402 :
      err.code === 'QUOTA' ? 402 :
      err.code === 'CREDITS_EXHAUSTED' ? 402 :
      err.code === 'NO_SUBSCRIPTION' ? 402 :
      err.code === 'RATE_LIMIT' ? 429 :
      err.code === 'PROVIDER_DOWN' ? 503 :
      500;
    res.status(status).json({
      error: err.publicMessage || err.message,
      code: err.code,
      details: err._errors || undefined,
    });
  }
});

// GET /api/ai/usage — current user's company AI usage summary
router.get('/usage', requireAuth, async (req, res) => {
  try {
    const { planId, creditsTotal, creditsUsed } = await getCompanyPlan(req.companyId);
    const remaining = Math.max(0, creditsTotal - creditsUsed);
    const percentUsed = creditsTotal > 0 ? Math.round((creditsUsed / creditsTotal) * 100) : 0;

    // Recent usage transactions
    const { data: recent } = await supabaseAdmin
      .from('credit_transactions')
      .select('*')
      .eq('company_id', req.companyId)
      .eq('type', 'usage')
      .order('created_at', { ascending: false })
      .limit(50);

    // Aggregate by feature
    const byFeature = {};
    const byUser = {};
    const byModel = {};
    for (const tx of recent || []) {
      const f = tx.feature || 'unknown';
      const credits = Math.abs(tx.credits_delta);
      byFeature[f] = (byFeature[f] || 0) + credits;
      const ue = tx.metadata?.user_email || 'unknown';
      byUser[ue] = (byUser[ue] || 0) + credits;
      const m = tx.metadata?.model || 'unknown';
      byModel[m] = (byModel[m] || 0) + credits;
    }

    res.json({
      plan_id: planId,
      credits_total: creditsTotal,
      credits_used: creditsUsed,
      credits_remaining: remaining,
      percent_used: percentUsed,
      recent_transactions: recent || [],
      by_feature: byFeature,
      by_user: byUser,
      by_model: byModel,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/transcribe — Whisper STT via OpenAI
// Uses OpenAI SDK's toFile() helper which handles Node.js Buffer → multipart
// upload correctly across Node 18/20/22. The previous direct `new File()`
// approach failed in some Node runtimes with "File is not defined".
router.post('/transcribe', requireAuth, async (req, res) => {
  try {
    const { audio_base64, filename = 'audio.webm', language } = req.body;
    if (!audio_base64) return res.status(400).json({ error: 'audio_base64 is required' });

    const client = await getOpenAIClient(req.companyId);
    const { toFile } = await import('openai');
    const buffer = Buffer.from(audio_base64, 'base64');
    const file = await toFile(buffer, filename, { type: 'audio/webm' });

    const params = { file, model: 'whisper-1' };
    if (language) params.language = language;

    const transcription = await client.audio.transcriptions.create(params);
    res.json({ text: transcription.text });
  } catch (err) {
    console.error('[ai/transcribe]', err.message);
    if (err.code === 'MISSING_API_KEY') {
      return res.status(402).json({ error: err.message, code: 'MISSING_API_KEY' });
    }
    const cat = categorizeProviderError(err, 'OpenAI');
    const status = cat.kind === 'AUTH' || cat.kind === 'QUOTA' ? 402 : cat.kind === 'RATE_LIMIT' ? 429 : 500;
    res.status(status).json({ error: cat.msg, code: cat.kind });
  }
});

// POST /api/ai/generate-image
router.post('/generate-image', requireAuth, async (req, res) => {
  try {
    const { prompt, size = '1024x1024', quality = 'standard', n = 1 } = req.body;
    const settings = await getCompanyAISettings(req.companyId);

    const provider = settings.ai_image_provider || 'openai';
    const model = settings.ai_image_model || 'dall-e-3';

    if (provider === 'stability' || provider === 'stable_diffusion') {
      const apiKey = settings.stability_api_key || process.env.STABILITY_API_KEY;
      if (!apiKey) return res.status(402).json({ error: 'Stability AI API key not configured', code: 'MISSING_API_KEY' });
      const response = await fetch('https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ text_prompts: [{ text: prompt, weight: 1 }], cfg_scale: 7, height: 1024, width: 1024, steps: 30, samples: n }),
      });
      const result = await response.json();
      const urls = result.artifacts?.map(a => `data:image/png;base64,${a.base64}`) || [];
      return res.json({ urls });
    }

    // Default: OpenAI DALL-E
    const client = await getOpenAIClient(req.companyId);
    const result = await client.images.generate({ model: model || 'dall-e-3', prompt, size, quality, n });
    res.json({ urls: result.data.map(img => img.url) });
  } catch (err) {
    console.error('[ai/generate-image]', err.message);
    if (err.code === 'MISSING_API_KEY') {
      return res.status(402).json({ error: err.message, code: 'MISSING_API_KEY' });
    }
    const cat = categorizeProviderError(err, 'OpenAI');
    const status = cat.kind === 'AUTH' || cat.kind === 'QUOTA' ? 402 : cat.kind === 'RATE_LIMIT' ? 429 : 500;
    res.status(status).json({ error: cat.msg, code: cat.kind });
  }
});

// POST /api/ai/tts
router.post('/tts', requireAuth, async (req, res) => {
  try {
    const { text, voice = 'alloy', model = 'tts-1' } = req.body;
    const client = await getOpenAIClient(req.companyId);
    const mp3 = await client.audio.speech.create({ model, voice, input: text });
    const buffer = Buffer.from(await mp3.arrayBuffer());
    res.set('Content-Type', 'audio/mpeg');
    res.send(buffer);
  } catch (err) {
    const status = err.code === 'MISSING_API_KEY' ? 402 : 500;
    res.status(status).json({ error: err.message, code: err.code });
  }
});

/**
 * Flatten an ai_outputs row: merge metadata JSONB into top-level keys
 * so the frontend can access title, content, status, etc. transparently.
 * Also expose created_date alias for created_at.
 */
function flattenAIOutput(row) {
  if (!row) return null;
  const { metadata, ...rest } = row;
  return {
    ...rest,
    ...(metadata || {}),
    // Map schema columns to frontend-expected aliases
    status: (metadata || {}).status || (row.approved ? 'approved' : row.applied ? 'applied' : 'pending'),
    created_date: row.created_at,
  };
}

// POST /api/ai/outputs
router.post('/outputs', requireAuth, async (req, res) => {
  try {
    // Store all non-schema fields (title, content, status, channel, etc.) in metadata
    const { type, prompt, output: outputText, model, tokens_used, ...extra } = req.body;
    const mergedMetadata = { ...((req.body.metadata) || {}), ...extra };
    delete mergedMetadata.metadata; // avoid double-nesting

    const { data, error } = await supabaseAdmin
      .from('ai_outputs')
      .insert({
        company_id: req.companyId,
        type: type || 'general',
        prompt: prompt || null,
        output: outputText || null,
        model: model || null,
        tokens_used: tokens_used || null,
        metadata: mergedMetadata,
      })
      .select()
      .single();
    if (error) throw error;
    res.json(flattenAIOutput(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ai/outputs
router.get('/outputs', requireAuth, async (req, res) => {
  try {
    const { type, limit = 50, offset = 0 } = req.query;
    let query = supabaseAdmin
      .from('ai_outputs')
      .select('*', { count: 'exact' })
      .eq('company_id', req.companyId)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);
    if (type) query = query.eq('type', type);
    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ data: (data || []).map(flattenAIOutput), total: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/ai/outputs/:id
router.patch('/outputs/:id', requireAuth, async (req, res) => {
  try {
    // Fetch existing to merge metadata
    const { data: existing } = await supabaseAdmin
      .from('ai_outputs')
      .select('metadata')
      .eq('id', req.params.id)
      .eq('company_id', req.companyId)
      .single();

    const { type, prompt, output: outputText, model, ...extra } = req.body;
    const mergedMetadata = { ...(existing?.metadata || {}), ...extra };
    delete mergedMetadata.metadata;

    const updates = { metadata: mergedMetadata };
    if (type !== undefined) updates.type = type;
    if (prompt !== undefined) updates.prompt = prompt;
    if (outputText !== undefined) updates.output = outputText;
    if (model !== undefined) updates.model = model;

    const { data, error } = await supabaseAdmin
      .from('ai_outputs')
      .update(updates)
      .eq('id', req.params.id)
      .eq('company_id', req.companyId)
      .select()
      .single();
    if (error) throw error;
    res.json(flattenAIOutput(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/ai/outputs/:id
router.delete('/outputs/:id', requireAuth, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('ai_outputs')
      .delete()
      .eq('id', req.params.id)
      .eq('company_id', req.companyId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export runAIChat so other routes (leads scoring, workflows, etc.) can use the
// unified bidirectional-fallback AI helper instead of calling OpenAI directly.
export { runAIChat };
export default router;
