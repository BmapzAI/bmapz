/**
 * Native-app awareness: the website and the Android / iOS apps (a Capacitor shell, see /mobile) run THIS SAME CODE.
 *
 * Everything that must behave differently inside the app goes through here, so there is exactly one answer to
 * "am I in the app?" and one place that knows how to reach the native side:
 *
 *   - isNativeApp()          true inside the Android/iOS shell. Also true for a bundle BUILT for the app
 *                            (VITE_NATIVE_BUILD=1, set by mobile/scripts/build-web.mjs), so a store build can never show
 *                            a purchase screen even if the runtime check were to fail on a cold start.
 *   - <WebOnly> (components/ui/WebOnly.jsx) wraps what must not exist in the app (see below).
 *   - openExternalUrl()      the system browser (in-app browser tab), never the embedded WebView.
 *   - onAppUrlOpen()/onAppResume()/onBrowserFinished()   deep-link returns and "the user came back to the app".
 *
 * NO @capacitor/* PACKAGE IS IMPORTED HERE, on purpose. The native shell injects `window.Capacitor` and one
 * `window.Capacitor.Plugins.<Name>` object per installed plugin before any page script runs (Android: JSExport.java,
 * iOS: JSExport.swift), so this code reaches the native side through those and the website's dependencies and production
 * build stay exactly as they were. The plugins themselves are installed in /mobile/package.json. If Capacitor ever drops that
 * injection, the tests in backend/tests/frontend-platform.test.mjs and the app build in CI are where it shows first.
 *
 * WHY THE APP HIDES BILLING: the stores take 15-30% and require their own in-app payment system for digital
 * subscriptions, and reviewers reject apps that link to an outside checkout. The apps are consumption-only: plans and
 * credit packs are bought on ai.bmapz.com and used in the app. See docs/audit-2026-10-06/mobile-research.md.
 */

// import.meta.env is Vite's; the fallback lets plain Node import this file in tests.
const ENV = import.meta.env || {};
const BUILT_FOR_NATIVE = ENV.VITE_NATIVE_BUILD === '1';

/** Test the app's behaviour in a desktop browser: open the site with ?native=1 on a dev server (never honoured in production builds). */
function devOverride() {
  if (!ENV.DEV || typeof window === 'undefined') return false;
  try { return new URLSearchParams(window.location.search).get('native') === '1'; } catch { return false; }
}

export function isNativeApp() {
  if (BUILT_FOR_NATIVE || devOverride()) return true;
  if (typeof window === 'undefined') return false;
  try { return window.Capacitor?.isNativePlatform?.() === true; } catch { return false; }
}

/** 'ios' | 'android' | 'web' */
export function nativePlatform() {
  if (typeof window !== 'undefined') {
    try { const p = window.Capacitor?.getPlatform?.(); if (p) return p; } catch { /* fall through */ }
  }
  return isNativeApp() ? 'android' : 'web';
}

export const isIOSApp = () => isNativeApp() && nativePlatform() === 'ios';
export const isAndroidApp = () => isNativeApp() && nativePlatform() === 'android';

/** The injected native plugin object (Browser, App, SocialLogin, ...). Throws a plain message when this build does not include it. */
export function nativePlugin(name) {
  const plugin = typeof window !== 'undefined' ? window.Capacitor?.Plugins?.[name] : undefined;
  if (!plugin) throw new Error(`The native "${name}" plugin is not part of this build.`);
  return plugin;
}

/**
 * Open a URL OUTSIDE the app's WebView.
 *
 * In the app that is the system's in-app browser tab (SFSafariViewController on iOS, a Chrome Custom Tab on Android):
 * Google refuses OAuth inside embedded WebViews, and the stores expect third-party sign-ins there. On the web it is a
 * normal new tab. Returns true when something was opened.
 */
export async function openExternalUrl(url) {
  if (!url) return false;
  if (isNativeApp()) {
    try {
      await nativePlugin('Browser').open({ url });
      return true;
    } catch (err) {
      console.error('[platform] could not open the system browser:', err?.message || err);
      return false;
    }
  }
  const w = window.open(url, '_blank', 'noopener,noreferrer');
  return !!w;
}

/** Close the system browser tab opened by openExternalUrl (iOS; Android Custom Tabs close themselves). Safe to call anywhere. */
export async function closeExternalBrowser() {
  if (!isNativeApp()) return;
  try { await nativePlugin('Browser').close(); } catch { /* nothing open, or not supported on this platform */ }
}

/** Base64 of a Blob, in chunks so a large file cannot overflow the call stack. Works in browsers and in Node. */
async function blobToBase64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/**
 * Save a file the app generated (a CSV export, a PDF report, an HTML post).
 *
 * Website: the ordinary download through a temporary link, exactly as before. App: a download link does nothing inside a WebView, so the
 * file is written to the app's cache and handed to the system share sheet (save to Files, send by e-mail, open in another app).
 * Returns true when the file was handed over.
 */
export async function saveFile(blob, filename) {
  if (!blob || !filename) return false;
  if (!isNativeApp()) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  }
  try {
    const data = await blobToBase64(blob);
    const { uri } = await nativePlugin('Filesystem').writeFile({ path: filename, data, directory: 'CACHE' });
    await nativePlugin('Share').share({ title: filename, url: uri, dialogTitle: filename });
    return true;
  } catch (err) {
    // A person closing the share sheet is not an error worth reporting.
    if (/cancel|dismiss/i.test(String(err?.message || ''))) return true;
    console.error('[platform] could not save the file:', err?.message || err);
    return false;
  }
}

/** Subscribe to a native plugin event. Works whether the bridge hands back the handle directly or as a promise. Returns an unsubscribe. */
function listen(pluginName, eventName, callback) {
  let handle = null;
  let cancelled = false;
  try {
    Promise.resolve(nativePlugin(pluginName).addListener(eventName, callback))
      .then((h) => { if (cancelled) h?.remove?.(); else handle = h; })
      .catch((err) => console.error(`[platform] ${pluginName}.${eventName} listener failed:`, err?.message || err));
  } catch (err) {
    console.error(`[platform] ${pluginName}.${eventName} listener failed:`, err?.message || err);
  }
  return () => { cancelled = true; try { handle?.remove?.(); } catch { /* already gone */ } };
}

/**
 * Subscribe to links that open the app (the bmapz:// scheme, or later a Universal Link / App Link on https://ai.bmapz.com).
 * handler receives the URL string. Returns an unsubscribe function. No-op on the web.
 */
export function onAppUrlOpen(handler) {
  if (!isNativeApp()) return () => {};
  return listen('App', 'appUrlOpen', (event) => { if (event?.url) handler(event.url); });
}

/**
 * Subscribe to "the person closed the system browser tab" (iOS fires this when the in-app browser is dismissed; on Android the
 * app resuming is the signal, see onAppResume). No-op on the web.
 */
export function onBrowserFinished(handler) {
  if (!isNativeApp()) return () => {};
  return listen('Browser', 'browserFinished', () => handler());
}

/**
 * Subscribe to "the app came back to the foreground" (for example after a sign-in in the system browser). No-op on the web.
 * Only fires for a return that FOLLOWS the app going to the background after this call, so a stray "active" event that was
 * already on its way when the browser opened cannot be mistaken for the person coming back.
 */
export function onAppResume(handler) {
  if (!isNativeApp()) return () => {};
  let wentAway = false;
  return listen('App', 'appStateChange', (state) => {
    if (state && state.isActive === false) wentAway = true;
    else if (state?.isActive && wentAway) handler();
  });
}
