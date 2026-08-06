# Bmapz AI audit - Codex session 2026-07-13

## Verified in production

- Supabase project `jmtnubzgnfjmtcwbegow` contains exactly one `owner`: `d2mdigitalmarketing@gmail.com`.
- The other current users are `company_admin` (`derekifidon@gmail.com`) and `user` (`derek@bmapz.com`).
- Remote migrations include the RLS hardening migration and the new security/index migration.
- All public tables reported by the audit have RLS enabled and at least one policy.
- The public `handle_new_user()` RPC is no longer executable by `PUBLIC`, `anon`, or `authenticated`; only the trigger/service role can execute it.
- Supabase security advisor now reports only the dashboard setting `Leaked Password Protection Disabled`. Enable this manually in Auth > Password Security.
- There are currently no `workflow_runs` rows, so no real lead was enrolled or contacted during this audit.

## Authorization findings

- `auth.js` assigns `company_admin` in initial provisioning, JIT `/me`, and `/complete-profile`; client-supplied roles are ignored.
- `users.js` invite and role-update endpoints only accept `company_admin` or `user` and are company-scoped.
- The admin panel remains the intentional elevation path. Its user update endpoint is now server-validated: only valid roles are accepted, existing Owners cannot be changed there, and only an Owner can grant `owner` or `system_admin`.
- A repository scan found no other customer-facing route that trusts a client-supplied internal role. Other generic `req.body` updates are not role paths and should still be narrowed over time.

## Workflow engine findings and fixes

- The node walk correctly advances trigger, send, wait, condition, meeting, and terminal nodes.
- Wait nodes store `next_action_at` and resume at the node after the wait.
- Email sends use the shared Gmail/SMTP/Resend sender; WhatsApp sends use Cloud API; unsupported channels are queued for human action.
- Runs now require an active workflow before enrollment.
- Run claiming is now atomic on `id + status + next_action_at`, preventing duplicate execution when more than one worker sees the same due run.
- Workflow send nodes now use `run_id + node_id` in `messages.metadata` as an idempotency key, preventing duplicate sends after a worker crash/retry.
- No live workflow test was executed because there was no synthetic test run and no safe authenticated test harness available in the local environment. Do not test by selecting a real lead. Add a dedicated no-send test fixture or use a sandbox mailbox before validating provider delivery.

## AI and product findings

- Image generation validates image models and falls back through compatible OpenAI image models before Stability; a chat model in `ai_image_model` no longer causes a false image-model request.
- `Company Brain` is injected into `runAIChat` unless explicitly skipped.
- `ai_automations` and `design_templates` exist in production and are RLS-protected.
- Settings model dropdowns now consume `GET /api/ai/models` and fall back to the existing static list if the catalog is unavailable.

## Stage 2 integration status

- Google Ads: now uses Google Ads REST v24, accepts the developer token saved in the company settings, normalizes customer IDs, and refreshes Google access tokens before querying when a refresh token is available.
- Meta Ads and Instagram: OAuth and live campaign/insight paths exist, but the user must connect a Meta app with the required permissions and choose an ad account.
- LinkedIn Ads: code can query campaigns, but LinkedIn Advertising API access and current API version/scopes must be approved for the developer app. A normal LinkedIn sign-in token is not enough for ads reporting or DMs.
- TikTok Ads: OAuth already existed; live campaign retrieval is now implemented through TikTok Marketing API v1.3. Performance fields may be absent unless the app has the required reporting permission, and the API response now says so instead of implying full performance data.
- Integration test buttons for Meta, Google Ads, LinkedIn Ads, and TikTok Ads now call the provider API. A saved token alone is no longer reported as a successful live connection.
- Platform app registration cannot be completed from this repository: Meta, Google, LinkedIn, and TikTok require the account owner to create/approve developer apps and place secrets in Railway. No secrets were read or written by Codex.

## Remaining manual production actions

1. Create/approve the four developer apps and set Railway variables from `backend/.env.example`.
2. Use the production callback URL `https://bmapz-production.up.railway.app/api/oauth/<provider>/callback` only after confirming that Railway still exposes that domain.
3. Reconnect Google, Meta/Instagram, LinkedIn, and TikTok after changing scopes so fresh tokens are issued.
4. Set the Google Ads Customer ID, Meta Ad Account ID, LinkedIn Ad Account ID, and TikTok Advertiser ID in Settings.
5. Enable Supabase Auth leaked-password protection.
6. Validate with a sandbox mailbox and test ad account before enabling any workflow with `auto_send: true`.

Official API references used for Stage 2 review: [Google Ads SearchStream](https://developers.google.com/google-ads/api/reference/rpc/v21/GoogleAdsService/SearchStream), [Google Ads credentials](https://developers.google.com/google-ads/api/docs/oauth/credential-management), [LinkedIn Advertising API](https://learn.microsoft.com/en-us/linkedin/marketing/integrations/ads/ads-overview?view=li-lms-2026-01), and [TikTok Marketing API](https://business-api.tiktok.com/gateway/docs/index?doc_id=1735713875563521&language=ENGLISH).
