/**
 * Integrations API — replaces base44.integrations.Core.*
 * All calls go to our Express backend which handles the actual integrations.
 */
import { api } from '@/api/apiClient';

// ─── AI / LLM ────────────────────────────────────────────────────────────────

export const InvokeLLM = async ({ prompt, systemPrompt, response_json_schema, inputFields }) => {
  const messages = [];
  if (inputFields) {
    // Build prompt from inputFields (legacy Base44 pattern)
    const userContent = typeof inputFields === 'string' ? inputFields : JSON.stringify(inputFields);
    messages.push({ role: 'user', content: userContent });
  } else {
    messages.push({ role: 'user', content: prompt });
  }

  const params = {
    messages,
    system: systemPrompt,
  };

  if (response_json_schema) {
    params.response_format = { type: 'json_object' };
  }

  const result = await api.post('/api/ai/chat', params);
  
  if (response_json_schema) {
    try {
      return JSON.parse(result.content);
    } catch {
      return result.content;
    }
  }
  return result.content;
};

// ─── Email ────────────────────────────────────────────────────────────────────

export const SendEmail = async ({ to, subject, body, html, from, replyTo }) => {
  return api.post('/api/email/send', {
    to,
    subject,
    html: html || body,
    text: body,
    from,
    replyTo,
  });
};

// ─── Image generation ─────────────────────────────────────────────────────────

export const GenerateImage = async ({ prompt, size, quality, n }) => {
  const result = await api.post('/api/ai/generate-image', { prompt, size, quality, n });
  return result.urls?.[0] || null;
};

// ─── SMS (stub — integrate Twilio via backend if needed) ──────────────────────

export const SendSMS = async ({ to, body }) => {
  console.warn('[SendSMS] SMS not yet integrated. Message:', body, 'To:', to);
  return { success: false, error: 'SMS not configured' };
};

// ─── File upload ──────────────────────────────────────────────────────────────

export const UploadFile = async ({ file, fileName }) => {
  // Upload directly to Supabase Storage
  const { supabase } = await import('@/lib/supabase');
  const path = `uploads/${Date.now()}-${fileName || file.name}`;
  const { data, error } = await supabase.storage.from('assets').upload(path, file);
  if (error) throw new Error(error.message);
  const { data: { publicUrl } } = supabase.storage.from('assets').getPublicUrl(path);
  return { url: publicUrl, path };
};

// ─── Extract data from uploaded file ─────────────────────────────────────────

export const ExtractDataFromUploadedFile = async ({ file_url, json_schema }) => {
  return api.post('/api/ai/chat', {
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: `Extract data from this file according to this schema: ${JSON.stringify(json_schema)}` },
        { type: 'image_url', image_url: { url: file_url } },
      ],
    }],
    response_format: { type: 'json_object' },
  }).then(r => {
    try { return JSON.parse(r.content); } catch { return r.content; }
  });
};

// ─── Audio transcription ──────────────────────────────────────────────────────

export const TranscribeAudio = async ({ audio_base64, filename, language }) => {
  const result = await api.post('/api/ai/transcribe', { audio_base64, filename, language });
  return result.text;
};

// ─── Core namespace (legacy compat) ──────────────────────────────────────────

export const Core = {
  InvokeLLM,
  SendEmail,
  SendSMS,
  UploadFile,
  GenerateImage,
  ExtractDataFromUploadedFile,
  TranscribeAudio,
};

export default Core;
