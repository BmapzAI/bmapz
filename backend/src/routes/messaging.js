import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { handleInboundEvent } from '../lib/workflowEngine.js';

const router = Router();

const SYNC_CHANNELS = ['gmail', 'instagram', 'whatsapp', 'linkedin'];

// ─── Message Templates (must be before /:id) ─────────────────────────────────

router.get('/templates', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('message_templates')
      .select('*')
      .eq('company_id', req.companyId)
      .order('name');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/templates', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('message_templates')
      .insert({ ...req.body, company_id: req.companyId })
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/templates/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('message_templates')
      .update(req.body)
      .eq('id', req.params.id)
      .eq('company_id', req.companyId)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/templates/:id', requireAuth, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('message_templates')
      .delete()
      .eq('id', req.params.id)
      .eq('company_id', req.companyId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Activities (must be before /:id) ────────────────────────────────────────

router.get('/activities', requireAuth, async (req, res) => {
  try {
    const { lead_id, type, limit = 30, offset = 0 } = req.query;
    let query = supabaseAdmin
      .from('activities')
      .select('*', { count: 'exact' })
      .eq('company_id', req.companyId)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (lead_id) query = query.eq('lead_id', lead_id);
    if (type) query = query.eq('type', type);

    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ data, total: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/activities', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('activities')
      .insert({ ...req.body, company_id: req.companyId })
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Messages ─────────────────────────────────────────────────────────────────

router.post('/sync', requireAuth, async (req, res) => {
  try {
    const requestedChannel = normalizeSyncChannel(req.body?.channel);
    const channels = requestedChannel ? [requestedChannel] : SYNC_CHANNELS;
    const limit = Math.min(Number(req.body?.limit) || 25, 50);

    const { data: companyRow, error } = await supabaseAdmin
      .from('companies')
      .select('api_keys, integration_status')
      .eq('id', req.companyId)
      .single();
    if (error) throw error;

    const company = {
      ...(companyRow?.api_keys || {}),
      integration_status: companyRow?.integration_status || {},
    };

    const results = {};
    for (const channel of channels) {
      try {
        if (channel === 'gmail') results.gmail = await syncGmail(req.companyId, company, limit);
        if (channel === 'instagram') results.instagram = await syncInstagram(req.companyId, company, limit);
        if (channel === 'whatsapp') results.whatsapp = await syncWhatsApp(company);
        if (channel === 'linkedin') results.linkedin = await syncLinkedIn();
      } catch (syncErr) {
        results[channel] = { status: 'error', imported: 0, message: syncErr.message };
      }
    }

    const imported = Object.values(results).reduce((sum, r) => sum + Number(r.imported || 0), 0);
    res.json({
      success: true,
      imported,
      results,
      message: buildSyncMessage(results, imported),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', requireAuth, async (req, res) => {
  try {
    const { lead_id, status, limit = 50, offset = 0 } = req.query;
    let query = supabaseAdmin
      .from('messages')
      .select('*', { count: 'exact' })
      .eq('company_id', req.companyId)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (lead_id) query = query.eq('lead_id', lead_id);
    if (status) query = query.eq('status', status);

    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ data, total: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('messages')
      .insert({ ...req.body, company_id: req.companyId })
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Parameterized routes last (after all named paths) ───────────────────────

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('messages')
      .select('*')
      .eq('id', req.params.id)
      .eq('company_id', req.companyId)
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(404).json({ error: 'Message not found' });
  }
});

router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('messages')
      .update(req.body)
      .eq('id', req.params.id)
      .eq('company_id', req.companyId)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

function normalizeSyncChannel(channel) {
  if (!channel || channel === 'all') return null;
  const value = String(channel).toLowerCase();
  const map = {
    email: 'gmail',
    gmail: 'gmail',
    instagram: 'instagram',
    whatsapp: 'whatsapp',
    linkedin: 'linkedin',
  };
  return map[value] || null;
}

async function syncGmail(companyId, company, limit) {
  const token = await getGoogleAccessToken(companyId, company);
  if (!token) {
    return {
      status: 'not_configured',
      imported: 0,
      message: 'Gmail is not connected. Connect Google/Gmail with read permission first.',
    };
  }

  const listUrl = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
  listUrl.searchParams.set('labelIds', 'INBOX');
  listUrl.searchParams.set('q', 'newer_than:30d');
  listUrl.searchParams.set('maxResults', String(limit));

  const listData = await googleFetchJson(listUrl, token, 'Gmail inbox list failed');
  const messageRefs = listData.messages || [];
  let imported = 0;

  for (const ref of messageRefs) {
    const getUrl = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${ref.id}`);
    getUrl.searchParams.set('format', 'full');
    const gmailMessage = await googleFetchJson(getUrl, token, 'Gmail message fetch failed');
    const normalized = normalizeGmailMessage(companyId, gmailMessage, company.google_connected_email || company.gmail_sender_email);
    if (!normalized?.platform_message_id) continue;
    if (await insertMessageIfNew(normalized)) imported++;
  }

  return {
    status: 'synced',
    imported,
    checked: messageRefs.length,
    message: imported ? `Imported ${imported} new Gmail message(s).` : 'Gmail checked; no new messages found.',
  };
}

async function syncInstagram(companyId, company, limit) {
  const pageId = company.facebook_page_id || company.meta_page_id;
  const pageToken = company.facebook_page_access_token || company.meta_access_token;
  const igAccountId = company.instagram_business_account_id || company.instagram_account_id;

  if (!pageId || !pageToken || !igAccountId) {
    return {
      status: 'not_configured',
      imported: 0,
      message: 'Instagram messaging is not fully connected. Connect Meta/Instagram and grant messaging permissions.',
    };
  }

  const conversationsUrl = new URL(`https://graph.facebook.com/v19.0/${pageId}/conversations`);
  conversationsUrl.searchParams.set('platform', 'instagram');
  conversationsUrl.searchParams.set('fields', 'id,updated_time,participants');
  conversationsUrl.searchParams.set('limit', String(Math.min(limit, 25)));
  conversationsUrl.searchParams.set('access_token', pageToken);

  const conversationsData = await metaFetchJson(conversationsUrl, 'Instagram conversations fetch failed');
  let imported = 0;
  let checked = 0;

  for (const conversation of conversationsData.data || []) {
    const messagesUrl = new URL(`https://graph.facebook.com/v19.0/${conversation.id}/messages`);
    messagesUrl.searchParams.set('fields', 'id,created_time,from,to,message');
    messagesUrl.searchParams.set('limit', '10');
    messagesUrl.searchParams.set('access_token', pageToken);

    const messagesData = await metaFetchJson(messagesUrl, 'Instagram messages fetch failed');
    for (const message of messagesData.data || []) {
      checked++;
      const normalized = normalizeInstagramMessage(companyId, message, conversation.id, igAccountId);
      if (!normalized?.platform_message_id || !normalized.content) continue;
      if (await insertMessageIfNew(normalized)) imported++;
    }
  }

  return {
    status: 'synced',
    imported,
    checked,
    message: imported ? `Imported ${imported} new Instagram DM(s).` : 'Instagram checked; no new DMs found.',
  };
}

async function syncWhatsApp(company) {
  const hasConfig = !!(
    (company.whatsapp_api_token || process.env.WHATSAPP_ACCESS_TOKEN)
    && (company.whatsapp_phone_id || process.env.WHATSAPP_PHONE_NUMBER_ID)
  );

  return {
    status: hasConfig ? 'webhook_required' : 'not_configured',
    imported: 0,
    message: hasConfig
      ? 'WhatsApp receives new messages through the Meta webhook. No pull-history sync is available; webhook messages already saved will appear after refresh.'
      : 'WhatsApp is not configured. Add WhatsApp token, phone number ID, and webhook settings first.',
  };
}

async function syncLinkedIn() {
  return {
    status: 'restricted',
    imported: 0,
    message: 'LinkedIn direct message sync requires approved LinkedIn Messaging API access. The current LinkedIn social/ads token cannot read inbox DMs.',
  };
}

async function getGoogleAccessToken(companyId, company) {
  if (company.google_access_token && !isExpired(company.google_token_expires_at)) {
    return company.google_access_token;
  }

  const refreshToken = company.google_refresh_token || company.gmail_refresh_token;
  const clientId = company.google_client_id || company.gmail_client_id || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = company.google_client_secret || company.gmail_client_secret || process.env.GOOGLE_CLIENT_SECRET;
  if (!refreshToken || !clientId || !clientSecret) return company.google_access_token || null;

  const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  const tokens = await tokenResp.json();
  if (!tokenResp.ok || tokens.error) {
    throw new Error(tokens.error_description || tokens.error || 'Google token refresh failed');
  }

  const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();
  const { data: companyRow } = await supabaseAdmin
    .from('companies')
    .select('api_keys')
    .eq('id', companyId)
    .single();
  await supabaseAdmin
    .from('companies')
    .update({
      api_keys: {
        ...(companyRow?.api_keys || {}),
        google_access_token: tokens.access_token,
        google_token_expires_at: expiresAt,
      },
    })
    .eq('id', companyId);

  company.google_access_token = tokens.access_token;
  company.google_token_expires_at = expiresAt;
  return tokens.access_token;
}

async function googleFetchJson(url, token, fallbackMessage) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) {
    const message = data.error?.message || fallbackMessage;
    if (message.toLowerCase().includes('insufficient')) {
      throw new Error('Gmail needs read permission. Reconnect Gmail so Bmapz can request gmail.readonly scope.');
    }
    throw new Error(message);
  }
  return data;
}

async function metaFetchJson(url, fallbackMessage) {
  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) {
    const message = data.error?.message || fallbackMessage;
    if (message.toLowerCase().includes('permission')) {
      throw new Error(`${message}. Reconnect Meta/Instagram with messaging permissions approved.`);
    }
    throw new Error(message);
  }
  return data;
}

function normalizeGmailMessage(companyId, gmailMessage, connectedEmail) {
  const headers = gmailMessage.payload?.headers || [];
  const from = getHeader(headers, 'From');
  const to = getHeader(headers, 'To');
  const subject = getHeader(headers, 'Subject') || '(No subject)';
  const internalDate = gmailMessage.internalDate ? new Date(Number(gmailMessage.internalDate)).toISOString() : new Date().toISOString();
  const body = extractGmailBody(gmailMessage.payload);
  const fromEmail = extractEmail(from);
  const direction = connectedEmail && fromEmail?.toLowerCase() === connectedEmail.toLowerCase() ? 'outbound' : 'inbound';

  return {
    company_id: companyId,
    direction,
    channel: 'email',
    subject,
    content: body.text || gmailMessage.snippet || subject,
    html_content: body.html || null,
    status: 'received',
    sent_at: internalDate,
    from_address: from,
    to_address: to,
    platform_message_id: gmailMessage.id,
    thread_id: gmailMessage.threadId,
    metadata: {
      source: 'gmail_sync',
      snippet: gmailMessage.snippet,
      from_email: fromEmail,
    },
  };
}

function normalizeInstagramMessage(companyId, message, conversationId, igAccountId) {
  const from = message.from || {};
  const direction = String(from.id) === String(igAccountId) ? 'outbound' : 'inbound';
  return {
    company_id: companyId,
    direction,
    channel: 'instagram',
    content: message.message || '',
    status: 'received',
    sent_at: message.created_time || new Date().toISOString(),
    from_address: from.name || from.username || from.id || null,
    platform_message_id: message.id,
    thread_id: conversationId,
    metadata: {
      source: 'instagram_sync',
      ig_sender_id: from.id,
      ig_sender_name: from.name || from.username,
    },
  };
}

async function insertMessageIfNew(record) {
  const { data: existing, error: existingError } = await supabaseAdmin
    .from('messages')
    .select('id')
    .eq('company_id', record.company_id)
    .eq('channel', record.channel)
    .eq('platform_message_id', record.platform_message_id)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return false;

  const { error } = await supabaseAdmin.from('messages').insert(record);
  if (error) throw error;

  // Real prospect message arrived → fire workflow triggers + let the SDR answer.
  // Fire-and-forget so a slow AI turn never blocks the sync.
  if (record.direction === 'inbound') {
    const contactHandle = record.from_address
      || record.metadata?.from_phone
      || record.metadata?.ig_sender_id
      || null;
    const contactName = record.metadata?.from_name || record.metadata?.ig_sender_name || null;
    // A message with no thread_id (or a novel thread) is treated as a new conversation.
    handleInboundEvent({
      companyId: record.company_id,
      channel: record.channel,
      contactHandle,
      contactName,
      text: record.content || '',
      leadId: record.lead_id || null,
      isNewConversation: !record.thread_id,
    }).catch(err => console.error('[messaging] inbound trigger failed:', err.message));
  }
  return true;
}

function getHeader(headers, name) {
  return headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';
}

function extractEmail(value = '') {
  return value.match(/<([^>]+)>/)?.[1] || value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || '';
}

function extractGmailBody(part) {
  if (!part) return { text: '', html: '' };
  const mimeType = part.mimeType || '';
  const data = part.body?.data ? decodeBase64Url(part.body.data) : '';
  if (mimeType === 'text/plain') return { text: data, html: '' };
  if (mimeType === 'text/html') return { text: stripHtml(data), html: data };

  const childResults = (part.parts || []).map(extractGmailBody);
  return {
    text: childResults.find(r => r.text)?.text || '',
    html: childResults.find(r => r.html)?.html || '',
  };
}

function decodeBase64Url(data) {
  return Buffer.from(String(data).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isExpired(isoDate) {
  if (!isoDate) return false;
  return new Date(isoDate).getTime() < Date.now() + 60000;
}

function buildSyncMessage(results, imported) {
  if (imported > 0) return `Imported ${imported} new message(s).`;
  const statuses = Object.values(results).map(r => r.message).filter(Boolean);
  return statuses[0] || 'Inbox checked; no new messages found.';
}
