# Claude Code Pickup Prompt - 2026-07-10

You are continuing work on the Bmapz AI standalone app with Codex. Use the project at:

`C:\Users\derek\OneDrive\Documents\Bmapz App`

Read these first:

1. `AGENTS.md`
2. `AGENT_HANDOFF.md`
3. `docs/SYSTEM_AUDIT_2026-07-10.md`
4. `supabase/backups/2026-07-10_security_snapshot.md`
5. `supabase/migrations/003_security_rls_hardening.sql`

Current known status:

- Frontend production URL `https://ai.bmapz.com` responds HTTP 200.
- Old documented Railway URL `https://bmapz-production.up.railway.app/health` returns 404 "Application not found". Find the current Railway backend URL and update docs/config references.
- Supabase RLS hardening was applied remotely as migration `20260710194731_security_rls_hardening_20260710`.
- Frontend build passes.
- Backend build passes.
- ESLint quiet mode passes with zero errors; full lint still has many old warnings.

Codex local fixes already made:

- Ads live data now only shows success when real campaigns are returned.
- Ads backend now supports `google_ads`, `meta_ads`, and `linkedin_ads` platform keys.
- Inbox now has `POST /api/messaging/sync`: Gmail imports recent inbox email with read scope; Instagram attempts Meta DM import when permissions allow it; WhatsApp reports webhook-only behavior; LinkedIn reports that DM sync requires approved LinkedIn Messaging API access.
- AI Chat layout bottom was cleaned up with a clearer contained surface.
- Duplicate translation keys were removed from `LanguageContext.jsx`.
- ESLint config now supports Node `.cjs` maintenance scripts.
- A Supabase security snapshot and system audit were created.

Your next tasks:

1. Confirm the current Railway backend URL from Railway, GitHub secrets, Cloudflare Pages environment variables, or deployment logs.
2. Update `VITE_API_URL` in Cloudflare Pages if it still points to the old Railway URL.
3. Update docs/handoff files so they no longer reference the dead Railway URL except as historical note.
4. Run a production smoke test:
   - Login with Google.
   - AI Chat request.
   - Settings/API key save and test.
   - Meta OAuth initiate flow.
   - Ads live data load with no connected data, confirming it does not show false success.
   - Inbox sync, confirming Gmail imports real email after reconnecting Gmail with the new read scope.
   - Inbox sync, confirming Instagram either imports real DMs or returns an actionable Meta permission/configuration message.
   - Social Media live data/analytics, confirming it does not claim real data if none was loaded.
5. Fix the Google login branding:
   - Verify Supabase Auth custom OAuth credentials.
   - Verify Google Cloud OAuth consent screen app name/logo/support email.
   - Verify authorized redirect URI includes `https://jmtnubzgnfjmtcwbegow.supabase.co/auth/v1/callback`.
   - If the goal is to stop Google from showing `jmtnubzgnfjmtcwbegow.supabase.co`, configure a Supabase custom Auth domain/custom domain and update auth URLs.
6. Remove GitHub Actions build-time rewrites of `vite.config.js` and `frontend-src/App.jsx` after confirming the repo source builds directly in CI.
7. Continue replacing demo/placeholder success states with truthful statuses across Ads, Social, Inbox, Integrations, and Workflows.

Verification required before handing back:

- `npm run build`
- `npm run build --prefix backend`
- `npx eslint . --quiet`
- Supabase advisor/security scan checked after RLS migration.
- `git status --short` summarized in `AGENT_HANDOFF.md`.

Do not expose secrets in logs, commits, screenshots, or docs.
