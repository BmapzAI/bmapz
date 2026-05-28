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

export const UploadFile = async ({ file, fileName, folder }) => {
  // Upload via backend endpoint (uses service-role key, auto-creates bucket,
  // bypasses Supabase Storage RLS issues that broke direct browser uploads).
  const { supabase } = await import('@/lib/supabase');
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Not authenticated. Please sign in again.');

  const formData = new FormData();
  formData.append('file', file, fileName || file.name);
  if (folder) formData.append('folder', folder);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  const response = await fetch(`${API_URL}/api/uploads`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData, // browser sets multipart/form-data with boundary
  });

  if (!response.ok) {
    let msg = `Upload failed (${response.status})`;
    try {
      const body = await response.json();
      msg = body.error || msg;
    } catch (_e) { /* keep default */ }
    const err = new Error(msg);
    err.status = response.status;
    throw err;
  }

  const result = await response.json();
  return { url: result.url, path: result.path };
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
