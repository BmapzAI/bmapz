/**
 * TikTok (Login Kit / Content Posting) access-token lifecycle.
 *
 * WHY THIS EXISTS. TikTok access tokens last 24 HOURS. The connect flow saved only the
 * access token and its expiry and threw away refresh_token, refresh_expires_in and open_id,
 * and there was no refresh code anywhere in the backend. Every TikTok connection therefore
 * died a day after it was made while the integration card kept showing "connected" - which
 * would have surfaced as "TikTok worked in Sandbox yesterday and is broken today".
 *
 * SCOPE OF WHAT THIS COVERS. This is the Login Kit token (open.tiktokapis.com, scopes
 * user.info.basic / video.publish / video.list). It is NOT an advertising credential: the
 * TikTok Business/Marketing API (business-api.tiktok.com) is a separate program with its own
 * app and its own OAuth flow, so routes/integrations.js `tiktok_ads` cannot work with this
 * token. See AGENT_HANDOFF.md.
 *
 * The response can carry the failure in the BODY with HTTP 200 ({"error":"invalid_grant",...}),
 * so success is "has an access_token", never merely res.ok.
 */
import { supabaseAdmin } from './supabase.js';

export const TIKTOK_OPEN_BASE = (process.env.TIKTOK_OPEN_API_BASE || 'https://open.tiktokapis.com/v2').replace(/\/+$/, '');

async function defaultSave(companyId, patch) {
  const { data: row, error: readErr } = await supabaseAdmin
    .from('companies').select('api_keys').eq('id', companyId).maybeSingle();
  if (readErr) throw new Error(`could not read api_keys before saving the refreshed TikTok token: ${readErr.message}`);
  const { error } = await supabaseAdmin
    .from('companies').update({ api_keys: { ...(row?.api_keys || {}), ...patch } }).eq('id', companyId);
  if (error) throw new Error(`could not save the refreshed TikTok token: ${error.message}`);
}

/**
 * A usable TikTok access token, refreshing it when it is (about to be) expired.
 * THROWS with TikTok's own message when the refresh is rejected, so callers can say
 * "reconnect TikTok". Legacy rows with no recorded expiry are returned as-is.
 */
export async function getTikTokAccessToken(companyId, keys, { fetchImpl = fetch, save = defaultSave, now = Date.now() } = {}) {
  const token = keys.tiktok_access_token;
  const expiresAt = keys.tiktok_token_expires_at ? new Date(keys.tiktok_token_expires_at).getTime() : null;
  if (token && (expiresAt === null || expiresAt > now + 60_000)) return token;

  const refresh = keys.tiktok_refresh_token;
  const clientKey = keys.tiktok_client_key || process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = keys.tiktok_client_secret || process.env.TIKTOK_CLIENT_SECRET;
  if (!refresh || !clientKey || !clientSecret) return token || null;

  const res = await fetchImpl(`${TIKTOK_OPEN_BASE}/oauth/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_key: clientKey, client_secret: clientSecret, grant_type: 'refresh_token', refresh_token: refresh }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error || !body.access_token) {
    throw new Error(body.error_description || body.error || `TikTok token refresh failed (HTTP ${res.status})`);
  }

  await save(companyId, {
    tiktok_access_token: body.access_token,
    // TikTok may rotate the refresh token; when it does the new one replaces the old.
    tiktok_refresh_token: body.refresh_token || refresh,
    tiktok_token_expires_at: new Date(now + (body.expires_in || 86400) * 1000).toISOString(),
    ...(body.refresh_expires_in ? { tiktok_refresh_expires_at: new Date(now + body.refresh_expires_in * 1000).toISOString() } : {}),
    ...(body.open_id ? { tiktok_open_id: body.open_id } : {}),
  });
  return body.access_token;
}
