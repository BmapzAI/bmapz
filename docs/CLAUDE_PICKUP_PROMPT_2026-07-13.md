Continue Bmapz AI from `C:\Users\derek\OneDrive\Documents\Bmapz App`.

Read `AGENTS.md`, `AGENT_HANDOFF.md`, `docs/CODEX_AUDIT_2026-07-13.md`, and the role-model memory before editing.

Codex verified the production Supabase project. Keep exactly one existing Owner (`d2mdigitalmarketing@gmail.com`) unless the platform Owner intentionally changes that. Customer provisioning and company-scoped user endpoints must never grant `owner` or `system_admin`.

Recent local changes to review:

- `backend/src/routes/admin.js`: server-side role allowlist and admin hierarchy.
- `backend/src/lib/workflowEngine.js`: active-workflow enrollment, atomic run claim, and message idempotency.
- `backend/src/routes/ads.js`: Google Ads v24 + token refresh + company developer token, TikTok Ads v1.3 campaign retrieval.
- `frontend-src/components/settings/ApiKeysTab.jsx`: live `/api/ai/models` dropdown with static fallback.
- `supabase/migrations/005_security_and_workflow_indexes.sql`: advisor cleanup and runtime indexes.

Before changing code, inspect the diff and preserve unrelated agent work. Then:

1. Run `npm run build`, `npm run build --prefix backend`, `npx eslint . --quiet`, and `git diff --check`.
2. Verify the deployed Railway URL and Cloudflare `VITE_API_URL`.
3. Register/approve Meta, Google Ads, LinkedIn Marketing, and TikTok developer apps using the platform owner accounts. Put only the required secrets in Railway; never commit them.
4. Reconnect each provider in the live app to issue tokens with current scopes. Configure the relevant ad account IDs.
5. Test only with a sandbox mailbox/ad account or a synthetic lead with no address. Never enable real workflow sending during a code test.
6. Validate truthful states: no campaign/message data means warning or not connected, never success.
7. Report exactly what was verified, what remains blocked by platform approval, and update `AGENT_HANDOFF.md`.

Do not claim that an integration is live merely because an OAuth token exists. A connection is live only after a real provider read succeeds and the UI displays the returned records.
