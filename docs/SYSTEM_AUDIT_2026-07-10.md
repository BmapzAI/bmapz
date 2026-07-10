# Bmapz AI System Audit - 2026-07-10

This file is a practical handoff for Codex, Claude Code, and Derek. It avoids secrets and customer data.

## Executive Summary

- The app codebase is active and connected to GitHub at `https://github.com/BmapzAI/bmapz.git`.
- The production frontend is `https://ai.bmapz.com`.
- The production frontend responds with HTTP 200 OK.
- The old documented Railway backend URL `https://bmapz-production.up.railway.app/health` now returns 404 "Application not found". This means the backend URL changed, the Railway app was renamed/removed, or the documentation is stale. Confirm the current Railway domain and set `VITE_API_URL` in Cloudflare Pages to that exact backend URL.
- The Supabase project is healthy, but security configuration needs hardening: three public tables had RLS disabled and several RLS-enabled tables had no table-specific policies.
- The Google login label issue is not a normal frontend text bug. Google is showing the Supabase Auth project host `jmtnubzgnfjmtcwbegow.supabase.co`. To hide that host, Supabase Auth/Google OAuth configuration must be corrected in the dashboards, and a custom Supabase/Auth domain may be required.
- A false success message was found in Ads: the frontend requested `google_ads`/`meta_ads` while the backend expected `google`/`meta`, so empty API responses could still be shown as "live data loaded".
- Inbox had similar wording risk: it said "synced" even though the current endpoint only refreshes saved database messages; it does not import live Gmail/Meta/WhatsApp messages yet.
- AI Chat bottom UI was visually unfinished; the chat area now has a clearer contained boundary and footer/input surface.

## Supabase Snapshot

Project:

- Project ref: `jmtnubzgnfjmtcwbegow`
- Project name: `Bmapz AI`
- Region: `sa-east-1`
- Edge functions listed: none at the time of the audit.
- Migration history from Supabase MCP: no migrations reported in the remote migration list, even though local migration files exist. This means local SQL files and remote migration history may not yet be synchronized.

## Local Backups Found

Folder checked:

- `C:\Users\derek\OneDrive\Documents\BMapz\Backups\Bmapz.ai App`

Files found:

- `bmapz-ai-sales-marketing-automation 09.05.2026 (pre-calude).zip`
- `bmapz-ai-sales-marketing-automation 20-03-2026.zip`
- `bmapz-ai-sales-marketing-automation 26.03.2026.zip`
- `bmapz-standalone-v1.tar.gz`

Recommendation:

- Keep these files as historical backups.
- Treat `09.05.2026 (pre-calude).zip` as the main Base44 reference export.
- Do not overwrite these backups during normal development.

RLS disabled in public schema:

- `accounts`
- `admin_change_logs`
- `data_deletion_requests`

Tables with policies already present:

- `activities`
- `ad_records`
- `billing_purchases`
- `companies`
- `integrations`
- `leads`
- `messages`
- `social_posts`
- `subscriptions`
- `users`
- `workflows`

RLS-enabled tables with no policy count returned by the audit query:

- `ai_outputs`
- `blog_posts`
- `brand_scans`
- `credit_transactions`
- `dashboard_configs`
- `funnels`
- `lead_lists`
- `message_templates`
- `node_templates`
- `seo_analyses`
- `workflow_runs`

Security migration:

- Applied to Supabase as remote migration `20260710194731_security_rls_hardening_20260710`.
- Local migration file: `supabase/migrations/003_security_rls_hardening.sql`.
- Verification after apply confirmed `accounts`, `admin_change_logs`, and `data_deletion_requests` now have RLS enabled.
- Verification after apply confirmed all tables listed under "Tables needing policy review" now have at least one policy.
- Next recommended check: run a fresh Supabase advisor/security scan from the Supabase dashboard.
- Keep backend service-role operations in the backend only. Never expose service-role keys in frontend variables.

## Fixes Applied Locally

Ads live data:

- Backend now accepts `google_ads`, `meta_ads`, and `linkedin_ads` platform keys.
- Backend now returns an error when required account IDs/tokens are missing instead of returning an empty successful object.
- Frontend now only shows "live data loaded" when real campaigns are returned.
- Empty campaign results now show a warning, not a success message.

Inbox:

- The Inbox button now calls `POST /api/messaging/sync`.
- Gmail sync imports recent inbox email when Gmail is connected with read permission.
- Instagram sync attempts to import Instagram DMs through the Meta page conversations API when Meta/Instagram messaging permissions are granted.
- WhatsApp sync reports the real platform behavior: WhatsApp Cloud API receives new messages through the Meta webhook, not through pull-history sync.
- LinkedIn sync reports the real platform limitation: direct-message inbox access requires approved LinkedIn Messaging API access and is not available from the normal social/ads token.

AI Chat:

- Chat surface now has a visible contained layout with a border and footer background so the page ending looks intentional.

## Remaining High-Priority Work

1. Fix Google/Supabase OAuth branding in dashboards.
2. Find the current Railway backend URL and update every place that still mentions `bmapz-production.up.railway.app`.
3. Confirm Cloudflare Pages has `VITE_API_URL` set to the current Railway backend URL.
4. Run a fresh Supabase advisor/security scan after the RLS migration.
5. Reconnect Gmail and Meta/Instagram in production so the new OAuth scopes are granted. Existing tokens may not have Gmail read or Instagram messaging permissions.
6. Finish OAuth/account ID capture for ad platforms so a nontechnical user can connect accounts without manually finding IDs.
7. Replace any remaining "success" toast that can be triggered by empty/demo/local data.
8. Remove GitHub Actions build-time file rewrites. The deploy workflow currently rewrites frontend files during CI, which makes production harder to trust.
9. Add production smoke tests for login, AI chat, integrations, ads, inbox, social, settings, and workflows.

## Nontechnical Explanation For Derek

The app is not failing because of one single bug. It has three types of problems:

- Code issues: some screens say something worked even when no real external data was loaded.
- Configuration issues: Google/Supabase/Railway/Cloudflare settings must match the code exactly.
- Product-completion gaps: some buttons exist before the full live integration behind them is finished.

The safest path is to fix misleading UI first, harden the database, then test each feature as a complete user journey.
