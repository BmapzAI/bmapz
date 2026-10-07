import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { safeFetch } from '../lib/safeFetch.js';
import { sendServerError } from '../lib/httpError.js';
import { askPerplexity } from '../lib/perplexity.js';
import { getGoogleAccessToken } from '../lib/googleToken.js';
import { getXAccessToken, X_API_BASE } from '../lib/xApi.js';
import { getTikTokAccessToken } from '../lib/tiktokApi.js';
import { GOOGLE_ADS_API_VERSION, googleAdsHeaders, googleAdsApiError, googleAdsErrorMessage } from '../lib/googleAds.js';

const router = Router();
const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v25.0';
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
    // One Google token serves every Google service, so "has a token" does not mean a given
    // service is usable: the person can untick permissions in the consent dialog, and the
    // restricted ones (Gmail read, Drive) are off by default. google_scopes records what
    // Google actually granted. Legacy rows without it fall back to token presence.
    const gScopes = String(k.google_scopes || '');
    const gHas = (frag) => !!k.google_access_token && (!gScopes || gScopes.includes(frag));
    const detected = {
      // AI providers
      openai: !!(k.openai_api_key) || envHas('OPENAI_API_KEY'),
      anthropic: !!(k.anthropic_api_key) || envHas('ANTHROPIC_API_KEY'),
      stability: !!(k.stability_api_key) || envHas('STABILITY_API_KEY'),
      perplexity: !!(k.perplexity_api_key) || envHas('PERPLEXITY_API_KEY'),
      // Billing
      stripe: envHas('STRIPE_SECRET_KEY'),
      // Google
      gmail: gHas('gmail'),
      google_analytics: gHas('analytics') && !!k.google_analytics_property_id,
      google_search_console: gHas('webmasters') && !!k.google_search_console_url,
      google_ads: gHas('adwords') && !!k.google_ads_customer_id,
      google_drive: gHas('auth/drive'),
      youtube: gHas('youtube'),
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
      // The Integrations page asks for `tiktok_social`, not `tiktok`, so the card
      // could never light up however successful the OAuth connect was.
      tiktok_social: !!(k.tiktok_access_token),
      tiktok_ads: !!(k.tiktok_access_token && k.tiktok_advertiser_id),
      canva: !!(k.canva_access_token),
      // Messaging
      whatsapp: !!((k.whatsapp_api_token || k.whatsapp_access_token || envHas('WHATSAPP_ACCESS_TOKEN'))
        && (k.whatsapp_phone_id || envHas('WHATSAPP_PHONE_NUMBER_ID'))),
      // Email
      email_smtp: !!(k.smtp_host && k.smtp_user),
      email_resend: !!(k.resend_api_key) || envHas('RESEND_API_KEY'),
      // Prospecting
      // Apollo is PER-COMPANY ONLY (no platform key): see the note at the apollo test case.
      apollo: !!(k.apollo_api_key),
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
      google_calendar: gHas('calendar'),
      cal_com: !!(k.cal_com_api_key),
      chilipiper: !!(k.chilipiper_api_key && k.chilipiper_tenant),

      // These all have storable credentials in the companies.js allowlist and a
      // card on the Integrations page, but were never reported here — so a user
      // could save the key, see it persist, and still be told "not connected"
      // with nothing to do about it. Each requires what the API actually needs to
      // work, not merely a key being present.
      mailchimp: !!(k.mailchimp_api_key),
      klaviyo: !!(k.klaviyo_api_key),
      activecampaign: !!(k.activecampaign_api_url && k.activecampaign_api_key),
      brevo: !!(k.brevo_api_key),
      convertkit: !!(k.convertkit_api_key),
      mailerlite: !!(k.mailerlite_api_key),
      lemlist: !!(k.lemlist_api_key),
      intercom: !!(k.intercom_access_token),
      segment: !!(k.segment_write_key),
      mixpanel: !!(k.mixpanel_project_token),
      jasper: !!(k.jasper_api_key),
      loom: !!(k.loom_api_key),
      demio: !!(k.demio_api_key),
      webflow: !!(k.webflow_api_token),
      shopify: !!(k.shopify_store_url && k.shopify_admin_token),
      hotjar: !!(k.hotjar_site_id && k.hotjar_api_token),
      zoom: !!(k.zoom_account_id && k.zoom_client_id && k.zoom_client_secret),
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

    // Provider-level state for the OAuth popup. The per-service flags above stay FALSE after a successful sign-in until a
    // property or account is chosen (Analytics needs a property id, Meta Ads an ad account), so the connect dialog could
    // not use them to tell "signed in" from "never finished". The stamp is each token's expiry time, which changes on every
    // new sign-in, so a re-consent of an already-connected provider is told apart from a cancelled one.
    const oauth_connected = {
      google: !!k.google_access_token,
      meta: !!k.meta_access_token,
      linkedin: !!k.linkedin_access_token,
      twitter: !!k.twitter_access_token,
      tiktok: !!k.tiktok_access_token,
      canva: !!k.canva_access_token,
    };
    const oauth_stamp = {
      google: k.google_token_expires_at || null,
      meta: k.meta_token_expires_at || null,
      linkedin: k.linkedin_token_expires_at || null,
      twitter: k.twitter_token_expires_at || null,
      tiktok: k.tiktok_token_expires_at || null,
      canva: k.canva_token_expires_at || null,
    };

    res.json({
      status: merged,
      oauth_connected,
      oauth_stamp,
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
        // The model is chosen from THIS account's live model list instead of being
        // hard-coded: a retired id would make this report failure for a valid key.
        const listed = await modelsResp.json().catch(() => ({}));
        const ids = new Set((listed.data || []).map((m) => m.id));
        const testModel = ['gpt-5-nano', 'gpt-5-mini', 'gpt-4.1-mini', 'gpt-4o-mini'].find((m) => ids.has(m));
        if (!testModel) return res.json({ success: true, message: 'OpenAI key is valid (could not pick a cheap chat model from the account list, so billing was not exercised)' });
        const completionResp = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: testModel, messages: [{ role: 'user', content: 'ping' }], max_completion_tokens: 16 }),
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
        // Model comes from the account's own live list (cheapest family first). The
        // old hard-coded claude-3-5-sonnet-20241022 has been retired, which made this
        // report 'completion failed' for a perfectly valid, funded key.
        const listed = await modelsResp.json().catch(() => ({}));
        const mids = (listed.data || []).map((m) => m.id).filter(Boolean);
        const testModel = mids.find((m) => /haiku/i.test(m)) || mids[0];
        if (!testModel) return res.json({ success: true, message: 'Anthropic key is valid (the account lists no models, so credits were not exercised)' });
        const completionResp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: testModel, messages: [{ role: 'user', content: 'ping' }], max_tokens: 16 }),
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
        // Same key chain as generation (ai.js) and the status list, so an env-only deployment is not told "not set".
        const apiKey = clean(k.stability_api_key || process.env.STABILITY_API_KEY);
        if (!apiKey) return res.json({ success: false, message: 'Stability AI key not set' });
        // /v1/user/account succeeds for a valid key with ZERO credits, so it reported "connected" for an
        // account that cannot generate a single image. The balance endpoint answers the question that matters.
        const r = await fetch('https://api.stability.ai/v1/user/balance', {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(20000),
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) return res.json({ success: false, message: `Stability AI key rejected (${r.status}): ${d.message || d.name || 'invalid key'}` });
        if (!(Number(d.credits) > 0)) {
          return res.json({ success: false, message: 'Stability AI key is valid but the account has no credits, so image generation will fail. Buy credits at platform.stability.ai (signing up with the Google button gives free credits).' });
        }
        return res.json({ success: true, message: `Stability AI connected (${Number(d.credits).toFixed(1)} credits)` });
      }

      // Apollo's health endpoint answers HTTP 200 even with NO key and with a
      // garbage key — verified live, both return {"healthy":true,"is_logged_in":false}.
      // `healthy` describes APOLLO, not your credentials. The old check was
      // `if (r.ok)`, so this test reported "connected" for an account with no key
      // configured at all. `is_logged_in` is the field that actually reflects the key.
      case 'apollo': {
        // PER-COMPANY KEY ONLY, deliberately - there is no APOLLO_API_KEY platform fallback. Apollo's developer
        // FAQ says an integration whose purpose is sharing, exposing or reselling Apollo data to people who are
        // not Apollo customers needs a custom data-licensing contract with Apollo Partnerships. One platform key
        // serving every Bmapz tenant is exactly that. Each company brings its own Apollo account, so its own
        // licence covers its own lookups. Restore the fallback only once such a contract exists.
        const apiKey = clean(k.apollo_api_key);
        if (!apiKey) return res.json({ success: false, message: 'Apollo is not connected. Each company connects its own Apollo API key (Apollo > Settings > Integrations > API Keys).' });
        const r = await fetch('https://api.apollo.io/api/v1/auth/health', {
          headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(20000),
        });
        const d = await r.json().catch(() => ({}));
        if (r.ok && d.is_logged_in === true) return res.json({ success: true, message: 'Apollo.io connected' });
        if (r.ok && d.is_logged_in === false) {
          return res.json({
            success: false,
            message: 'Apollo rejected the key. Check it is correct, and that it was created as a master key '
              + '(a scoped key only works on the endpoints selected when it was made). The key goes in an x-api-key header, not Bearer.',
          });
        }
        return res.json({ success: false, message: `Apollo key invalid or not authorized (HTTP ${r.status})` });
      }

      case 'hunter': {
        const apiKey = clean(k.hunter_api_key || process.env.HUNTER_API_KEY);
        if (!apiKey) return res.json({ success: false, message: 'Hunter API key not set' });
        // Header, not ?api_key=: query strings end up in proxy and access logs. Probed: no key, a garbage
        // query key, a garbage header and a garbage Bearer all answer 401, so the header form is safe.
        const r = await fetch('https://api.hunter.io/v2/account', { headers: { 'X-API-KEY': apiKey }, signal: AbortSignal.timeout(20000) });
        const d = await r.json().catch(() => ({}));
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

      // Resolved in the SAME order the sending code uses (sdrEngine, workflowEngine,
      // email.js). Testing a different chain would pass while real sends fail — or
      // worse, pass while sends silently go out from the platform's number instead
      // of the company's, which is exactly what the mismatched key name caused.
      case 'whatsapp': {
        const token = clean(k.whatsapp_api_token || k.whatsapp_access_token || process.env.WHATSAPP_ACCESS_TOKEN);
        const phoneId = clean(k.whatsapp_phone_id || process.env.WHATSAPP_PHONE_NUMBER_ID);
        if (!token || !phoneId) {
          return res.json({ success: false, message: 'WhatsApp needs an access token and a Phone Number ID.' });
        }
        const usingPlatform = !k.whatsapp_api_token && !k.whatsapp_access_token;
        const r = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${phoneId}?fields=display_phone_number,verified_name`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const d = await r.json().catch(() => ({}));
        if (r.ok && !d.error) {
          const who = d.display_phone_number ? ` (${d.display_phone_number})` : '';
          return res.json({
            success: true,
            message: `WhatsApp Business connected${who}${usingPlatform ? ' — using the platform number, not one of yours' : ''}`,
          });
        }
        return res.json({ success: false, message: d.error?.message || 'WhatsApp credentials invalid' });
      }

      // This used to return success for "credentials present" without ever calling
      // Google, so an expired or revoked token reported as connected — the exact
      // failure a test exists to catch. It now makes a real call.
      case 'gmail': {
        // OAuth only. A manual client-id + refresh-token pair used to be accepted here, but
        // the shared token refresher never read those keys, so that path could only fail.
        if (!k.google_access_token && !k.google_refresh_token) {
          return res.json({ success: false, message: 'Gmail is not connected. Use Connect to sign in with Google.' });
        }
        const { token, error: tokenErr } = await googleToken(req.companyId, k);
        if (!token) return res.json({ success: false, message: tokenErr });
        const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const d = await r.json().catch(() => ({}));
        if (r.ok && d.emailAddress) {
          // Connected is not the same as able to do the job. Sending is the Gmail feature that
          // ships by default, and the person can untick it in the consent dialog.
          const granted = String(k.google_scopes || '');
          if (granted && !granted.includes('gmail.send')) {
            return res.json({ success: false, message: `Gmail is connected (${d.emailAddress}) but the permission to SEND email was not granted. Disconnect and reconnect, and leave every box ticked.` });
          }
          const canRead = !granted || granted.includes('gmail.readonly');
          return res.json({ success: true, message: `Gmail connected (${d.emailAddress})${canRead ? '' : ' - sending works; inbox sync needs a restricted Google permission that is not enabled yet'}` });
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
        // Ads Manager shows the id as act_123..., and publishing normalises that prefix; this test did
        // not, so it called act_act_123 and failed for an account that publishing would have used fine.
        const acct = String(accountId).startsWith('act_') ? String(accountId) : `act_${accountId}`;
        const r = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${acct}?fields=id,name,account_status`, {
          headers: { Authorization: `Bearer ${token}` },   // header, not ?access_token= (URLs get logged)
        });
        const d = await r.json().catch(() => ({}));
        if (r.ok && !d.error && d.account_status !== undefined && d.account_status !== 1) {
          return res.json({ success: false, message: `Meta ad account ${d.name || acct} is reachable but not ACTIVE (status ${d.account_status}). Ads cannot run on it until that is resolved in Ads Manager.` });
        }
        if (r.ok && !d.error) return res.json({ success: true, message: `Meta Ads connected${d.name ? `: ${d.name}` : ''}` });
        return res.json({ success: false, message: d.error?.message || 'Meta token or ad account is invalid. Please reconnect.' });
      }

      case 'google_ads': {
        const customerId = String(k.google_ads_customer_id || '').replace(/-/g, '');
        // Named individually: "requires Developer Token, Customer ID, and a
        // connected OAuth token" left the person guessing which of the three was
        // missing, and they are obtained in three completely different places.
        // NOT required any more — Google sunset developer tokens on 2026-09-09 and
        // the header is "optional and ignored by the API servers". Access now comes
        // from the Cloud project's Google Ads API access level. Requiring it here
        // would fail every new setup for a credential that cannot be obtained.
        if (!customerId) return res.json({ success: false, message: 'Google Ads is missing the Customer ID (the 10-digit number at the top right of the Google Ads UI).' });
        const { token, error: tokenErr } = await googleToken(req.companyId, k);
        if (!token) return res.json({ success: false, message: tokenErr });
        const r = await fetch(`https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}/googleAds:searchStream`, {
          method: 'POST',
          headers: googleAdsHeaders({ token, keys: k }),
          body: JSON.stringify({ query: 'SELECT customer.id FROM customer LIMIT 1' }),
        });
        const d = await r.json().catch(() => ({}));
        if (r.ok && !googleAdsApiError(d)) return res.json({ success: true, message: 'Google Ads live API connection confirmed' });
        // searchStream failures are an ARRAY, so d.error was undefined and this said "HTTP 403"
        // instead of the real reason (USER_PERMISSION_DENIED, CUSTOMER_NOT_FOUND, ...).
        const gmsg = googleAdsErrorMessage(d, r.status);
        // The defining failure since developer tokens went away: a brand-new Cloud
        // project gets Test access automatically, which reaches Google Ads TEST
        // accounts only. Pointing it at a real advertiser fails here, and the raw
        // message does not say what to do about it.
        if (/CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION|ACTION_NOT_PERMITTED/i.test(JSON.stringify(d))) {
          return res.json({
            success: false,
            message: 'Your Google Cloud project only has Test access to the Google Ads API, which reaches test accounts '
              + 'only. Apply for Explorer access from the Google Ads API page in Cloud Console to use a real advertiser account. '
              + `(Google said: ${gmsg})`,
          });
        }
        return res.json({ success: false, message: `Google Ads rejected the connection: ${gmsg}` });
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
        // campaign/get is documented as a GET with query parameters (this POSTed a JSON body).
        const qs = new URLSearchParams({ advertiser_id: String(advertiserId), page: '1', page_size: '1' });
        const r = await fetch(`https://business-api.tiktok.com/open_api/v1.3/campaign/get/?${qs}`, { headers: { 'Access-Token': token } });
        const d = await r.json().catch(() => ({}));
        // Failure arrives as HTTP 200 with a non-zero code (40104 no token, 40105 invalid token), so
        // r.ok alone would be a false positive - success is code === 0.
        if (r.ok && d.code === 0) return res.json({ success: true, message: 'TikTok Ads live API connection confirmed' });
        if (Number(d.code) >= 40100 && Number(d.code) <= 40105) {
          return res.json({
            success: false,
            message: 'TikTok Ads rejected the credential. The token stored here comes from TikTok LOGIN (open.tiktokapis.com) and cannot '
              + 'access advertising: the TikTok Business API is a separate program with its own app and its own connect flow, which '
              + 'is not built yet. See AGENT_HANDOFF.md. (TikTok said: ' + (d.message || d.code) + ')',
          });
        }
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
        // Calls askPerplexity() — the SAME function lib/webSearch.js uses — so this
        // proves the path search actually takes, and `surface` reports which API
        // answered (the Agent API, or the retired Sonar path as a fallback). That is
        // direct evidence on the one question the docs contradict each other on.
        try {
          const out = await askPerplexity({ key: apiKey, query: 'Reply with the single word: ok', maxTokens: 256, timeoutMs: 20000 });
          const via = out.surface === 'agent' ? 'the Agent API' : 'the legacy Sonar endpoint (retired 2026-09-27 — still answering, but plan to rely on the Agent API)';
          return res.json({ success: true, message: `Perplexity connected via ${via} (web search will work)` });
        } catch (e) {
          const msg = String(e.message || '');
          // Perplexity answers 401 for an invalid or deleted key AND for an account with no credit, so the
          // status alone cannot tell them apart; say both. 429 is a rate limit (the key is fine).
          if (e.status === 429) return res.json({ success: false, message: `Perplexity rate limit hit (the key is valid; retry shortly): ${msg}` });
          if (e.status === 401) return res.json({ success: false, message: `Perplexity rejected the key: it is invalid or deleted, OR the account has no credit (prepaid credits must be bought first). ${msg}` });
          if (e.status === 402 || /credit|balance|quota/i.test(msg)) {
            return res.json({ success: false, message: `Perplexity account has no usable credit (prepaid credits must be bought first): ${msg}` });
          }
          return res.json({ success: false, message: `Perplexity call failed: ${msg}` });
        }
      }

      case 'resend':
      case 'email_resend': {
        const apiKey = clean(k.resend_api_key || process.env.RESEND_API_KEY);
        if (!apiKey) return res.json({ success: false, message: 'Resend API key not set' });
        // limit=100: the default page is 20 domains, so a team with more could be told a verified domain is not.
        const r = await fetch('https://api.resend.com/domains?limit=100', { headers: { Authorization: `Bearer ${apiKey}` } });
        const d = await r.json().catch(() => ({}));
        // A sending-only key can send but cannot LIST domains, so it answers restricted_api_key. That is a
        // valid key, not a rejected one - reporting it as rejected would push people off the safer key type.
        if (!r.ok && d.name === 'restricted_api_key') {
          return res.json({ success: true, message: 'Resend sending-only key accepted. Domain status cannot be read with this key type; send a test email to confirm the From address works.' });
        }
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

      // PLATFORM ONLY, deliberately. billing.js reads process.env.STRIPE_SECRET_KEY
      // and nothing else, and a company-settable Stripe key would mean a tenant
      // could point Bmapz's own subscription billing at an account it controls.
      // So this reads the platform key and no per-company override exists.
      case 'stripe': {
        const apiKey = clean(process.env.STRIPE_SECRET_KEY);
        if (!apiKey) return res.json({ success: false, message: 'Stripe secret key not set' });
        const r = await fetch('https://api.stripe.com/v1/account', { headers: { Authorization: `Bearer ${apiKey}` } });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) return res.json({ success: false, message: `Stripe key rejected (${r.status}): ${d.error?.message || 'invalid key'}` });
        const mode = /^sk_live_/.test(apiKey) ? 'LIVE' : /^sk_test_/.test(apiKey) ? 'TEST' : 'unknown';
        // "Any non-empty value" passed a mistyped secret; Stripe signing secrets start with whsec_.
        const webhookSet = /^whsec_/.test(clean(process.env.STRIPE_WEBHOOK_SECRET));
        // A valid key plus a webhook secret still cannot take money if checkout has no price to charge: it
        // answers 400 "price_id is required". Check the per-plan price ids the checkout route resolves.
        const missingPrices = ['STARTER', 'GROWTH', 'SCALE'].filter((p) =>
          !(process.env[`STRIPE_PRICE_ID_${p}_MONTHLY`] || process.env[`STRIPE_PRICE_ID_${p}`]));
        const bits = [`Stripe connected in ${mode} mode`, d.id ? `account ${d.id}` : null,
          d.charges_enabled === false ? 'charges NOT enabled yet' : null,
          webhookSet ? null : 'STRIPE_WEBHOOK_SECRET is missing or is not a whsec_ signing secret, so subscription events will be rejected',
          missingPrices.length ? `no price id for: ${missingPrices.join(', ')} (set STRIPE_PRICE_ID_<PLAN>_MONTHLY), so checkout will fail` : null].filter(Boolean);
        // Charges disabled, no webhook secret or no prices means billing does not actually work end to end.
        const ok = d.charges_enabled !== false && webhookSet && missingPrices.length === 0;
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
          // Connected is not the same as able to POST: connecting LinkedIn Ads used to replace this
          // token with one that has no w_member_social, leaving a green card that 403s on every post.
          const granted = String(k.linkedin_scopes || '');
          if (granted && !granted.includes('w_member_social')) {
            return res.json({ success: false, message: `LinkedIn is connected${d.name ? ` (${d.name})` : ''} but the permission to POST was not granted. Disconnect and reconnect LinkedIn.` });
          }
          return res.json({ success: true, message: `LinkedIn connected${d.name ? `: ${d.name}` : ''}` });
        }
        return res.json({ success: false, message: d.message || 'LinkedIn token is invalid or expired. Please reconnect.' });
      }

      case 'twitter': {
        if (!k.twitter_access_token && !k.twitter_refresh_token) {
          return res.json({ success: false, message: 'X/Twitter is not connected. Run the X connect flow first.' });
        }
        // X access tokens last ~2 hours, so refresh first or this reports "expired" for a grant that is fine.
        let token;
        try {
          token = await getXAccessToken(req.companyId, k);
        } catch (e) {
          return res.json({ success: false, message: `X refused to refresh the token (${e.message}). Disconnect and reconnect X.` });
        }
        if (!token) return res.json({ success: false, message: 'X/Twitter is not connected. Run the X connect flow first.' });
        const r = await fetch(`${X_API_BASE}/2/users/me`, { headers: { Authorization: `Bearer ${token}` } });
        const d = await r.json().catch(() => ({}));
        if (r.ok && d.data?.id) {
          // A read passing does not prove POSTING works: posting is billed per request from prepaid credits.
          return res.json({ success: true, message: `X/Twitter connected (@${d.data.username || d.data.id}). Posting is pay-per-use, so it also needs credits on the X developer account.` });
        }
        const msg = d.detail || d.title || `HTTP ${r.status}`;
        // A garbage or expired token comes back as 403 "Unsupported Authentication", which is NOT
        // an access-tier problem. The old wording blamed the plan for a bad token.
        if (r.status === 401 || String(d.type || '').includes('unsupported-authentication')) {
          return res.json({ success: false, message: `X token is invalid or expired (${msg}). Please reconnect.` });
        }
        if (r.status === 402 || /credit/i.test(msg)) {
          return res.json({ success: false, message: `The X developer account has no API credits (${msg}). Add credits in the X developer console.` });
        }
        return res.json({ success: false, message: `X rejected the call (${msg}). Check the X app is in a project with credits and has the tweet.read, tweet.write and users.read permissions.` });
      }

      case 'tiktok':
      case 'tiktok_social': {
        if (!k.tiktok_access_token && !k.tiktok_refresh_token) {
          return res.json({ success: false, message: 'TikTok is not connected. Run the TikTok connect flow first.' });
        }
        // TikTok access tokens last 24 hours: refresh first, or this reports "expired" a day after a good connect.
        let token;
        try {
          token = await getTikTokAccessToken(req.companyId, k);
        } catch (e) {
          return res.json({ success: false, message: `TikTok refused to refresh the token (${e.message}). Disconnect and reconnect TikTok.` });
        }
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
        const granted = String(k.google_scopes || '');
        if (granted && !granted.includes('auth/drive')) {
          return res.json({ success: false, message: 'Google Drive access was not granted. Drive browsing needs a restricted Google permission that is not enabled in this release.' });
        }
        const { token, error: tokenErr } = await googleToken(req.companyId, k);
        if (!token) return res.json({ success: false, message: tokenErr });
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

    let token = null;
    try {
      token = await getGoogleAccessToken(req.companyId, company);
    } catch {
      return res.status(401).json({ error: 'Google needs to be reconnected.' });
    }
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
    let gaToken;
    try {
      gaToken = await getGoogleAccessToken(req.companyId, company);
    } catch {
      return res.json({ error: 'Google needs to be reconnected.' });
    }

    const r = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${company.google_analytics_property_id}:runReport`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${gaToken}`,
        'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateRanges: [{ startDate, endDate }],
          metrics: [
            // GA4 Data API metric names. 'users' and 'pageviews' (Universal Analytics names)
            // do not exist: every request failed with an invalid-metric error. Same order as before.
            { name: 'sessions' },
            { name: 'totalUsers' },
            { name: 'screenPageViews' },
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

    // Per-company key only (no platform fallback): see the apollo case in the test switch above.
    const apiKey = clean(companyRow?.api_keys?.apollo_api_key);
    if (!apiKey) return res.status(400).json({ error: 'Apollo is not connected for this company. Add your own Apollo API key in Integrations.' });
    if (!email && !domain) return res.status(400).json({ error: 'email or domain is required' });

    // Apollo's People Enrichment page documents these as QUERY parameters (they were sent in a JSON body,
    // which a garbage-key probe cannot tell apart). reveal_personal_emails used to be hard-coded true:
    // it spends extra credits and exposes people's PERSONAL addresses on every call, so it is opt-in now.
    const qs = new URLSearchParams(Object.entries({
      email, domain, ...(req.body.reveal_personal_emails === true ? { reveal_personal_emails: 'true' } : {}),
    }).filter(([, v]) => v));
    const r = await fetch(`https://api.apollo.io/api/v1/people/match?${qs}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      signal: AbortSignal.timeout(20000),
    });
    const d = await r.json().catch(() => ({}));
    // Apollo removes the legacy root-level error fields (error, error_code, message) on 2027-02-16 and keeps
    // only error_details. Answer in OUR shape so nothing downstream depends on theirs. A 401/422 from Apollo is
    // a problem with the stored key, not with the caller's request, so it is not passed through as one.
    if (!r.ok) {
      return res.status(r.status === 401 || r.status === 422 ? 502 : r.status)
        .json({ error: d.error_details?.message || d.error || 'Apollo request failed', code: d.error_details?.code || null });
    }
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

    // URLSearchParams turns a missing field into the literal string "undefined", so a request without a
    // first name queried Hunter for a person called "undefined" and could spend a lookup.
    if (!domain || !first_name || !last_name) return res.status(400).json({ error: 'domain, first_name and last_name are required' });
    const params = new URLSearchParams({ domain, first_name, last_name });
    const r = await fetch(`https://api.hunter.io/v2/email-finder?${params}`, {
      headers: { 'X-API-KEY': clean(apiKey) },
      signal: AbortSignal.timeout(20000),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(r.status === 401 ? 502 : r.status).json({ error: d.errors?.[0]?.details || 'Hunter request failed', code: d.errors?.[0]?.id || null });
    res.json(d);
  } catch (err) {
    sendServerError(res, err, '[integrations]');
  }
});

export default router;
