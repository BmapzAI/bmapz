import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

/**
 * Helper: get company AI settings (provider, model, keys).
 * Keys are stored in the api_keys JSONB column — must select that column,
 * NOT individual field names (those are not direct columns on the table).
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
  if (systemPrompt) params.system = systemPrompt;

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
 * Unified AI chat completion — tries every available key in this order:
 *   1. Preferred provider with company key
 *   2. Preferred provider with platform env-var key (if different)
 *   3. Other provider with company key
 *   4. Other provider with platform env-var key (if different)
 * Only fails when ALL attempts have been exhausted.
 */
async function runAIChat({ companyId, messages, model, temperature = 0.7, max_tokens, response_format, system }) {
  const settings = await getCompanyAISettings(companyId);
  const provider = settings.ai_provider || 'openai';

  const companyOpenAI = cleanKey(settings.openai_api_key);
  const platformOpenAI = cleanKey(process.env.OPENAI_API_KEY);
  const companyAnthropic = cleanKey(settings.anthropic_api_key);
  const platformAnthropic = cleanKey(process.env.ANTHROPIC_API_KEY);

  if (!companyOpenAI && !platformOpenAI && !companyAnthropic && !platformAnthropic) {
    const err = new Error('No AI provider configured. Add OpenAI or Anthropic API key in Settings > API Keys.');
    err.code = 'MISSING_API_KEY';
    err.publicMessage = err.message;
    throw err;
  }

  // Build attempt list: each entry is { provider, key, source }
  // For each provider, try company key first, then platform key (only if different)
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
      const result = await fn({
        companyId, settings, messages, model, temperature, max_tokens, response_format, system,
        keyOverride: attempt.key,
      });
      if (errors.length > 0) console.log(`[ai] succeeded with ${attempt.provider}/${attempt.source} after ${errors.length} failure(s)`);
      return { ...result, key_source: attempt.source };
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
  const diag = {
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
    const { messages, model, temperature = 0.7, max_tokens, response_format, system } = req.body;
    const result = await runAIChat({ companyId: req.companyId, messages, model, temperature, max_tokens, response_format, system });
    res.json(result);
  } catch (err) {
    console.error('[ai/chat]', err.code || 'ERR', err.publicMessage || err.message, err._errors || '');
    const status =
      err.code === 'MISSING_API_KEY' || err.code === 'AUTH' ? 402 :
      err.code === 'QUOTA' ? 402 :
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

// POST /api/ai/transcribe
router.post('/transcribe', requireAuth, async (req, res) => {
  try {
    const { audio_base64, filename = 'audio.webm', language } = req.body;
    if (!audio_base64) return res.status(400).json({ error: 'audio_base64 is required' });

    const client = await getOpenAIClient(req.companyId);
    const buffer = Buffer.from(audio_base64, 'base64');
    const blob = new Blob([buffer], { type: 'audio/webm' });
    const file = new File([blob], filename, { type: 'audio/webm' });

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
