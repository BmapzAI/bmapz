# Supabase Security Snapshot - 2026-07-10

This is a lightweight backup/audit snapshot. It contains structure and security status only. It intentionally does not contain customer data, API keys, OAuth tokens, or secrets.

Project:

- Supabase project ref: `jmtnubzgnfjmtcwbegow`
- Supabase project name: `Bmapz AI`
- Region: `sa-east-1`

Public tables checked:

- `accounts`
- `activities`
- `ad_records`
- `admin_change_logs`
- `ai_outputs`
- `billing_purchases`
- `blog_posts`
- `brand_scans`
- `companies`
- `credit_transactions`
- `dashboard_configs`
- `data_deletion_requests`
- `funnels`
- `integrations`
- `lead_lists`
- `leads`
- `message_templates`
- `messages`
- `node_templates`
- `seo_analyses`
- `social_posts`
- `subscriptions`
- `users`
- `workflow_runs`
- `workflows`

RLS disabled:

- `accounts`
- `admin_change_logs`
- `data_deletion_requests`

Policy counts returned by audit:

- `activities`: 1
- `ad_records`: 1
- `billing_purchases`: 1
- `companies`: 1
- `integrations`: 1
- `leads`: 1
- `messages`: 1
- `social_posts`: 1
- `subscriptions`: 1
- `users`: 1
- `workflows`: 1

Tables needing policy review:

- `accounts`
- `admin_change_logs`
- `ai_outputs`
- `blog_posts`
- `brand_scans`
- `credit_transactions`
- `dashboard_configs`
- `data_deletion_requests`
- `funnels`
- `lead_lists`
- `message_templates`
- `node_templates`
- `seo_analyses`
- `workflow_runs`

Recommended next action:

- `supabase/migrations/003_security_rls_hardening.sql` was applied to Supabase as migration `20260710194731_security_rls_hardening_20260710`.
- Re-run the Supabase security advisor.
- Confirm the app still loads company data, saved AI conversations, dashboards, blog posts, brand scans, workflows, and templates after the migration.

Post-apply verification:

- `accounts`: RLS enabled, 1 policy.
- `admin_change_logs`: RLS enabled, 1 policy.
- `data_deletion_requests`: RLS enabled, 1 policy.
- Previously missing policy tables now return at least 1 policy each.
