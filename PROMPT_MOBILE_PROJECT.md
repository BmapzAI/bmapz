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

- `mobile/`: own `package.json` (Capacitor 8, Node >= 22; plugins app, browser, filesystem, haptics, keyboard, preferences, share, splash-screen, status-bar and `@capgo/capacitor-social-login`), `capacitor.config.json` (appId `com.bmapz.ai`, appName "Bmapz AI": the id is permanent once published), generated `android/` and `ios/`. `npm run sync` builds the web bundle into `mobile/www` (`scripts/build-web.mjs`, needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`) and copies it into the native projects. No Android SDK / Xcode on Derek's PC: GitHub Actions (`.github/workflows/mobile-build.yml`) builds both with no store credentials. Run 37655145379 (commit fc7d1f3) was green; check the newest run for the branch.
- `frontend-src/lib/platform.js`: `isNativeApp()`, `nativePlugin(name)`, `openExternalUrl`, `saveFile`, `onAppUrlOpen`, `onAppResume`, `onBrowserFinished`. **No `@capacitor/*` package is imported by the website**: the native shell injects `window.Capacitor.Plugins.<Name>` (verified in Capacitor's Android `JSExport.java` and iOS `JSExport.swift`), so the website's `package.json` and production build are untouched.
- `vite.config.js`: when `VITE_NATIVE_BUILD=1` the Billing, Pricing and Design pages are swapped for `frontend-src/native/NotInApp.jsx` (their code is not in the app bundle; `mobile/scripts/check-bundle.mjs` proves it, including that Design Studio's image editor is absent). `components/ui/WebOnly.jsx` hides the remaining doorways; `lib/nativeMessages.js` replaces "upgrade / buy credits" wording from the server inside the app.
- Sign-in: `lib/nativeAuth.js` + `components/auth/GoogleSignInButton.jsx`: the phone's account picker -> `supabase.auth.signInWithIdToken` with the website's nonce scheme. Apple stays hidden until `VITE_APPLE_SIGNIN=1`.
- Connecting integrations: `lib/oauthConnect.js` (one flow for the dialog, the Canva picker and the Meta connect in Settings; pure decisions in `lib/oauthState.js`): popup on the website, system browser in the app; the callback page (`backend/src/routes/oauth.js`, `client=app`) links back with `bmapz://oauth?status=...` (status only); the SERVER decides (`/api/integrations/status` -> `oauth_connected` / `oauth_stamp`). `components/layout/AppLinkHandler.jsx` takes the link when no dialog is waiting.
- `lib/AuthContext.jsx` / `lib/authEvents.js`: no full-screen reset on token refresh or app resume (this also changed the website); phone sign-out is local; sign-up e-mail links point at the website. `lib/supabase.js` keeps the session in the Preferences plugin inside the app.
- `backend/src/index.js` + `lib/appOrigins.js`: CORS allows exactly `capacitor://localhost` and `https://localhost`; billing checkout/portal answer 404 to them. Security fixes made on the way (BYOK keys only for owner/system_admin on the write path, `/api/ai/edit-image` owner-only, Design not named in error text): `backend/tests/owner-only-surfaces.test.mjs`.
- Voice input and exports: recordings are named after what the browser recorded (`lib/audio.js`, `backend/src/lib/audioUpload.js`); `saveFile` replaces `<a download>` (share sheet in the app).

## 4. What is NOT done or NOT verified (your starting list; `AGENT_HANDOFF.md` "MOBILE PHASE 1" has the detail)

1. **Nothing has run on a real phone.** Unverified: native Google sign-in, the system-browser connect flow and `bmapz://oauth` hand-back (Android Custom Tab vs iOS SFSafariViewController behaviour on redirects), Preferences-backed session, `window.open` / `target=_blank` inside the WebView, edge-to-edge insets on Android 16, the share-sheet export, `window.Capacitor.Plugins` being present before the first render. The code and tests prove logic against fakes; CI proves the projects compile.
2. The branch is **not merged**. Merging deploys to production (website + API). Before merging: CI green on the latest commit, the whole suite and lint, `npx vite build` still produces Billing/Pricing/Design chunks, and a look at what changes for WEBSITE users (the `AuthContext` reload behaviour, voice file names, the Integrations page return handler, hidden BYOK cards for non-platform roles). The backend-only parts (CORS, owner-only fixes, audio upload, billing refusal for app origins) are safe to ship alone and are needed before any phone can talk to the API.
3. Phase 2 (not started): push (Firebase + APNs key, `@capacitor/push-notifications`), Universal Links / App Links (`public/.well-known/apple-app-site-association`, `assetlinks.json`, an https return page; needs the Apple Team ID and the Android signing SHA-256), release signing and Fastlane upload to TestFlight / Play internal testing, store listings and privacy answers.
4. Product pieces both stores require and that do not exist: authenticated **"Delete my account"**, an AI third-party data-sharing consent screen, a reviewer demo account. There is no **forgot-password** flow on the website either.
5. Mobile layout was not audited (the explorer hit the usage limit). The shell has a phone drawer; heavy tools (workflow canvas, ads manager) are not adapted. Remaining wording in the dialog still says "popup".
6. The rate limiter keys by IP before authentication: phones on carrier networks share IPs. The Design Studio JS chunk is still served by the WEBSITE to anyone who knows its hashed file name (only the run-time gate protects it).
7. Open owner decisions (ONE plain-English message to Derek, with pros/cons; do not decide for him): can people create accounts in the app or only sign in; iPhone sign-in (Sign in with Apple vs hide Google); what "Delete my account" does to a company, its team and an active subscription; business country and legal entity (D-U-N-S, personal vs organisation store accounts); who prepares the reviewer demo account; whether the owner's Admin Panel money screens stay visible in the app; the permanent bundle id.

## 5. How to work

- Prefer fixing and verifying yourself over asking. Ask only what needs Derek (accounts, decisions, real-device tests), batched into one message.
- Every change gets a test that would FAIL without it (see `backend/tests/*.test.mjs`; `frontend-platform.test.mjs` shows how to test frontend logic in plain Node). Lint and the whole suite must pass before every commit.
- Prove the website is unaffected: `npx vite build` (no `VITE_NATIVE_BUILD`) must still produce `Billing-*.js` and `Pricing-*.js`; `cd mobile && node scripts/build-web.mjs && node scripts/check-bundle.mjs` must say no purchase code.
- After merging anything to main, verify the deploy (`curl https://api.bmapz.com/health` -> `commit`, and read the page's own chunk, not only `index-*.js`).
- Update `AGENT_HANDOFF.md` and `AGENT_LIVE_BOARD.md` at the end of each session, and this prompt if the plan changes.
