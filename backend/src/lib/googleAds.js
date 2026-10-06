/**
 * Google Ads REST helpers shared by routes/ads.js and routes/integrations.js, so the
 * version, the headers and the error shape are decided in exactly one place.
 *
 * VERSION. v24 shipped 2026-04-22 and v25 on 2026-07-22 (v25.2 on 2026-09-23); v26 is
 * scheduled for October 2026. Older versions are retired roughly a year after release,
 * and v22 is on a tentative October 2026 sunset - so a pinned version is a countdown, not
 * a constant. Overridable without a deploy: set GOOGLE_ADS_API_VERSION in Railway.
 *
 * DEVELOPER TOKEN. Sunset 2026-09-09; the header is "optional and ignored by the API
 * servers" and Google has said it will start REJECTING it in an unnamed future major
 * version. So it is NOT sent by default. A stale GOOGLE_ADS_DEVELOPER_TOKEN left in
 * Railway would otherwise turn into a hard failure the day the version is bumped past
 * that change. GOOGLE_ADS_SEND_DEV_TOKEN=true restores it for a version that still wants it.
 *
 * LOGIN CUSTOMER ID. An agency, or anyone reaching a customer account through a manager
 * (MCC) account, is rejected with a permission error unless login-customer-id names the
 * manager. It was read by adPublisher.js and sent by nothing.
 */
export const GOOGLE_ADS_API_VERSION = process.env.GOOGLE_ADS_API_VERSION || 'v25';

const digits = (v) => String(v || '').replace(/\D/g, '');

export function googleAdsHeaders({ token, keys = {} }) {
  const devToken = keys.google_ads_developer_token || process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const login = digits(keys.google_ads_login_customer_id);
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...(devToken && process.env.GOOGLE_ADS_SEND_DEV_TOKEN === 'true' ? { 'developer-token': devToken } : {}),
    ...(login ? { 'login-customer-id': login } : {}),
  };
}

/**
 * searchStream reports failures as a JSON ARRAY - [{"error":{...}}] - not an object, so
 * `d.error?.message` was undefined and the person saw a bare "HTTP 403" instead of
 * Google's actual reason (USER_PERMISSION_DENIED, CUSTOMER_NOT_FOUND, ...).
 */
export function googleAdsApiError(d) {
  return Array.isArray(d) ? d.find((x) => x?.error)?.error : d?.error;
}

export function googleAdsErrorMessage(d, status) {
  const e = googleAdsApiError(d);
  return e?.details?.[0]?.errors?.[0]?.message || e?.message || `HTTP ${status}`;
}
