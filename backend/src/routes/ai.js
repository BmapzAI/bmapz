import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth, requireCompanyAdmin } from '../middleware/auth.js';
import {
  extractActions, applyActions, describeActions, isKnownOp,
  proposeActions, looksActionable, buildSectionAction, ACTION_PROTOCOL, friendlyError,
} from '../lib/aiActions.js';
import { validatedFetchUrl } from '../lib/companyView.js';
import { webSearch, formatForPrompt } from '../lib/webSearch.js';
import {
  computeCreditCost,
  resolveActionModel,
  canUseBYOK,
  canRunScanAction,
  SCAN_ACTIONS,
  PLAN_SCAN_TOKENS,
  PLAN_MONTHLY_CREDITS,
  DEFAULT_MODEL_PER_PROVIDER,
  MODEL_TIER,
  PLAN_MODEL_ACCESS,
} from '../lib/aiCredits.js';
import { getCompanyBrain, recordOutcomeLearning } from '../lib/companyBrain.js';
import { getLiveModels } from '../lib/modelRegistry.js';

const router = Router();

/**
 * Helper: get company AI settings (provider, model, keys) AND active plan.
 * Keys are stored in the api_keys JSONB column — must select that column.
 *
 * Cached 60s per company (in-process): settings change rarely but are read on
 * EVERY generation, and each read was a full DB round-trip before the model
 * call could even start. Invalidated on settings writes via
 * invalidateAISettingsCache().
 */
const SETTINGS_CACHE_TTL_MS = 60_000;
const settingsCache = new Map(); // companyId -> { at, settings }

async function getCompanyAISettings(companyId) {
  const hit = settingsCache.get(companyId);
  if (hit && Date.now() - hit.at < SETTINGS_CACHE_TTL_MS) return hit.settings;
  const { data: company } = await supabaseAdmin
    .from('companies')
    .select('api_keys')
    .eq('id', companyId)
    .single();
  const settings = company?.api_keys || {};
  settingsCache.set(companyId, { at: Date.now(), settings });
  return settings;
}

export function invalidateAISettingsCache(companyId) {
  settingsCache.delete(companyId);
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
/** Read the plan name whichever column the live table uses (see note below). */
const planOf = (sub) => sub?.plan_id || sub?.plan || 'trial';

async function getCompanyPlan(companyId) {
  if (!companyId) {
    console.warn('[ai/getCompanyPlan] called with no companyId');
    return { planId: 'trial', creditsTotal: 0, creditsUsed: 0, subscriptionId: null, status: 'inactive', scanTokensRemaining: 0 };
  }

  // NOTE: select('*') rather than an explicit column list on purpose.
  // This used to request `plan_id`, which does NOT exist in any migration — the
  // column is `plan`. PostgREST fails the whole SELECT on an unknown column, so
  // the query errored, `sub` came back null, and every company was treated as
  // (and re-created as) a TRIAL — including customers who had paid, because the
  // Stripe webhook writes `plan`. Reading both names keeps this working whichever
  // the live database actually has.
  let { data: sub, error: selectErr } = await supabaseAdmin
    .from('subscriptions')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Refuse to provision on a FAILED read. This runs on every AI call in the
  // product (chat, SDR replies, the 60s automation and workflow ticks), and the
  // branch below inserts a subscription when `sub` is null — so a transient
  // SELECT failure used to mint a duplicate subscription per call. Same shape as
  // the incident that turned 3 companies into 16; here the blast radius is
  // larger because the caller frequency is far higher.
  if (selectErr) {
    const err = new Error('Could not read your subscription. Please try again in a moment.');
    err.code = 'PLAN_LOOKUP_FAILED';
    err.publicMessage = err.message;
    throw err;
  }

  // Case A: no subscription at all → create a fresh trial sub with credits
  if (!sub) {
    const trialEnds = new Date(Date.now() + TRIAL_DAYS * 86400_000).toISOString();
    const { data: newSub, error: createErr } = await supabaseAdmin
      .from('subscriptions')
      .insert({
        company_id: companyId,
        // `plan` is the column the schema actually defines (001); `plan_id` was
        // never created. planOf() reads either on the way back out.
        plan: 'trial',
        status: 'trialing',
        ai_credits_total: TRIAL_CREDITS,
        ai_credits_used: 0,
        topup_credits_purchased: 0,
        trial_ends_at: trialEnds,
        // Stamped at creation so the cycle machinery has a starting point. A
        // subscription with no cycle dates can never renew — that, plus the
        // columns being absent entirely, is why the monthly reset had never run.
        cycle_started_at: new Date().toISOString(),
        cycle_ends_at: new Date(Date.now() + 30 * 86400_000).toISOString(),
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

  // ─── Auto-reset on monthly cycle rollover ─────────────────────────────────
  // If the subscription's cycle has ended, reset AI credits + scan tokens to
  // their per-plan defaults. Idempotent: only fires once per cycle.
  // A trial is time-boxed by trial_ends_at, not a recurring cycle. Rolling it into
  // a new cycle would hand out a fresh grant every 30 days forever — the product
  // free, indefinitely, to anyone who never upgrades. Only paying subscriptions
  // renew.
  const isRenewablePlan = sub
    && !['trial', 'free'].includes(planOf(sub))
    && ['active', 'past_due'].includes(sub.status);

  if (isRenewablePlan && sub.cycle_ends_at && new Date(sub.cycle_ends_at) <= new Date()) {
    const planId = planOf(sub);
    const monthlyCredits = PLAN_MONTHLY_CREDITS[planId] || 0;
    const monthlyScanTokens = PLAN_SCAN_TOKENS[planId] || 0;
    const nextCycleStart = new Date();
    const nextCycleEnd = new Date(nextCycleStart.getTime() + 30 * 86400_000);

    const { data: resetSub, error: resetErr } = await supabaseAdmin
      .from('subscriptions')
      .update({
        ai_credits_total: monthlyCredits,
        ai_credits_used: 0,
        scan_tokens_total: monthlyScanTokens,
        scan_tokens_used: 0,
        scan_tokens_addon: 0,           // add-ons don't roll over — use it or lose it
        cycle_started_at: nextCycleStart.toISOString(),
        cycle_ends_at: nextCycleEnd.toISOString(),
        last_reset_at: nextCycleStart.toISOString(),
      })
      .eq('id', sub.id)
      .select()
      .single();
    if (!resetErr && resetSub) {
      sub = resetSub;
      console.log(`[ai/getCompanyPlan] monthly cycle reset for company ${companyId}: +${monthlyCredits} credits, +${monthlyScanTokens} scan tokens`);
      await supabaseAdmin.from('credit_transactions').insert([
        {
          company_id: companyId,
          subscription_id: sub.id,
          type: 'cycle_reset',
          feature: 'monthly_grant',
          credits_delta: monthlyCredits,
          credits_after: monthlyCredits,
          description: `Monthly cycle reset — +${monthlyCredits} AI credits, +${monthlyScanTokens} scan tokens`,
          metadata: { plan_id: planId, credits: monthlyCredits, scan_tokens: monthlyScanTokens },
        },
      ]);
    }
  }

  const scanTokensTotal = (sub?.scan_tokens_total || 0) + (sub?.scan_tokens_addon || 0);
  const scanTokensRemaining = Math.max(0, scanTokensTotal - (sub?.scan_tokens_used || 0));

  const result = {
    planId: planOf(sub),
    creditsTotal: (sub?.ai_credits_total || 0) + (sub?.topup_credits_purchased || 0),
    creditsUsed: sub?.ai_credits_used || 0,
    subscriptionId: sub?.id || null,
    status: sub?.status || 'inactive',
    scanTokensTotal,
    scanTokensUsed: sub?.scan_tokens_used || 0,
    scanTokensRemaining,
    cycleStartedAt: sub?.cycle_started_at || null,
    cycleEndsAt: sub?.cycle_ends_at || null,
    // Written at signup but never read anywhere, which is why the "14-day trial"
    // was unlimited and permanent. Surfaced so the credit gate can honour it.
    trialEndsAt: sub?.trial_ends_at || null,
    billingCycle: sub?.billing_cycle || 'monthly',
    annualStartAt: sub?.annual_start_at || null,
  };
  console.log(`[ai/getCompanyPlan] company=${companyId} plan=${result.planId} credits=${result.creditsTotal - result.creditsUsed}/${result.creditsTotal} scans=${result.scanTokensRemaining}/${result.scanTokensTotal}`);
  return result;
}

/**
 * Which actions produce user-facing CONTENT that belongs in the AI Outputs
 * archive, and under which category the archive should file it.
 *
 * runAIChat is the single choke point every AI generation flows through, so
 * archiving here means a new generator is archived the moment it passes an
 * action — no more per-caller wiring to forget. Before this, only ads and
 * automations archived anything, so Social, Blog, workflow and message
 * generations never appeared in AI Outputs at all.
 *
 * DELIBERATELY NOT ARCHIVED:
 *  - design_* — Design Studio is confidential (App Owner only). Writing its
 *    output to the company-level archive would reveal the section exists.
 *  - sdr_chat / whatsapp_chat / help_assistant — conversation turns, not
 *    reviewable content; they'd bury the archive in chat noise.
 *  - lead_scoring / *_scan / brand_scan — stored in their own tables with
 *    purpose-built UIs.
 */
const ARCHIVE_CATEGORY_BY_ACTION = {
  social_post: 'social_media',
  social_caption: 'social_media',
  social_performance: 'social_media',
  blog_post: 'blogposts',
  blog_outline: 'blogposts',
  message_template: 'message_templates',
  email_template: 'email_templates',
  inbox_reply: 'message_templates',
  workflow_build: 'workflows',
  workflow_optimize: 'workflows',
  workflow_node: 'workflows',
  seo_plan: 'strategies',
  marketing_plan: 'strategies',
  // A brand scan is a strategy document. It was absent here, so scans were never
  // archived and so never reached the Review tab's approve / edit / reject flow —
  // the report existed only on its own screen.
  brand_scan: 'strategies',
  // Work the agent completed from the task board. Archived like any other
  // generation so a task result is reviewable where every other output lives —
  // section-specific tasks map to their own category above, and anything general
  // lands here rather than disappearing once the task card is closed.
  task_execution: 'strategies',
  sales_marketing_plan: 'strategies',
  campaign_plan: 'strategies',
  prospect_list: 'prospect_list',
};

/**
 * File a finished generation in the AI Outputs archive. Fire-and-forget: the
 * user already has their content, so a failed archive write must never surface
 * as a failed generation.
 */
function archiveGeneration({ companyId, userId, userEmail, action, title, content, model, tokens }) {
  const category = ARCHIVE_CATEGORY_BY_ACTION[action];
  if (!category || !companyId || !content) return;
  const body = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
  // title/content/category/status live in metadata — ai_outputs has no such
  // columns, and inserting them top-level makes PostgREST reject the row.
  supabaseAdmin.from('ai_outputs').insert({
    company_id: companyId,
    type: action,
    output: body,
    model: model || null,
    tokens_used: tokens || null,
    metadata: {
      title: title || `${action.replace(/_/g, ' ')} — ${new Date().toLocaleDateString()}`,
      content: body,
      category,
      status: 'pending',
      created_by: userId || null,
      created_by_email: userEmail || null,
      action,
    },
  }).then(({ error }) => {
    if (error) console.error('[ai/archive] could not archive generation:', error.message);
  });
}

/**
 * Flat credit prices for the endpoints that do not report token usage.
 *
 * Images and audio call the provider directly, so there is no prompt/completion
 * count to price from — a fixed charge is the honest approximation. Roughly
 * anchored to provider list prices at ~1 credit per US$0.001.
 */
const FLAT_CREDIT_COST = {
  generate_image: 40,   // gpt-image-1 / dall-e-3 standard ≈ $0.04
  edit_image: 40,
  transcribe: 6,        // whisper ≈ $0.006/min
  tts: 15,
  diagnose: 2,
};

/**
 * Charge for a non-token endpoint, and refuse when the company cannot pay.
 *
 * /generate-image, /edit-image, /transcribe, /tts and /diagnose called the provider
 * with NO plan check, NO credit deduction and NO scan token — a request for
 * `quality:"hd", n:4` was roughly US$0.75 of provider spend, available to any free
 * self-serve account, repeatedly. This is the gate they never had.
 *
 * Returns null when allowed; an {status, body} to send when refused.
 */
async function chargeFlat({ companyId, userId, userEmail, action, quantity = 1 }) {
  const credits = (FLAT_CREDIT_COST[action] || 1) * Math.max(1, Number(quantity) || 1);
  const plan = await getCompanyPlan(companyId);

  // Trials still generate freely, but only while the trial is actually live —
  // the same expiry the chat path now honours.
  const trialLive = plan.trialEndsAt ? new Date(plan.trialEndsAt) > new Date() : true;
  const onTrial = trialLive && (plan.planId === 'trial' || plan.status === 'trialing' || plan.status === 'inactive');

  const remaining = Math.max(0, plan.creditsTotal - plan.creditsUsed);
  if (!onTrial && remaining < credits) {
    return {
      status: 402,
      body: {
        error: `Not enough AI credits: ${remaining} left, ${credits} needed.`,
        code: 'CREDITS_EXHAUSTED',
      },
    };
  }

  try {
    await deductCredits({ companyId, userId, userEmail, credits, feature: action, model: action, tokens: 0 });
  } catch (err) {
    // On trial the deduction is bookkeeping only, so a failure must not block.
    if (!onTrial) return { status: 402, body: { error: err.message, code: err.code || 'CREDITS_EXHAUSTED' } };
    console.error(`[ai] trial usage log failed for ${action}:`, err.message);
  }
  return null;
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

  // Atomic increment via RPC (migration 019). The old read-modify-write raced:
  // two concurrent generations both read used=X and both wrote X+cost, losing
  // one deduction. Falls back to the non-atomic path until the migration runs.
  let newUsed = used + credits;
  const { data: rpcUsed, error: rpcErr } = await supabaseAdmin
    .rpc('consume_ai_credits', { p_subscription_id: sub.id, p_credits: credits });
  if (rpcErr) {
    if (!/function|schema cache/i.test(rpcErr.message || '')) console.error('[ai] consume_ai_credits rpc failed:', rpcErr.message);
    await supabaseAdmin.from('subscriptions').update({ ai_credits_used: newUsed }).eq('id', sub.id);
  } else if (typeof rpcUsed === 'number') {
    newUsed = rpcUsed;
  }
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
/**
 * @param {string} companyId
 * @param {string} [keyOverride]  a key already resolved by a BYOK-aware caller
 * @param {string} [userRole]     REQUIRED to reach the company's own key
 *
 * The BYOK role gate lived only inside runAIChat, so every direct caller here
 * (/generate-image, /edit-image, /transcribe, /tts, /diagnose) spent the COMPANY's
 * key for any authenticated user — including a guest from another tenant. BYOK is
 * owner/system_admin only; anyone else falls through to the platform key.
 *
 * The role must be passed explicitly. Omitting it means "not eligible", so a new
 * caller that forgets defaults to the safe path instead of silently spending the
 * customer's credentials.
 */
async function getOpenAIClient(companyId, keyOverride, userRole) {
  let apiKey = cleanKey(keyOverride);
  if (!apiKey) {
    const settings = canUseBYOK(userRole) ? await getCompanyAISettings(companyId) : {};
    apiKey = cleanKey(settings.openai_api_key) || cleanKey(process.env.OPENAI_API_KEY);
  }
  if (!apiKey) {
    const err = new Error('OpenAI API key not configured. Add your key in Settings > API Keys.');
    err.code = 'MISSING_API_KEY';
    throw err;
  }
  const OpenAI = (await import('openai')).default;
  // timeout: a hung provider must not hold the HTTP connection for the SDK's
  // ~10-min default. maxRetries: SDK-level backoff absorbs transient 429/5xx
  // before we burn a whole provider-fallback attempt.
  return new OpenAI({ apiKey, timeout: 180_000, maxRetries: 2 });
}

/**
 * Helper: get Anthropic client with optional key override.
 */
// Same BYOK rule as getOpenAIClient: the company key is only reachable with an
// explicitly passed owner/system_admin role.
async function getAnthropicClient(companyId, keyOverride, userRole) {
  let apiKey = cleanKey(keyOverride);
  if (!apiKey) {
    const settings = canUseBYOK(userRole) ? await getCompanyAISettings(companyId) : {};
    apiKey = cleanKey(settings.anthropic_api_key) || cleanKey(process.env.ANTHROPIC_API_KEY);
  }
  if (!apiKey) {
    const err = new Error('Anthropic API key not configured. Add your key in Settings > API Keys.');
    err.code = 'MISSING_API_KEY';
    throw err;
  }
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  // Same rationale as the OpenAI client: bounded timeout + SDK retry/backoff.
  // 180s covers the heaviest single completions (brand scans chunk their work).
  return new Anthropic({ apiKey, timeout: 180_000, maxRetries: 2 });
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

  const anthropicMessages = (messages || [])
    .filter(m => m.role !== 'system')
    .map(m => {
      if (!Array.isArray(m.content)) return m;
      return {
        ...m,
        content: m.content.map(part => {
          if (part?.type === 'image_url' && part.image_url?.url) {
            return { type: 'image', source: { type: 'url', url: part.image_url.url } };
          }
          return part;
        }),
      };
    });
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
/**
 * EXECUTION-FIRST. Prepended to every generation that goes through this choke
 * point, so chat, tasks, automations and every generator behave the same way.
 *
 * WHY: the agent's default failure was answering "Find 10 qualified leads" with
 * an explanation of HOW to find leads, and "fill in the company settings from
 * that task" with a description of what could be filled in. Users asked for work
 * and got a lecture. The rule is simple: if the request can be carried out,
 * carry it out and return the finished artifact.
 *
 * The second half matters just as much. Pushed to execute, a model will happily
 * invent "Marketing Manager at Software Company A — [LinkedIn Profile]" and call
 * it a lead list. Fabricated contacts are WORSE than a refusal: they look like
 * work, they get imported into a CRM, and someone tries to email them. So the
 * directive pairs "do the work" with "never invent facts you were not given" —
 * when real-world data is genuinely required and unavailable, say precisely what
 * is missing and what to connect.
 */
const EXECUTION_DIRECTIVE = [
  'HOW YOU WORK:',
  '1. EXECUTE, do not explain. If the request is something you can produce, produce the finished,',
  'ready-to-use deliverable — the actual copy, plan, list, reply, structure or content. Never answer a',
  'request for work with a method, a checklist of steps the user should take, or an offer to help.',
  '"Here is how you could…" is a failure unless the user explicitly asked how, why, or for an explanation.',
  '2. Use what you were given. The company context above is real data — use it instead of placeholders.',
  '3. NEVER FABRICATE REAL-WORLD FACTS. Do not invent people, companies, contact details, email',
  'addresses, phone numbers, URLs, links, prices, statistics or citations. Do not emit placeholders like',
  '"Company A", "[LinkedIn Profile]", "[Link]" or "example@company.com" and present them as findings.',
  'If a request needs real external data you do not have (for example finding NEW prospects outside the',
  "CRM), do the part you genuinely can, then state in one short line exactly what is missing and which",
  'integration or input would supply it. A short honest answer beats an invented one.',
  '4. Be concise. No preamble, no restating the request, no closing offer of further help.',
].join(' ');

/**
 * Actions where explaining IS the job, so the directive above would be wrong.
 * The support assistant answers questions about the product; the SDR and
 * WhatsApp agents hold conversations with a human on the other end.
 */
const CONVERSATIONAL_ACTIONS = new Set(['help_assistant', 'sdr_chat', 'whatsapp_chat']);

/**
 * Should this message trigger a live web lookup?
 *
 * Gated rather than always-on: a search costs money and latency, and most chat
 * turns are about the company's own data, which the brain already supplies. Fires
 * on explicit research verbs, on competitor/market questions, and on anything
 * time-sensitive — in both languages, since the product is bilingual.
 *
 * A false positive costs one lookup; a false negative just means the agent answers
 * from what it already knows, which is the pre-existing behaviour.
 */
const WEB_SEARCH_RE = new RegExp([
  // explicit
  'search', 'google', 'look up', 'lookup', 'research', 'find out', 'browse', 'online',
  'pesquis', 'busca', 'procur', 'na internet',
  // external subjects
  'competitor', 'competitors', 'concorrent', 'market share', 'mercado',
  'industry trend', 'tend[êe]ncia', 'benchmark', 'best practice',
  'news', 'not[íi]cia', 'pricing of', 'their website', 'site deles',
  // time-sensitive
  'latest', 'current', 'recent', 'today', 'this year', '20\\d\\d',
  '[úu]ltim', 'atual', 'recente', 'hoje', 'este ano',
].join('|'), 'i');

export const needsWebSearch = (text) => WEB_SEARCH_RE.test(String(text || ''));

async function runAIChat({ companyId, userId, userRole, userEmail, messages, model, temperature = 0.7, max_tokens, response_format, system, action, skipBrain = false, archiveTitle, skipArchive = false, skipExecutionDirective = false }) {
  // ── Pre-flight: settings + brain + plan are independent reads — fetch them
  // in PARALLEL. They used to run sequentially, costing 3 back-to-back DB
  // round-trips before the model call could start.
  //
  // Company Brain: omniscient company context on EVERY AI call. Prepended to
  // the system prompt so all generations (chat, ads, social, blog, workflows,
  // automations…) are grounded in the company's briefing, ICP, live funnel
  // numbers and past approved/rejected outputs. Compact (≤ ~1.5k tokens) and
  // cached 5 min per company; Anthropic prompt caching makes repeats ~90%
  // cheaper. Pass skipBrain: true for context-free calls.
  const [settings, brain, planInfo] = await Promise.all([
    getCompanyAISettings(companyId),
    skipBrain ? Promise.resolve('') : getCompanyBrain(companyId),
    getCompanyPlan(companyId),
  ]);
  if (brain) system = system ? `${brain}\n\n${system}` : brain;

  // Execution directive LAST, so it is the closest instruction to the request and
  // cannot be diluted by a caller's own wording. Skipped for conversational
  // actions, and for JSON-shaped calls where the caller's schema already dictates
  // the output and prose rules would only confuse it.
  if (!skipExecutionDirective && !CONVERSATIONAL_ACTIONS.has(action) && !response_format) {
    system = system ? `${system}\n\n${EXECUTION_DIRECTIVE}` : EXECUTION_DIRECTIVE;
  }
  const { planId, creditsTotal, creditsUsed, status: planStatus, scanTokensRemaining, subscriptionId, trialEndsAt } = planInfo;
  const remainingCredits = Math.max(0, creditsTotal - creditsUsed);

  // Trial users get FULL ACCESS during the 14-day trial — usage is tracked
  // (so they see what they consume), but never blocks. This matches the
  // marketing promise: "14-day trial with full access, no credit card".
  // Credit gate is only enforced on paid plans (starter/growth/scale/enterprise).
  //
  // WHILE the trial lasts. `trial_ends_at` was written at signup and then read
  // nowhere, so this bypass never expired: the "14-day trial" was in fact
  // unlimited free AI forever, on platform keys, for any account that simply never
  // upgraded. An expired trial now falls through to the normal credit gate.
  const trialExpired = !!trialEndsAt && new Date(trialEndsAt) <= new Date();
  const isOnTrial = !trialExpired
    && (planId === 'trial' || planStatus === 'trialing' || planStatus === 'inactive');

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

  // Pre-flight credit check — ONLY enforced on paid plans, never on trial.
  // BYOK also bypasses (admin's key, admin's cost).
  const willUsePlatformKey = !companyOpenAI && !companyAnthropic;
  if (willUsePlatformKey && !isOnTrial && remainingCredits < 1) {
    const err = new Error(`Out of AI credits (${remainingCredits} remaining). Upgrade your plan or buy a credit pack.`);
    err.code = 'CREDITS_EXHAUSTED';
    err.publicMessage = err.message;
    throw err;
  }

  // Scan-token gate — separate budget from AI credits, NOT part of the trial.
  // Uses the LIVE remaining count (base monthly grant + addons - used this cycle).
  if (SCAN_ACTIONS.has(action) && !canRunScanAction(action, planId, scanTokensRemaining)) {
    const err = new Error(
      planId === 'trial'
        ? 'Brand Scans are not included in the 14-day trial. Upgrade to Growth+ for Lite Scans or Scale+ for Full Scans, or purchase a one-off Full Scan from the pricing page.'
        : `You have 0 scan tokens remaining this cycle. Plans include: Growth = 1 Lite/mo, Scale = 2 Full/mo, Enterprise = 5 Full/mo. Or purchase a one-off Full Scan token for R$ 800.`
    );
    err.code = 'NO_SCAN_TOKENS';
    err.publicMessage = err.message;
    throw err;
  }

  console.log(`[ai/runAIChat] company=${companyId} plan=${planId} trial=${isOnTrial} action=${action || 'chat'} remaining=${remainingCredits} byok=${!!(companyOpenAI || companyAnthropic)}`);

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
      // For trial users, LOG usage but never block — matches "full access" promise.
      let creditsCharged = 0;
      let remainingAfter = remainingCredits;
      let scanTokenCharged = 0;

      // If this was a scan action, decrement 1 scan token from the subscription.
      // Scans are charged the SCAN TOKEN, NOT AI credits — so we skip the credit
      // deduction below for scan actions.
      if (SCAN_ACTIONS.has(action) && subscriptionId) {
        scanTokenCharged = 1;
        // Read-modify-write on a value read BEFORE the model call, with the error
        // discarded. Two scans started together both read the same count and both
        // wrote count+1, so the pair consumed ONE token — and a failed write was
        // invisible, making the scan free. The increment is now computed from the
        // current stored value at write time and the failure is at least recorded.
        const { data: freshSub } = await supabaseAdmin
          .from('subscriptions').select('scan_tokens_used').eq('id', subscriptionId).maybeSingle();
        const { error: scanErr } = await supabaseAdmin
          .from('subscriptions')
          .update({ scan_tokens_used: (freshSub?.scan_tokens_used ?? planInfo.scanTokensUsed ?? 0) + 1 })
          .eq('id', subscriptionId);
        if (scanErr) console.error(`[ai] scan token NOT charged for company ${companyId}:`, scanErr.message);
        await supabaseAdmin.from('credit_transactions').insert({
          company_id: companyId,
          subscription_id: subscriptionId,
          type: 'scan_usage',
          feature: action,
          credits_delta: 0, // scans don't burn AI credits
          credits_after: remainingCredits,
          description: `${action} — 1 scan token consumed`,
          metadata: {
            user_id: userId || null,
            user_email: userEmail || null,
            scan_token: 1,
            scan_tokens_remaining_after: Math.max(0, scanTokensRemaining - 1),
          },
        });
      }

      // For non-scan actions on platform key → deduct AI credits as usual
      if (attempt.source === 'platform' && !SCAN_ACTIONS.has(action)) {
        try {
          const tokens = (result.usage?.prompt_tokens || 0) + (result.usage?.completion_tokens || 0);
          creditsCharged = computeCreditCost({
            model: result.model_used,
            promptTokens: result.usage?.prompt_tokens || 0,
            completionTokens: result.usage?.completion_tokens || 0,
          });
          if (isOnTrial) {
            // Trial: log to credit_transactions for usage visibility only —
            // never enforced, so don't make the user wait on these two writes.
            // Fire-and-forget; failures are logged and cost nothing but a
            // missing usage row. (subscriptionId is already known from the
            // pre-flight plan fetch — no need to re-select it.)
            remainingAfter = Math.max(0, remainingCredits - creditsCharged);
            supabaseAdmin.from('credit_transactions').insert({
              company_id: companyId,
              subscription_id: subscriptionId || null,
              type: 'usage',
              feature: action || 'ai_chat',
              credits_delta: -creditsCharged,
              credits_after: remainingAfter,
              description: `${action || 'ai_chat'} — ${result.model_used} (${tokens} tokens) [trial]`,
              metadata: {
                user_id: userId || null,
                user_email: userEmail || null,
                model: result.model_used,
                tokens,
                tier: MODEL_TIER[result.model_used] || 'smart',
                trial_uncapped: true,
              },
            }).then(({ error }) => {
              if (error) console.error('[ai] trial usage log failed:', error.message);
            });
          } else {
            // Paid plan: real deduction with enforcement
            const deduction = await deductCredits({
              companyId, userId, userEmail,
              credits: creditsCharged,
              feature: action || 'ai_chat',
              model: result.model_used,
              tokens,
            });
            remainingAfter = deduction.remaining;
          }
        } catch (deductErr) {
          // The generation already happened and the provider has already been paid,
          // so failing the request here would punish the user for our bookkeeping.
          // But swallowing it outright was an unlimited-free-AI bug: deductCredits
          // throws CREDITS_EXHAUSTED *before* writing anything, and the pre-flight
          // only blocks at remaining < 1 — so an account holding fewer credits than
          // one call costs could keep generating forever, paying nothing.
          //
          // The debt is recorded instead: the balance is driven to zero so the
          // NEXT request is refused by the pre-flight gate.
          console.error('[ai] credit deduction failed:', deductErr.message);
          if (deductErr.code === 'CREDITS_EXHAUSTED' && subscriptionId) {
            const { error: zeroErr } = await supabaseAdmin
              .from('subscriptions')
              .update({ ai_credits_used: creditsTotal })
              .eq('id', subscriptionId);
            if (zeroErr) console.error('[ai] could not zero the balance:', zeroErr.message);
            else console.warn(`[ai] company=${companyId} overdrew its balance; credits zeroed, next call will be refused`);
            remainingAfter = 0;
          }
        }
      }

      // File content generations in the AI Outputs archive (no-op for actions
      // that aren't reviewable content — see ARCHIVE_CATEGORY_BY_ACTION).
      if (!skipArchive) {
        archiveGeneration({
          companyId, userId, userEmail, action,
          title: archiveTitle,
          content: result.content,
          model: result.model_used,
          tokens: result.usage?.total_tokens,
        });
      }

      return {
        ...result,
        key_source: attempt.source,
        credits_charged: creditsCharged,
        credits_remaining: remainingAfter,
        scan_token_charged: scanTokenCharged,
        scan_tokens_remaining: Math.max(0, scanTokensRemaining - scanTokenCharged),
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
// Diagnostics expose which keys are configured, where they come from and their
// prefixes — an operator's view, not a member's. It was requireAuth only, so any
// user could enumerate the company's BYOK posture.
router.get('/diagnose', requireAuth, requireCompanyAdmin, async (req, res) => {
  try {
  const settings = await getCompanyAISettings(req.companyId);
  // Include plan + credits in diagnose so users can see exactly why AI is blocked.
  // NOTE: this handler had NO try/catch while both awaits can reject —
  // getCompanyPlan now deliberately throws on a failed read. In Express 4 an
  // async handler's rejection is unhandled, which can take the whole process
  // down rather than returning an error for one request.
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
      // Presence only. A prefix confirms the key's type and account family, which
      // is a hint an attacker does not need and an operator does not require.
      key_configured: !!settings.openai_api_key,
      model: settings.openai_model || OPENAI_FALLBACK_MODEL,
      test_result: null,
    },
    anthropic: {
      has_key: !!(settings.anthropic_api_key || process.env.ANTHROPIC_API_KEY),
      key_source: settings.anthropic_api_key ? 'company' : (process.env.ANTHROPIC_API_KEY ? 'platform' : 'none'),
      key_configured: !!settings.anthropic_api_key,
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
  } catch (err) {
    console.error('[ai/diagnose]', err.message);
    res.status(503).json({ error: err.publicMessage || 'Could not run diagnostics right now.', code: err.code });
  }
});

/**
 * POST /api/ai/actions/apply — execute actions the USER approved in the chat.
 *
 * Separate from /chat on purpose. The model's proposal and the user's consent are
 * two different events, and only this endpoint writes. It re-validates everything
 * rather than trusting that the payload came from a proposal we made: the body is
 * client-supplied like any other, so ops are re-checked against the whitelist and
 * every write is re-scoped to this caller's company and role inside aiActions.js.
 *
 * The user may have EDITED the actions before approving, which is why the payload
 * is taken as given and re-validated rather than looked up from a stored proposal.
 */
router.post('/actions/apply', requireAuth, async (req, res) => {
  try {
    const actions = Array.isArray(req.body?.actions) ? req.body.actions.slice(0, 12) : null;
    if (!actions?.length) return res.status(400).json({ error: 'No actions supplied.' });

    const unknown = actions.filter(a => !isKnownOp(a?.op || a?.operation));
    if (unknown.length) {
      return res.status(400).json({
        error: `Unsupported operation: ${unknown.map(u => u?.op || '(missing)').join(', ')}`,
        code: 'UNKNOWN_OPERATION',
      });
    }

    const applied = await applyActions(actions, {
      companyId: req.companyId,
      userId: req.dbUser?.id,
      userRole: req.dbUser?.role,
    });

    const failures = applied.filter(a => !a.ok);
    res.json({
      applied,
      ok_count: applied.length - failures.length,
      failed_count: failures.length,
      ...(failures.length ? { warning: failures.map(f => `${f.op}: ${f.error}`).join(' · ') } : {}),
    });
  } catch (err) {
    console.error('[ai/actions/apply]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/chat
router.post('/chat', requireAuth, async (req, res) => {
  try {
    const { messages, model, temperature = 0.7, max_tokens, response_format, system, action, archive_title } = req.body;

    // The agent may CHANGE things from chat, not just describe them. It emits a
    // bmapz-actions block, which the backend parses, authorises against this
    // caller's role and company, and executes — see lib/aiActions.js. Skipped for
    // JSON-shaped calls, where the caller's schema owns the output.
    const canAct = !response_format;

    // LIVE WEB ACCESS. When the question needs current or external facts — a
    // competitor, a market, a price, anything time-sensitive — look it up first and
    // hand the findings to the model as context. Done as a pre-pass rather than a
    // tool loop so it works identically across both providers and the fallback
    // chain, matching how action extraction works.
    //
    // Degrades silently and deliberately: webSearch returns null when no provider
    // is configured or all fail, and the reply proceeds exactly as it did before.
    // Web access must never be able to break a chat.
    let webContext = '';
    const lastUserForSearch = [...(messages || [])].reverse().find(m => m?.role === 'user')?.content;
    const searchText = typeof lastUserForSearch === 'string'
      ? lastUserForSearch
      : Array.isArray(lastUserForSearch)
        ? lastUserForSearch.map(p => p?.text || '').join(' ')
        : '';

    if (!response_format && needsWebSearch(searchText)) {
      try {
        const found = await webSearch({ companyId: req.companyId, query: searchText });
        if (found) webContext = formatForPrompt(found);
      } catch (e) {
        console.error('[ai/chat] web search failed, continuing without it:', e.message);
      }
    }

    const systemWithActions = canAct
      ? [system, webContext, ACTION_PROTOCOL].filter(Boolean).join('\n\n')
      : [system, webContext].filter(Boolean).join('\n\n');

    const result = await runAIChat({
      companyId: req.companyId,
      userId: req.dbUser?.id,
      userRole: req.dbUser?.role,
      userEmail: req.dbUser?.email,
      messages, model, temperature, max_tokens, response_format, action,
      system: systemWithActions,
      archiveTitle: archive_title,
    });

    if (!canAct) return res.json(result);

    // PROPOSE, do not execute. Nothing is written until the user approves it in the
    // chat. This is both what was asked for and safer: the previous version applied
    // whatever the model emitted, so a rejected write still read as "done" in the
    // reply, and there was no moment where the user could see or correct it.
    const { text, actions: inline } = extractActions(result.content);
    let actions = inline;

    // SECOND PASS. The in-reply block is only a fast path; production logs proved
    // the model routinely omits it, which silently swallowed the user's
    // instruction. When the request looks like it asks for a change and no block
    // came back, extract the operations with a dedicated JSON-mode call.
    const lastUserMessage = [...(messages || [])].reverse()
      .find(m => m?.role === 'user')?.content;
    const userText = typeof lastUserMessage === 'string'
      ? lastUserMessage
      : Array.isArray(lastUserMessage)
        ? lastUserMessage.map(p => p?.text || '').join(' ')
        : '';

    if (!actions.length && looksActionable(userText)) {
      try {
        actions = await proposeActions({
          runAIChat,
          companyId: req.companyId,
          userId: req.dbUser?.id,
          userRole: req.dbUser?.role,
          userEmail: req.dbUser?.email,
          userMessage: userText,
          assistantReply: text,
        });
      } catch (e) {
        // Never fail the chat because the extractor failed — the reply is still
        // useful. Logged so the failure is visible rather than silent.
        console.error('[ai/chat] action extraction failed:', e.message);
      }
    }

    if (!actions.length) return res.json({ ...result, content: text });

    res.json({
      ...result,
      content: text,
      proposed_actions: actions,
      action_preview: describeActions(actions),
    });
  } catch (err) {
    console.error('[ai/chat]', err.code || 'ERR', err.publicMessage || err.message, err._errors || '');
    const status =
      err.code === 'MISSING_API_KEY' || err.code === 'AUTH' ? 402 :
      err.code === 'QUOTA' ? 402 :
      err.code === 'CREDITS_EXHAUSTED' ? 402 :
      err.code === 'NO_SUBSCRIPTION' ? 402 :
      err.code === 'NO_SCAN_TOKENS' ? 402 :
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

// GET /api/ai/models — live model catalog (auto-updated from providers).
// Returns models filtered to what the company's PLAN allows, plus the full
// catalog for admins. New Anthropic/OpenAI models appear here automatically.
router.get('/models', requireAuth, async (req, res) => {
  try {
    const [models, planInfo] = await Promise.all([
      getLiveModels(),
      getCompanyPlan(req.companyId),
    ]);
    const { planId } = planInfo;
    const allowedTiers = PLAN_MODEL_ACCESS[planId] || PLAN_MODEL_ACCESS.starter;
    res.json({
      plan_id: planId,
      allowed_tiers: allowedTiers,
      models: models.map(m => ({ ...m, allowed: allowedTiers.includes(m.tier) })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
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

    const refusal = await chargeFlat({
      companyId: req.companyId, userId: req.dbUser?.id, userEmail: req.dbUser?.email,
      action: 'transcribe',
    });
    if (refusal) return res.status(refusal.status).json(refusal.body);

    const client = await getOpenAIClient(req.companyId, null, req.dbUser?.role);
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

// ─── Image generation ─────────────────────────────────────────────────────────
// Valid OpenAI IMAGE models only — company settings sometimes hold a CHAT model
// in ai_image_model (which made images.generate 404 with "model not available").
const OPENAI_IMAGE_MODELS = ['gpt-image-1', 'dall-e-3', 'dall-e-2'];

// Each image model accepts different size/quality values; map the request onto
// whatever the attempted model supports instead of failing.
function imageParamsFor(model, size, quality) {
  const landscape = /^(1792|1536|1600|1920)x/.test(size);
  const portrait = /x(1792|1536|1600|1920)$/.test(size);
  if (model === 'gpt-image-1') {
    return {
      size: landscape ? '1536x1024' : portrait ? '1024x1536' : '1024x1024',
      quality: quality === 'hd' || quality === 'high' ? 'high' : 'medium',
    };
  }
  if (model === 'dall-e-3') {
    return {
      size: landscape ? '1792x1024' : portrait ? '1024x1792' : '1024x1024',
      quality: quality === 'hd' || quality === 'high' ? 'hd' : 'standard',
    };
  }
  // dall-e-2: square only, no quality param
  return { size: '1024x1024', quality: undefined };
}

async function generateWithStability(settings, prompt, n) {
  const apiKey = cleanKey(settings.stability_api_key) || cleanKey(process.env.STABILITY_API_KEY);
  if (!apiKey) return null;
  const response = await fetch('https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ text_prompts: [{ text: prompt, weight: 1 }], cfg_scale: 7, height: 1024, width: 1024, steps: 30, samples: n }),
  });
  if (!response.ok) throw new Error(`Stability AI error ${response.status}`);
  const result = await response.json();
  return result.artifacts?.map(a => `data:image/png;base64,${a.base64}`) || [];
}

// POST /api/ai/generate-image
// Tries the preferred model first, then falls back through every other OpenAI
// image model, then Stability — mirroring the resilience of the chat pipeline.
router.post('/generate-image', requireAuth, async (req, res) => {
  const { prompt, size = '1024x1024', quality = 'standard', n = 1 } = req.body;
  try {
    if (!prompt?.trim()) return res.status(400).json({ error: 'prompt is required' });

    // Priced per image, and hd costs about double — n=4 at hd was ~US$0.75 a call
    // with nothing stopping a free account repeating it.
    const refusal = await chargeFlat({
      companyId: req.companyId, userId: req.dbUser?.id, userEmail: req.dbUser?.email,
      action: 'generate_image',
      quantity: Math.min(4, Math.max(1, Number(n) || 1)) * (quality === 'hd' ? 2 : 1),
    });
    if (refusal) return res.status(refusal.status).json(refusal.body);

    const settings = await getCompanyAISettings(req.companyId);

    const provider = settings.ai_image_provider || 'openai';

    // Explicit Stability selection
    if (provider === 'stability' || provider === 'stable_diffusion') {
      const urls = await generateWithStability(settings, prompt, n);
      if (urls) return res.json({ urls });
      return res.status(402).json({ error: 'Stability AI API key not configured', code: 'MISSING_API_KEY' });
    }

    // OpenAI path with model fallback. Ignore any non-image model that ended
    // up in settings (e.g. a chat model) — that was the "model not available" bug.
    const preferred = OPENAI_IMAGE_MODELS.includes(settings.ai_image_model) ? settings.ai_image_model : null;
    const attempts = [...new Set([preferred, ...OPENAI_IMAGE_MODELS].filter(Boolean))];

    const client = await getOpenAIClient(req.companyId, null, req.dbUser?.role);
    const errors = [];
    for (const model of attempts) {
      try {
        const params = imageParamsFor(model, size, quality);
        const result = await client.images.generate({
          model, prompt,
          size: params.size,
          ...(params.quality ? { quality: params.quality } : {}),
          n: model === 'dall-e-3' ? 1 : Math.min(4, Math.max(1, n)),
        });
        // gpt-image-1 returns b64_json; dall-e returns url
        const urls = (result.data || [])
          .map(img => img.url || (img.b64_json ? `data:image/png;base64,${img.b64_json}` : null))
          .filter(Boolean);
        if (urls.length) return res.json({ urls, model_used: model });
        errors.push(`${model}: empty result`);
      } catch (err) {
        const cat = categorizeProviderError(err, 'OpenAI');
        errors.push(`${model}: ${cat.kind}`);
        console.warn(`[ai/generate-image] ${model} failed (${cat.kind}): ${err.message}`);
        // Auth/quota failures affect every OpenAI model — stop retrying OpenAI
        if (cat.kind === 'AUTH' || cat.kind === 'QUOTA') { errors.push('skipping remaining OpenAI models'); break; }
      }
    }

    // Last resort: Stability if a key exists
    try {
      const urls = await generateWithStability(settings, prompt, n);
      if (urls?.length) return res.json({ urls, model_used: 'stable-diffusion-xl' });
    } catch (e) { errors.push(`stability: ${e.message}`); }

    console.error('[ai/generate-image] all providers failed:', errors.join(' | '));
    return res.status(502).json({
      error: 'Image generation is unavailable right now. The image provider rejected all attempts — check the OpenAI account has image access/credits, or add a Stability AI key.',
      code: 'IMAGE_GEN_FAILED',
      details: errors,
    });
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

// POST /api/ai/edit-image — free-form AI image edit for the Design Studio
// (e.g. "make the sky purple"). Uses gpt-image-1 edits; returns a data URL the
// frontend persists to storage. (remove-background and enhance operations were
// removed — they altered the source too much.)
router.post('/edit-image', requireAuth, async (req, res) => {
  try {
    const { image_url, prompt: userPrompt } = req.body;
    if (!image_url) return res.status(400).json({ error: 'image_url is required' });
    if (!userPrompt?.trim()) return res.status(400).json({ error: 'prompt is required' });

    const refusal = await chargeFlat({
      companyId: req.companyId, userId: req.dbUser?.id, userEmail: req.dbUser?.email,
      action: 'edit_image',
    });
    if (refusal) return res.status(refusal.status).json(refusal.body);

    // Load the source image (storage URL or data URL)
    let buffer;
    if (image_url.startsWith('data:')) {
      const b64 = image_url.split(',')[1] || '';
      buffer = Buffer.from(b64, 'base64');
    } else {
      // SSRF guard. This fetched ANY url the caller supplied, so an authenticated
      // user could point it at http://169.254.169.254/ (cloud metadata),
      // http://localhost:… (internal services) or a private 10./192.168. address
      // and use the server as a proxy into the private network. canva.js already
      // does exactly this check; this endpoint simply never got it.
      const safeUrl = validatedFetchUrl(image_url);
      const r = await fetch(safeUrl, { redirect: 'error' }); // no redirect out of the allowlist
      if (!r.ok) throw new Error(`Could not load source image (${r.status})`);
      buffer = Buffer.from(await r.arrayBuffer());
    }
    if (buffer.length > 20 * 1024 * 1024) return res.status(413).json({ error: 'Image too large (max 20MB)' });

    const prompt = userPrompt;

    const client = await getOpenAIClient(req.companyId, null, req.dbUser?.role);
    const { toFile } = await import('openai');
    const file = await toFile(buffer, 'source.png', { type: 'image/png' });

    // Highest quality + high input fidelity so the source is preserved as closely
    // as the model allows.
    const params = { model: 'gpt-image-1', image: file, prompt, size: 'auto', quality: 'high', input_fidelity: 'high' };

    // Progressive fallback: drop the least-supported params first, so newer
    // accounts get max quality and older ones still succeed.
    const paramFallbacks = [
      params,
      { ...params, input_fidelity: undefined },
      { ...params, input_fidelity: undefined, quality: undefined },
      { ...params, input_fidelity: undefined, quality: undefined, size: undefined },
    ].map(p => Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined)));

    let result, lastErr;
    for (const p of paramFallbacks) {
      try { result = await client.images.edit(p); break; }
      catch (err) {
        lastErr = err;
        // Only keep retrying on param-shape rejections; bail on auth/quota/etc.
        const cat = categorizeProviderError(err, 'OpenAI');
        if (cat.kind === 'AUTH' || cat.kind === 'QUOTA' || cat.kind === 'RATE_LIMIT') throw err;
      }
    }
    if (!result) throw lastErr || new Error('Image edit failed');

    const b64 = result.data?.[0]?.b64_json;
    if (!b64) throw new Error('Image edit returned no image');
    res.json({ url: `data:image/png;base64,${b64}` });
  } catch (err) {
    console.error('[ai/edit-image]', err.message);
    if (err.code === 'MISSING_API_KEY') return res.status(402).json({ error: err.message, code: 'MISSING_API_KEY' });
    const cat = categorizeProviderError(err, 'OpenAI');
    const status = cat.kind === 'AUTH' || cat.kind === 'QUOTA' ? 402 : cat.kind === 'RATE_LIMIT' ? 429 : 500;
    res.status(status).json({ error: cat.msg, code: cat.kind });
  }
});

// POST /api/ai/tts
router.post('/tts', requireAuth, async (req, res) => {
  try {
    const { text, voice = 'alloy', model = 'tts-1' } = req.body;

    const refusal = await chargeFlat({
      companyId: req.companyId, userId: req.dbUser?.id, userEmail: req.dbUser?.email,
      action: 'tts',
    });
    if (refusal) return res.status(refusal.status).json(refusal.body);

    const client = await getOpenAIClient(req.companyId, null, req.dbUser?.role);
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
    metadata: metadata || {},
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

// GET /api/ai/outputs — the archive. Supports server-side outcome filtering
// (status lives in metadata->>'status'; indexed by migration 019), free-text
// search over title/content, and category filtering.
router.get('/outputs', requireAuth, async (req, res) => {
  try {
    const { type, status, category, q, limit = 50, offset = 0 } = req.query;
    let query = supabaseAdmin
      .from('ai_outputs')
      .select('*', { count: 'exact' })
      .eq('company_id', req.companyId)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);
    if (type) query = query.eq('type', type);
    if (category) query = query.eq('metadata->>category', category);
    if (status) {
      // 'pending' also matches rows written before status existed (null).
      if (status === 'pending') query = query.or('metadata->>status.eq.pending,metadata->>status.is.null');
      else query = query.eq('metadata->>status', status);
    }
    if (q) {
      // Sanitize: strip PostgREST .or() syntax characters from user input.
      const term = String(q).replace(/[,()"]/g, ' ').trim().slice(0, 80);
      if (term) query = query.or(`metadata->>title.ilike.%${term}%,output.ilike.%${term}%`);
    }
    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ data: (data || []).map(flattenAIOutput), total: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ai/outputs/:id — single record (entities.js AIOutput.get targeted
// this route but it never existed; every call 404'd).
/**
 * POST /api/ai/outputs/:id/send-to-section
 * Body: { section, content? }
 *
 * Closes the gap that made the whole flow feel broken: an approved output sat in
 * the archive and never appeared in the section it belonged to, because filing a
 * record and creating one in a section were two unconnected paths. This connects
 * them, using the SAME builder the task board uses, so "send this to Ads" produces
 * the same record whichever surface it came from.
 *
 * `content` is optional so the user can edit before sending — the archived text is
 * a draft, not a final artefact.
 */
router.post('/outputs/:id/send-to-section', requireAuth, async (req, res) => {
  try {
    const { data: output, error } = await supabaseAdmin
      .from('ai_outputs').select('*')
      .eq('id', req.params.id).eq('company_id', req.companyId)
      .maybeSingle();
    if (error) throw error;
    if (!output) return res.status(404).json({ error: 'Output not found' });

    const meta = output.metadata || {};
    const content = String(req.body?.content ?? meta.content ?? output.output ?? '').trim();
    if (!content) return res.status(400).json({ error: 'This output has no content to send.' });

    const action = buildSectionAction({
      section: req.body?.section,
      title: meta.title || 'AI output',
      content,
    });
    if (!action) {
      return res.status(400).json({ error: `Cannot send to "${req.body?.section}".`, code: 'BAD_SECTION' });
    }

    const [result] = await applyActions([action], {
      companyId: req.companyId,
      userId: req.dbUser?.id,
      userRole: req.dbUser?.role,
    });
    if (!result?.ok) {
      return res.status(400).json({ error: result?.error || 'Could not send this to the section.' });
    }

    // Record where it went so the card can link to it and the same output is not
    // sent twice by accident.
    await supabaseAdmin.from('ai_outputs').update({
      metadata: {
        ...meta,
        status: 'approved',
        sent_to: { section: req.body.section, id: result.id || null, at: new Date().toISOString() },
      },
    }).eq('id', output.id).eq('company_id', req.companyId);

    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[ai/outputs/send-to-section]', err.message);
    // The full error goes to the logs; the user gets something actionable rather
    // than raw Postgres.
    res.status(500).json({ error: friendlyError(err) });
  }
});

router.get('/outputs/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('ai_outputs')
      .select('*')
      .eq('id', req.params.id)
      .eq('company_id', req.companyId)
      .single();
    if (error) throw error;
    res.json(flattenAIOutput(data));
  } catch (err) {
    res.status(404).json({ error: 'Output not found' });
  }
});

// PATCH /api/ai/outputs/:id
router.patch('/outputs/:id', requireAuth, async (req, res) => {
  try {
    // Fetch existing to merge metadata
    const { data: existing } = await supabaseAdmin
      .from('ai_outputs')
      .select('type, metadata')
      .eq('id', req.params.id)
      .eq('company_id', req.companyId)
      .single();

    const { type, prompt, output: outputText, model, ...extra } = req.body;
    const prevMeta = existing?.metadata || {};
    const mergedMetadata = { ...prevMeta, ...extra };
    delete mergedMetadata.metadata;

    // Outcome bookkeeping — the archive + brain learning depend on this:
    //  - preserve the ORIGINAL AI content the first time the user edits it
    //  - stamp who/when decided the outcome
    //  - flag edited-then-approved so the brain knows first-pass quality was off
    const statusChanged = extra.status !== undefined && extra.status !== prevMeta.status;
    const contentEdited = extra.content !== undefined && prevMeta.content !== undefined
      && JSON.stringify(extra.content) !== JSON.stringify(prevMeta.content);
    if (contentEdited && mergedMetadata.original_content === undefined) {
      mergedMetadata.original_content = prevMeta.content;
    }
    if (contentEdited) mergedMetadata.was_edited = true;
    if (statusChanged) {
      mergedMetadata.status_at = new Date().toISOString();
      mergedMetadata.status_by = req.dbUser?.email || null;
    }

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

    // Feed the outcome into the company brain's learning loop (fire-and-forget
    // — never blocks or fails the request).
    if (statusChanged || contentEdited) {
      recordOutcomeLearning({
        companyId: req.companyId,
        category: mergedMetadata.category || existing?.type || 'general',
        status: mergedMetadata.status,
        wasEdited: !!mergedMetadata.was_edited,
        runAIChat,
      }).catch((e) => console.error('[brain] outcome learning failed:', e.message));
    }

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
