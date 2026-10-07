# Mobile apps (Android + iOS): what exists, what only you can do

Approach (decided in the project chat "Web app mobile deployment", 2026-10-06/07): **Capacitor**. The Android and iOS apps are the same web code as ai.bmapz.com, wrapped in a native shell, with the desktop website staying the full product. The apps are **consumption-only**: nobody buys, upgrades or tops up inside them (the stores require their own payment system for that, and take 15-30%); people subscribe on the website and sign in on the phone.

Status of this document: written 2026-10-07 with phase 1. Nothing here has been run on a real phone yet.

## What is in the repo

| Piece | Where |
|---|---|
| Native shell (own `package.json`, so the website build never installs it) | `mobile/` (`android/`, `ios/`, `capacitor.config.json`) |
| "Am I in the app?" and every native call | `frontend-src/lib/platform.js` (no `@capacitor/*` package is imported by the website; the shell injects `window.Capacitor.Plugins`) |
| Sign in with the phone's Google / Apple account | `frontend-src/lib/nativeAuth.js`, `components/auth/GoogleSignInButton.jsx` |
| Connecting an integration from the app: system browser, `bmapz://oauth` hand-back, the server decides | `lib/oauthConnect.js` (dialog, Canva picker, Meta connect), `components/layout/AppLinkHandler.jsx`, `backend/src/routes/oauth.js` (`client=app`) |
| No purchase code in the app (Billing, Pricing, Design replaced; proof on every build) | `vite.config.js` plugin, `mobile/scripts/check-bundle.mjs` |
| CORS for the apps (`capacitor://localhost`, `https://localhost`) | `backend/src/index.js` |
| Builds without any store account (debug apk, iOS simulator) | `.github/workflows/mobile-build.yml` |
| Tests | `backend/tests/` (`cors`, `frontend-platform`, `audio-upload`, and the OAuth files) |

Build the web bundle for the app (the same public values the website is built with), then sync it into the native projects:

```bash
cd mobile
npm install
VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npm run sync      # builds ../ into mobile/www and copies it into android/ and ios/
```

An Android build needs the Android SDK and an iOS build needs a Mac with Xcode. Neither is on your PC: the **Mobile build** workflow (GitHub -> Actions) does both on GitHub's machines and attaches the debug apk to the run.

## What only you can do (I never create accounts for you)

1. **Apple Developer Program**: USD 99 per year. For a company you need a D-U-N-S number first (free, up to about 5 business days plus 2 for Apple to receive it). Individual enrolment needs none. Tell me the **Team ID** when you have it.
2. **Google Play Console**: USD 25 once. A personal account must run a closed test (12 testers for 14 days) before the first production release; an organisation account is reported not to (confirm in the console after registering).
3. **Google Cloud (same project as the web sign-in)**, APIs & Services -> Credentials -> Create credentials -> OAuth client ID:
   - **Android**: package name `com.bmapz.ai` and the SHA-1 fingerprint of the key that signs the app (the debug key for the test apk; later the Play App Signing key, shown in Play Console -> Setup -> App signing).
   - **iOS**: bundle ID `com.bmapz.ai`. Send me the iOS client ID (it is public).
4. **Supabase** -> Authentication -> Providers -> Google -> **Authorized Client IDs**: add the iOS client ID next to the existing web one (comma separated). Nothing else changes (Site URL stays `https://ai.bmapz.com`).
5. **Sign in with Apple** (only if you want it on iPhone; the alternative is to hide Google on iOS and keep e-mail + password): create an App ID with the Sign in with Apple capability, a Services ID and a key in the Apple developer portal, then fill Supabase's Apple provider. The key must be renewed every 6 months. Until this exists the Apple button stays hidden (`VITE_APPLE_SIGNIN` unset).
6. **GitHub** -> Settings -> Secrets and variables: the mobile build reuses `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (already there for the website). Add `VITE_GOOGLE_IOS_CLIENT_ID` (a variable, not a secret) once step 3 is done.
7. **Firebase project** (free) later, for push notifications.

## Decisions that are still yours

- Does the app let people create an account, or only sign in (creating accounts on the website)? Both stores then require an in-app **Delete my account**, which does not exist yet.
- iPhone sign-in: Sign in with Apple, or hide Google there (e-mail + password only; that also needs a forgot-password flow, which does not exist on the website either).
- Business country and legal entity (D-U-N-S, personal vs organisation accounts).
- What "Delete my account" does to a company, its team and an active subscription.
- Who prepares the reviewer demo account (paid plan, password login, no 2FA, sample data).

## Known limits of phase 1 (do not discover these by surprise)

- Unverified on real devices: the connect flow through the system browser, Google/Apple native sign-in, the `bmapz://oauth` hand-back, session storage. The code and tests prove the logic against fakes only.
- Push notifications, Universal Links / App Links (so e-mail links open the app), store listing assets and release signing are phase 2.
- File exports (CSV, PDF, HTML) go through the system share sheet (`saveFile` in `lib/platform.js`); `window.open` and `target=_blank` links inside the WebView are unverified.
- Design Studio (the owner's confidential feature) is NOT in the app: the app build replaces it, like Billing and Pricing, and the owner uses it on the website. Heavy tools such as the workflow canvas and the ads manager are not adapted for phones.
