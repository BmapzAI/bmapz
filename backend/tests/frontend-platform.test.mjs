// Behaviour test: frontend-src/lib/platform.js, the single answer to "am I inside the Android / iOS app?".
// The store apps must never show a purchase surface, so this is what everything billing-related hangs off.
// Run all: node backend/tests/run.mjs. Pure logic, no server.
let fail = 0;
const t = (name, ok, extra = '') => { if (!ok) fail++; console.log(ok ? 'PASS' : 'FAIL', name, ok ? '' : extra); };

const load = async (tag) => import('../../frontend-src/lib/platform.js?' + tag);

// 1. plain website: no window at all (SSR / tests) and a window with no Capacitor
delete globalThis.window;
let p = await load('nowindow');
t('no window -> not native', p.isNativeApp() === false);
t('no window -> platform "web"', p.nativePlatform() === 'web');
t('no window -> nothing to unsubscribe, no throw', typeof p.onAppUrlOpen(() => {}) === 'function' && typeof p.onAppResume(() => {}) === 'function');

globalThis.window = { location: { search: '' } };
p = await load('website');
t('website (no Capacitor object) -> not native', p.isNativeApp() === false && p.isIOSApp() === false && p.isAndroidApp() === false);
t('website -> openExternalUrl opens a normal tab with noopener', await (async () => {
  let args = null;
  globalThis.window.open = (...a) => { args = a; return {}; };
  const ok = await p.openExternalUrl('https://example.com/x');
  return ok === true && args[0] === 'https://example.com/x' && args[1] === '_blank' && /noopener/.test(args[2]);
})());
t('website -> an empty URL opens nothing', (await p.openExternalUrl('')) === false);

// 2. Capacitor object present but reporting the web platform (what @capacitor/core does in a normal browser)
globalThis.window = { location: { search: '' }, Capacitor: { isNativePlatform: () => false, getPlatform: () => 'web' } };
p = await load('capacitor-web');
t('Capacitor on the web -> not native', p.isNativeApp() === false && p.nativePlatform() === 'web');

// 3. inside the iOS shell
globalThis.window = { location: { search: '' }, Capacitor: { isNativePlatform: () => true, getPlatform: () => 'ios' } };
p = await load('ios');
t('iOS shell -> native, iOS, not Android', p.isNativeApp() === true && p.isIOSApp() === true && p.isAndroidApp() === false && p.nativePlatform() === 'ios');

// 4. inside the Android shell
globalThis.window = { location: { search: '' }, Capacitor: { isNativePlatform: () => true, getPlatform: () => 'android' } };
p = await load('android');
t('Android shell -> native, Android, not iOS', p.isNativeApp() === true && p.isAndroidApp() === true && p.isIOSApp() === false);

// 5. a bridge that throws must read as "web", never crash the page
globalThis.window = { location: { search: '' }, Capacitor: { isNativePlatform: () => { throw new Error('bridge not ready'); } } };
p = await load('broken');
t('a throwing bridge is treated as the website', p.isNativeApp() === false);

// 6. the ?native=1 override is for the dev server only: it must never work on the production site
globalThis.window = { location: { search: '?native=1' } };
p = await load('override');
t('?native=1 is ignored when not a dev build (the production site cannot be switched into app mode)', p.isNativeApp() === false);

// 7. the native calls go to the plugin objects the shell injects (window.Capacitor.Plugins.<Name>), with no @capacitor package imported
const tick = () => new Promise((r) => setTimeout(r, 5));
const makeShell = ({ withBrowser = true } = {}) => {
  const calls = [];
  const listeners = {};
  const removed = [];
  const plugin = (name) => ({
    addListener: (event, cb) => { listeners[name + '.' + event] = cb; return { remove: async () => { removed.push(name + '.' + event); } }; },
  });
  const Plugins = { App: plugin('App'), Browser: { ...plugin('Browser'), open: async (o) => { calls.push(['open', o]); }, close: async () => { calls.push(['close']); } } };
  if (!withBrowser) delete Plugins.Browser;
  globalThis.window = { location: { search: '' }, Capacitor: { isNativePlatform: () => true, getPlatform: () => 'android', Plugins } };
  return { calls, listeners, removed };
};

let shell = makeShell();
p = await load('shell1');
t('native: openExternalUrl opens the SYSTEM browser through the injected Browser plugin', (await p.openExternalUrl('https://accounts.example/auth')) === true && JSON.stringify(shell.calls[0]) === JSON.stringify(['open', { url: 'https://accounts.example/auth' }]), JSON.stringify(shell.calls));
await p.closeExternalBrowser();
t('native: closeExternalBrowser closes it', shell.calls.some((c) => c[0] === 'close'));

shell = makeShell({ withBrowser: false });
p = await load('shell-nobrowser');
const quiet = console.error; console.error = () => {};
const opened = await p.openExternalUrl('https://x.example');
console.error = quiet;
t('native: a build without the Browser plugin fails soft (returns false, no throw)', opened === false);
t('native: nativePlugin names the missing plugin', (() => { try { p.nativePlugin('Browser'); return false; } catch (e) { return /"Browser"/.test(e.message); } })());

shell = makeShell();
p = await load('shell2');
let got = null;
const offUrl = p.onAppUrlOpen((u) => { got = u; });
await tick();
shell.listeners['App.appUrlOpen']({ url: 'bmapz://oauth?status=success&integration=gmail' });
t('native: appUrlOpen hands the URL string to the handler', got === 'bmapz://oauth?status=success&integration=gmail', String(got));
shell.listeners['App.appUrlOpen']({});
t('native: an event without a url is ignored', got === 'bmapz://oauth?status=success&integration=gmail');
offUrl();
t('native: unsubscribing removes the native listener', shell.removed.includes('App.appUrlOpen'));

let resumes = 0;
const offResume = p.onAppResume(() => { resumes++; });
await tick();
shell.listeners['App.appStateChange']({ isActive: true });
t('native: an "active" event that was NOT preceded by the app going away is not a return', resumes === 0);
shell.listeners['App.appStateChange']({ isActive: false });
shell.listeners['App.appStateChange']({ isActive: true });
t('native: going away and coming back IS a return', resumes === 1, String(resumes));
offResume();

let finished = 0;
p.onBrowserFinished(() => { finished++; });
await tick();
shell.listeners['Browser.browserFinished']({});
t('native: closing the browser tab fires browserFinished', finished === 1);

// unsubscribing before the listener registration resolves must not leak it
shell = makeShell();
p = await load('shell3');
p.onAppUrlOpen(() => {})();
await tick();
t('native: an unsubscribe that races the registration still removes the listener', shell.removed.includes('App.appUrlOpen'));

// 8. which auth events reset the whole app (lib/authEvents.js)
const { authEventPlan } = await import('../../frontend-src/lib/authEvents.js');
const plan = (event, sessionUserId, loadedUserId) => authEventPlan({ event, sessionUserId, loadedUserId });
t('auth: an hourly TOKEN_REFRESHED does nothing (it used to blank the app to a spinner)', JSON.stringify(plan('TOKEN_REFRESHED', 'u1', 'u1')) === JSON.stringify({ reload: false, spinner: false, silent: false }));
t('auth: a repeat SIGNED_IN for the person already on screen refreshes QUIETLY (no spinner; a failure keeps the screen)', JSON.stringify(plan('SIGNED_IN', 'u1', 'u1')) === JSON.stringify({ reload: true, spinner: false, silent: true }));
t('auth: the first load (nobody on screen yet) gets the full treatment', JSON.stringify(plan('INITIAL_SESSION', 'u1', null)) === JSON.stringify({ reload: true, spinner: true, silent: false }));
t('auth: a DIFFERENT person signing in gets the full treatment', JSON.stringify(plan('SIGNED_IN', 'u2', 'u1')) === JSON.stringify({ reload: true, spinner: true, silent: false }));
t('auth: signing out clears everything with the spinner', JSON.stringify(plan('SIGNED_OUT', undefined, 'u1')) === JSON.stringify({ reload: true, spinner: true, silent: false }));
t('auth: a user update for the same person is quiet too', plan('USER_UPDATED', 'u1', 'u1').spinner === false);

// 11. saving a generated file: the ordinary download on the website, the share sheet in the app (a download link does nothing in a WebView)
{
  const clicks = [];
  const fakeDoc = { createElement: () => { const a = { click() { clicks.push({ href: a.href, download: a.download }); } }; return a; } };
  globalThis.document = fakeDoc;
  globalThis.window = { location: { search: '' } };
  let p2 = await load('save-web');
  const blob = new Blob(['a,b\n1,2'], { type: 'text/csv' });
  t('saveFile on the website: a temporary download link named after the file', (await p2.saveFile(blob, 'leads.csv')) === true && clicks.length === 1 && clicks[0].download === 'leads.csv' && /^blob:/.test(clicks[0].href), JSON.stringify(clicks));
  t('saveFile: nothing to save -> false, nothing happens', (await p2.saveFile(null, 'x.csv')) === false && (await p2.saveFile(blob, '')) === false && clicks.length === 1);

  const calls = [];
  const Filesystem = { writeFile: async (o) => { calls.push(['write', o]); return { uri: 'file:///cache/leads.csv' }; } };
  const Share = { share: async (o) => { calls.push(['share', o]); } };
  globalThis.window = { location: { search: '' }, Capacitor: { isNativePlatform: () => true, getPlatform: () => 'ios', Plugins: { Filesystem, Share } } };
  p2 = await load('save-native');
  t('saveFile in the app: written to the cache as base64, then handed to the share sheet', (await p2.saveFile(blob, 'leads.csv')) === true
    && calls[0][0] === 'write' && calls[0][1].path === 'leads.csv' && calls[0][1].directory === 'CACHE' && calls[0][1].data === Buffer.from('a,b\n1,2').toString('base64')
    && calls[1][0] === 'share' && calls[1][1].url === 'file:///cache/leads.csv', JSON.stringify(calls));
  t('saveFile in the app: no browser download link is used', clicks.length === 1);
  const quiet2 = console.error; console.error = () => {};
  globalThis.window.Capacitor.Plugins.Share = { share: async () => { throw new Error('Share canceled'); } };
  t('saveFile in the app: closing the share sheet is not an error', (await load('save-cancel').then((m) => m.saveFile(blob, 'x.csv'))) === true);
  globalThis.window.Capacitor.Plugins.Filesystem = { writeFile: async () => { throw new Error('disk full'); } };
  t('saveFile in the app: a real failure returns false so the caller can say so', (await load('save-fail').then((m) => m.saveFile(blob, 'x.csv'))) === false);
  console.error = quiet2;
  delete globalThis.document;
}

// 10. "did the connection happen?" decisions (lib/oauthState.js): the server decides, never the popup or the link
const { isNewConnection, waitForConnection, statusOfAppLink } = await import('../../frontend-src/lib/oauthState.js');
const none = { ok: true, connected: false, stamp: null };
const was = { ok: true, connected: true, stamp: 'T1' };
t('connect: not connected before, connected now -> a new connection', isNewConnection({ ok: true, connected: true, stamp: 'T2' }, none) === true);
t('connect: still not connected -> nothing happened', isNewConnection(none, none) === false);
t('connect: already connected, stamp unchanged -> the window was closed without finishing (NOT a connection)', isNewConnection(was, was) === false);
t('connect: already connected, stamp moved -> a re-consent finished', isNewConnection({ ok: true, connected: true, stamp: 'T2' }, was) === true);
t('connect: the server could not be asked -> never claim success', isNewConnection({ ok: false }, none) === false);
t('connect: baseline unreadable but now connected -> success (cannot do better)', isNewConnection({ ok: true, connected: true, stamp: 'T9' }, { ok: false }) === true);

let reads = 0;
const fastRead = async () => { reads++; return reads >= 3 ? { ok: true, connected: true, stamp: 'N' } : none; };
t('connect: polls until the server shows the connection', (await waitForConnection({ provider: 'google', baseline: none, read: fastRead, timeoutMs: 2000, intervalMs: 5 })) === true && reads === 3, 'reads=' + reads);
reads = 0;
t('connect: gives up when it never shows within the time allowed', (await waitForConnection({ provider: 'google', baseline: none, read: async () => { reads++; return none; }, timeoutMs: 60, intervalMs: 20 })) === false && reads >= 2, 'reads=' + reads);
t('connect: succeeds at once when it is already there on the first look', (await waitForConnection({ provider: 'meta', baseline: none, read: async () => ({ ok: true, connected: true, stamp: 'Z' }), timeoutMs: 60, intervalMs: 20 })) === true);

t('app link: bmapz://oauth?status=success -> success', statusOfAppLink('bmapz://oauth?status=success&provider=unknown&integration=twitter') === 'success');
t('app link: bmapz://oauth?status=error -> error', statusOfAppLink('bmapz://oauth?status=error&provider=google') === 'error');
t('app link: another host or scheme is not ours', statusOfAppLink('bmapz://other?status=success') === null && statusOfAppLink('https://ai.bmapz.com/oauth?status=success') === null && statusOfAppLink('evil://oauth?status=success') === null);
t('app link: a missing or unknown status is ignored; garbage never throws', statusOfAppLink('bmapz://oauth') === null && statusOfAppLink('bmapz://oauth?status=maybe') === null && statusOfAppLink('::::') === null && statusOfAppLink(undefined) === null);

const { providerFamily } = await import('../../frontend-src/lib/oauthState.js');
t('provider family: every integration type maps to the key /status reports', ['gmail', 'google_calendar', 'google_ads', 'youtube', 'Google Analytics'].every((v) => providerFamily(v) === 'google') && ['meta', 'meta_ads', 'facebook', 'instagram', 'whatsapp'].every((v) => providerFamily(v) === 'meta') && providerFamily('linkedin_ads') === 'linkedin' && ['twitter', 'Twitter/X', 'x'].every((v) => providerFamily(v) === 'twitter') && providerFamily('tiktok_social') === 'tiktok' && providerFamily('Canva') === 'canva');
t('provider family: an unknown name (including the "unknown" the callback uses) is null, never a guess', providerFamily('unknown') === null && providerFamily('') === null && providerFamily(undefined) === null && providerFamily('zapier') === null);

// 9. in the app the server's buying language is replaced (lib/nativeMessages.js)
const { neutralizeForApp } = await import('../../frontend-src/lib/nativeMessages.js');
t('app wording: credits exhausted says so plainly, no "upgrade" / "credit pack"', neutralizeForApp('Insufficient AI credits: 0 remaining, 40 needed. Upgrade your plan or buy a credit pack.', 'CREDITS_EXHAUSTED') === "You've used all of your AI credits for this period.");
t('app wording: an uncoded message that steers to buying is neutralised too', neutralizeForApp('Brand Scans are not included in the trial. Upgrade to Growth+ ... or purchase one from the pricing page.', undefined) === "This isn't available on your current plan.");
t('app wording: a message about something else is left exactly as written', neutralizeForApp('OpenAI API key not configured. Add one in Settings.', 'MISSING_API_KEY') === 'OpenAI API key not configured. Add one in Settings.');
t('app wording: no message at all stays empty', neutralizeForApp('', undefined) === '' && neutralizeForApp(undefined, undefined) === undefined);

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
// Flush stdout first: on Windows the process can exit before its piped output is written, and run.mjs then sees an empty file (a one-off
// "0 passed" failure of a file that had passed).
await new Promise((resolve) => process.stdout.write('', resolve));
process.exit(fail ? 1 : 0);
