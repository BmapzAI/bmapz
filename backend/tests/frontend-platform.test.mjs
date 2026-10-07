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

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
