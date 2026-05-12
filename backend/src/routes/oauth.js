import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';

const router = Router();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const API_URL = process.env.API_URL || 'http://localhost:3001';

// ─── Google OAuth ─────────────────────────────────────────────────────────────

const GOOGLE_SCOPES_MAP = {
  google_ads: [
    'https://www.googleapis.com/auth/adwords',
    'https://www.googleapis.com/auth/userinfo.email',
  ],
  google_analytics: [
    'https://www.googleapis.com/auth/analytics.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
  ],
  google_search_console: [
    'https://www.googleapis.com/auth/webmasters.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
  ],
  google_calendar: [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/userinfo.email',
  ],
  google_meet: [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/userinfo.email',
  ],
  youtube: [
    'https://www.googleapis.com/auth/youtube.readonly',
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/userinfo.email',
  ],
  google_drive: [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
  ],
  gmail: [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.compose',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ],
};

// GET /api/oauth/google/initiate?type=gmail&userId=...&origin=...
router.get('/google/initiate', requireAuth, async (req, res) => {
  try {
    const { type = 'gmail', origin } = req.query;
    const { data: company } = await supabaseAdmin
      .from('companies')
      .select('google_client_id')
      .eq('id', req.companyId)
      .single();

    const clientId = company?.google_client_id || process.env.GOOGLE_CLIENT_ID;
    if (!clientId) return res.status(400).json({ error: 'Google Client ID not configured' });

    const scopes = GOOGLE_SCOPES_MAP[type] || GOOGLE_SCOPES_MAP.gmail;
    const state = Buffer.from(JSON.stringify({
      userId: req.dbUser.id,
      companyId: req.companyId,
      integrationType: type,
      origin: origin || FRONTEND_URL,
    })).toString('base64url');

    const redirectUri = `${API_URL}/api/oauth/google/callback`;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/oauth/google/callback
router.get('/google/callback', async (req, res) => {
  try {
    const { code, state, error: oauthError } = req.query;

    if (oauthError) {
      return res.send(popupHtml('error', 'Google', oauthError));
    }

    const stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
    const { companyId, integrationType } = stateData;

    // Get company credentials
    const { data: company } = await supabaseAdmin
      .from('companies')
      .select('google_client_id, google_client_secret')
      .eq('id', companyId)
      .single();

    const clientId = company?.google_client_id || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = company?.google_client_secret || process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = `${API_URL}/api/oauth/google/callback`;

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
    });
    const tokens = await tokenResponse.json();

    if (tokens.error) return res.send(popupHtml('error', 'Google', tokens.error_description || tokens.error));

    // Get user email from Google
    const userInfoResp = await fetch(`https://www.googleapis.com/oauth2/v2/userinfo?access_token=${tokens.access_token}`);
    const userInfo = await userInfoResp.json();

    // Build update object based on integration type
    const updates = {
      integration_status: { ...{}, [integrationType]: 'connected' },
    };

    if (integrationType === 'google_drive') {
      updates.google_drive_token = tokens.access_token;
    } else if (integrationType === 'gmail') {
      updates.google_access_token = tokens.access_token;
      updates.google_refresh_token = tokens.refresh_token;
      updates.google_token_expires_at = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
      updates.google_connected_email = userInfo.email;
    } else {
      updates.google_access_token = tokens.access_token;
      updates.google_refresh_token = tokens.refresh_token;
      updates.google_token_expires_at = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
      updates.google_connected_email = userInfo.email;
    }

    // Save tokens
    const { data: existingCompany } = await supabaseAdmin
      .from('companies')
      .select('integration_status')
      .eq('id', companyId)
      .single();

    const mergedStatus = { ...(existingCompany?.integration_status || {}), [integrationType]: 'connected' };
    await supabaseAdmin
      .from('companies')
      .update({ ...updates, integration_status: mergedStatus })
      .eq('id', companyId);

    res.send(popupHtml('success', 'Google', null, integrationType));
  } catch (err) {
    console.error('[google callback]', err);
    res.send(popupHtml('error', 'Google', err.message));
  }
});

// ─── Meta (Facebook/Instagram) OAuth ─────────────────────────────────────────

router.get('/meta/initiate', requireAuth, async (req, res) => {
  try {
    const { type = 'meta', origin } = req.query;
    const { data: company } = await supabaseAdmin
      .from('companies')
      .select('meta_app_id')
      .eq('id', req.companyId)
      .single();

    const appId = company?.meta_app_id || process.env.META_APP_ID;
    if (!appId) return res.status(400).json({ error: 'Meta App ID not configured' });

    const state = Buffer.from(JSON.stringify({
      userId: req.dbUser.id,
      companyId: req.companyId,
      integrationType: type,
      origin: origin || FRONTEND_URL,
    })).toString('base64url');

    const scopes = 'email,pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish,ads_management,ads_read,business_management';
    const redirectUri = `${API_URL}/api/oauth/meta/callback`;
    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      scope: scopes,
      response_type: 'code',
      state,
    });

    res.redirect(`https://www.facebook.com/v19.0/dialog/oauth?${params}`);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/meta/callback', async (req, res) => {
  try {
    const { code, state, error: oauthError } = req.query;
    if (oauthError) return res.send(popupHtml('error', 'Meta', oauthError));

    const stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
    const { companyId } = stateData;

    const { data: company } = await supabaseAdmin
      .from('companies')
      .select('meta_app_id, meta_app_secret, integration_status')
      .eq('id', companyId)
      .single();

    const appId = company?.meta_app_id || process.env.META_APP_ID;
    const appSecret = company?.meta_app_secret || process.env.META_APP_SECRET;
    const redirectUri = `${API_URL}/api/oauth/meta/callback`;

    // Exchange code for token
    const tokenResp = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`
    );
    const tokens = await tokenResp.json();
    if (tokens.error) return res.send(popupHtml('error', 'Meta', tokens.error.message));

    // Get long-lived token
    const llResp = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${tokens.access_token}`
    );
    const llTokens = await llResp.json();
    const accessToken = llTokens.access_token || tokens.access_token;
    const expiresIn = llTokens.expires_in || tokens.expires_in || 5184000;

    // Fetch FB pages
    const pagesResp = await fetch(`https://graph.facebook.com/v19.0/me/accounts?access_token=${accessToken}`);
    const pagesData = await pagesResp.json();
    const page = pagesData.data?.[0];

    // Fetch Instagram Business Account
    let igAccountId = null;
    if (page) {
      const igResp = await fetch(
        `https://graph.facebook.com/v19.0/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`
      );
      const igData = await igResp.json();
      igAccountId = igData.instagram_business_account?.id;
    }

    const mergedStatus = {
      ...(company?.integration_status || {}),
      meta: 'connected',
      facebook: 'connected',
      ...(igAccountId ? { instagram: 'connected' } : {}),
    };

    await supabaseAdmin.from('companies').update({
      meta_access_token: accessToken,
      meta_token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
      facebook_page_id: page?.id || null,
      facebook_page_access_token: page?.access_token || null,
      instagram_business_account_id: igAccountId,
      integration_status: mergedStatus,
    }).eq('id', companyId);

    res.send(popupHtml('success', 'Meta'));
  } catch (err) {
    console.error('[meta callback]', err);
    res.send(popupHtml('error', 'Meta', err.message));
  }
});

// ─── LinkedIn OAuth ───────────────────────────────────────────────────────────

router.get('/linkedin/initiate', requireAuth, async (req, res) => {
  try {
    const { data: company } = await supabaseAdmin
      .from('companies')
      .select('linkedin_client_id')
      .eq('id', req.companyId)
      .single();

    const clientId = company?.linkedin_client_id || process.env.LINKEDIN_CLIENT_ID;
    if (!clientId) return res.status(400).json({ error: 'LinkedIn Client ID not configured' });

    const state = Buffer.from(JSON.stringify({ companyId: req.companyId })).toString('base64url');
    const redirectUri = `${API_URL}/api/oauth/linkedin/callback`;
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      scope: 'openid profile email w_member_social r_liteprofile r_emailaddress',
    });

    res.redirect(`https://www.linkedin.com/oauth/v2/authorization?${params}`);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/linkedin/callback', async (req, res) => {
  try {
    const { code, state, error: oauthError } = req.query;
    if (oauthError) return res.send(popupHtml('error', 'LinkedIn', oauthError));

    const { companyId } = JSON.parse(Buffer.from(state, 'base64url').toString());
    const { data: company } = await supabaseAdmin
      .from('companies')
      .select('linkedin_client_id, linkedin_client_secret, integration_status')
      .eq('id', companyId)
      .single();

    const clientId = company?.linkedin_client_id || process.env.LINKEDIN_CLIENT_ID;
    const clientSecret = company?.linkedin_client_secret || process.env.LINKEDIN_CLIENT_SECRET;
    const redirectUri = `${API_URL}/api/oauth/linkedin/callback`;

    const tokenResp = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri, client_id: clientId, client_secret: clientSecret }),
    });
    const tokens = await tokenResp.json();
    if (tokens.error) return res.send(popupHtml('error', 'LinkedIn', tokens.error_description));

    const mergedStatus = { ...(company?.integration_status || {}), linkedin: 'connected' };
    await supabaseAdmin.from('companies').update({
      linkedin_access_token: tokens.access_token,
      linkedin_token_expires_at: new Date(Date.now() + (tokens.expires_in || 5184000) * 1000).toISOString(),
      integration_status: mergedStatus,
    }).eq('id', companyId);

    res.send(popupHtml('success', 'LinkedIn'));
  } catch (err) {
    res.send(popupHtml('error', 'LinkedIn', err.message));
  }
});

// ─── Twitter/X OAuth ──────────────────────────────────────────────────────────

router.get('/twitter/initiate', requireAuth, async (req, res) => {
  try {
    const { data: company } = await supabaseAdmin
      .from('companies')
      .select('twitter_client_id')
      .eq('id', req.companyId)
      .single();

    const clientId = company?.twitter_client_id || process.env.TWITTER_CLIENT_ID;
    if (!clientId) return res.status(400).json({ error: 'Twitter Client ID not configured' });

    const state = Buffer.from(JSON.stringify({ companyId: req.companyId })).toString('base64url');
    const codeVerifier = Buffer.from(crypto.randomUUID()).toString('base64url');
    const codeChallenge = codeVerifier; // plain for simplicity (use SHA-256 in production)

    const redirectUri = `${API_URL}/api/oauth/twitter/callback`;
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'tweet.read tweet.write users.read offline.access',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'plain',
    });

    res.redirect(`https://twitter.com/i/oauth2/authorize?${params}`);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/twitter/callback', async (req, res) => {
  try {
    const { code, state, error: oauthError } = req.query;
    if (oauthError) return res.send(popupHtml('error', 'Twitter/X', oauthError));

    const { companyId } = JSON.parse(Buffer.from(state, 'base64url').toString());
    const { data: company } = await supabaseAdmin
      .from('companies')
      .select('twitter_client_id, twitter_client_secret, integration_status')
      .eq('id', companyId)
      .single();

    const clientId = company?.twitter_client_id || process.env.TWITTER_CLIENT_ID;
    const clientSecret = company?.twitter_client_secret || process.env.TWITTER_CLIENT_SECRET;
    const redirectUri = `${API_URL}/api/oauth/twitter/callback`;

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const tokenResp = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        code_verifier: Buffer.from(companyId).toString('base64url'), // must match what was sent
      }),
    });
    const tokens = await tokenResp.json();
    if (tokens.error) return res.send(popupHtml('error', 'Twitter/X', tokens.error_description));

    const mergedStatus = { ...(company?.integration_status || {}), twitter: 'connected' };
    await supabaseAdmin.from('companies').update({
      twitter_access_token: tokens.access_token,
      integration_status: mergedStatus,
    }).eq('id', companyId);

    res.send(popupHtml('success', 'Twitter/X'));
  } catch (err) {
    res.send(popupHtml('error', 'Twitter/X', err.message));
  }
});

// ─── TikTok OAuth ─────────────────────────────────────────────────────────────

router.get('/tiktok/initiate', requireAuth, async (req, res) => {
  try {
    const { data: company } = await supabaseAdmin
      .from('companies')
      .select('tiktok_client_key')
      .eq('id', req.companyId)
      .single();

    const clientKey = company?.tiktok_client_key || process.env.TIKTOK_CLIENT_KEY;
    if (!clientKey) return res.status(400).json({ error: 'TikTok Client Key not configured' });

    const state = Buffer.from(JSON.stringify({ companyId: req.companyId })).toString('base64url');
    const redirectUri = `${API_URL}/api/oauth/tiktok/callback`;
    const params = new URLSearchParams({
      client_key: clientKey,
      response_type: 'code',
      scope: 'user.info.basic,video.publish,video.list',
      redirect_uri: redirectUri,
      state,
    });

    res.redirect(`https://www.tiktok.com/v2/auth/authorize/?${params}`);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/tiktok/callback', async (req, res) => {
  try {
    const { code, state, error: oauthError } = req.query;
    if (oauthError) return res.send(popupHtml('error', 'TikTok', oauthError));

    const { companyId } = JSON.parse(Buffer.from(state, 'base64url').toString());
    const { data: company } = await supabaseAdmin
      .from('companies')
      .select('tiktok_client_key, tiktok_client_secret, integration_status')
      .eq('id', companyId)
      .single();

    const clientKey = company?.tiktok_client_key || process.env.TIKTOK_CLIENT_KEY;
    const clientSecret = company?.tiktok_client_secret || process.env.TIKTOK_CLIENT_SECRET;
    const redirectUri = `${API_URL}/api/oauth/tiktok/callback`;

    const tokenResp = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_key: clientKey, client_secret: clientSecret, code, grant_type: 'authorization_code', redirect_uri: redirectUri }),
    });
    const tokens = await tokenResp.json();
    if (tokens.error) return res.send(popupHtml('error', 'TikTok', tokens.error_description));

    const mergedStatus = { ...(company?.integration_status || {}), tiktok: 'connected' };
    await supabaseAdmin.from('companies').update({
      tiktok_access_token: tokens.access_token,
      tiktok_token_expires_at: new Date(Date.now() + (tokens.expires_in || 86400) * 1000).toISOString(),
      integration_status: mergedStatus,
    }).eq('id', companyId);

    res.send(popupHtml('success', 'TikTok'));
  } catch (err) {
    res.send(popupHtml('error', 'TikTok', err.message));
  }
});

// ─── Token refresh ────────────────────────────────────────────────────────────

router.post('/google/refresh', requireAuth, async (req, res) => {
  try {
    const { data: company } = await supabaseAdmin
      .from('companies')
      .select('google_client_id, google_client_secret, google_refresh_token')
      .eq('id', req.companyId)
      .single();

    if (!company?.google_refresh_token) return res.status(400).json({ error: 'No refresh token stored' });

    const clientId = company.google_client_id || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = company.google_client_secret || process.env.GOOGLE_CLIENT_SECRET;

    const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: company.google_refresh_token, client_id: clientId, client_secret: clientSecret }),
    });
    const tokens = await tokenResp.json();
    if (tokens.error) throw new Error(tokens.error_description || tokens.error);

    await supabaseAdmin.from('companies').update({
      google_access_token: tokens.access_token,
      google_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    }).eq('id', req.companyId);

    res.json({ access_token: tokens.access_token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Disconnect integration ───────────────────────────────────────────────────

router.post('/disconnect', requireAuth, async (req, res) => {
  try {
    const { provider } = req.body;
    const { data: company } = await supabaseAdmin
      .from('companies')
      .select('integration_status')
      .eq('id', req.companyId)
      .single();

    const newStatus = { ...(company?.integration_status || {}) };
    delete newStatus[provider];

    const updates = { integration_status: newStatus };

    // Clear tokens based on provider
    if (provider?.startsWith('google') || provider === 'gmail') {
      updates.google_access_token = null;
      updates.google_refresh_token = null;
      updates.google_token_expires_at = null;
      updates.google_connected_email = null;
    } else if (provider === 'meta' || provider === 'facebook' || provider === 'instagram') {
      updates.meta_access_token = null;
      updates.facebook_page_id = null;
      updates.facebook_page_access_token = null;
      updates.instagram_business_account_id = null;
    } else if (provider === 'linkedin') {
      updates.linkedin_access_token = null;
      updates.linkedin_token_expires_at = null;
    } else if (provider === 'twitter') {
      updates.twitter_access_token = null;
      updates.twitter_access_secret = null;
    } else if (provider === 'tiktok') {
      updates.tiktok_access_token = null;
      updates.tiktok_token_expires_at = null;
    }

    await supabaseAdmin.from('companies').update(updates).eq('id', req.companyId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Helper: popup HTML page ──────────────────────────────────────────────────

function popupHtml(status, provider, errorMsg = null, integrationType = null) {
  if (status === 'success') {
    return `<!DOCTYPE html>
<html>
<head><title>Connected</title></head>
<body>
<script>
  window.opener && window.opener.postMessage({ type: 'oauth_success', provider: '${provider}', integrationType: '${integrationType || provider}' }, '*');
  window.close();
</script>
<p>Connected! This window will close automatically.</p>
</body>
</html>`;
  }
  return `<!DOCTYPE html>
<html>
<head><title>Error</title></head>
<body>
<script>
  window.opener && window.opener.postMessage({ type: 'oauth_error', provider: '${provider}', error: ${JSON.stringify(errorMsg)} }, '*');
  window.close();
</script>
<p>Error: ${errorMsg}. Please close this window and try again.</p>
</body>
</html>`;
}

export default router;
