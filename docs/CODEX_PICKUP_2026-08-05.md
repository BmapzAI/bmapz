# Codex pickup — Bmapz AI, 2026-08-05

You are taking over from Claude Code. Read `AGENT_HANDOFF.md` sessions **24–27**
first; this file is the delta plus your assignment. Do not re-do work listed as
done — verify it, then push past it.

## Ground rules (from Derek, unchanged)

- Derek authorizes reviewed commits, pushes, deployments and production publication.
- **Never report an integration, deployment or feature as working without direct
  evidence.** A green commit message is not evidence. After `git mv`/`sed`, run
  `git show HEAD:<file>` and confirm the edit is IN the commit — a 40-minute
  production outage was caused by exactly that omission (`d6b636c` → `3d511e4`).
- Do not commit real `.env` files or secrets. Do not change Railway, Cloudflare,
  Supabase or GitHub settings unless the task requires it.
- Do not overwrite Claude Code's changes; do not run destructive git commands.
- **BYOK is strictly `owner`/`system_admin`. Customers cap at `company_admin`.**
- **Design Studio is an absolute business secret — `role === 'owner'` only,
  including in AI replies. Never let its existence leak into company-level lists,
  archives, search results or AI output.**
- Document auth/billing/OAuth/RLS/schema changes in `AGENT_HANDOFF.md`.
- `backend/railway.json` roots the service at `backend/` — an import that escapes
  that directory takes production down. Always boot-test from `backend/` before
  pushing: `cd backend && node src/index.js` (expect only the missing-env error).

## Environment facts you need

- Frontend: Vite + React 18 in `frontend-src/`, deployed to Cloudflare Pages by
  `.github/workflows/deploy.yml` (which injects `VITE_*` secrets at build time —
  so **deployed chunk hashes never match your local build**; verify deploys by
  following the deployed `index-*.js` to the real lazy-chunk names and grepping
  those for a marker string).
- Backend: Express ESM in `backend/src/`, Railway, `https://bmapz-production.up.railway.app`.
- Production frontend: `https://ai.bmapz.com`.
- Cloudflare serves `index.html` (content-type `text/html`) for unknown asset
  paths — a 200 on a chunk URL is NOT proof it exists. Check the content type.
- Migrations 001–020 are applied (Derek confirmed 018/019/020 on 2026-08-05).
  `supabase/VERIFY_018_019_020.sql` is a read-only PASS/FAIL verifier — run it in
  the Supabase SQL editor if anything schema-related looks wrong.
- `ai_outputs` has NO top-level `title`/`content`/`category`/`status`/`created_by`
  columns. Those live in `metadata` JSONB; `flattenAIOutput()` merges them up.
  Inserting them top-level makes PostgREST reject the row — and several call
  sites swallow that in try/catch, so it fails **silently**. This bug shipped
  twice already.

## What Claude Code changed in sessions 24–27 (verify, don't redo)

1. **Wrong-lead bug**: `LeadDetails` used `Lead.filter({id})` → the list endpoint
   ignored `id` and returned everything, so every card opened the newest lead.
   Now `Lead.get(id)`; list route also honours `?id=`.
2. **Copy generator**: Google RSA returns `headlines[]`/`descriptions[]` arrays;
   the validator demanded flat keys and discarded every variant. Added
   `normalizeCopyVariant()` + synonyms; failures now return a raw-output sample.
3. **Lead history "Invalid Date"**: `created_at`/`sent_at`/`created_date` mismatch.
4. **`/api/metrics`** + `OperationsMetrics.jsx`: response time (SDR vs human),
   first contact with/without SDR, availability, velocity, touchpoints, workload.
5. **Internal-role lockdown** (migration 018 + admin route + a new
   `/api/admin/invite`): `owner`/`system_admin` restricted to the platform
   company at API and DB-trigger level. The old panel invite put every invitee in
   the *caller's* company.
6. **Drill-downs** on every bar, pie slice, stat card and funnel stage
   (`DrillDownModal.jsx`), plus removal of a lot of fake data (hardcoded
   `weeklyData`, invented stat-card percentages, fixed `+12%` trends, and widgets
   that ignored their own `dataSource`).
7. **AI Outputs archive tab** + brain learning loop (`brain_learnings`,
   migration 019) + atomic credit deduction RPC (`consume_ai_credits`).
8. **Drafts persist in place** (migration 020: `ads.copy_drafts`,
   `ad_campaigns.ai_plan`; `lib/usePersistentDraft.js` for Ads/Social).
9. **Dropdowns "not appearing"**: an empty `SelectContent` opened an invisible
   ~2px menu. `SelectContent` now renders "No options available"; popper contents
   moved to `z-[60]` above dialogs (`z-50`), tooltips `z-[70]`. Also added the
   missing `GET /api/admin/accounts` (the Set Account list was hardcoded `[]`).
10. **Central AI archiving** in `runAIChat` via `ARCHIVE_CATEGORY_BY_ACTION`.
11. **WhatsApp webhook signature verification** (`X-Hub-Signature-256`, HMAC over
    `req.rawBody`). Verified live: an unsigned POST returned 200 before and 401
    after. **Fails closed — needs `META_APP_SECRET` in Railway.**
12. **`POST /api/messaging`** now tags outbound sends `{human: true, sent_by}` so
    the SDR-vs-human metric stops undercounting humans.

## Your assignment

### A. Finish the connectivity sweep (highest value)

Claude Code centralised archiving but only tagged three generators. **Tag the
rest** so everything a user generates reaches AI Outputs. Untagged today:
`components/workflows/WorkflowAIPanel.jsx`, `AIOptimizationPanel.jsx`,
`WorkflowNodePanel.jsx`, `FlowchartBuilder.jsx`, `components/ads/AdsCreativesTab.jsx`,
`components/social/SocialPerformanceTab.jsx`, `pages/SEO.jsx`,
`pages/WorkflowAnalytics.jsx`, `components/brandscan/BrandScanSetup.jsx`,
`pages/Dashboards.jsx` (custom metric).
Pass an `action` from `ARCHIVE_CATEGORY_BY_ACTION` (add entries if a category is
genuinely new) plus an `archiveTitle`. **Do NOT tag anything in `pages/Design.jsx`**
— see the Design secrecy rule. Judgement call: BrandScan and the Dashboards
custom-metric prompt may be config rather than reviewable content; decide and say
why in the handoff.
Then prove it end to end: generate in each surface and confirm the row appears in
the Archive tab with the right category and a `pending` status.

### B. Audit dimensions Claude Code started but could not finish

Eight parallel auditors were launched; only partial results returned before the
session ended. Redo these yourself, thoroughly, and fix what you find:

1. **i18n coverage.** 736 keys exist for both `en` and `pt-BR` with zero missing,
   so the gap is *hardcoded English*, not missing keys. Note the app uses TWO
   patterns — `t('key')` and inline `isPt ? 'pt' : 'en'` — so a low `t()` count
   is not proof. Pages with neither: **TextTemplates, Login, Signup,
   PrivacyPolicy, TermsOfService, DataDeletion**, and largely WorkflowAnalytics,
   SEO, Inbox, Integrations, LeadDetails, AIChat, Dashboards, Help. Legal + auth
   pages matter most for a pt-BR-first market. Also check `toast.*` messages,
   placeholders, `aria-label`s and empty-state copy.
2. **Dead code.** Look for unreferenced files/exports, entities pointing at
   non-existent routes (all 23 prefixes currently resolve), Base44-era leftovers
   (`grep -ri base44`), duplicate implementations (there were two workflow
   template systems), and unused dependencies. **Derek's standing instruction:
   if a deletion could matter now or later, STOP and ask him in plain English
   with pros/cons — do not decide for him.**
3. **DB/code drift.** Build the column list from `supabase/migrations/*.sql`
   (001–020, later files ALTER earlier tables) and find queries referencing
   columns that do not exist. Note `leads.funnel_stage` is real and
   `pipeline_stage` never existed (already fixed once).
4. **Runtime breakage prediction.** Hunt the recurring classes: objects rendered
   directly in JSX (`[object Object]` — already hit Ads strategy output),
   `new Date(undefined)` → "Invalid Date", `.map()` on possibly-undefined,
   `JSON.parse` without try/catch on AI output, and `useQuery` results treated as
   arrays when the route returns `{data, total}`.
5. **Settings + integrations coverage.** Every toggle in Settings should persist
   and take effect; every integration card's connected state must reflect reality
   (a previous bug showed platforms as connected when they were not).

### C. Next-phase readiness — external platform API permissions

Verify concretely and fix blockers:
- **OAuth per platform**: full authorization-code flow, HMAC-signed `state`
  (already implemented — confirm), token storage, and **refresh** handling. Which
  platforms are still stubs? `lib/adPublisher.js` has real Meta/LinkedIn/TikTok
  adapters; Google and X return `NOT_SUPPORTED`.
- **Redirect URIs** driven by env, never hardcoded localhost, and matching what
  is registered in each platform console.
- **Legal + data deletion**: Meta requires a working data-deletion callback.
  Exercise `/api/data-deletion` end to end and prove it deletes.
- **Webhook verification**: WhatsApp is now signature-verified; Stripe already
  was. Check any other inbound webhook.
- **Secrets**: no tokens in the repo, no tokens in logs.
- **Scopes** declared per platform and permission-denied handled with an
  actionable message rather than a silent failure.

### D. Deliverable

Update `AGENT_HANDOFF.md`, then produce a report answering exactly:

> **Is the App ready for the next phase (external platform API integration
> permissions)? Find & fix any blocker or issue remaining/preventing us from
> moving to the next phase.**

Structure it as: verdict (ready / ready-with-conditions / not ready), the
evidence for each platform separately (Meta, Google, LinkedIn, TikTok, X,
WhatsApp, Stripe), the blockers you fixed, the blockers that remain with who must
act, and anything needing Derek's decision.

## Open item Claude Code deliberately did NOT decide (do not decide it either)

**AI credit allowances are mis-scaled.** Margin is >99% (burning an entire Scale
allowance costs under R$4 of provider spend against R$785 revenue), but
`TOKENS_PER_CREDIT = 12` combined with the model multipliers makes allowances so
tight that a Starter customer on the Anthropic default (haiku, multiplier 6) gets
~2 ads strategies or ~3 blog posts per month, and **zero** ads strategies on
`claude-sonnet-4-5` (multiplier 25). Scans are safe — they charge a scan token and
skip credit deduction. This is Derek's pricing call. Surface it, quantify it, do
not change the constants.
