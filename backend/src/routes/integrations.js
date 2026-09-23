import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { safeFetch } from '../lib/safeFetch.js';
import { sendServerError } from '../lib/httpError.js';

const router = Router();
const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v24.0';
const LINKEDIN_API_VERSION = process.env.LINKEDIN_API_VERSION || '202606';

/**
 * Keys pasted from a dashboard routinely carry a trailing newline or a stray
 * space, which providers reject as an invalid key — indistinguishable from a
 * genuinely wrong key unless it is trimmed first.
 */
const clean = (v) => (typeof v === 'string' ? v.trim() : v ? String(v).trim() : '');

/**
 * Get a usable Google token, or the reason there isn't one.
 *
 * getGoogleAccessToken THROWS when a refresh is rejected, which inside a route's
 * try/catch becomes a 500 and — now that 500s are scrubbed — a generic "something
 * went wrong". For a TEST endpoint that is the worst possible answer: an expired
 * or revoked refresh token is the single most likely thing being tested, and the
 * fix (reconnect Google) is specific. The text here comes from Google's OAuth
 * response, not from our database, so it is safe to show.
 */
async function googleToken(companyId, k) {
  try {
    const token = await getGoogleAccessToken(companyId, k);
    if (!token) return { error: 'Google is not connected. Run the Google connect flow first.' };
    return { token };
  } catch (err) {
    return { error: `Google refused to refresh the token (${err.message}). Disconnect and reconnect Google.` };
  }
}

/**
 * Turn a Google API failure into something the person setting it up can act on.
 *
 * "403 Forbidden" is useless to them. The overwhelmingly common cause on a first
 * connect is that the API was never enabled in the Cloud project — the OAuth
 * consent succeeds, a token is issued, and then every call 403s. That reads as a
 * broken integration when it is one checkbox. Second most common is a token that
 * expired or was revoked, which needs a reconnect, not a console visit.
 */
function googleErr(body, response, label) {
  const msg = body?.error?.message || body?.error_description || `HTTP ${response.status}`;
  if (/has not been used in project|is disabled|SERVICE_DISABLED|accessNotConfigured/i.test(msg)) {
    return `${label}: the API is not enabled in your Google Cloud project. `
      + 'Enable it under APIs & Services > Library, wait a minute, then test again. '
      + `(Google said: ${msg})`;
  }
  if (response.status === 401 || /invalid_grant|Invalid Credentials|UNAUTHENTICATED/i.test(msg)) {
    return `${label}: the Google token is expired or revoked. Disconnect and reconnect Google. (${msg})`;
  }
  if (response.status === 403 && /insufficient|scope|PERMISSION_DENIED/i.test(msg)) {
    return `${label}: the token is missing the required scope. Reconnect Google and accept all requested permissions. (${msg})`;
  }
  return `${label}: ${msg}`;
}

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

    // Auto-detect connections from stored keys/tokens (all booleans).
    //
    // PLATFORM-LEVEL services fall back to process.env, because Bmapz pays for
    // them and every company uses the platform key unless it brings its own. This
    // used to check only the per-company key, so with a key set in Railway and
    // none on the company the page said "not connected" while POST /test/:type
    // on the very same service said "fully working". Per-tenant OAuth tokens
    // below have NO env fallback on purpose — they are minted by a real person
    // completing a consent flow and cannot be platform-wide.
    const envHas = (name) => !!String(process.env[name] || '').trim();
    const detected = {
      // AI providers
      openai: !!(k.openai_api_key) || envHas('OPENAI_API_KEY'),
      anthropic: !!(k.anthropic_api_key) || envHas('ANTHROPIC_API_KEY'),
      stability: !!(k.stability_api_key) || envHas('STABILITY_API_KEY'),
      perplexity: !!(k.perplexity_api_key) || envHas('PERPLEXITY_API_KEY'),
      // Billing
      stripe: !!(k.stripe_secret_key) || envHas('STRIPE_SECRET_KEY'),
      // Google
      gmail: !!(k.google_access_token),
      google_analytics: !!(k.google_access_token && k.google_analytics_property_id),
      google_search_console: !!(k.google_access_token && k.google_search_console_url),
      google_ads: !!(k.google_access_token && k.google_ads_customer_id),
      google_drive: !!(k.google_drive_token),
      youtube: !!(k.google_access_token),
      // Meta
      meta: !!(k.meta_access_token),
      meta_ads: !!(k.meta_access_token && (k.meta_ads_account_id || k.meta_ad_account_id)),
      facebook: !!(k.meta_access_token && k.facebook_page_id),
      instagram: !!(k.meta_access_token && k.instagram_business_account_id),
      // Social
      linkedin: !!(k.linkedin_access_token),
      linkedin_ads: !!((k.linkedin_ads_access_token || k.linkedin_access_token) && k.linkedin_ads_account_id),
      twitter: !!(k.twitter_access_token),
      tiktok: !!(k.tiktok_access_token),
      tiktok_ads: !!(k.tiktok_access_token && k.tiktok_advertiser_id),
      canva: !!(k.canva_access_token),
      // Messaging
      whatsapp: !!(k.whatsapp_api_token && k.whatsapp_phone_id),
      // Email
      email_smtp: !!(k.smtp_host && k.smtp_user),
      email_resend: !!(k.resend_api_key) || envHas('RESEND_API_KEY'),
      // Prospecting
      apollo: !!(k.apollo_api_key) || envHas('APOLLO_API_KEY'),
      hunter: !!(k.hunter_api_key) || envHas('HUNTER_API_KEY'),
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
      // Stripe CONNECT — a per-company connected account for receiving payouts.
      // Distinct from the `stripe` key above, which is the PLATFORM billing key
      // that charges Bmapz's own subscribers. Both were previously called
      // `stripe`, so the second silently overwrote the first and the platform
      // key never showed up at all.
      stripe_connect: !!(k.stripe_connected && k.stripe_account_id),
    };

    // Credentials are the ground truth. A stale saved status must not claim an
    // integration is connected when its required token/account is missing.
    const merged = { ...status, ...detected };

    res.json({
      status: merged,
      google_connected_email: k.google_connected_email,
      facebook_page_id: k.facebook_page_id,
      instagram_business_account_id: k.instagram_business_account_id,
    });
  } catch (err) {
    sendServerError(res, err, '[integrations]');
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
        const r = await safeFetch(`${wordpress_url.replace(/\/$/, '')}/wp-json/wp/v2/users/me`, {
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
        const r = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${whatsapp_phone_id}`, {
          headers: { Authorization: `Bearer ${whatsapp_api_token}` },
        });
        if (r.ok) return res.json({ success: true, message: 'WhatsApp Business connected' });
        return res.json({ success: false, message: 'WhatsApp credentials invalid' });
      }

      // This used to return success for "credentials present" without ever calling
      // Google, so an expired or revoked token reported as connected — the exact
      // failure a test exists to catch. It now makes a real call.
      case 'gmail': {
        const hasOAuth = !!(k.google_access_token);
        const hasManual = !!(k.gmail_client_id && k.gmail_refresh_token);
        if (!hasOAuth && !hasManual) {
          return res.json({ success: false, message: 'Gmail not configured. Use OAuth or add Client ID + Refresh Token.' });
        }
        const { token, error: tokenErr } = await googleToken(req.companyId, k);
        if (!token) return res.json({ success: false, message: tokenErr });
        const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const d = await r.json().catch(() => ({}));
        if (r.ok && d.emailAddress) {
          return res.json({ success: true, message: `Gmail connected (${d.emailAddress})` });
        }
        return res.json({
          success: false,
          message: googleErr(d, r, 'Gmail'),
        });
      }

      case 'meta_ads': {
        const token = k.meta_access_token;
        const accountId = k.meta_ads_account_id || k.meta_ad_account_id;
        if (!token || !accountId) return res.json({ success: false, message: 'Meta Ads requires OAuth and an Ad Account ID' });
        const r = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/act_${accountId}?fields=id,name&access_token=${token}`);
        const d = await r.json();
        if (r.ok && !d.error) return res.json({ success: true, message: `Meta Ads connected${d.name ? `: ${d.name}` : ''}` });
        return res.json({ success: false, message: d.error?.message || 'Meta token or ad account is invalid. Please reconnect.' });
      }

      case 'google_ads': {
        const developerToken = k.google_ads_developer_token || process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
        const customerId = String(k.google_ads_customer_id || '').replace(/-/g, '');
        // Named individually: "requires Developer Token, Customer ID, and a
        // connected OAuth token" left the person guessing which of the three was
        // missing, and they are obtained in three completely different places.
        if (!developerToken) return res.json({ success: false, message: 'Google Ads is missing the Developer Token. Get it from your Google Ads account under Tools > API Center.' });
        if (!customerId) return res.json({ success: false, message: 'Google Ads is missing the Customer ID (the 10-digit number at the top right of the Google Ads UI).' });
        const { token, error: tokenErr } = await googleToken(req.companyId, k);
        if (!token) return res.json({ success: false, message: tokenErr });
        const r = await fetch(`https://googleads.googleapis.com/v24/customers/${customerId}/googleAds:searchStream`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'developer-token': developerToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: 'SELECT customer.id FROM customer LIMIT 1' }),
        });
        const d = await r.json();
        if (r.ok && !d.error) return res.json({ success: true, message: 'Google Ads live API connection confirmed' });
        return res.json({ success: false, message: d.error?.message || 'Google Ads API rejected the connection. Reconnect OAuth if the token expired.' });
      }

      case 'linkedin_ads': {
        const token = k.linkedin_ads_access_token || k.linkedin_access_token;
        const accountId = k.linkedin_ads_account_id;
        if (!token || !accountId) return res.json({ success: false, message: 'LinkedIn Ads requires OAuth and an Ad Account ID' });
        const r = await fetch(`https://api.linkedin.com/rest/adAccounts/${accountId}/adCampaigns?q=search&search=(test:False)&pageSize=1`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Linkedin-Version': LINKEDIN_API_VERSION,
            'X-Restli-Protocol-Version': '2.0.0',
          },
        });
        const d = await r.json();
        if (r.ok && !d.message) return res.json({ success: true, message: 'LinkedIn Ads live API connection confirmed' });
        return res.json({ success: false, message: d.message || 'LinkedIn Ads API rejected the connection. Advertising API access may need approval.' });
      }

      case 'tiktok_ads': {
        const token = k.tiktok_access_token;
        const advertiserId = k.tiktok_advertiser_id;
        if (!token || !advertiserId) return res.json({ success: false, message: 'TikTok Ads requires OAuth and an Advertiser ID' });
        const r = await fetch('https://business-api.tiktok.com/open_api/v1.3/campaign/get/', {
          method: 'POST',
          headers: { 'Access-Token': token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ advertiser_id: String(advertiserId), page_size: 1, page: 1 }),
        });
        const d = await r.json();
        if (r.ok && d.code === 0) return res.json({ success: true, message: 'TikTok Ads live API connection confirmed' });
        return res.json({ success: false, message: d.message || 'TikTok Ads API rejected the connection. Check app permissions.' });
      }

      case 'zapier': {
        const webhookUrl = k.zapier_webhook_url;
        if (!webhookUrl) return res.json({ success: false, message: 'Zapier webhook URL not set' });
        const r = await safeFetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ test: true, source: 'bmapz', timestamp: new Date().toISOString() }),
        });
        return res.json({ success: r.ok, message: r.ok ? 'Zapier webhook test sent' : 'Zapier webhook URL not reachable' });
      }

      case 'make': {
        const webhookUrl = k.make_webhook_url;
        if (!webhookUrl) return res.json({ success: false, message: 'Make webhook URL not set' });
        const r = await safeFetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ test: true, source: 'bmapz', timestamp: new Date().toISOString() }),
        });
        return res.json({ success: r.ok, message: r.ok ? 'Make webhook test sent' : 'Make webhook URL not reachable' });
      }

      case 'n8n': {
        const webhookUrl = k.n8n_webhook_url;
        if (!webhookUrl) return res.json({ success: false, message: 'n8n webhook URL not set' });
        const r = await safeFetch(webhookUrl, {
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
        const r = await safeFetch(custom_api_url, {
          method: 'POST',
          headers,
          body: JSON.stringify({ test: true, source: 'bmapz', timestamp: new Date().toISOString() }),
        });
        return res.json({ success: r.ok, message: r.ok ? 'Custom webhook responded successfully' : `Custom endpoint returned ${r.status}` });
      }

      // ─── Platform-level API keys ────────────────────────────────────────────
      //
      // These fall back to process.env because they are platform services rather
      // than per-tenant connections: Bmapz pays for them and every company uses
      // the same key unless it brings its own.

      case 'perplexity': {
        const apiKey = clean(k.perplexity_api_key || process.env.PERPLEXITY_API_KEY);
        if (!apiKey) return res.json({ success: false, message: 'Perplexity API key not set' });
        // Deliberately the SAME model lib/webSearch.js uses. Testing a different
        // model would prove something the product never does.
        const r = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'sonar', messages: [{ role: 'user', content: 'ping' }], max_tokens: 5 }),
        });
        if (r.ok) return res.json({ success: true, message: 'Perplexity connected (web search will work)' });
        const d = await r.json().catch(() => ({}));
        const msg = d.error?.message || d.detail || `HTTP ${r.status}`;
        // A rejected model name and a rejected key look identical if you only
        // report the status code, and they need opposite fixes.
        if (r.status === 400 && /model/i.test(String(msg))) {
          return res.json({ success: false, message: `Perplexity key is valid but the model "sonar" was rejected: ${msg}. The model name in lib/webSearch.js needs updating.` });
        }
        if (r.status === 401) return res.json({ success: false, message: `Perplexity key rejected: ${msg}` });
        return res.json({ success: false, message: `Perplexity call failed: ${msg}` });
      }

      case 'resend':
      case 'email_resend': {
        const apiKey = clean(k.resend_api_key || process.env.RESEND_API_KEY);
        if (!apiKey) return res.json({ success: false, message: 'Resend API key not set' });
        const r = await fetch('https://api.resend.com/domains', { headers: { Authorization: `Bearer ${apiKey}` } });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) return res.json({ success: false, message: `Resend key rejected (${r.status}): ${d.message || 'invalid key'}` });

        // A valid key is not the same as being able to send. Resend only delivers
        // from a VERIFIED domain, so check the From address can actually be used —
        // otherwise every email silently 403s at send time.
        const from = clean(k.resend_from_email || process.env.RESEND_FROM_EMAIL);
        const domains = Array.isArray(d.data) ? d.data : [];
        const verified = domains.filter((x) => x?.status === 'verified').map((x) => x.name);
        if (!from) {
          return res.json({ success: true, message: `Resend key valid. Verified domains: ${verified.join(', ') || 'none yet'}. RESEND_FROM_EMAIL is not set, so sending will fail.` });
        }
        const fromDomain = String(from).split('@').pop().toLowerCase();
        if (verified.some((nm) => String(nm).toLowerCase() === fromDomain)) {
          return res.json({ success: true, message: `Resend fully working — ${from} sends from verified domain ${fromDomain}` });
        }
        return res.json({
          success: false,
          message: `Resend key is valid but "${fromDomain}" is not a verified domain, so mail from ${from} will be refused. `
            + `Verify it at resend.com/domains (add the DKIM/SPF DNS records). Currently verified: ${verified.join(', ') || 'none'}.`,
        });
      }

      case 'stripe': {
        const apiKey = clean(k.stripe_secret_key || process.env.STRIPE_SECRET_KEY);
        if (!apiKey) return res.json({ success: false, message: 'Stripe secret key not set' });
        const r = await fetch('https://api.stripe.com/v1/account', { headers: { Authorization: `Bearer ${apiKey}` } });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) return res.json({ success: false, message: `Stripe key rejected (${r.status}): ${d.error?.message || 'invalid key'}` });
        const mode = /^sk_live_/.test(apiKey) ? 'LIVE' : /^sk_test_/.test(apiKey) ? 'TEST' : 'unknown';
        const webhookSet = !!clean(k.stripe_webhook_secret || process.env.STRIPE_WEBHOOK_SECRET);
        const bits = [`Stripe connected in ${mode} mode`, d.id ? `account ${d.id}` : null,
          d.charges_enabled === false ? 'charges NOT enabled yet' : null,
          webhookSet ? null : 'STRIPE_WEBHOOK_SECRET is missing, so subscription events will be ignored'].filter(Boolean);
        // Charges disabled or no webhook secret means billing does not actually
        // work end to end, so this is not a pass.
        const ok = d.charges_enabled !== false && webhookSet;
        return res.json({ success: ok, message: bits.join(' — ') });
      }

      // ─── OAuth-connected accounts ───────────────────────────────────────────
      //
      // No process.env fallback: these are per-company tokens minted by a real
      // person completing a consent flow.

      case 'meta':
      case 'facebook':
      case 'instagram': {
        const token = k.meta_access_token;
        if (!token) return res.json({ success: false, message: 'Meta is not connected. Run the Meta connect flow first.' });
        const r = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/me?fields=id,name&access_token=${encodeURIComponent(token)}`);
        const d = await r.json().catch(() => ({}));
        if (!r.ok || d.error) {
          return res.json({ success: false, message: d.error?.message || 'Meta token is invalid or expired. Please reconnect.' });
        }
        if (type === 'facebook' && !k.facebook_page_id) {
          return res.json({ success: false, message: `Meta token is valid (${d.name || d.id}) but no Facebook Page has been selected yet.` });
        }
        if (type === 'instagram' && !k.instagram_business_account_id) {
          return res.json({ success: false, message: `Meta token is valid (${d.name || d.id}) but no Instagram business account is linked yet.` });
        }
        return res.json({ success: true, message: `Meta connected${d.name ? `: ${d.name}` : ''}` });
      }

      case 'linkedin':
      case 'linkedin_social': {
        const token = k.linkedin_access_token;
        if (!token) return res.json({ success: false, message: 'LinkedIn is not connected. Run the LinkedIn connect flow first.' });
        const r = await fetch('https://api.linkedin.com/v2/userinfo', { headers: { Authorization: `Bearer ${token}` } });
        const d = await r.json().catch(() => ({}));
        if (r.ok && (d.sub || d.email)) {
          return res.json({ success: true, message: `LinkedIn connected${d.name ? `: ${d.name}` : ''}` });
        }
        return res.json({ success: false, message: d.message || 'LinkedIn token is invalid or expired. Please reconnect.' });
      }

      case 'twitter': {
        const token = k.twitter_access_token;
        if (!token) return res.json({ success: false, message: 'X/Twitter is not connected. Run the X connect flow first.' });
        const r = await fetch('https://api.twitter.com/2/users/me', { headers: { Authorization: `Bearer ${token}` } });
        const d = await r.json().catch(() => ({}));
        if (r.ok && d.data?.id) {
          return res.json({ success: true, message: `X/Twitter connected (@${d.data.username || d.data.id})` });
        }
        // Read works on far cheaper tiers than write, so a passing read test does
        // not prove posting will work. Say so rather than implying a full pass.
        const msg = d.detail || d.title || `HTTP ${r.status}`;
        if (r.status === 403) {
          return res.json({ success: false, message: `X token is valid but the API access tier forbids this call: ${msg}. Posting needs a paid tier.` });
        }
        return res.json({ success: false, message: `X/Twitter token invalid or expired: ${msg}` });
      }

      case 'tiktok':
      case 'tiktok_social': {
        const token = k.tiktok_access_token;
        if (!token) return res.json({ success: false, message: 'TikTok is not connected. Run the TikTok connect flow first.' });
        const r = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const d = await r.json().catch(() => ({}));
        if (r.ok && d.data?.user) {
          return res.json({ success: true, message: `TikTok connected${d.data.user.display_name ? `: ${d.data.user.display_name}` : ''}` });
        }
        return res.json({ success: false, message: d.error?.message || 'TikTok token is invalid or expired. Please reconnect.' });
      }

      case 'canva': {
        const token = k.canva_access_token;
        if (!token) return res.json({ success: false, message: 'Canva is not connected. Run the Canva connect flow first.' });
        const r = await fetch('https://api.canva.com/rest/v1/users/me', { headers: { Authorization: `Bearer ${token}` } });
        const d = await r.json().catch(() => ({}));
        if (r.ok && (d.team_user || d.user)) {
          return res.json({ success: true, message: 'Canva connected' });
        }
        return res.json({ success: false, message: d.message || 'Canva token is invalid or expired. Please reconnect.' });
      }

      // ─── Google properties ──────────────────────────────────────────────────
      //
      // All share one OAuth token; they differ only in which API must be enabled
      // in the Cloud project and which scope was granted, which is exactly what
      // googleErr() disambiguates.

      case 'google_analytics': {
        const { token, error: tokenErr } = await googleToken(req.companyId, k);
        if (!token) return res.json({ success: false, message: tokenErr });
        const r = await fetch('https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=1', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) return res.json({ success: false, message: googleErr(d, r, 'Google Analytics') });
        if (!k.google_analytics_property_id) {
          return res.json({ success: false, message: 'Google Analytics is reachable but no GA4 property has been selected yet.' });
        }
        return res.json({ success: true, message: 'Google Analytics connected' });
      }

      case 'google_search_console': {
        const { token, error: tokenErr } = await googleToken(req.companyId, k);
        if (!token) return res.json({ success: false, message: tokenErr });
        const r = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) return res.json({ success: false, message: googleErr(d, r, 'Search Console') });
        const sites = (d.siteEntry || []).map((s) => s.siteUrl);
        if (!sites.length) {
          return res.json({ success: false, message: 'Search Console is reachable but this Google account verifies no sites.' });
        }
        return res.json({ success: true, message: `Search Console connected (${sites.length} site(s))` });
      }

      case 'google_drive': {
        const dedicated = k.google_drive_token;
        const g = dedicated ? { token: dedicated } : await googleToken(req.companyId, k);
        const token = g.token;
        if (!token) return res.json({ success: false, message: g.error });
        const r = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const d = await r.json().catch(() => ({}));
        if (r.ok && d.user) return res.json({ success: true, message: `Google Drive connected (${d.user.emailAddress || 'ok'})` });
        return res.json({ success: false, message: googleErr(d, r, 'Google Drive') });
      }

      // Google Meet has no API of its own here — it is created as a conference on
      // a Calendar event, so the calendar scope is the thing to prove.
      case 'google_calendar':
      case 'google_meet': {
        const { token, error: tokenErr } = await googleToken(req.companyId, k);
        if (!token) return res.json({ success: false, message: tokenErr });
        const r = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const d = await r.json().catch(() => ({}));
        if (r.ok) {
          return res.json({
            success: true,
            message: type === 'google_meet' ? 'Google Meet ready (Calendar access confirmed)' : 'Google Calendar connected',
          });
        }
        return res.json({ success: false, message: googleErr(d, r, type === 'google_meet' ? 'Google Meet' : 'Google Calendar') });
      }

      case 'youtube': {
        const { token, error: tokenErr } = await googleToken(req.companyId, k);
        if (!token) return res.json({ success: false, message: tokenErr });
        const r = await fetch('https://www.googleapis.com/youtube/v3/channels?part=id&mine=true', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) return res.json({ success: false, message: googleErr(d, r, 'YouTube') });
        if (!d.items?.length) {
          return res.json({ success: false, message: 'YouTube is reachable but this Google account has no channel.' });
        }
        return res.json({ success: true, message: 'YouTube connected' });
      }

      default:
        return res.json({ success: false, message: `No test defined for integration type: ${type}` });
    }
  } catch (err) {
    sendServerError(res, err, '[integrations]', 'success');
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

    // Build query.
    //
    // Drive's `q` is a query LANGUAGE, and both values were interpolated into it
    // raw. A single quote closes the literal, so `mime_type` of
    //   x' or name contains 'a
    // escaped the image/PDF restriction entirely and turned this endpoint into a
    // browser for the whole connected Google account — spreadsheets, contracts,
    // anything — for any plain member.
    //
    // A quote is not escapable here in a way worth trusting, so a value containing
    // one is rejected rather than mangled, and mime_type is matched against a
    // fixed set instead of taken on faith.
    const ALLOWED_MIME = new Set([
      'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml', 'application/pdf',
    ]);

    const qParts = ['trashed=false'];
    if (mime_type) {
      if (!ALLOWED_MIME.has(String(mime_type))) {
        return res.status(400).json({ error: 'Unsupported file type filter.' });
      }
      qParts.push(`mimeType='${mime_type}'`);
    } else {
      qParts.push("(mimeType contains 'image/' or mimeType='application/pdf')");
    }
    if (query) {
      const term = String(query).replace(/['\\]/g, '').trim().slice(0, 120);
      if (term) qParts.push(`name contains '${term}'`);
    }
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
    sendServerError(res, err, '[integrations]');
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
    sendServerError(res, err, '[integrations]');
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
    sendServerError(res, err, '[integrations]');
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
    sendServerError(res, err, '[integrations]');
  }
});

export default router;

async function getGoogleAccessToken(companyId, keys) {
  const expiresAt = keys.google_token_expires_at ? new Date(keys.google_token_expires_at).getTime() : 0;
  if (keys.google_access_token && expiresAt > Date.now() + 60000) return keys.google_access_token;

  const refreshToken = keys.google_ads_refresh_token || keys.google_refresh_token;
  const clientId = keys.google_ads_client_id || keys.google_client_id || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = keys.google_ads_client_secret || keys.google_client_secret || process.env.GOOGLE_CLIENT_SECRET;
  if (!refreshToken || !clientId || !clientSecret) return keys.google_access_token || null;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  const tokens = await response.json();
  if (!response.ok || tokens.error || !tokens.access_token) {
    throw new Error(tokens.error_description || tokens.error || 'Google OAuth refresh failed');
  }
  const updatedKeys = {
    ...keys,
    google_access_token: tokens.access_token,
    google_token_expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
  };
  await supabaseAdmin.from('companies').update({ api_keys: updatedKeys }).eq('id', companyId);
  return tokens.access_token;
}
