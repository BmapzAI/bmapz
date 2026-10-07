/**
 * Connect an integration (Google, Meta, LinkedIn, X, TikTok, Canva) through the provider's own sign-in, on the website AND in the
 * Android / iOS apps, and answer one question honestly: did it connect?
 *
 * The SERVER decides. A popup that closes, a window message, a bmapz:// link: each is only a hint that it is time to ask
 * GET /api/integrations/status, which reports per provider whether a token is stored (`oauth_connected`) and a stamp that changes on every new
 * sign-in (`oauth_stamp`). The callback page is served with COOP same-origin, which severs the popup's opener, so on the website a popup can
 * close "looking cancelled" after a perfectly good connect; and the apps have no popup at all.
 *
 *   website : popup window, confirm with the server when it closes or says it finished.
 *   app     : system browser (Google forbids embedded WebViews). The callback page hands control back by bmapz://oauth; closing the browser tab
 *             or (Android) returning to the app also starts the check. A link that says status=error ends it at once.
 *
 * Resolves { status: 'connected' | 'popup_blocked' | 'not_completed' | 'failed', message? }. Throws only when the sign-in cannot be STARTED
 * (for example the platform's OAuth credentials are not configured), so callers can show that specific message.
 */
import { api } from '@/api/apiClient';
import { waitForConnection as waitFor, statusOfAppLink } from '@/lib/oauthState';
import {
  isNativeApp, isAndroidApp, openExternalUrl, closeExternalBrowser, onAppUrlOpen, onAppResume, onBrowserFinished,
} from '@/lib/platform';

let activeFlows = 0;
/** True while a connect is waiting for its browser. The app-level link handler leaves those returns to the flow that is waiting. */
export const isOauthFlowActive = () => activeFlows > 0;

/** What the server says about this provider right now. `ok:false` when it could not be asked. */
export async function readOauthState(provider) {
  try {
    const r = await api.get('/api/integrations/status');
    return { ok: true, connected: r?.oauth_connected?.[provider] === true, stamp: r?.oauth_stamp?.[provider] ?? null };
  } catch {
    return { ok: false };
  }
}

const waitForConnection = (opts) => waitFor({ read: readOauthState, ...opts });

async function startFlow({ provider, type, client }) {
  // One request for the launch URL and one for the baseline, together, so the browser opens without an extra round trip.
  const [{ authUrl }, baseline] = await Promise.all([
    api.get('/api/oauth/launch-url', { provider, type, ...(client ? { client } : {}) }),
    readOauthState(provider),
  ]);
  return { authUrl, baseline };
}

async function connectInApp({ provider, type }) {
  const { authUrl, baseline } = await startFlow({ provider, type, client: 'app' });
  if (!(await openExternalUrl(authUrl))) return { status: 'popup_blocked' };

  return new Promise((resolve) => {
    const stops = [];
    let settled = false;
    let checking = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      stops.forEach((stop) => stop());
      resolve(result);
    };
    const check = async (timeoutMs) => {
      if (checking || settled) return;
      checking = true;
      closeExternalBrowser();
      const ok = await waitForConnection({ provider, baseline, timeoutMs });
      finish(ok ? { status: 'connected' } : { status: 'not_completed' });
    };

    stops.push(onAppUrlOpen((url) => {
      const status = statusOfAppLink(url);
      if (!status) return;
      if (status === 'error') { closeExternalBrowser(); finish({ status: 'failed', message: 'The sign-in was not completed.' }); return; }
      check(45000);
    }));
    // Closing the browser tab without the link: the sign-in may have finished just before, so give the server a short moment, not a long wait.
    stops.push(onBrowserFinished(() => check(10000)));
    // On Android the Custom Tab leaves the app paused, so coming back is itself the signal. On iOS the app stays active while the
    // in-app browser is up (and an unrelated pause, such as a Face ID prompt, must not be mistaken for coming back), so iOS relies on the
    // link and on the tab closing.
    if (isAndroidApp()) stops.push(onAppResume(() => check(10000)));
    const giveUp = setTimeout(() => finish({ status: 'not_completed' }), 10 * 60 * 1000);
    stops.push(() => clearTimeout(giveUp));
  });
}

async function connectInPopup({ provider, type }) {
  const { authUrl, baseline } = await startFlow({ provider, type });
  const popup = window.open(authUrl, 'oauth_popup', 'width=620,height=720,left=200,top=80');
  if (!popup) return { status: 'popup_blocked' };

  return new Promise((resolve) => {
    let settled = false;
    let checking = false;
    let timer = null;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearInterval(timer);
      window.removeEventListener('message', onMessage);
      resolve(result);
    };
    const check = async (timeoutMs) => {
      if (checking || settled) return;
      checking = true;
      const ok = await waitForConnection({ provider, baseline, timeoutMs });
      finish(ok ? { status: 'connected' } : { status: 'not_completed' });
    };
    function onMessage(event) {
      // The message can come from any window, so it only ever STARTS the server check (a success) or ends the wait early (an error).
      if (event.data?.type === 'oauth_success') check(15000);
      else if (event.data?.type === 'oauth_error') finish({ status: 'failed', message: event.data.error || 'The sign-in was not completed.' });
    }
    window.addEventListener('message', onMessage);
    // A popup that closes is not proof of a cancel (see the header): ask the server, patiently.
    timer = setInterval(() => { if (popup.closed) { clearInterval(timer); check(45000); } }, 800);
  });
}

export function connectProvider({ provider, type }) {
  activeFlows += 1;
  const run = isNativeApp() ? connectInApp : connectInPopup;
  return run({ provider, type }).finally(() => { activeFlows -= 1; });
}
