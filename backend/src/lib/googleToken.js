/**
 * One place to get a usable Google access token for a company.
 *
 * Every Google service Bmapz talks to (Gmail, Calendar, Drive, Analytics, Search
 * Console, YouTube, Ads) shares ONE stored OAuth token. An access token lasts about an
 * hour, so anything that reads api_keys.google_access_token directly works for the first
 * hour after connecting and then fails with a 401 that looks like a revoked grant.
 *
 * This logic used to exist in three diverging copies (routes/integrations.js,
 * routes/messaging.js, routes/ads.js) and two routes (Search Console reports in
 * seo.js, GA4 reports in integrations.js) skipped refreshing altogether. New callers
 * should use this; the remaining copies are listed in AGENT_HANDOFF.md for
 * consolidation.
 *
 * THROWS when Google rejects the refresh (revoked / expired grant). Callers that can
 * show a message should catch and say "reconnect Google"; the text is Google's OAuth
 * response, not database detail, so it is safe to display.
 */
import { supabaseAdmin } from './supabase.js';

export async function getGoogleAccessToken(companyId, keys) {
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

  // Merge into the CURRENT row, not the caller's snapshot: the snapshot can be stale by
  // the time the refresh returns, and writing it back would undo whatever changed since.
  const { data: row, error: readErr } = await supabaseAdmin
    .from('companies').select('api_keys').eq('id', companyId).maybeSingle();
  if (readErr) console.error('[googleToken] could not re-read api_keys before saving the refreshed token:', readErr.message);
  const updatedKeys = {
    ...(row?.api_keys || keys),
    google_access_token: tokens.access_token,
    google_token_expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
  };
  const { error: writeErr } = await supabaseAdmin.from('companies').update({ api_keys: updatedKeys }).eq('id', companyId);
  if (writeErr) console.error('[googleToken] refreshed token could not be saved (will refresh again next call):', writeErr.message);
  return tokens.access_token;
}
