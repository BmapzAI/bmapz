/**
 * X (Twitter) API plumbing: hosts, PKCE, and the access-token lifecycle.
 *
 * WHY THE TOKEN LIFECYCLE MATTERS. X access tokens last about TWO HOURS. The connect flow
 * asked for offline.access (so X issued a refresh token) and then saved only the access
 * token, so the integration stopped working roughly two hours after connecting while
 * integration_status kept saying "connected". Refresh tokens ROTATE on X: each refresh
 * returns a new one, so the new one must be stored or the next refresh fails.
 *
 * HOSTS. X documents api.x.com and x.com/i/oauth2/authorize. api.twitter.com and
 * twitter.com still answer identically today (verified 2026-10-06; twitter.com 301s to
 * x.com) but only the x.com hosts are documented, and there is no published sunset for the
 * old ones. Overridable via X_API_BASE if X ever moves again.
 *
 * COST NOTE. X is pay-per-use since 2026-02-06: a plain post costs $0.015 and a post with
 * a URL costs $0.20, billed to Bmapz's prepaid credits for every customer post. That is a
 * business decision, not a code detail: see AGENT_HANDOFF.md.
 */
import crypto from 'node:crypto';
import { supabaseAdmin } from './supabase.js';

export const X_API_BASE = (process.env.X_API_BASE || 'https://api.x.com').replace(/\/+$/, '');
export const X_AUTH_URL = process.env.X_AUTH_URL || 'https://x.com/i/oauth2/authorize';

/** PKCE S256. Was 'plain', where the challenge IS the secret verifier and protects nothing. */
export const pkceChallenge = (verifier) => crypto.createHash('sha256').update(verifier).digest('base64url');

/** Default persistence: merge into the CURRENT api_keys row, never the caller's stale snapshot. */
async function defaultSave(companyId, patch) {
  const { data: row, error: readErr } = await supabaseAdmin
    .from('companies').select('api_keys').eq('id', companyId).maybeSingle();
  if (readErr) throw new Error(`could not read api_keys before saving the refreshed X token: ${readErr.message}`);
  const { error } = await supabaseAdmin
    .from('companies').update({ api_keys: { ...(row?.api_keys || {}), ...patch } }).eq('id', companyId);
  if (error) throw new Error(`could not save the refreshed X token: ${error.message}`);
}

/**
 * A usable X access token, refreshing it when it is (about to be) expired.
 * THROWS with X's own message when the refresh is rejected (revoked grant): callers should
 * tell the person to reconnect. Legacy rows with no recorded expiry are returned as-is,
 * because there is no way to know whether they are stale.
 */
export async function getXAccessToken(companyId, keys, { fetchImpl = fetch, save = defaultSave, now = Date.now() } = {}) {
  const token = keys.twitter_access_token;
  const expiresAt = keys.twitter_token_expires_at ? new Date(keys.twitter_token_expires_at).getTime() : null;
  if (token && (expiresAt === null || expiresAt > now + 60_000)) return token;

  const refresh = keys.twitter_refresh_token;
  const clientId = keys.twitter_client_id || process.env.TWITTER_CLIENT_ID;
  const clientSecret = keys.twitter_client_secret || process.env.TWITTER_CLIENT_SECRET;
  if (!refresh || !clientId || !clientSecret) return token || null;

  const res = await fetchImpl(`${X_API_BASE}/2/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refresh }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) {
    // X reports failures as problem+json (title/detail) as well as OAuth-style error fields.
    throw new Error(body.error_description || body.detail || body.title || body.error || `X token refresh failed (HTTP ${res.status})`);
  }

  await save(companyId, {
    twitter_access_token: body.access_token,
    // Rotating: if X sent a new refresh token it REPLACES the old one; if not, keep the old.
    twitter_refresh_token: body.refresh_token || refresh,
    twitter_token_expires_at: new Date(now + (body.expires_in || 7200) * 1000).toISOString(),
  });
  return body.access_token;
}
