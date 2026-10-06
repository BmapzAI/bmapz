import { Router } from 'express';
import crypto from 'node:crypto';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth, requireCompanyAdmin } from '../middleware/auth.js';
import { X_API_BASE, X_AUTH_URL, pkceChallenge } from '../lib/xApi.js';

const router = Router();
const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v25.0';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const API_URL = process.env.API_URL || 'http://localhost:3001';
const OAUTH_STATE_MAX_AGE_MS = 15 * 60 * 1000;

/**
 * The key that signs OAuth state and launch tickets.
 *
 * It fell back to SUPABASE_SERVICE_ROLE_KEY, which is the most privileged secret
 * the system has. Reusing it here widened that key's exposure for no benefit: any
 * flaw that leaked a signing key would have leaked full database access with it,
 * and rotating one would silently break the other.
 *
 * A dedicated OAUTH_STATE_SECRET is derived from the service key when it is not
 * configured, so nothing breaks on a deploy that has not set it yet — but the
 * derived value is NOT the service key itself, so it cannot be replayed against
 * Supabase. Set OAUTH_STATE_SECRET explicitly in production.
 */
let derivedStateSecret = null;
function oauthStateSecret() {
  if (process.env.OAUTH_STATE_SECRET) return process.env.OAUTH_STATE_SECRET;
  if (derivedStateSecret) return derivedStateSecret;

  const base = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base) throw new Error('OAUTH_STATE_SECRET is not configured');
  console.warn('[oauth] OAUTH_STATE_SECRET is not set — deriving one. Set it explicitly in production.');
  derivedStateSecret = crypto.createHmac('sha256', base).update('bmapz:oauth-state:v1').digest('base64url');
  return derivedStateSecret;
}

const OAUTH_NONCE_COOKIE = 'bmapz_oauth_nonce';
const sha256 = (v) => crypto.createHash('sha256').update(String(v)).digest('base64url');

/** Cookies without a parser dependency — this backend is otherwise Bearer-only. */
function readCookie(req, name) {
  const raw = req.headers?.cookie;
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

/**
 * Bind this flow to THIS browser.
 *
 * A signed state alone proves the link was minted by us — not that the person
 * finishing the flow is the person who started it. An attacker could mint a state
 * for their OWN company, lure a victim through Google's consent screen, and have
 * the victim's Gmail tokens written into the attacker's tenant. That is
 * account-linking CSRF, and no amount of signing fixes it.
 *
 * So a random nonce is set as a cookie in the initiating browser and only its HASH
 * travels inside the state. The callback requires the two to agree, which the
 * victim's browser cannot satisfy for an attacker's state.
 *
 * SameSite=Lax survives the top-level GET redirect back from the provider while
 * still refusing cross-site POSTs. httpOnly keeps it away from scripts.
 */
function issueOAuthNonce(res) {
  const nonce = crypto.randomBytes(32).toString('base64url');
  res.cookie?.(OAUTH_NONCE_COOKIE, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV !== 'development',
    sameSite: 'lax',
    maxAge: OAUTH_STATE_MAX_AGE_MS,
    path: '/api/oauth',
  });
  return sha256(nonce);
}

function encodeOAuthState(payload, res) {
  const nonceHash = res ? issueOAuthNonce(res) : null;
  const body = Buffer.from(JSON.stringify({
    ...payload, issuedAt: Date.now(), ...(nonceHash ? { nonceHash } : {}),
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', oauthStateSecret()).update(body).digest('base64url');
  return `${body}.${signature}`;
}

/**
 * A short-lived ticket that lets an UNAUTHENTICATED popup navigation start a flow.
 *
 * The popup cannot send an Authorization header, which is why the old flow fetched
 * the provider URL over XHR and opened the provider directly — and that is exactly
 * why no cookie could ever be set: the browser never visited our origin top-level
 * before the callback, so any cookie write was third-party and dropped.
 *
 * The popup now opens OUR initiate route carrying this ticket. That navigation is
 * first-party, so the nonce cookie sticks, and we redirect on to the provider.
 */
function mintLaunchTicket({ userId, companyId }) {
  const body = Buffer.from(JSON.stringify({ userId, companyId, purpose: 'launch', issuedAt: Date.now() })).toString('base64url');
  return `${body}.${crypto.createHmac('sha256', oauthStateSecret()).update(body).digest('base64url')}`;
}

/**
 * Accept EITHER a normal Bearer session or a launch ticket.
 *
 * Tickets are valid for two minutes — long enough to open a window, too short to
 * be worth capturing — and only ever stand in for the user who minted them.
 */
function allowLaunchTicket(req, res, next) {
  const t = req.query?.t;
  if (!t) return requireAuth(req, res, next);
  try {
    const [body, sig] = String(t).split('.');
    if (!body || !sig) throw new Error('malformed');
    const expected = crypto.createHmac('sha256', oauthStateSecret()).update(body).digest();
    const supplied = Buffer.from(sig, 'base64url');
    if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
      throw new Error('bad signature');
    }
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (p.purpose !== 'launch' || Date.now() - p.issuedAt > 2 * 60 * 1000) throw new Error('expired');

    req.dbUser = { id: p.userId };
    req.companyId = p.companyId;
    return next();
  } catch (err) {
    console.error('[oauth] launch ticket rejected:', err.message);
    return res.status(401).send(popupHtml('error', 'oauth'));
  }
}

// GET /api/oauth/launch-url?provider=google&type=gmail
// Authenticated XHR: hands the frontend a URL on OUR origin to open the popup at.
router.get('/launch-url', requireAuth, (req, res) => {
  const provider = String(req.query.provider || '').replace(/[^a-z_]/gi, '');
  const type = String(req.query.type || '').replace(/[^a-z_]/gi, '');
  if (!provider) return res.status(400).json({ error: 'provider is required' });
  if (provider === 'google' && GOOGLE_RESTRICTED_ONLY_TYPES.has(type) && !restrictedGoogleScopesEnabled()) {
    return res.status(400).json({
      error: 'Google Drive browsing needs a restricted Google permission, which Google only grants after a paid annual '
        + 'security assessment. It is not enabled yet. Gmail sending, Calendar, Analytics, Search Console and YouTube are unaffected.',
    });
  }

  const ticket = mintLaunchTicket({ userId: req.dbUser.id, companyId: req.companyId });
  const params = new URLSearchParams({ t: ticket, ...(type ? { type } : {}) });
  res.json({ authUrl: `${API_URL}/api/oauth/${provider}/initiate?${params}` });
});

/**
 * Verify a state AND spend it, so it works exactly once.
 *
 * The state was a stateless signed bearer blob valid for a full 15 minutes, so a
 * captured callback URL could be replayed repeatedly within that window — and for
 * Twitter and Canva the PKCE `code_verifier` travels INSIDE the state, which
 * defeats the point of PKCE if the state is ever observed.
 *
 * The insert is the lock: the signature is the primary key, so the second use
 * collides and is refused.
 *
 * Together with the nonce-cookie check below, a callback must be BOTH unused and
 * completed in the browser that started it.
 */
async function consumeOAuthState(state, req) {
  const payload = decodeOAuthState(state);   // verify signature + expiry first
  const signature = String(state).split('.')[1];

  // The browser that STARTED this flow must be the one finishing it. Without this,
  // a signed state is a bearer token: mint one for your own company, lure someone
  // through the provider's consent screen, and their tokens land in your tenant.
  //
  // Only enforced when the state carries a nonce, so a flow started before this
  // shipped still completes rather than stranding a user mid-connect. Once those
  // have expired (15 minutes), every state carries one.
  if (payload.nonceHash) {
    const cookie = readCookie(req, OAUTH_NONCE_COOKIE);
    if (!cookie || sha256(cookie) !== payload.nonceHash) {
      throw new Error('That connection did not start in this browser. Please try connecting again.');
    }
  }

  const { error } = await supabaseAdmin
    .from('webhook_events')
    .insert({ id: `oauth:${signature}`, provider: 'oauth', event_type: payload.integrationType || 'oauth' });
  if (error) {
    if (/duplicate key|already exists/i.test(error.message || '')) {
      throw new Error('That sign-in link was already used. Please connect again.');
    }
    // Cannot prove it is unused — refuse rather than risk a replay.
    console.error('[oauth] state single-use check failed:', error.message);
    throw new Error('Could not verify that sign-in. Please try again.');
  }
  return payload;
}

function decodeOAuthState(state) {
  const [body, suppliedSignature] = String(state || '').split('.');
  if (!body || !suppliedSignature) throw new Error('Invalid OAuth state');
  const expectedSignature = crypto.createHmac('sha256', oauthStateSecret()).update(body).digest();
  const supplied = Buffer.from(suppliedSignature, 'base64url');
  if (supplied.length !== expectedSignature.length || !crypto.timingSafeEqual(supplied, expectedSignature)) {
    throw new Error('Invalid OAuth state signature');
  }
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
  if (!payload.issuedAt || Date.now() - payload.issuedAt > OAUTH_STATE_MAX_AGE_MS) {
    throw new Error('OAuth session expired. Please connect again.');
  }
  return payload;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Fetch a company's api_keys and integration_status in one call.
 */
async function getCompanyKeys(companyId) {
  const { data, error } = await supabaseAdmin
    .from('companies')
    .select('api_keys, integration_status')
    .eq('id', companyId)
    .single();
  // THROW rather than defaulting to {}. Every OAuth write in this file merges
  // onto this value and then UPDATEs the whole api_keys blob, so returning an
  // empty object on a failed read made the next write DELETE every stored
  // credential for that company — Meta, Google, LinkedIn, TikTok, Canva, all of
  // them — from a single transient database hiccup.
  if (error) {
    const err = new Error('Could not read the company integration settings. Nothing was changed.');
    err.code = 'KEYS_READ_FAILED';
    err.publicMessage = err.message;
    throw err;
  }
  return {
    apiKeys: data?.api_keys || {},
    integrationStatus: data?.integration_status || {},
  };
}

/**
 * Merge newKeys into api_keys JSONB and update integration_status for the given type.
 * All OAuth tokens live in api_keys; integration_status is a direct JSONB column.
 */
async function saveOAuthTokens(companyId, newKeys, integrationType, extraDirectFields = {}) {
  const { apiKeys, integrationStatus } = await getCompanyKeys(companyId);
  const mergedKeys = { ...apiKeys, ...newKeys };
  const mergedStatus = { ...integrationStatus, [integrationType]: true };

  await supabaseAdmin
    .from('companies')
    .update({ api_keys: mergedKeys, integration_status: mergedStatus, ...extraDirectFields })
    .eq('id', companyId);
}

/**
 * Remove a set of keys from api_keys JSONB and remove the integration type from integration_status.
 */
async function clearOAuthTokens(companyId, keysToRemove, statusKeys) {
  const { apiKeys, integrationStatus } = await getCompanyKeys(companyId);
  const updatedApiKeys = { ...apiKeys };
  for (const k of keysToRemove) delete updatedApiKeys[k];

  const updatedStatus = { ...integrationStatus };
  for (const k of statusKeys) delete updatedStatus[k];

  // supabase-js resolves with {data:null,error} rather than throwing, so this
  // discarded failure meant /disconnect answered `{success:true}` while the tokens
  // were still live — the user believed an integration was revoked when it was not.
  const { error } = await supabaseAdmin
    .from('companies')
    .update({ api_keys: updatedApiKeys, integration_status: updatedStatus })
    .eq('id', companyId);
  if (error) throw new Error(`Could not disconnect: ${error.message}`);
}

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
    // youtube.upload removed (2026-10-06): nothing in the code uploads to YouTube, and
    // Google forces uploads from an unaudited API project to PRIVATE until the project
    // passes a compliance audit - a scope with a hidden gate and no caller.
    'https://www.googleapis.com/auth/userinfo.email',
  ],
  google_drive: [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
  ],
  gmail: [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    // gmail.compose removed (2026-10-06): RESTRICTED, and the code only ever calls
    // messages.send (lib/emailSender.js) plus messages.list/get (routes/messaging.js).
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ],
};

/**
 * RESTRICTED Google scopes - the ones that trigger the annual third-party security
 * assessment (CASA). Classified from Google's own Gmail and Drive scope tables,
 * fetched 2026-10-06: gmail.readonly/modify/compose/metadata/insert and full mail
 * access are restricted while gmail.send is only SENSITIVE; drive, drive.readonly and
 * drive.metadata are restricted while drive.file is not.
 *
 * WHY THESE ARE OFF BY DEFAULT. Verification with only sensitive scopes takes roughly
 * 2-4 weeks and costs nothing; with a restricted scope it is 5-10 weeks plus an annual
 * assessment (third-party quotes about $540-$3,000 a year, Google publishes no price).
 * Worse, an UNVERIFIED production app is capped at 100 new users for the whole life of
 * the project, a cap Google says cannot be reset - so launching with restricted scopes
 * before the assessment is paid for can burn that allowance with nothing to show.
 * What is lost while off: Gmail INBOX SYNC (sending still works) and Drive browsing.
 * Switch on with GOOGLE_ENABLE_RESTRICTED_SCOPES=true once the assessment is budgeted.
 */
const GOOGLE_RESTRICTED_SCOPES = new Set([
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.metadata',
]);
const restrictedGoogleScopesEnabled = () => process.env.GOOGLE_ENABLE_RESTRICTED_SCOPES === 'true';

/** Types whose ONLY purpose needs a restricted scope - refuse them rather than connect an empty grant. */
const GOOGLE_RESTRICTED_ONLY_TYPES = new Set(['google_drive']);

function googleScopesFor(type) {
  const wanted = GOOGLE_SCOPES_MAP[type] || GOOGLE_SCOPES_MAP.gmail;
  return restrictedGoogleScopesEnabled() ? wanted : wanted.filter((s) => !GOOGLE_RESTRICTED_SCOPES.has(s));
}

// GET /api/oauth/google/initiate?type=gmail&origin=...
// GET /api/oauth/google/initiate-url?type=gmail&origin=...
router.get(['/google/initiate', '/google/initiate-url'], allowLaunchTicket, async (req, res) => {
  try {
    const { type = 'gmail', origin } = req.query;
    const { apiKeys } = await getCompanyKeys(req.companyId);

    const clientId = apiKeys.google_client_id || process.env.GOOGLE_CLIENT_ID;
    if (!clientId) return res.status(400).json({ error: 'Google Client ID not configured' });

    const scopes = googleScopesFor(type);
    const state = encodeOAuthState({
      userId: req.dbUser.id,
      companyId: req.companyId,
      integrationType: type,
      origin: origin || FRONTEND_URL,
    }, res);

    const redirectUri = `${API_URL}/api/oauth/google/callback`;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      // Every Google service shares ONE stored token. Without this, connecting Calendar
      // after Gmail replaces the token with one that covers only Calendar's scopes and
      // silently breaks Gmail. This asks Google to return the UNION of everything the
      // person has already granted this client.
      include_granted_scopes: 'true',
      state,
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    if (req.path.endsWith('/initiate-url')) return res.json({ authUrl });
    res.redirect(authUrl);
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

    const stateData = await consumeOAuthState(state, req);
    const { companyId, integrationType } = stateData;

    // Get company credentials from api_keys JSONB
    const { apiKeys } = await getCompanyKeys(companyId);

    const clientId = apiKeys.google_client_id || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = apiKeys.google_client_secret || process.env.GOOGLE_CLIENT_SECRET;
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
    // Bearer header, not ?access_token=: Google logs query strings. A failure here must
    // not abort the connect (the token is already good), so it only costs the email.
    const userInfoResp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userInfo = userInfoResp.ok ? await userInfoResp.json().catch(() => ({})) : {};

    // Build new tokens to store in api_keys JSONB
    // ONE token model for every Google type. Drive used to store only the access token
    // as google_drive_token - no refresh token, no expiry - so it stopped working about
    // an hour after connecting and nothing could renew it.
    const newKeys = {};
    newKeys.google_access_token = tokens.access_token;
    if (tokens.refresh_token) newKeys.google_refresh_token = tokens.refresh_token;
    newKeys.google_token_expires_at = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();
    if (userInfo.email) newKeys.google_connected_email = userInfo.email;
    // The scopes Google ACTUALLY granted (the union, with include_granted_scopes). The
    // person can untick boxes in the consent dialog, so a token's mere existence does not
    // mean a service is usable; this is what lets the app tell.
    if (tokens.scope) newKeys.google_scopes = String(tokens.scope);

    await saveOAuthTokens(companyId, newKeys, integrationType);
    res.send(popupHtml('success', 'Google', null, integrationType));
  } catch (err) {
    console.error('[google callback]', err);
    res.send(popupHtml('error', 'Google', err.message));
  }
});

// ─── Meta (Facebook/Instagram) OAuth ─────────────────────────────────────────

router.get(['/meta/initiate', '/meta/initiate-url'], allowLaunchTicket, async (req, res) => {
  try {
    const { type = 'meta', origin } = req.query;
    const { apiKeys } = await getCompanyKeys(req.companyId);

    const appId = apiKeys.meta_app_id || process.env.META_APP_ID;
    if (!appId) return res.status(400).json({ error: 'Meta App ID not configured' });

    const state = encodeOAuthState({
      userId: req.dbUser.id,
      companyId: req.companyId,
      integrationType: type,
      origin: origin || FRONTEND_URL,
    }, res);

    const scopes = 'email,pages_show_list,pages_read_engagement,pages_manage_posts,pages_messaging,read_insights,instagram_basic,instagram_content_publish,instagram_manage_messages,instagram_manage_insights,ads_management,ads_read,business_management';
    const redirectUri = `${API_URL}/api/oauth/meta/callback`;
    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      scope: scopes,
      response_type: 'code',
      state,
    });

    const authUrl = `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth?${params}`;
    if (req.path.endsWith('/initiate-url')) return res.json({ authUrl });
    res.redirect(authUrl);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/meta/callback', async (req, res) => {
  try {
    const { code, state, error: oauthError } = req.query;
    if (oauthError) return res.send(popupHtml('error', 'Meta', oauthError));

    const stateData = await consumeOAuthState(state, req);
    const { companyId, integrationType = 'meta' } = stateData;

    const { apiKeys } = await getCompanyKeys(companyId);

    const appId = apiKeys.meta_app_id || process.env.META_APP_ID;
    const appSecret = apiKeys.meta_app_secret || process.env.META_APP_SECRET;
    const redirectUri = `${API_URL}/api/oauth/meta/callback`;

    // Exchange code for token
    const tokenResp = await fetch(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`
    );
    const tokens = await tokenResp.json();
    if (tokens.error) return res.send(popupHtml('error', 'Meta', tokens.error.message));

    // Get long-lived token
    const llResp = await fetch(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${tokens.access_token}`
    );
    const llTokens = await llResp.json();
    const accessToken = llTokens.access_token || tokens.access_token;
    const expiresIn = llTokens.expires_in || tokens.expires_in || 5184000;

    // Fetch FB pages
    const pagesResp = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/me/accounts?access_token=${accessToken}`);
    const pagesData = await pagesResp.json();
    const page = pagesData.data?.[0];

    // Fetch Instagram Business Account
    let igAccountId = null;
    if (page) {
      const igResp = await fetch(
        `https://graph.facebook.com/${META_GRAPH_VERSION}/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`
      );
      const igData = await igResp.json();
      igAccountId = igData.instagram_business_account?.id;
    }

    const newKeys = {
      meta_access_token: accessToken,
      meta_token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
      facebook_page_id: page?.id || null,
      facebook_page_access_token: page?.access_token || null,
      instagram_business_account_id: igAccountId || null,
    };

    // Merge keys and update status for all connected Meta platforms
    const { apiKeys: currentKeys, integrationStatus } = await getCompanyKeys(companyId);
    const mergedKeys = { ...currentKeys, ...newKeys };
    const mergedStatus = {
      ...integrationStatus,
      meta: true,
      [integrationType]: true,
      facebook: true,
      ...(igAccountId ? { instagram: true } : {}),
    };

    await supabaseAdmin
      .from('companies')
      .update({ api_keys: mergedKeys, integration_status: mergedStatus })
      .eq('id', companyId);

    res.send(popupHtml('success', 'Meta', null, integrationType));
  } catch (err) {
    console.error('[meta callback]', err);
    res.send(popupHtml('error', 'Meta', err.message));
  }
});

// ─── LinkedIn OAuth ───────────────────────────────────────────────────────────

router.get(['/linkedin/initiate', '/linkedin/initiate-url'], allowLaunchTicket, async (req, res) => {
  try {
    const { type = 'linkedin', origin } = req.query;
    const { apiKeys, integrationStatus } = await getCompanyKeys(req.companyId);

    const clientId = apiKeys.linkedin_client_id || process.env.LINKEDIN_CLIENT_ID;
    if (!clientId) return res.status(400).json({ error: 'LinkedIn Client ID not configured' });

    const state = encodeOAuthState({
      companyId: req.companyId,
      integrationType: type,
      origin: origin || FRONTEND_URL,
    }, res);
    const redirectUri = `${API_URL}/api/oauth/linkedin/callback`;
    // LinkedIn invalidates a member's earlier token when a DIFFERENT scope set is granted, and
    // every LinkedIn integration writes the same stored token. Connecting Ads therefore killed
    // posting and connecting posting killed Ads, with both cards still showing "connected".
    // So ask for the UNION of what this company already has plus what is being connected now.
    // Ads scopes are only added when ads are already connected or being connected: LinkedIn
    // refuses the whole authorisation for a scope the app has not been approved for.
    const status = integrationStatus || {};
    const wantsPosting = type === 'linkedin' || type === 'linkedin_social' || !!(status.linkedin || status.linkedin_social);
    const wantsAds = type === 'linkedin_ads' || !!status.linkedin_ads;
    // r_ads is read-only; creating campaigns needs rw_ads, which may need a higher Advertising
    // API tier than reporting does. Reporting is the default; LINKEDIN_ADS_WRITE=true opts in.
    const adsScopes = process.env.LINKEDIN_ADS_WRITE === 'true' ? 'rw_ads r_ads_reporting' : 'r_ads r_ads_reporting';
    const linkedinScopes = ['openid profile email', wantsPosting ? 'w_member_social' : '', wantsAds ? adsScopes : '']
      .filter(Boolean).join(' ');
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      scope: linkedinScopes,
    });

    const authUrl = `https://www.linkedin.com/oauth/v2/authorization?${params}`;
    if (req.path.endsWith('/initiate-url')) return res.json({ authUrl });
    res.redirect(authUrl);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/linkedin/callback', async (req, res) => {
  try {
    const { code, state, error: oauthError } = req.query;
    if (oauthError) return res.send(popupHtml('error', 'LinkedIn', oauthError));

    const { companyId, integrationType = 'linkedin' } = await consumeOAuthState(state, req);
    const { apiKeys } = await getCompanyKeys(companyId);

    const clientId = apiKeys.linkedin_client_id || process.env.LINKEDIN_CLIENT_ID;
    const clientSecret = apiKeys.linkedin_client_secret || process.env.LINKEDIN_CLIENT_SECRET;
    const redirectUri = `${API_URL}/api/oauth/linkedin/callback`;

    const tokenResp = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri, client_id: clientId, client_secret: clientSecret }),
    });
    const tokens = await tokenResp.json();
    if (tokens.error || !tokens.access_token) return res.send(popupHtml('error', 'LinkedIn', tokens.error_description));

    const newKeys = {
      linkedin_access_token: tokens.access_token,
      // What LinkedIn ACTUALLY granted, so a test can tell "connected" from "connected but
      // cannot post". Comma-separated in LinkedIn's token response.
      linkedin_scopes: String(tokens.scope || ''),
      linkedin_token_expires_at: new Date(Date.now() + (tokens.expires_in || 5184000) * 1000).toISOString(),
    };

    await saveOAuthTokens(companyId, newKeys, integrationType);
    res.send(popupHtml('success', 'LinkedIn', null, integrationType));
  } catch (err) {
    res.send(popupHtml('error', 'LinkedIn', err.message));
  }
});

// ─── Twitter/X OAuth ──────────────────────────────────────────────────────────

router.get(['/twitter/initiate', '/twitter/initiate-url'], allowLaunchTicket, async (req, res) => {
  try {
    const { type = 'twitter', origin } = req.query;
    const { apiKeys } = await getCompanyKeys(req.companyId);

    const clientId = apiKeys.twitter_client_id || process.env.TWITTER_CLIENT_ID;
    if (!clientId) return res.status(400).json({ error: 'Twitter Client ID not configured' });

    const codeVerifier = Buffer.from(crypto.randomUUID()).toString('base64url');
    const state = encodeOAuthState({
      companyId: req.companyId,
      codeVerifier,
      integrationType: type,
      origin: origin || FRONTEND_URL,
    }, res);

    const redirectUri = `${API_URL}/api/oauth/twitter/callback`;
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'tweet.read tweet.write users.read offline.access',
      state,
      // S256, not 'plain': with plain the challenge IS the secret verifier, so PKCE protected nothing.
      code_challenge: pkceChallenge(codeVerifier),
      code_challenge_method: 'S256',
    });

    const authUrl = `${X_AUTH_URL}?${params}`;
    if (req.path.endsWith('/initiate-url')) return res.json({ authUrl });
    res.redirect(authUrl);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/twitter/callback', async (req, res) => {
  try {
    const { code, state, error: oauthError } = req.query;
    if (oauthError) return res.send(popupHtml('error', 'Twitter/X', oauthError));

    const { companyId, codeVerifier, integrationType = 'twitter' } = await consumeOAuthState(state, req);
    const { apiKeys } = await getCompanyKeys(companyId);

    const clientId = apiKeys.twitter_client_id || process.env.TWITTER_CLIENT_ID;
    const clientSecret = apiKeys.twitter_client_secret || process.env.TWITTER_CLIENT_SECRET;
    const redirectUri = `${API_URL}/api/oauth/twitter/callback`;

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const tokenResp = await fetch(`${X_API_BASE}/2/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
    });
    const tokens = await tokenResp.json();
    // X reports failures as problem+json (title/detail) as well as OAuth-style error fields, so
    // checking tokens.error alone could save an undefined token and report success.
    if (tokens.error || !tokens.access_token) return res.send(popupHtml('error', 'Twitter/X', tokens.error_description || tokens.detail));

    // X access tokens last about TWO HOURS. offline.access makes X issue a refresh token, which
    // was thrown away, so the integration died two hours after connecting while still showing
    // "connected". Store the refresh token and the expiry (see lib/xApi.js getXAccessToken).
    await saveOAuthTokens(companyId, {
      twitter_access_token: tokens.access_token,
      ...(tokens.refresh_token ? { twitter_refresh_token: tokens.refresh_token } : {}),
      twitter_token_expires_at: new Date(Date.now() + (tokens.expires_in || 7200) * 1000).toISOString(),
    }, integrationType);
    res.send(popupHtml('success', 'Twitter/X', null, integrationType));
  } catch (err) {
    res.send(popupHtml('error', 'Twitter/X', err.message));
  }
});

// ─── TikTok OAuth ─────────────────────────────────────────────────────────────

router.get(['/tiktok/initiate', '/tiktok/initiate-url'], allowLaunchTicket, async (req, res) => {
  try {
    const { type = 'tiktok', origin } = req.query;
    const { apiKeys } = await getCompanyKeys(req.companyId);

    const clientKey = apiKeys.tiktok_client_key || process.env.TIKTOK_CLIENT_KEY;
    if (!clientKey) return res.status(400).json({ error: 'TikTok Client Key not configured' });

    const state = encodeOAuthState({
      companyId: req.companyId,
      integrationType: type,
      origin: origin || FRONTEND_URL,
    }, res);
    const redirectUri = `${API_URL}/api/oauth/tiktok/callback`;
    const params = new URLSearchParams({
      client_key: clientKey,
      response_type: 'code',
      scope: 'user.info.basic,video.publish,video.list',
      redirect_uri: redirectUri,
      state,
    });

    const authUrl = `https://www.tiktok.com/v2/auth/authorize/?${params}`;
    if (req.path.endsWith('/initiate-url')) return res.json({ authUrl });
    res.redirect(authUrl);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/tiktok/callback', async (req, res) => {
  try {
    const { code, state, error: oauthError } = req.query;
    if (oauthError) return res.send(popupHtml('error', 'TikTok', oauthError));

    const { companyId, integrationType = 'tiktok' } = await consumeOAuthState(state, req);
    const { apiKeys } = await getCompanyKeys(companyId);

    const clientKey = apiKeys.tiktok_client_key || process.env.TIKTOK_CLIENT_KEY;
    const clientSecret = apiKeys.tiktok_client_secret || process.env.TIKTOK_CLIENT_SECRET;
    const redirectUri = `${API_URL}/api/oauth/tiktok/callback`;

    const tokenResp = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_key: clientKey, client_secret: clientSecret, code, grant_type: 'authorization_code', redirect_uri: redirectUri }),
    });
    const tokens = await tokenResp.json();
    // TikTok can report a failure in the BODY with HTTP 200 ({"error":"invalid_grant",...}).
    if (tokens.error || !tokens.access_token) return res.send(popupHtml('error', 'TikTok', tokens.error_description));

    // Access tokens last 24 HOURS and the refresh token used to be discarded, so every TikTok
    // connection died a day after it was made (lib/tiktokApi.js getTikTokAccessToken renews it).
    const newKeys = {
      tiktok_access_token: tokens.access_token,
      tiktok_token_expires_at: new Date(Date.now() + (tokens.expires_in || 86400) * 1000).toISOString(),
      ...(tokens.refresh_token ? { tiktok_refresh_token: tokens.refresh_token } : {}),
      ...(tokens.refresh_expires_in ? { tiktok_refresh_expires_at: new Date(Date.now() + tokens.refresh_expires_in * 1000).toISOString() } : {}),
      ...(tokens.open_id ? { tiktok_open_id: tokens.open_id } : {}),
    };

    await saveOAuthTokens(companyId, newKeys, integrationType);
    res.send(popupHtml('success', 'TikTok', null, integrationType));
  } catch (err) {
    res.send(popupHtml('error', 'TikTok', err.message));
  }
});

// ─── Token refresh ────────────────────────────────────────────────────────────

router.post('/google/refresh', requireAuth, requireCompanyAdmin, async (req, res) => {
  try {
    const { apiKeys } = await getCompanyKeys(req.companyId);

    if (!apiKeys.google_refresh_token) return res.status(400).json({ error: 'No refresh token stored' });

    const clientId = apiKeys.google_client_id || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = apiKeys.google_client_secret || process.env.GOOGLE_CLIENT_SECRET;

    const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: apiKeys.google_refresh_token, client_id: clientId, client_secret: clientSecret }),
    });
    const tokens = await tokenResp.json();
    if (tokens.error) throw new Error(tokens.error_description || tokens.error);

    // Update only the new access token in api_keys (keep existing refresh token)
    const updatedKeys = {
      ...apiKeys,
      google_access_token: tokens.access_token,
      google_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    };

    await supabaseAdmin
      .from('companies')
      .update({ api_keys: updatedKeys })
      .eq('id', req.companyId);

    // The refreshed token is STORED, never returned.
    //
    // This used to respond with `{ access_token }`, handing a live Google OAuth
    // token for the company's connected account to any authenticated member — the
    // lowest-privileged user, or a guest from another tenant who had switched in.
    // That token is usable directly against Google's APIs, entirely outside this
    // app's permission model, and it bypassed the whole companyView redaction layer.
    //
    // No caller in the frontend or backend ever read the token from this response,
    // so returning it bought nothing. Server-side code reads it from api_keys.
    res.json({
      ok: true,
      expires_at: updatedKeys.google_token_expires_at,
    });
  } catch (err) {
    console.error('[oauth/google/refresh]', err.message);
    // Provider errors can carry token fragments and client identifiers.
    res.status(500).json({ error: 'Could not refresh the Google connection.' });
  }
});

// ─── Disconnect integration ───────────────────────────────────────────────────

// Company-wide credentials: same bar as the Settings route that manages them.
// A plain member could previously rewire or wipe every integration the company had.
router.post('/disconnect', requireAuth, requireCompanyAdmin, async (req, res) => {
  try {
    const { provider } = req.body;

    // Google is ONE connection shared by Gmail, Calendar, Drive, Analytics, Search
    // Console, YouTube and Ads: disconnecting any of them clears the shared token.
    const GOOGLE_TOKEN_KEYS = ['google_access_token', 'google_refresh_token', 'google_token_expires_at', 'google_connected_email', 'google_scopes', 'google_drive_token'];

    // Define which api_keys fields to clear for each provider
    const TOKEN_KEYS_BY_PROVIDER = {
      gmail: GOOGLE_TOKEN_KEYS,
      google_ads: GOOGLE_TOKEN_KEYS,
      google_analytics: GOOGLE_TOKEN_KEYS,
      google_search_console: GOOGLE_TOKEN_KEYS,
      google_drive: GOOGLE_TOKEN_KEYS,
      google_calendar: GOOGLE_TOKEN_KEYS,
      meta: ['meta_access_token', 'meta_token_expires_at', 'facebook_page_id', 'facebook_page_access_token', 'instagram_business_account_id'],
      facebook: ['meta_access_token', 'meta_token_expires_at', 'facebook_page_id', 'facebook_page_access_token'],
      instagram: ['instagram_business_account_id'],
      linkedin: ['linkedin_access_token', 'linkedin_token_expires_at', 'linkedin_scopes'],
      linkedin_social: ['linkedin_access_token', 'linkedin_token_expires_at', 'linkedin_scopes'],
      linkedin_ads: ['linkedin_ads_access_token', 'linkedin_ads_account_id', 'linkedin_ads_connected'],
      twitter: ['twitter_access_token', 'twitter_refresh_token', 'twitter_token_expires_at', 'twitter_access_secret'],
      tiktok: ['tiktok_access_token', 'tiktok_token_expires_at', 'tiktok_refresh_token', 'tiktok_refresh_expires_at', 'tiktok_open_id'],
    };

    // Fallback: for google* prefixed providers, clear google tokens
    let keysToRemove = TOKEN_KEYS_BY_PROVIDER[provider] || [];
    if (!keysToRemove.length && provider?.startsWith('google')) {
      keysToRemove = TOKEN_KEYS_BY_PROVIDER.gmail;
    }

    await clearOAuthTokens(req.companyId, keysToRemove, [provider]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Helper: popup HTML page ──────────────────────────────────────────────────

// ─── Canva OAuth (Canva Connect API, OAuth 2.0 + PKCE S256) ───────────────────
// Requires a Canva developer app: set CANVA_CLIENT_ID + CANVA_CLIENT_SECRET in
// Railway. Redirect URI in the Canva app must be
// `${API_URL}/api/oauth/canva/callback`.
//
// DECISION (2026-10-06, Derek delegated it): Canva is PLATFORM-APP-ONLY. There is no
// per-company Canva client id/secret, and none is accepted: a company_admin must not
// be able to write OAuth client secrets, and Canva Connect is built around one
// registered integration that every customer authorises against. (Meta, LinkedIn, X
// and TikTok still accept per-company app credentials; revisiting those is a separate
// decision recorded in AGENT_HANDOFF.md.) The per-company reads that used to sit here
// were dead anyway — those names were never in the ALLOWED list in routes/companies.js
// — so removing them changes no behaviour, only stops the code implying a path that
// does not exist.
// design:meta:read added 2026-10-06: GET /v1/designs (the design picker, canva.js) requires it, so
// without it the picker fails with a missing-scope 403 for every connected company. Scopes are fixed
// at authorisation time, so the same scope must ALSO be ticked in the Canva developer portal and any
// existing connection must be reconnected.
const CANVA_SCOPES = 'design:content:read design:content:write design:meta:read asset:read asset:write profile:read';

router.get(['/canva/initiate', '/canva/initiate-url'], allowLaunchTicket, async (req, res) => {
  try {
    const { type = 'canva', origin } = req.query;
    const { apiKeys } = await getCompanyKeys(req.companyId);
    const clientId = process.env.CANVA_CLIENT_ID;
    if (!clientId) return res.status(400).json({ error: 'Canva Client ID not configured', code: 'NOT_CONFIGURED' });

    const codeVerifier = crypto.randomBytes(48).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    const state = encodeOAuthState({
      companyId: req.companyId, codeVerifier, integrationType: type, origin: origin || FRONTEND_URL,
    }, res);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: `${API_URL}/api/oauth/canva/callback`,
      scope: CANVA_SCOPES,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state,
    });
    const authUrl = `https://www.canva.com/api/oauth/authorize?${params}`;
    if (req.path.endsWith('/initiate-url')) return res.json({ authUrl });
    res.redirect(authUrl);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/canva/callback', async (req, res) => {
  try {
    const { code, state, error: oauthError } = req.query;
    if (oauthError) return res.send(popupHtml('error', 'Canva', oauthError));
    const { companyId, codeVerifier, integrationType = 'canva' } = await consumeOAuthState(state, req);
    const { apiKeys } = await getCompanyKeys(companyId);
    const clientId = process.env.CANVA_CLIENT_ID;
    const clientSecret = process.env.CANVA_CLIENT_SECRET;

    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const r = await fetch('https://api.canva.com/rest/v1/oauth/token', {
      method: 'POST',
      headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        code_verifier: codeVerifier,
        redirect_uri: `${API_URL}/api/oauth/canva/callback`,
      }),
    });
    const tokens = await r.json();
    if (tokens.error || !tokens.access_token) throw new Error(tokens.error_description || tokens.error || 'Canva token exchange failed');

    await saveOAuthTokens(companyId, {
      canva_access_token: tokens.access_token,
      canva_refresh_token: tokens.refresh_token || null,
      canva_token_expires_at: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null,
    }, integrationType);
    res.send(popupHtml('success', 'Canva', null, integrationType));
  } catch (err) {
    res.send(popupHtml('error', 'Canva', err.message));
  }
});

// Refresh an expired Canva access token (Canva access tokens are short-lived).
// Canva refresh tokens are single use and each refresh returns a new one. The UI fires /designs and
// /export together; both used to read the same refresh token and refresh in parallel, so the second
// got invalid_grant (swallowed upstream) and the connection could end up stuck on a dead token.
// Concurrent callers for one company now share a single in-flight refresh.
const canvaRefreshInFlight = new Map();
export function refreshCanvaToken(companyId) {
  const pending = canvaRefreshInFlight.get(companyId);
  if (pending) return pending;
  const p = doRefreshCanvaToken(companyId).finally(() => canvaRefreshInFlight.delete(companyId));
  canvaRefreshInFlight.set(companyId, p);
  return p;
}

async function doRefreshCanvaToken(companyId) {
  const { apiKeys } = await getCompanyKeys(companyId);
  if (!apiKeys.canva_refresh_token) throw new Error('Canva not connected');
  const clientId = process.env.CANVA_CLIENT_ID;
  const clientSecret = process.env.CANVA_CLIENT_SECRET;
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const r = await fetch('https://api.canva.com/rest/v1/oauth/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: apiKeys.canva_refresh_token }),
  });
  const tokens = await r.json();
  if (!tokens.access_token) throw new Error('Canva token refresh failed');
  await saveOAuthTokens(companyId, {
    canva_access_token: tokens.access_token,
    canva_refresh_token: tokens.refresh_token || apiKeys.canva_refresh_token,
    canva_token_expires_at: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null,
  }, 'canva');
  return tokens.access_token;
}

/**
 * The popup that closes an OAuth flow.
 *
 * Four defects lived in these few lines:
 *
 *  1. `provider`, `integrationType` and the error text were interpolated straight
 *     into HTML and into inline JS. The error branch is reachable UNAUTHENTICATED
 *     with an attacker-chosen query string, so it was a reflected injection.
 *  2. postMessage targeted '*', broadcasting to whatever opened the window.
 *  3. helmet's default CSP (`script-src 'self'`) BLOCKS an inline <script>, so this
 *     script never ran in production — the popup never told the opener anything and
 *     simply sat there. The reported "OAuth popups don't signal success" bug is
 *     this. The payload now travels in a data attribute read by an external module
 *     that CSP permits, and the window closes on a timer either way.
 *  4. The error text came from the provider verbatim and could carry token
 *     fragments; it is now a fixed sentence.
 */
function popupHtml(status, provider, errorMsg = null, integrationType = null) {
  const esc = (s) => String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  // Only ever a known provider key — never free text from the query string.
  const safeProvider = /^[a-z0-9_]{1,40}$/i.test(String(provider || '')) ? String(provider) : 'unknown';
  const safeType = /^[a-z0-9_]{1,40}$/i.test(String(integrationType || '')) ? String(integrationType) : safeProvider;
  const ok = status === 'success';

  // The opener's exact origin, so the message is not broadcast.
  const target = process.env.APP_URL || process.env.FRONTEND_URL || '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${ok ? 'Connected' : 'Connection failed'}</title></head>
<body
  data-status="${ok ? 'success' : 'error'}"
  data-provider="${esc(safeProvider)}"
  data-integration="${esc(safeType)}"
  data-target="${esc(target)}"
>
<p>${ok
    ? 'Connected. This window will close automatically.'
    : 'That connection could not be completed. Please close this window and try again.'}</p>
<script src="/api/oauth/popup.js"></script>
</body>
</html>`;
}

/**
 * Served as a real script file so helmet's `script-src 'self'` allows it — an
 * inline block here is silently dropped by the CSP, which is why the popups never
 * signalled anything.
 */
router.get('/popup.js', (_req, res) => {
  res.type('application/javascript').send(`(function () {
  var b = document.body;
  var ok = b.dataset.status === 'success';
  var msg = {
    type: ok ? 'oauth_success' : 'oauth_error',
    provider: b.dataset.provider,
    integrationType: b.dataset.integration
  };
  var delivered = false;
  try {
    if (window.opener) {
      // Named origin when we know it; '*' only as a last resort, and the payload
      // carries no secret either way.
      window.opener.postMessage(msg, b.dataset.target || '*');
      delivered = true;
    }
  } catch (e) { /* opener gone or cross-origin */ }

  if (delivered) { setTimeout(function () { window.close(); }, 300); return; }

  // NO OPENER. Verified 2026-10-06: this page is served with COOP same-origin (helmet
  // default) while the app that opens it sends none, which per the spec puts the popup
  // in a new browsing-context group and nulls window.opener. An in-app browser or a
  // phone's system-browser tab has no opener either. There is nobody to message, and
  // window.close() is refused for a window script did not open, so the user would be
  // stranded on a page promising it will close. Send them back into the app instead:
  // it reads the outcome from the query string and CONFIRMS it with the server, and on
  // a phone this https URL is claimed by the installed app (universal / app link) or
  // simply opens the web app. The security header is deliberately left as it is.
  var t = b.dataset.target;
  if (t) {
    var who = b.dataset.integration || b.dataset.provider || '';
    // (The regex below needs a DOUBLE backslash in the server source because this sits
    // inside a template literal: a single one collapses and the emitted regex becomes
    // two slashes, which is a comment and broke the whole script.)
    location.replace(t.replace(/\\/+$/, '') + '/Integrations?oauth=' + (ok ? 'success' : 'error') + '&provider=' + encodeURIComponent(who));
  } else {
    setTimeout(function () { window.close(); }, 300);
  }
})();`);
});

export default router;
