import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

/**
 * Helper: get company AI settings (provider, model, keys).
 */
async function getCompanyAISettings(companyId) {
  const { data: company } = await supabaseAdmin
    .from('companies')
    .select('openai_api_key, openai_model, anthropic_api_key, anthropic_model, ai_provider, ai_image_provider, ai_image_model, stability_api_key')
    .eq('id', companyId)
    .single();
  return company || {};
}

/**
 * Helper: get OpenAI client using company key or platform key.
 */
async function getOpenAIClient(companyId) {
  const { data: company } = await supabaseAdmin
    .from('companies')
    .select('openai_api_key')
    .eq('id', companyId)
    .single();

  const apiKey = company?.openai_api_key || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const err = new Error('OpenAI API key not configured. Add your key in Settings > API Keys.');
    err.code = 'MISSING_API_KEY';
    throw err;
  }

  const OpenAI = (await import('openai')).default;
  return new OpenAI({ apiKey });
}

/**
 * Helper: get Anthropic client using company key or platform key.
 */
async function getAnthropicClient(companyId) {
  const { data: company } = await supabaseAdmin
    .from('companies')
    .select('anthropic_api_key')
    .eq('id', companyId)
    .single();

  const apiKey = company?.anthropic_api_key || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const err = new Error('Anthropic API key not configured. Add your key in Settings > API Keys.');
    err.code = 'MISSING_API_KEY';
    throw err;
  }

  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  return new Anthropic({ apiKey });
}

/**
 * Unified AI chat completion — supports OpenAI and Anthropic based on company setting.
 */
async function runAIChat({ companyId, messages, model, temperature = 0.7, max_tokens, response_format, system }) {
  const settings = await getCompanyAISettings(companyId);
  const provider = settings.ai_provider || 'openai';

  if (provider === 'anthropic') {
    const client = await getAnthropicClient(companyId);
    const anthropicModel = model || settings.anthropic_model || 'claude-sonnet-4-5';
    const anthropicMessages = (messages || []).filter(m => m.role !== 'system');
    const systemPrompt = system || (messages || []).find(m => m.role === 'system')?.content;
    const params = { model: anthropicModel, messages: anthropicMessages, max_tokens: max_tokens || 4096, temperature };
    if (systemPrompt) params.system = systemPrompt;
    const response = await client.messages.create(params);
    return {
      content: response.content[0]?.text || '',
      usage: {
        prompt_tokens: response.usage?.input_tokens,
        completion_tokens: response.usage?.output_tokens,
        total_tokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
      },
    };
  }

  // Default: OpenAI
  const client = await getOpenAIClient(companyId);
  const openaiModel = model || settings.openai_model || 'gpt-4o-mini';
  const msgs = [];
  if (system) msgs.push({ role: 'system', content: system });
  msgs.push(...(messages || []));
  const params = { model: openaiModel, messages: msgs, temperature };
  if (max_tokens) params.max_tokens = max_tokens;
  if (response_format) params.response_format = response_format;
  const completion = await client.chat.completions.create(params);
  return { content: completion.choices[0].message.content, usage: completion.usage };
}

// POST /api/ai/chat
router.post('/chat', requireAuth, async (req, res) => {
  try {
    const { messages, model, temperature = 0.7, max_tokens, response_format, system } = req.body;
    const result = await runAIChat({ companyId: req.companyId, messages, model, temperature, max_tokens, response_format, system });
    res.json(result);
  } catch (err) {
    console.error('[ai/chat]', err.message);
    const status = err.code === 'MISSING_API_KEY' ? 402 : 500;
    res.status(status).json({ error: err.message, code: err.code });
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
    const status = err.code === 'MISSING_API_KEY' ? 402 : 500;
    res.status(status).json({ error: err.message, code: err.code });
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

    const client = await getOpenAIClient(req.companyId);
    const result = await client.images.generate({ model: model || 'dall-e-3', prompt, size, quality, n });
    res.json({ urls: result.data.map(img => img.url) });
  } catch (err) {
    console.error('[ai/generate-image]', err.message);
    const status = err.code === 'MISSING_API_KEY' ? 402 : 500;
    res.status(status).json({ error: err.message, code: err.code });
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

// POST /api/ai/outputs
router.post('/outputs', requireAuth, async (req, res) => {
  try {
    const { type, title, content, metadata } = req.body;
    const { data, error } = await supabaseAdmin
      .from('ai_outputs')
      .insert({ company_id: req.companyId, created_by: req.dbUser.id, type, title, content, metadata })
      .select()
      .single();
    if (error) throw error;
    res.json(data);
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
    res.json({ data, total: count });
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

export default router;
