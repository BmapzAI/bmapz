# Bmapz App Code Audit - 2026-05-18

Purpose: move Bmapz AI from a partially converted Base44 app into a functional, market-ready standalone app for non-technical sales and marketing professionals.

## Executive Summary

The app is not fully functional yet. The backend has valid JavaScript syntax, but the frontend appears to have widespread standalone-conversion corruption in JSX strings/templates. This likely prevents the frontend from building. There are also API mismatches between frontend calls and backend routes, and several database/schema mismatches that will break key user flows even after the frontend compiles.

The first milestone should be: "make the app compile and show login/signup/home reliably." Do not optimize features before that.

## What Was Checked

- Local project structure in `C:\Users\derek\OneDrive\Documents\Bmapz App`
- Frontend source under `frontend-src/`
- Backend source under `backend/src/`
- Supabase schema under `supabase/migrations/001_initial_schema.sql`
- Deployment configs for GitHub Actions, Railway, Cloudflare Pages, and Vite
- Base44 URL access attempt

## Base44 Review Status

Original Base44 URL:

`https://app.base44.com/apps/692f76589e4f67192bcabdb4/editor/workspace/code`

Status: direct URL access was blocked because the private Base44 editor could not be accessed from this environment. Chrome automation also failed because the local browser integration could not read the required Chrome app-cache path.

The user later provided the original Base44 export zip:

`C:\Users\derek\OneDrive\Documents\BMapz\Backups\Bmapz.ai App\bmapz-ai-sales-marketing-automation 09.05.2026 (pre-calude).zip`

### Base44 Export Findings

The zip is useful and should be treated as the original product reference. It contains:

- Original frontend source under `src/`
- Original Base44 function implementations under `base44/functions/*/entry.ts`
- Base44 entity definitions under `base44/entities/*.jsonc`
- Base44 agent definition under `base44/agents/bmapz_agent.jsonc`

Important migration guidance:

- The original frontend files are cleaner than the current standalone `frontend-src` copies. Use them as a repair reference for corrupted JSX/encoding, but do not copy them blindly because they still depend on `@base44/sdk` and `base44.functions.invoke(...)`.
- The original `src/api/base44Client.js` uses `@base44/sdk`. The standalone app must keep replacing this with Supabase/Auth + Express API calls.
- The original `src/api/entities.js` is very thin and only exposes Base44 SDK behavior. The standalone `frontend-src/api/entities.js` compatibility layer is necessary and should be completed, not removed.
- The Base44 agent goal was broader than chat: the AI assistant was designed as a full platform operator with read/write access to leads, workflows, message templates, social posts, ads, blog, SEO, dashboards, settings, integrations, and saved AI outputs. This is an important long-term product objective, but the first recovery milestone remains "make the app compile and core flows work."

Base44 functions that should be used as a standalone backend migration checklist:

- `callAI`
- `getCompanyContext`
- `testIntegration`
- `executeSocialAction`
- `fetchPostMetrics`
- `boostMetaPost`
- `createStripeCheckout`
- `stripeWebhook`
- `sendEmail`
- `sendWhatsApp`
- `fetchInbox`
- `replyToMessage`
- `receiveInboxMessage`
- `scoreLeadICP`
- `bulkScoreLeads`
- `enrichLead`
- `analyzeLeadDigitalPresence`
- `enrollLeadInWorkflow`
- `advanceWorkflowRun`
- `syncDynamicLists`
- `scheduleMeeting`
- `triggerWebhook`
- `publishAdCampaign`
- `optimizeAdCampaigns`
- `fetchAdLeads`
- `fetchAdAccountData`
- `fetchMultiPlatformAdData`
- `analyzeSEO`
- `fetchGoogleSearchConsoleData`
- `publishToWordPress`
- `fetchGoogleDriveImages`
- `initiateOAuth`
- `initiateGoogleOAuth`
- `googleOAuthCallback`
- `initiateMetaOAuth`
- `metaOAuthCallback`
- `onLeadCreated`
- `onLeadStageChange`
- `onAIOutputApproved`
- `logActivity`
- `transcribeAudio`

Base44 entity definitions found in the export:

- `Account`
- `AdminChangeLog`
- `BillingPurchase`
- `CreditTransaction`
- `DataDeletionRequest`
- `SocialPost`
- `Subscription`
- `User`
- `Workflow`

Notable entity confirmation:

- Base44 `CreditTransaction.type` allows `usage`, `topup`, `monthly_grant`, `bonus`, `refund`. This confirms the standalone backend should not insert `deduction` unless the schema is intentionally changed.
- Base44 `SocialPost` has `status` values `draft`, `scheduled`, `published`. The standalone schema adds `failed`, which is acceptable as an extension, but frontend behavior should still preserve the original draft/scheduled/published flow.
- Base44 `Workflow.nodes` and `Workflow.connections` were described as arrays of serialized JSON strings, while the standalone Supabase migration uses `JSONB[]`. Claude should verify the frontend and backend agree on one representation before relying on workflow execution.

## Critical Findings

### 1. Frontend likely does not compile

Several JSX files contain malformed template strings such as:

- `className={...}'}`
- `value={something || `'}`
- mismatched backticks/single quotes
- corrupted strings in JSX expressions

Examples found:

- `frontend-src/Layout.jsx`
- `frontend-src/components/onboarding/OnboardingWizard.jsx`
- `frontend-src/components/social/SocialPerformanceTab.jsx`
- `frontend-src/pages/WorkflowAnalytics.jsx`
- `frontend-src/pages/TextTemplates.jsx`
- `frontend-src/pages/SocialMedia.jsx`
- `frontend-src/pages/Settings.jsx`
- `frontend-src/components/settings/ApiKeysTab.jsx`
- `frontend-src/components/billing/UsageMeter.jsx`
- `frontend-src/components/chat/MessageBubble.jsx`
- `frontend-src/components/integrations/ConnectIntegrationModal.jsx`
- `frontend-src/components/brandscan/BrandScanReport.jsx`
- `frontend-src/components/sales/LeadListView.jsx`
- `frontend-src/components/sales/LeadListManager.jsx`
- `frontend-src/components/sales/LeadListManagerFull.jsx`
- `frontend-src/components/sales/AddLeadForm.jsx`
- `frontend-src/components/sales/KanbanFilters.jsx`
- `frontend-src/components/sales/LeadKanban.jsx`

Impact: the browser app may fail before users can log in.

Recommended fix: install dependencies, run `npm run build:frontend`, then repair files one build error at a time until Vite builds cleanly.

### 2. `npm` is not available in the current terminal

Commands attempted:

- `npm run build:frontend`
- `npm run build:backend`

Result: `npm` was not recognized on PATH.

Impact: local build/test verification cannot be completed until Node/npm are installed or VS Code terminal is configured with Node.

Recommended fix: install Node.js LTS for Windows, reopen VS Code/terminal, then run:

```powershell
npm run install:all
npm run build:frontend
npm run build:backend
```

### 3. Production domain is missing from backend CORS allow-list

Production frontend URL is:

`https://ai.bmapz.com`

Backend CORS allow-list in `backend/src/index.js` currently includes older domains such as `bmapzai.com`, but not `ai.bmapz.com`.

Impact: production frontend calls to the Railway backend may fail unless Railway `FRONTEND_URL` is exactly set to `https://ai.bmapz.com`.

Recommended fix: add `https://ai.bmapz.com` to the static allow-list and ensure Railway `FRONTEND_URL=https://ai.bmapz.com`.

### 4. Frontend calls backend routes that do not exist

Examples:

- `frontend-src/components/onboarding/OnboardingWizard.jsx` calls `POST /api/companies`, but backend only has `/api/companies/current`, `/subscription`, `/credits`, `/deduct-credits`.
- `Company.create(...)` is used in Settings/Admin/CompanyAdmin through the generic entity helper, but the backend does not implement `POST /api/companies`.
- `frontend-src/components/social/SocialPerformanceTab.jsx` calls `POST /api/social/posts/boost`, but backend does not implement this route.
- Original Base44 has `base44/functions/boostMetaPost/entry.ts`, which can guide the missing standalone `POST /api/social/posts/boost` implementation.
- Original Base44 has `base44/functions/fetchPostMetrics/entry.ts`, which can guide production-grade post metrics sync beyond the current `/api/social/analytics` behavior.

Impact: onboarding, company creation, admin company creation, and social boosting will fail.

Recommended fix: either implement the missing backend routes or adjust the frontend to use supported routes.

### 5. Frontend references symbols that are not imported

Example:

- `frontend-src/components/social/SocialPerformanceTab.jsx` calls `SocialPost.update(...)` but does not import `SocialPost`.

Impact: runtime crash when refreshing social metrics.

Recommended fix: import `SocialPost` from `@/api/entities` or replace the call with `api.patch('/api/social/posts/:id', ...)`.

### 6. Database schema does not match backend/company update behavior

The `companies` table schema contains JSONB fields such as `settings`, `api_keys`, `briefing`, `icp`, and `integration_status`, but backend `companies.js` tries to update many direct columns that do not exist in the schema, for example:

- `years_in_business`
- `business_model`
- `average_ticket`
- `openai_api_key`
- `google_client_id`
- `meta_app_secret`
- `smtp_host`
- `wordpress_url`
- many more

Impact: saving Settings/API keys can fail with Supabase column errors.

Recommended fix: map these values into JSONB fields instead of direct columns, or update the Supabase migration to create the needed columns. Prefer JSONB grouping for scalability and security:

- company profile data -> `briefing` or `settings`
- integration credentials -> encrypted backend storage, not browser-visible company columns
- public integration status -> `integration_status`

The Base44 export confirms the original app stored many integration credentials under `company.api_keys`. For standalone production, do not expose sensitive API keys to the browser. Prefer backend-only storage/encryption and return only status metadata to the frontend.

### 7. Credit transaction type mismatch

Schema allows `credit_transactions.type` values:

- `usage`
- `topup`
- `monthly_grant`
- `bonus`
- `refund`

Backend `companies.js` inserts:

- `deduction`

Impact: deducting credits can fail because `deduction` violates the database check constraint.

Recommended fix: use `usage` instead of `deduction`, or expand the schema check constraint.

### 8. Deployment docs/configs have outdated domains and paths

Examples:

- `DEPLOYMENT.md` references `bmapzai.com`, while current production is `ai.bmapz.com`.
- `DEPLOYMENT.md` says run `supabase/schema.sql`, but the repo has `supabase/migrations/001_initial_schema.sql`.

Impact: future deploy/setup work can follow the wrong instructions.

Recommended fix: update documentation to reflect current production and actual file paths.

### 9. Encoding/mojibake appears in many files

Examples in output:

- `â€”`
- `â†’`
- `âœ…`
- `ðŸ...`

Impact: UI text and comments may look broken to users, especially in Portuguese/English mixed screens.

Recommended fix: normalize all source files to UTF-8 and clean user-facing copy after compile blockers are fixed.

## Backend Syntax Check

Command used:

```powershell
node --check backend/src/index.js
node --check all backend/src/**/*.js
```

Result: no backend JavaScript syntax failures were found using the bundled Node executable.

Important: this does not prove backend runtime correctness because environment variables, dependencies, Supabase connection, Stripe, OpenAI, OAuth providers, and Railway runtime were not exercised.

## Suggested Recovery Plan

### Phase 1 - Make it build

1. Install Node.js LTS and npm locally.
2. Run `npm run install:all`.
3. Run `npm run build:frontend`.
4. Fix frontend syntax errors one by one until build passes.
5. Run `npm run build:backend`.
6. When fixing corrupted JSX, compare against the original Base44 zip `src/` files as the clean UI reference, while preserving standalone imports/API replacements from `frontend-src/`.

### Phase 2 - Make login/signup/onboarding work

1. Confirm Supabase env vars are present.
2. Confirm Supabase Auth redirect URLs include:
   - `https://ai.bmapz.com/auth/callback`
   - local dev callback if needed
3. Decide how company creation should work:
   - create company automatically on signup, or
   - allow onboarding to create/update company.
4. Implement missing `POST /api/companies` if onboarding/admin creation should create companies.

### Phase 3 - Make core product workflows usable

Priority for market-readiness:

1. Settings / company profile / ICP / briefing
2. AI chat and saved AI outputs
3. Leads CRM
4. Workflows builder
5. Social media planner
6. Ads tools
7. Integrations
8. Billing
9. Admin/company admin

Use the Base44 functions as feature parity references during this phase. Do not migrate all functions at once. Start with the functions needed by the current UI path being stabilized.

### Phase 4 - Production hardening

1. Add `https://ai.bmapz.com` to backend CORS.
2. Confirm Railway env vars.
3. Confirm Cloudflare Pages env vars.
4. Confirm GitHub Actions secrets.
5. Confirm Supabase RLS policies and service-role backend behavior.
6. Add smoke tests for health, auth, company, leads, AI chat, and billing.

## Prompt For Claude Code

```text
You are helping Codex stabilize the Bmapz App / BmapzAI standalone app.

Open:
C:\Users\derek\OneDrive\Documents\Bmapz App

Read first:
- AGENTS.md
- CLAUDE.md
- AGENT_HANDOFF.md
- docs/CODE_AUDIT_2026-05-18.md

Goal:
Make the app compile and reach a functional login/signup/home/onboarding baseline before adding new features.

Start with Phase 1:
1. Confirm Node.js/npm are available.
2. Run npm run install:all.
3. Run npm run build:frontend.
4. Fix the first frontend build error.
5. Repeat until the frontend builds.
6. Run npm run build:backend.

Rules:
- Update AGENT_HANDOFF.md before editing.
- Do not touch production secrets or real .env files.
- Do not deploy until the build passes locally.
- Keep fixes small and focused.
- After each fix, document the exact files changed and the next failing build error.

Known likely blockers:
- Corrupted JSX className/template strings ending in extra quotes.
- Original Base44 `src/` files in the provided zip are a clean reference for repairing corrupted JSX, but preserve standalone API changes.
- Missing backend routes: POST /api/companies and POST /api/social/posts/boost.
- Use `base44/functions/boostMetaPost/entry.ts` as the reference for POST /api/social/posts/boost.
- Use `base44/functions/fetchPostMetrics/entry.ts` as the reference for social post metrics sync.
- SocialPerformanceTab uses SocialPost without importing it.
- companies.js updates fields that do not exist in the Supabase companies table.
- credit_transactions uses type 'deduction' but schema only allows usage/topup/monthly_grant/bonus/refund.
- backend CORS should include https://ai.bmapz.com.
```
