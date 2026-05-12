import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

/**
 * Helper: get OpenAI client using company's own key or platform fallback
 */
async function getOpenAIClient(companyId) {
  const { data: company } = await supabaseAdmin
    .from('companies')
    .select('openai_api_key')
    .eq('id', companyId)
    .single();

  const OpenAI = (await import('openai')).default;
  return new OpenAI({
    apiKey: company?.openai_api_key || process.env.OPENAI_API_KEY,
  });
}

// POST /api/ai/chat — universal AI chat / completion
router.post('/chat', requireAuth, async (req, res) => {
  try {
    const {
      messages,
      model = 'gpt-4o-mini',
      temperature = 0.7,
      max_tokens,
      response_format,
      system,
    } = req.body;

    const client = await getOpenAIClient(req.companyId);

    const msgs = [];
    if (system) msgs.push({ role: 'system', content: system });
    msgs.push(...(messages || []));

    const params = { model, messages: msgs, temperature };
    if (max_tokens) params.max_tokens = max_tokens;
    if (response_format) params.response_format = response_format;

    const completion = await client.chat.completions.create(params);
    res.json({
      content: completion.choices[0].message.content,
      usage: completion.usage,
    });
  } catch (err) {
    console.error('[ai/chat]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/transcribe — audio transcription (Whisper)
router.post('/transcribe', requireAuth, async (req, res) => {
  try {
    const { audio_base64, filename = 'audio.webm', language } = req.body;
    if (!audio_base64) return res.status(400).json({ error: 'audio_base64 is required' });

    const client = await getOpenAIClient(req.companyId);

    // Convert base64 to buffer
    const buffer = Buffer.from(audio_base64, 'base64');
    const blob = new Blob([buffer], { type: 'audio/webm' });
    const file = new File([blob], filename, { type: 'audio/webm' });

    const params = { file, model: 'whisper-1' };
    if (language) params.language = language;

    const transcription = await client.audio.transcriptions.create(params);
    res.json({ text: transcription.text });
  } catch (err) {
    console.error('[ai/transcribe]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/generate-image — image generation (DALL-E or Stable Diffusion)
router.post('/generate-image', requireAuth, async (req, res) => {
  try {
    const { prompt, size = '1024x1024', quality = 'standard', n = 1 } = req.body;

    // Get company's image provider preference
    const { data: company } = await supabaseAdmin
      .from('companies')
      .select('openai_api_key, ai_image_provider, ai_image_model')
      .eq('id', req.companyId)
      .single();

    const provider = company?.ai_image_provider || 'openai';
    const model = company?.ai_image_model || 'dall-e-3';

    if (provider === 'stability' || provider === 'stable_diffusion') {
      // Stable Diffusion via Stability AI API
      const apiKey = process.env.STABILITY_API_KEY;
      if (!apiKey) throw new Error('Stability AI API key not configured');

      const response = await fetch('https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          text_prompts: [{ text: prompt, weight: 1 }],
          cfg_scale: 7,
          height: 1024,
          width: 1024,
          steps: 30,
          samples: n,
        }),
      });

      const result = await response.json();
      const urls = result.artifacts?.map(a => `data:image/png;base64,${a.base64}`) || [];
      return res.json({ urls });
    }

    // Default: OpenAI DALL-E
    const client = await getOpenAIClient(req.companyId);
    const result = await client.images.generate({
      model: model || 'dall-e-3',
      prompt,
      size,
      quality,
      n,
    });

    res.json({ urls: result.data.map(img => img.url) });
  } catch (err) {
    console.error('[ai/generate-image]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/tts — text-to-speech
router.post('/tts', requireAuth, async (req, res) => {
  try {
    const { text, voice = 'alloy', model = 'tts-1' } = req.body;
    const client = await getOpenAIClient(req.companyId);

    const mp3 = await client.audio.speech.create({ model, voice, input: text });
    const buffer = Buffer.from(await mp3.arrayBuffer());

    res.set('Content-Type', 'audio/mpeg');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/outputs — save an AI output
router.post('/outputs', requireAuth, async (req, res) => {
  try {
    const { type, title, content, metadata } = req.body;
    const { data, error } = await supabaseAdmin
      .from('ai_outputs')
      .insert({
        company_id: req.companyId,
        created_by: req.dbUser.id,
        type,
        title,
        content,
        metadata,
      })
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ai/outputs — list AI outputs
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
