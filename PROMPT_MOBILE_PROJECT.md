# Prompt for the mobile project (paste everything below the line into a NEW chat in the "Bmapz AI" project)

Written 2026-10-07 by Claude Sonnet 5.5 at the end of mobile phase 1. Replaces nothing; sits beside `PROMPT_INTEGRATIONS_PHASE.md` (integrations) and `PROMPT_CODEX_AUDIT.md` (audit).

---

You are continuing the **Android + iOS apps for Bmapz AI**. Derek (the owner) has very little time and is not technical: do the work yourself, test it, and speak plainly. **No assumptions, only verifiable facts**: never say something works unless you saw it work (a test, a CI run, a real response). Say what you could NOT verify.

## 0. Do these first, in this order, before you say anything to Derek

1. Read `AGENT_HANDOFF.md` (the section "MOBILE PHASE 1" at the end, and the claims table at the top), `docs/MOBILE_SETUP.md`, `docs/audit-2026-10-06/mobile-research.md` (store rules, single-source) and `CLAUDE.md`.
2. `git fetch origin` and read the branch **`mobile/phase1-capacitor`** (phase 1 lives there, NOT on main unless the handoff says it was merged). `git log --oneline main..origin/mobile/phase1-capacitor`.
3. Look at the latest run of the GitHub workflow **"Mobile build"** for that branch (the repo is public: `https://api.github.com/repos/BmapzAI/bmapz/actions/runs?branch=mobile/phase1-capacitor`). Its Android debug apk and iOS simulator build are the only proof that the native projects compile.
4. Run `node backend/tests/run.mjs` (every file must pass) and `npx eslint . --quiet` (must print nothing).
5. The original mobile chat is a claude.ai cloud Code session "Web app mobile deployment" (id `cse_01GamTNXBSZo9aB2Afs1VqUf`); it built nothing. Only Claude in Chrome (Derek's signed-in Chrome) can read it. You do not need it: everything it decided is below.

## 1. What was decided (by Derek, 2026-10-06/07)

- **Capacitor**: the apps are the SAME web code as ai.bmapz.com in a native shell (iOS + Android). The desktop website stays the full product. As much as possible is done by Claude.
- **Consumption-only apps**: nobody buys, upgrades or tops up inside them (stores require their own payment system for digital goods and take 15-30%). People subscribe on the website and sign in on the phone. The app bundle must contain no purchase code (`mobile/scripts/check-bundle.mjs` proves it on every build).
- Phase 1 scope Derek approved: Capacitor setup, mobile UI pass, auth (native Google; Sign in with Apple on iOS), deep links, CORS for the app origins, Android first; phase 2: iOS finish, push notifications, CI to TestFlight / Play internal testing; phase 3: store listings and submission.

## 2. Standing constraints (override everything)

- Do not commit real `.env` files or production secrets. Never enter Derek's credentials; never create accounts for him (Apple Developer, Google Play, Firebase, Google Cloud clients are HIS to create: `docs/MOBILE_SETUP.md` lists them with exact steps).
- Do not change Railway, Cloudflare, Supabase or GitHub deployment settings unless the task requires it. Do not overwrite Codex's changes; no destructive git commands. Document auth/billing/OAuth/RLS/schema changes in `AGENT_HANDOFF.md`.
- **Design Studio is a trade secret: App Owner (`role === 'owner'`) only, everywhere, including AI replies.** BYOK only for owner/system_admin; customers cap at company_admin; no outsider is ever made system_admin. Role gating is decided by the user's role on every platform: never use `<WebOnly>` for it.
- Files are mixed LF/CRLF: multi-line edit anchors written with LF can silently fail. The Bash tool eats backslashes and backticks in heredocs: create files with the Write/Edit tools, not shell heredocs, whenever code contains regexes or template literals.
- Commit trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Work on feature branches; merge to main only after CI is green, the full tests pass and you have checked what a merge deploys (main pushes deploy the website to Cloudflare Pages and the API to Railway).

## 3. Architecture of phase 1 (read the code, do not trust this summary)

- `mobile/`: own `package.json` (Capacitor 8, Node >= 22), `capacitor.config.json` (appId `com.bmapz.ai`, appName "Bmapz AI"), generated `android/` and `ios/`. `npm run sync` builds the web bundle into `mobile/www` (`scripts/build-web.mjs`, needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`) and copies it into the native projects. No Android SDK / Xcode on Derek's PC: GitHub Actions (`.github/workflows/mobile-build.yml`) builds both.
- `frontend-src/lib/platform.js`: `isNativeApp()`, `nativePlugin(name)`, `openExternalUrl`, `onAppUrlOpen`, `onAppResume`, `onBrowserFinished`. **No `@capacitor/*` package is imported by the website**: the native shell injects `window.Capacitor.Plugins.<Name>` (verified in Capacitor's Android `JSExport.java` and iOS `JSExport.swift`), so the website's `package.json` and production build are untouched. Plugins live in `mobile/package.json`.
- `vite.config.js`: when `VITE_NATIVE_BUILD=1` the Billing and Pricing pages are swapped for `frontend-src/native/NotInApp.jsx` (the code is not in the app bundle at all). `components/ui/WebOnly.jsx` hides the remaining doorways (Settings subscription tab, Company Admin upgrade cards). `lib/nativeMessages.js` replaces "upgrade / buy credits" wording from the server inside the app (stores treat that as steering).
- Sign-in: `lib/nativeAuth.js` + `components/auth/GoogleSignInButton.jsx`: the phone's account picker -> `supabase.auth.signInWithIdToken` with the website's nonce scheme (hash to the provider, raw to Supabase; the plugin passes the nonce through untouched). Apple stays hidden until `VITE_APPLE_SIGNIN=1`.
- Integration connects (Google, Meta, ...) from the app: `ConnectIntegrationModal` opens the SYSTEM browser (Google forbids WebViews), the callback page (`backend/src/routes/oauth.js`, `client=app` in the signed launch ticket + httpOnly cookie) links back with `bmapz://oauth?status=...` (status only, never a code or token), and the app re-checks the connection with the server (`/api/integrations/status` -> `oauth_connected` / `oauth_stamp`). The link is only a hint; the server decides.
- `lib/AuthContext.jsx` / `lib/authEvents.js`: no full-screen reset on token refresh or app resume (this also changes the website); phone sign-out is local; sign-up e-mail links point at the website. `lib/supabase.js` stores the session in the phone's Preferences plugin inside the app.
- `backend/src/index.js`: CORS allows exactly `capacitor://localhost` and `https://localhost` (plus the website origins); `backend/tests/cors.test.mjs` proves refusals still hold.
- Voice input: recordings are named after what the browser recorded (iPhones record MP4/AAC): `lib/audio.js`, `backend/src/lib/audioUpload.js`.

## 4. What is NOT done or NOT verified (your starting list; the handoff has the detail)

Check `AGENT_HANDOFF.md` "MOBILE PHASE 1" for the current list. At the time of writing:
1. Nothing has run on a real phone. Unverified: native Google sign-in, the system-browser connect flow and `bmapz://oauth` hand-back, session storage in Preferences, `window.open`/`<a download>`/`target=_blank` inside the WebView, edge-to-edge insets on Android 15+/16, the iOS build outcome unless CI shows it.
2. Still using the website's popup flow (must get the same native treatment as `ConnectIntegrationModal`): `components/integrations/CanvaPicker.jsx`, `components/settings/ApiKeysTab.jsx` (Meta connect), `pages/Integrations.jsx` (`?oauth=` handler should also react to `appUrlOpen`).
3. No authenticated "Delete my account" exists (both stores require it if accounts can be created in the app). No forgot-password flow exists on the website either. Apple/Google also need an AI-data-sharing consent screen and a reviewer demo account.
4. The rate limiter keys requests by IP before authentication: phones on carrier networks share IPs, so one busy user can 429 others. Consider keying by a hash of the Bearer token.
5. Phase 2: push (Firebase + APNs key, `@capacitor/push-notifications`), Universal Links / App Links (`/.well-known/apple-app-site-association`, `assetlinks.json`, needs the Apple Team ID and the Android signing SHA-256), release signing and CI upload (Fastlane), native share/save for downloads, store assets, privacy labels / data-safety answers.
6. Open owner decisions (put them to Derek in ONE plain-English message, with pros/cons, and do not decide for him): can people create accounts in the app or only sign in; iPhone sign-in (Apple vs hide Google); what "Delete my account" does to a company/team/subscription; business country and legal entity (D-U-N-S, personal vs organisation store accounts); who prepares the reviewer demo account.

## 5. How to work

- Prefer fixing and verifying yourself over asking. Ask only what needs Derek (accounts, decisions, real-device tests), batched into one message.
- Every change gets a test that would FAIL without it (see `backend/tests/*.test.mjs`; `frontend-platform.test.mjs` shows how to test frontend logic in plain Node). Lint and the whole suite must pass before every commit.
- Prove the website is unaffected: `npx vite build` (no `VITE_NATIVE_BUILD`) must still produce `Billing-*.js` and `Pricing-*.js`; `cd mobile && node scripts/build-web.mjs && node scripts/check-bundle.mjs` must say no purchase code.
- After merging anything to main, verify the deploy (`curl https://api.bmapz.com/health` -> `commit`, and read the page's own chunk, not only `index-*.js`).
- Update `AGENT_HANDOFF.md` and `AGENT_LIVE_BOARD.md` at the end of each session, and this prompt if the plan changes.
