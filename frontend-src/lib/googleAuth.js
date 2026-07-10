/**
 * Google sign-in via Google Identity Services (GIS) using ID tokens.
 *
 * WHY THIS EXISTS (and why it replaced supabase.auth.signInWithOAuth):
 *   The old flow redirected the browser through Supabase's servers, so Google's
 *   consent screen told the user "to continue to <project>.supabase.co". That
 *   host text comes from the OAuth redirect target and CANNOT be changed by any
 *   Google Cloud consent-screen setting.
 *
 *   This flow instead loads Google's own sign-in on our page. Google returns an
 *   ID token directly to ai.bmapz.com, which we hand to Supabase via
 *   signInWithIdToken(). Google now shows OUR app/domain, never the Supabase host.
 *
 * The Google client ID is public (it appears in every OAuth URL), so it is safe
 * to ship in the frontend. The client SECRET stays only in Supabase.
 */
import { supabase } from '@/lib/supabase';

// Public web client ID for the Bmapz Google OAuth app. Overridable via env.
export const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  '25970699691-3d9t3thivcc5ka9ba4ovu2krvru25l63.apps.googleusercontent.com';

let gisPromise = null;

/** Load the Google Identity Services script once. */
function loadGis() {
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('gis_load_failed'));
    document.head.appendChild(s);
  });
  return gisPromise;
}

/** Create a raw nonce + its SHA-256 hash (Google gets the hash, Supabase the raw). */
async function makeNonce() {
  const raw =
    (crypto.randomUUID?.() || Math.random().toString(36)) +
    (crypto.randomUUID?.() || Math.random().toString(36));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  const hashed = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return { raw, hashed };
}

/**
 * Render Google's official sign-in button into `container`. On success, a
 * Supabase session is created and AuthContext's onAuthStateChange takes over.
 *
 * @returns {Promise<boolean>} true if the button rendered, false if GIS was
 *   unavailable (caller should show a fallback button).
 */
export async function renderGoogleButton(container, { onError, text = 'continue_with' } = {}) {
  if (!container) return false;
  try {
    await loadGis();
    const { raw, hashed } = await makeNonce();

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      nonce: hashed,
      use_fedcm_for_prompt: true,
      callback: async (response) => {
        try {
          const { error } = await supabase.auth.signInWithIdToken({
            provider: 'google',
            token: response.credential,
            nonce: raw,
          });
          if (error) throw error;
          // Session established — AuthProvider's listener handles the rest.
        } catch (err) {
          onError?.(err);
        }
      },
    });

    container.innerHTML = '';
    const width = Math.min(400, Math.max(240, container.offsetWidth || 360));
    window.google.accounts.id.renderButton(container, {
      type: 'standard',
      theme: 'filled_black',
      size: 'large',
      text,
      shape: 'pill',
      logo_alignment: 'center',
      width,
    });
    return true;
  } catch {
    return false;
  }
}
