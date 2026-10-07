// The browser origins of the Android and iOS apps (Capacitor serves the bundled pages from these). One list, used by CORS (index.js) and by
// the routes that must refuse the apps (billing.js): the apps are consumption-only, so a purchase or portal session must never be created
// for them even by a hand-made request.
export const APP_ORIGINS = ['capacitor://localhost', 'https://localhost'];

/** True when the request came from one of the apps' pages. */
export function isAppOrigin(req) {
  return APP_ORIGINS.includes(String(req?.headers?.origin || ''));
}
