/**
 * The pure decisions behind "did the connection happen?" (see lib/oauthConnect.js). Kept free of imports so they can be tested in plain Node.
 */

/**
 * Is `current` a NEW connection compared with `baseline` (read before the browser opened)? Connected now and either it was not
 * connected before or the stamp moved (a re-consent of an already-connected provider). If the baseline could not be read, being connected
 * is taken as success.
 */
export function isNewConnection(current, baseline) {
  if (!current?.ok || !current.connected) return false;
  if (!baseline?.ok || !baseline.connected) return true;
  return current.stamp !== baseline.stamp;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Poll `read(provider)` until the provider shows as newly connected, or the time runs out. */
export async function waitForConnection({ provider, baseline, read, timeoutMs = 45000, intervalMs = 1500 }) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (isNewConnection(await read(provider), baseline)) return true;
    if (Date.now() + intervalMs >= deadline) return false;
    await sleep(intervalMs);
  }
}

/** The status carried by a bmapz://oauth link ('success' | 'error' | null). The link is a hint, never proof. */
export function statusOfAppLink(url) {
  try {
    const u = new URL(String(url));
    if (u.protocol !== 'bmapz:' || u.hostname !== 'oauth') return null;
    const s = u.searchParams.get('status');
    return s === 'success' || s === 'error' ? s : null;
  } catch {
    return null;
  }
}

/**
 * Which OAuth provider a type or display name belongs to ('gmail' / 'Google Analytics' -> 'google', 'meta_ads' / 'Instagram' -> 'meta', 'Twitter/X' -> 'twitter'...),
 * in the keys GET /api/integrations/status uses for `oauth_connected`. null when it is not one of the six.
 */
export function providerFamily(value) {
  const v = String(value || '').toLowerCase();
  if (!v) return null;
  if (/google|gmail|youtube/.test(v)) return 'google';
  if (/meta|facebook|instagram|whatsapp/.test(v)) return 'meta';
  if (/linkedin/.test(v)) return 'linkedin';
  if (/twitter|^x$/.test(v)) return 'twitter';
  if (/tiktok/.test(v)) return 'tiktok';
  if (/canva/.test(v)) return 'canva';
  return null;
}
