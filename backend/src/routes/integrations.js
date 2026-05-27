import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/integrations/status — full integration status for the company
router.get('/status', requireAuth, async (req, res) => {
  try {
    const { data: companyRow } = await supabaseAdmin
      .from('companies')
      .select('integration_status, api_keys')
      .eq('id', req.companyId)
      .single();

    const k = companyRow?.api_keys || {};
    const status = companyRow?.integration_status || {};

    // Auto-detect connections from stored keys/tokens (all booleans)
    const detected = {
      // AI providers
      openai: !!(k.openai_api_key),
      anthropic: !!(k.anthropic_api_key),
      stability: !!(k.stability_api_key),
      // Google
      gmail: !!(k.google_access_token),
      google_analytics: !!(k.google_access_token && k.google_analytics_property_id),
      google_search_console: !!(k.google_access_token && k.google_search_console_url),
      google_ads: !!(k.google_access_token && k.google_ads_customer_id),
      google_drive: !!(k.google_drive_token),
      youtube: !!(k.google_access_token),
      // Meta
      meta: !!(k.meta_access_token),
      meta_ads: !!(k.meta_access_token),
      facebook: !!(k.meta_access_token && k.facebook_page_id),
      instagram: !!(k.meta_access_token && k.instagram_business_account_id),
      // Social
      linkedin: !!(k.linkedin_access_token),
      linkedin_ads: !!(k.linkedin_ads_access_token || k.linkedin_access_token),
      twitter: !!(k.twitter_access_token),
      tiktok: !!(k.tiktok_access_token),
      tiktok_ads: !!(k.tiktok_access_token && k.tiktok_advertiser_id),
      // Messaging
      whatsapp: !!(k.whatsapp_api_token && k.whatsapp_phone_id),
      // Email
      email_smtp: !!(k.smtp_host && k.smtp_user),
      email_resend: !!(k.resend_api_key),
      // Prospecting
      apollo: !!(k.apollo_api_key),
      hunter: !!(k.hunter_api_key),
      lusha: !!(k.lusha_api_key),
      clay: !!(k.clay_api_key),
      // Publishing
      wordpress: !!(k.wordpress_url && k.wordpress_user && k.wordpress_app_password),
      // Automation webhooks
      zapier: !!(k.zapier_webhook_url),
      make: !!(k.make_webhook_url),
      n8n: !!(k.n8n_webhook_url),
      custom: !!(k.custom_api_url),
      // Scheduling
      google_calendar: !!(k.google_access_token),
      cal_com: !!(k.cal_com_api_key),
      // Other
      stripe: !!(k.stripe_connected),
    };

    // Merge: auto-detected takes precedence for presence, stored status for OAuth-confirmed ones
    const merged = { ...detected, ...status };

    res.json({
      status: merged,
      google_connected_email: k.google_connected_email,
      facebook_page_id: k.facebook_page_id,
      instagram_business_account_id: k.instagram_business_account_id,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/integrations/test/:type — actively test a connection with a real API call
router.post('/test/:type', requireAuth, async (req, res) => {
  try {
    const { type } = req.params;

    const { data: companyRow } = await supabaseAdmin
      .from('companies')
      .select('api_keys')
      .eq('id', req.companyId)
      .single();
    const k = companyRow?.api_keys || {};

    switch (type) {
      case 'openai': {
        const rawKey = k.openai_api_key || process.env.OPENAI_API_KEY;
        if (!rawKey) return res.json({ success: false, message: 'OpenAI API key not set' });
        const apiKey = String(rawKey).trim();
        // STEP 1: Verify key is valid (lists models). Catches 401 (bad key).
        const modelsResp = await fetch('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${apiKey}` } });
        if (!modelsResp.ok) {
          const d = await modelsResp.json().catch(() => ({}));
          return res.json({ success: false, message: `OpenAI key rejected (${modelsResp.status}): ${d.error?.message || 'invalid key'}` });
        }
        // STEP 2: Verify key can actually make completions (catches insufficient_quota / billing missing).
        const completionResp = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'ping' }], max_tokens: 5 }),
        });
        if (completionResp.ok) return res.json({ success: true, message: 'OpenAI fully working (key + billing)' });
        const compErr = await completionResp.json().catch(() => ({}));
        const errMsg = compErr.error?.message || `HTTP ${completionResp.status}`;
        const errType = compErr.error?.type || '';
        if (errType === 'insufficient_quota' || errMsg.toLowerCase().includes('quota')) {
          return res.json({ success: false, message: `OpenAI key is valid but account has no billing/credits: ${errMsg}. Add credits at platform.openai.com/settings/organization/billing.` });
        }
        return res.json({ success: false, message: `OpenAI completion failed: ${errMsg}` });
      }

      case 'anthropic': {
        const rawKey = k.anthropic_api_key || process.env.ANTHROPIC_API_KEY;
        if (!rawKey) return res.json({ success: false, message: 'Anthropic API key not set' });
        const apiKey = String(rawKey).trim();
        // STEP 1: Verify key is valid (lists models). Catches 401 (bad key).
        const modelsResp = await fetch('https://api.anthropic.com/v1/models', {
          headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        });
        if (!modelsResp.ok) {
          const d = await modelsResp.json().catch(() => ({}));
          return res.json({ success: false, message: `Anthropic key rejected (${modelsResp.status}): ${d.error?.message || 'invalid key'}` });
        }
        // STEP 2: Verify key can actually make completions (catches credit balance issues).
        const completionResp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'claude-3-5-sonnet-20241022', messages: [{ role: 'user', content: 'ping' }], max_tokens: 5 }),
        });
        if (completionResp.ok) return res.json({ success: true, message: 'Anthropic fully working (key + credits)' });
        const compErr = await completionResp.json().catch(() => ({}));
        const errMsg = compErr.error?.message || `HTTP ${completionResp.status}`;
        if (errMsg.toLowerCase().includes('credit') || errMsg.toLowerCase().includes('billing')) {
          return res.json({ success: false, message: `Anthropic key is valid but workspace has no credits: ${errMsg}. Add credits at console.anthropic.com/settings/billing.` });
        }
        return res.json({ success: false, message: `Anthropic completion failed: ${errMsg}` });
      }

      case 'stability': {
        const apiKey = k.stability_api_key;
        if (!apiKey) return res.json({ success: false, message: 'Stability AI key not set' });
        const r = await fetch('https://api.stability.ai/v1/user/account', {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (r.ok) return res.json({ success: true, message: 'Stability AI connected' });
        return res.json({ success: false, message: 'Stability AI key invalid' });
      }

      case 'apollo': {
        const apiKey = k.apollo_api_key || process.env.APOLLO_API_KEY;
        if (!apiKey) return res.json({ success: false, message: 'Apollo API key not set' });
        const r = await fetch('https://api.apollo.io/api/v1/auth/health', {
          headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
        });
        if (r.ok) return res.json({ success: true, message: 'Apollo.io connected' });
        return res.json({ success: false, message: 'Apollo key invalid or not authorized' });
      }

      case 'hunter': {
        const apiKey = k.hunter_api_key || process.env.HUNTER_API_KEY;
        if (!apiKey) return res.json({ success: false, message: 'Hunter API key not set' });
        const r = await fetch(`https://api.hunter.io/v2/account?api_key=${apiKey}`);
        const d = await r.json();
        if (d.data?.email) return res.json({ success: true, message: `Hunter connected (${d.data.email})` });
        return res.json({ success: false, message: d.errors?.[0]?.details || 'Hunter key invalid' });
      }

      case 'wordpress': {
        const { wordpress_url, wordpress_user, wordpress_app_password } = k;
        if (!wordpress_url || !wordpress_user || !wordpress_app_password) {
          return res.json({ success: false, message: 'WordPress URL, username, and app password required' });
        }
        const credentials = Buffer.from(`${wordpress_user}:${wordpress_app_password}`).toString('base64');
        const r = await fetch(`${wordpress_url.replace(/\/$/, '')}/wp-json/wp/v2/users/me`, {
          headers: { Authorization: `Basic ${credentials}` },
        });
        if (r.ok) return res.json({ success: true, message: 'WordPress connected' });
        return res.json({ success: false, message: 'WordPress credentials invalid or REST API not accessible' });
      }

      case 'whatsapp': {
        const { whatsapp_api_token, whatsapp_phone_id } = k;
        if (!whatsapp_api_token || !whatsapp_phone_id) {
          return res.json({ success: false, message: 'WhatsApp API token and Phone Number ID required' });
        }
        const r = await fetch(`https://graph.facebook.com/v19.0/${whatsapp_phone_id}`, {
          headers: { Authorization: `Bearer ${whatsapp_api_token}` },
        });
        if (r.ok) return res.json({ success: true, message: 'WhatsApp Business connected' });
        return res.json({ success: false, message: 'WhatsApp credentials invalid' });
      }

      case 'gmail': {
        const hasOAuth = !!(k.google_access_token);
        const hasManual = !!(k.gmail_client_id && k.gmail_refresh_token);
        if (!hasOAuth && !hasManual) {
          return res.json({ success: false, message: 'Gmail not configured. Use OAuth or add Client ID + Refresh Token.' });
        }
        return res.json({ success: true, message: 'Gmail credentials present' });
      }

      case 'meta_ads': {
        const token = k.meta_access_token;
        if (!token) return res.json({ success: false, message: 'Meta not connected via OAuth' });
        const r = await fetch(`https://graph.facebook.com/v19.0/me?access_token=${token}`);
        if (r.ok) return res.json({ success: true, message: 'Meta Ads connected' });
        return res.json({ success: false, message: 'Meta token invalid or expired. Please reconnect.' });
      }

      case 'google_ads': {
        const hasCredentials = k.google_ads_developer_token && k.google_ads_customer_id &&
          (k.google_ads_refresh_token || k.google_access_token);
        if (!hasCredentials) {
          return res.json({ success: false, message: 'Google Ads requires Developer Token, Customer ID, and OAuth token' });
        }
        return res.json({ success: true, message: 'Google Ads credentials present' });
      }

      case 'linkedin_ads': {
        const token = k.linkedin_ads_access_token || k.linkedin_access_token;
        if (!token) return res.json({ success: false, message: 'LinkedIn not connected' });
        return res.json({ success: true, message: 'LinkedIn Ads token present' });
      }

      case 'tiktok_ads': {
        const token = k.tiktok_access_token;
        if (!token) return res.json({ success: false, message: 'TikTok not connected via OAuth' });
        return res.json({ success: true, message: 'TikTok Ads token present' });
      }

      case 'zapier': {
        const webhookUrl = k.zapier_webhook_url;
        if (!webhookUrl) return res.json({ success: false, message: 'Zapier webhook URL not set' });
        const r = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ test: true, source: 'bmapz', timestamp: new Date().toISOString() }),
        });
        return res.json({ success: r.ok, message: r.ok ? 'Zapier webhook test sent' : 'Zapier webhook URL not reachable' });
      }

      case 'make': {
        const webhookUrl = k.make_webhook_url;
        if (!webhookUrl) return res.json({ success: false, message: 'Make webhook URL not set' });
        const r = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ test: true, source: 'bmapz', timestamp: new Date().toISOString() }),
        });
        return res.json({ success: r.ok, message: r.ok ? 'Make webhook test sent' : 'Make webhook URL not reachable' });
      }

      case 'n8n': {
        const webhookUrl = k.n8n_webhook_url;
        if (!webhookUrl) return res.json({ success: false, message: 'n8n webhook URL not set' });
        const r = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ test: true, source: 'bmapz', timestamp: new Date().toISOString() }),
        });
        return res.json({ success: r.ok, message: r.ok ? 'n8n webhook test sent' : 'n8n webhook URL not reachable' });
      }

      case 'custom': {
        const { custom_api_url, custom_api_key } = k;
        if (!custom_api_url) return res.json({ success: false, message: 'Custom API URL not set' });
        const headers = { 'Content-Type': 'application/json' };
        if (custom_api_key) headers['Authorization'] = `Bearer ${custom_api_key}`;
        const r = await fetch(custom_api_url, {
          method: 'POST',
          headers,
          body: JSON.stringify({ test: true, source: 'bmapz', timestamp: new Date().toISOString() }),
        });
        return res.json({ success: r.ok, message: r.ok ? 'Custom webhook responded successfully' : `Custom endpoint returned ${r.status}` });
      }

      default:
        return res.json({ success: false, message: `No test defined for integration type: ${type}` });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/integrations/google/drive/files — list Drive files
router.get('/google/drive/files', requireAuth, async (req, res) => {
  try {
    const { query = '', page_token, mime_type } = req.query;

    const { data: companyRow } = await supabaseAdmin
      .from('companies')
      .select('api_keys')
      .eq('id', req.companyId)
      .single();
    const company = companyRow?.api_keys || {};

    const token = company.google_drive_token || company.google_access_token;
    if (!token) return res.status(401).json({ error: 'Google Drive not connected' });

    const params = new URLSearchParams({
      fields: 'nextPageToken,files(id,name,mimeType,thumbnailLink,webViewLink,createdTime,size)',
      orderBy: 'modifiedTime desc',
      pageSize: '30',
    });

    // Build query
    const qParts = ['trashed=false'];
    if (mime_type) {
      qParts.push(`mimeType='${mime_type}'`);
    } else {
      qParts.push("(mimeType contains 'image/' or mimeType='application/pdf')");
    }
    if (query) qParts.push(`name contains '${query}'`);
    params.set('q', qParts.join(' and '));

    if (page_token) params.set('pageToken', page_token);

    const r = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const d = await r.json();

    if (d.error) {
      if (d.error.status === 'UNAUTHENTICATED') {
        return res.status(401).json({ error: 'Google Drive token expired. Please reconnect.' });
      }
      throw new Error(d.error.message);
    }

    res.json(d);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/integrations/google/analytics — fetch GA4 data
router.get('/google/analytics', requireAuth, async (req, res) => {
  try {
    const { days = 28 } = req.query;
    const { data: companyRow } = await supabaseAdmin
      .from('companies')
      .select('api_keys')
      .eq('id', req.companyId)
      .single();
    const company = companyRow?.api_keys || {};

    if (!company.google_access_token || !company.google_analytics_property_id) {
      return res.json({ error: 'Google Analytics not connected' });
    }

    const endDate = 'today';
    const startDate = `${days}daysAgo`;

    const r = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${company.google_analytics_property_id}:runReport`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${company.google_access_token}`,
        'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateRanges: [{ startDate, endDate }],
          metrics: [
            { name: 'sessions' },
            { name: 'users' },
            { name: 'pageviews' },
            { name: 'bounceRate' },
            { name: 'averageSessionDuration' },
          ],
          dimensions: [{ name: 'date' }],
          orderBys: [{ dimension: { dimensionName: 'date' } }],
        }),
      }
    );
    const d = await r.json();
    if (d.error) throw new Error(d.error.message);
    res.json(d);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/integrations/apollo/enrich — enrich a lead with Apollo
router.post('/apollo/enrich', requireAuth, async (req, res) => {
  try {
    const { email, domain } = req.body;
    const { data: companyRow } = await supabaseAdmin
      .from('companies')
      .select('api_keys')
      .eq('id', req.companyId)
      .single();

    const apiKey = companyRow?.api_keys?.apollo_api_key || process.env.APOLLO_API_KEY;
    if (!apiKey) return res.status(400).json({ error: 'Apollo API key not configured' });

    const r = await fetch('https://api.apollo.io/api/v1/people/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ email, domain, reveal_personal_emails: true }),
    });
    const d = await r.json();
    res.json(d);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/integrations/hunter/find-email
router.post('/hunter/find-email', requireAuth, async (req, res) => {
  try {
    const { domain, first_name, last_name } = req.body;
    const { data: companyRow } = await supabaseAdmin
      .from('companies')
      .select('api_keys')
      .eq('id', req.companyId)
      .single();

    const apiKey = companyRow?.api_keys?.hunter_api_key || process.env.HUNTER_API_KEY;
    if (!apiKey) return res.status(400).json({ error: 'Hunter API key not configured' });

    const params = new URLSearchParams({ domain, first_name, last_name, api_key: apiKey });
    const r = await fetch(`https://api.hunter.io/v2/email-finder?${params}`);
    const d = await r.json();
    res.json(d);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
