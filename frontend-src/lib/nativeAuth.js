/**
 * Sign in with Google / Apple INSIDE the Android and iOS apps (Capacitor).
 *
 * The website signs in with Google Identity Services (lib/googleAuth.js), which only works on https pages Google has
 * registered; the app's pages live on capacitor://localhost (iOS) and https://localhost (Android), and Google also forbids
 * OAuth inside an embedded WebView. So the app asks the operating system's own account picker (Credential Manager on
 * Android, GoogleSignIn / AuthenticationServices on iOS) for an ID token and hands it to Supabase, exactly like the
 * website does with the token it gets from GIS (supabase.auth.signInWithIdToken).
 *
 * NONCE. Same scheme as googleAuth.js: a random raw nonce stays here and goes to Supabase; its SHA-256 (hex) goes to the
 * provider and ends up inside the ID token, where Supabase compares it. The plugin passes the value through untouched on
 * both platforms (verified in its Swift/Java source), so it must be the HASH that is passed to it.
 *
 * WHAT THE OWNER MUST CREATE (cannot be done from code): see docs/MOBILE_SETUP.md
 *   - Google Cloud: an Android OAuth client (package name + SHA-1) and an iOS OAuth client (bundle id);
 *   - Supabase: add the iOS client id to the Google provider's "Authorized Client IDs";
 *   - Apple: Services ID + key, configured in Supabase's Apple provider (Sign in with Apple is offered on iOS only).
 */
import { supabase } from '@/lib/supabase';
import { api } from '@/api/apiClient';
import { GOOGLE_CLIENT_ID } from '@/lib/googleAuth';
import { isAndroidApp, isIOSApp, isNativeApp, nativePlugin } from '@/lib/platform';

const ENV = import.meta.env || {};
const GOOGLE_IOS_CLIENT_ID = ENV.VITE_GOOGLE_IOS_CLIENT_ID || '';
// Sign in with Apple needs the owner's Apple Developer setup; the button stays hidden until it is switched on for the build.
const APPLE_ENABLED = ENV.VITE_APPLE_SIGNIN === '1';

/** True when this build can offer the native Google account picker. iOS needs its own client id; Android uses the web client id. */
export function nativeGoogleAvailable() {
  if (!isNativeApp()) return false;
  if (isIOSApp()) return !!GOOGLE_IOS_CLIENT_ID;
  return isAndroidApp();
}

/** True when this build can offer Sign in with Apple (iOS only, and only once the Apple setup exists). */
export function nativeAppleAvailable() {
  return isIOSApp() && APPLE_ENABLED;
}

async function makeNonce() {
  const raw = `${crypto.randomUUID()}${crypto.randomUUID()}`;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  const hashed = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return { raw, hashed };
}

let initialised = null;
async function socialLogin() {
  // The plugin object the native shell injected (installed in mobile/package.json); nothing is imported into the website.
  const SocialLogin = nativePlugin('SocialLogin');
  if (!initialised) {
    initialised = SocialLogin.initialize({
      google: {
        webClientId: GOOGLE_CLIENT_ID,
        ...(GOOGLE_IOS_CLIENT_ID ? { iOSClientId: GOOGLE_IOS_CLIENT_ID, iOSServerClientId: GOOGLE_CLIENT_ID } : {}),
        mode: 'online',
      },
      ...(nativeAppleAvailable() ? { apple: {} } : {}),
    }).catch((err) => { initialised = null; throw err; });
  }
  await initialised;
  return SocialLogin;
}

/** A person closing the account picker is not an error worth showing. */
export function isNativeSignInCancelled(err) {
  const text = `${err?.code || ''} ${err?.message || ''}`.toLowerCase();
  // Apple: ASAuthorizationError.canceled = 1001. Google on Android: GetCredentialCancellationException. Google on iOS: GIDSignIn canceled = -5.
  return /cancel|dismiss|\b1001\b|\b12501\b|(^|\s)-5(\s|$)/.test(text);
}

async function exchange(provider, idToken, rawNonce) {
  if (!idToken) throw new Error('The sign-in did not return a token. Please try again.');
  const { error } = await supabase.auth.signInWithIdToken({ provider, token: idToken, nonce: rawNonce });
  if (error) throw error;
  // The session is established: AuthProvider's onAuthStateChange takes over, exactly as on the website.
}

export async function signInWithGoogleNative() {
  const plugin = await socialLogin();
  const { raw, hashed } = await makeNonce();
  const res = await plugin.login({ provider: 'google', options: { scopes: ['email', 'profile'], nonce: hashed } });
  await exchange('google', res?.result?.idToken, raw);
}

export async function signInWithAppleNative() {
  const plugin = await socialLogin();
  const { raw, hashed } = await makeNonce();
  const res = await plugin.login({ provider: 'apple', options: { scopes: ['email', 'name'], nonce: hashed } });
  await exchange('apple', res?.result?.idToken, raw);
  // Apple sends the person's name ONCE, on the very first authorisation, and not inside the ID token. The account is created from the
  // token alone, so keep the name now or it is lost for good (the server reads full_name from the user's metadata when it sets the account up).
  const profile = res?.result?.profile || {};
  const fullName = [profile.givenName, profile.familyName].filter(Boolean).join(' ').trim();
  if (fullName) {
    await supabase.auth.updateUser({ data: { full_name: fullName } }).catch(() => {});
    // The account row may already have been created from the e-mail alone by the time that update lands, so set the name on it too (best effort).
    try { await api.get('/api/auth/me'); await api.patch('/api/users/me', { full_name: fullName }); } catch { /* the name can be edited in the profile */ }
  }
}
