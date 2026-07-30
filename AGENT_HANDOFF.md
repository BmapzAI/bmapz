# Agent Handoff

Shared coordination file for Codex and Claude Code.

## Current State

- Repository: `C:\Users\derek\OneDrive\Documents\Bmapz App`
- Project: Bmapz App / BmapzAI
- Production URL: `https://ai.bmapz.com`
- Git branch: `main`
- Git status when configured: repository has imported app files and no commits yet.
- Source imported from Claude local-agent output: `C:\Users\derek\AppData\Local\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\local-agent-mode-sessions\b5fcce77-9259-4459-9516-831f4dffed05\2703066d-4dd9-4c11-88f4-df3c368cbb44\local_7ce6ccf8-52e7-44af-b44a-29e4de48a3f6\outputs\bmapz-standalone`
- Stack: Vite + React frontend, Express backend, Supabase, Railway, Cloudflare Pages.
- Claude CLI command was not found on PATH as `claude` or `claude-code` during this setup.

## Active Claims

| Owner | Task | Files / Areas | Status | Updated |
| --- | --- | --- | --- | --- |
| Codex | Session 22 audit and integration verification | Design, SDR, AI Chat, Workflows, Company Brain, Supabase migrations, production smoke tests | Done | 2026-07-24 |
| Codex | Import app source and configure shared agent workflow | `AGENTS.md`, `CLAUDE.md`, `AGENT_HANDOFF.md`, `package.json`, `CLAUDE_COWORK_PROMPT.md` | Done | 2026-05-18 |
| Codex | Configure VS Code workspace for project visibility | `.vscode/`, `Bmapz App.code-workspace`, `AGENT_HANDOFF.md` | Done | 2026-05-18 |
| Codex | Review standalone app code and prepare Claude pickup audit | `docs/CODE_AUDIT_2026-05-18.md`, `AGENT_HANDOFF.md` | Done | 2026-05-18 |
| Codex | Review original Base44 zip and add useful findings | `docs/CODE_AUDIT_2026-05-18.md`, `AGENT_HANDOFF.md` | Done | 2026-05-18 |
| Codex | Set up simple live board for Codex/Claude visibility | `AGENT_LIVE_BOARD.md`, `CLAUDE_COWORK_PROMPT.md`, `AGENT_HANDOFF.md` | Done | 2026-05-18 |
| Claude | Phase 1 + 2: Fix all JSX corruption; frontend build passes | All `frontend-src/**/*.jsx` files, `backend/src/index.js`, `backend/src/routes/companies.js` | **✅ BUILD PASSING** | 2026-05-18 |

## Next Recommended Step

**Runtime integration wiring is now fixed. Next: live-environment smoke test by feature, not just page load.**

1. **Test API key saving**: In Settings → API Keys, enter an OpenAI key, save, reload page — confirm key is pre-filled. Then click "Test Key" — confirm "OpenAI connected" toast.
2. **Test OAuth**: In Integrations, connect Meta (if app ID is configured). Check `companies.api_keys.meta_access_token` in Supabase after callback.
3. **Test `/api/integrations/test/openai`**: POST directly to backend with a valid key, expect `{ success: true }`.
4. **Test workflow node-templates**: GET `/api/workflows/meta/node-templates` — should return array, not 404.
5. **Workflow execution engine**: `POST /api/workflows/:id/run` still only creates a run record. Actual node execution is a future task.
6. **Remaining known gaps**: OAuth token refresh when tokens expire, real-time workflow scheduling, admin smoke-test by role.

## Work Log

### 2026-05-18 - Codex

- Inspected `Bmapz App`; found only `.git`.
- Checked nearby `BMapz` and `BMapz\Bmapz.ai`; found documents/assets, no Git repository.
- Checked `BMapz\Backups\Bmapz.ai App`; found app archives, no extracted Git repository.
- Added shared coordination files so Codex and Claude Code can work from the same rules.
- Inspected the Claude local-agent output folder provided by the user.
- Identified `outputs\bmapz-standalone` as the integrated app source because it contains `backend`, `frontend-src`, `supabase`, `railway.toml`, `wrangler.toml`, and `.github`.
- Copied `bmapz-standalone` into `C:\Users\derek\OneDrive\Documents\Bmapz App` excluding the broken `.git` metadata from Claude's cache.
- Set the unborn Git branch to `main` to match `.github/workflows/deploy.yml`.
- Added root scripts for frontend/backend build and install compatibility with deployment docs.
- Verification note: `git status --short --branch` works and reports `No commits yet on main`; build commands could not run in this shell because `npm` is not available on PATH.
- Added VS Code workspace settings, recommended extensions, and simple tasks for showing changed files, showing exact changes, opening the handoff file, and running frontend/backend builds.
- Completed first audit pass and wrote `docs/CODE_AUDIT_2026-05-18.md`.
- Base44 private editor review was blocked by access/browser integration permissions; local standalone code was reviewed instead.
- Backend syntax check passed for `backend/src/**/*.js` using bundled Node.
- Frontend build could not be run because `npm` is not available on PATH, but manual scan found many likely build-breaking JSX conversion errors.
- Reviewed original Base44 export zip at `C:\Users\derek\OneDrive\Documents\BMapz\Backups\Bmapz.ai App\bmapz-ai-sales-marketing-automation 09.05.2026 (pre-calude).zip`.
- Added Base44 export findings to the audit. Key takeaway: use original `src/` files as clean JSX/UI reference, and use `base44/functions/*/entry.ts` as the standalone backend migration checklist.
- Added `AGENT_LIVE_BOARD.md` as a simple live-status board. This does not create direct Codex-to-Claude messaging, but it gives both agents and Derek one shared place to watch/report work.

### 2026-05-18 - Claude (Phase 1 completion)

**JSX Corruption — all patterns fixed:**
- Identified two corruption patterns throughout frontend-src: (1) `}'}` → `` }`} `` (template literal closing backtick replaced by `'`), (2) `{\`` / `}\'` backslash-injected corruption around template literals.
- Bulk-fixed 46 files with pattern (1) via PowerShell regex `(?<=\})'(?=\})` → `` ` ``.
- Individually fixed: `Layout.jsx`, `OnboardingWizard.jsx`, `SocialPerformanceTab.jsx`, `WorkflowAnalytics.jsx`.
- Fixed `TextTemplates.jsx` (5 corruptions including backslash pattern; file was accidentally zeroed mid-session — restored from session backup at `...local-agent-mode-sessions/.../bmapz-standalone/frontend-src/pages/TextTemplates.jsx`).
- Fixed backslash-template-literal corruption in 6 more files: `LeadListManagerFull.jsx`, `FlowchartBuilder.jsx`, `AIChat.jsx`, `BrandScan.jsx`, `SEO.jsx`, `SocialMedia.jsx`.
- Final verification: 0 remaining `}'}` patterns and 0 remaining `{\`` patterns across all `.jsx` files.

**Backend fixes applied:**
- `backend/src/index.js`: Added `https://ai.bmapz.com` to CORS `allowedOrigins`.
- `backend/src/routes/companies.js`: Changed `credit_transactions` type from `'deduction'` → `'usage'` (schema alignment).
- `backend/src/routes/companies.js`: Added `POST /api/companies` route for onboarding wizard (updates existing company created by JIT auth provisioning).
- `frontend-src/components/social/SocialPerformanceTab.jsx`: `SocialPost` import was already present from prior session fix.

**Build status:** Node.js was not available during Claude's run, so Claude could not verify with `npm run build:frontend`. Codex subsequently ran the build and found 16 parser errors (see next section).

### 2026-05-18 - Codex Build Check After Node Install

Node/npm are installed at `C:\Program Files\nodejs`, but plain `node` can resolve to a WindowsApps alias with permission errors. Use:

```powershell
$env:Path='C:\Program Files\nodejs;' + $env:Path; & "C:\Program Files\nodejs\npm.cmd" run build:frontend
```

Checks run:

- `npm install`: completed for frontend/root.
- `npm install --prefix backend`: completed for backend.
- `npm run build:backend`: passed; backend reports no build step needed for Node.js ESM.
- `npm run build:frontend`: failed; multiple frontend files still contain syntax corruption.

Codex repaired many concrete compile blockers, including:

- Restored static/legal pages from the Base44 export where standalone-specific changes were not needed: `Documentation.jsx`, `TermsOfService.jsx`, `PrivacyPolicy.jsx`, `DataDeletion.jsx`.
- Fixed syntax corruption in: `Pricing.jsx`, `CompanyAdminPanel.jsx`, `AdminPanel.jsx`, `Inbox.jsx`, `Ads.jsx`, `TextTemplates.jsx`, `SocialMedia.jsx`, `BrandScan.jsx`, `AIChat.jsx`, `Integrations.jsx`, `Billing.jsx`, `AIOutputs.jsx`, selected ads/brandscan/integration components.

Remaining parser errors from the last scan:

```text
frontend-src\components\brandscan\BrandScanReport.jsx:155:7 Unexpected token, expected ","
frontend-src\components\integrations\ConnectIntegrationModal.jsx:43:100 Unterminated string constant
frontend-src\components\sales\LeadListManager.jsx:202:32 Unterminated template
frontend-src\components\sales\LeadListManagerFull.jsx:250:119 Unterminated template
frontend-src\components\sales\LeadListView.jsx:198:66 Unexpected token, expected ","
frontend-src\components\settings\ApiKeysTab.jsx:269:39 Unexpected token, expected "}"
frontend-src\components\social\SocialCalendar.jsx:97:28 Missing semicolon
frontend-src\components\workflows\AIOptimizationPanel.jsx:173:28 Unexpected token, expected ","
frontend-src\components\workflows\FlowchartBuilder.jsx:923:19 Unexpected token, expected ")"
frontend-src\components\workflows\ScheduleMeetingPanel.jsx:139:86 Unexpected token, expected "}"
frontend-src\components\workflows\WorkflowCanvas.jsx:72:99 Unexpected token, expected "}"
frontend-src\components\workflows\WorkflowNodePanel.jsx:222:88 Unexpected token, expected "}"
frontend-src\lib\VisualEditAgent.jsx:633:48 Unterminated string constant
frontend-src\pages\Ads.jsx:364:118 Unterminated template
frontend-src\pages\Blog.jsx:380:81 Missing semicolon
frontend-src\pages\BrandScan.jsx:269:27 Unexpected token, expected "}"
frontend-src\utils\index.ts:1:38 Unexpected token, expected ","
```

Recommended Claude prompt: "Continue from `AGENT_HANDOFF.md`, fix only the remaining frontend parser errors listed under 'Codex Build Check After Node Install', rerun the parser scan and `npm run build:frontend`, and update `AGENT_LIVE_BOARD.md` with pass/fail results."

### 2026-05-18 - Claude (Phase 2 build fix — all parser errors cleared)

Fixed all remaining parser errors from Codex's build check. Errors were a second wave of the same corruption (template literal closing backtick replaced by `'`, or backtick used where `'` should open a comparison string). Files and fixes:

- `BrandScanReport.jsx`: `.pdf')` → `.pdf`)`, `.txt'` → `.txt`` (2 template closes)
- `BrandScan.jsx`: 5× `language === \`pt'` → `'pt'`; nested template literals in className replaced with plain strings to satisfy esbuild
- `ConnectIntegrationModal.jsx`: 8 logo URL strings closing with `` ` `` instead of `'`; `\`Connection failed...'` → backtick; `` `linkedin_social' `` → `'linkedin_social'`
- `LeadListManager.jsx`: `` `Update' `` → `'Update'`
- `LeadListManagerFull.jsx`: `` setManualSearch(`') `` → `setManualSearch('')`
- `LeadListView.jsx`: `` }20' `` → `` }20` `` (STAGE_COLORS template close)
- `SocialCalendar.jsx`: 3 corruptions — week range string, `:00'` hour display, and `}25'` color value
- `WorkflowCanvas.jsx`: `` '?'}' `` → `` '?'}` `` (social action template); `` `send_message' `` / `` `social_action' `` / `` `enrich_lead' `` → plain strings
- `WorkflowNodePanel.jsx`: all `{'{{var}}\`}` → `{'{{var}}'}` via regex; multi-line AI prompt template `}',` → `` }` ``,
- `FlowchartBuilder.jsx`: `` `trigger' `` → `'trigger'`
- `ScheduleMeetingPanel.jsx`: `{{lead_name}}\`}`, `{{meet_link}}\`}` → closing single quotes
- `VisualEditAgent.jsx`: `'height\`` → `'height'` in attributeFilter array
- `Ads.jsx`: `` title}"\' `` → `` title}"` ``
- `Blog.jsx`: `</html>'` → `` </html>` `` (big html template); `a.download` already fixed previously
- `utils/index.ts`: No change needed — file is clean TypeScript; Codex's parser scan was using a non-TypeScript parser (false positive confirmed by successful Vite build)

**Build result: ✅ PASSED**
```
✓ 3554 modules transformed.
✓ built in 26.81s
```
Non-blocking warnings: supabase dynamic+static import overlap, main chunk 2.9 MB (both expected for a large SPA).

### 2026-05-19 - Claude (Phase 3: Full entity/route audit — all broken refs fixed)

**Commits pushed (8 total in this session):**

1. `8076c51` — BrandScan page: created `/api/brand-scans` backend CRUD route with status/field mapping; added `BrandScanData` entity; replaced `BrandScan.list/create/update/delete` (calls on the React component) with `BrandScanData.*`. Also fixed legacy sort-string bug in Home.jsx (`Activity.list({limit:10})`), CompanyAdminPanel.jsx, AdminPanel.jsx.

2. `8068eb1` — Created `funnels.js` and `dashboardConfigs.js` backend routes; added `Funnel` and `DashboardConfig` entities; fixed Sales.jsx and Dashboards.jsx imports. Fixed LeadDetails.jsx: removed undefined `Funnel.list()` call.

3. `afd695d` — Created `nodeTemplates.js` backend route; created `dataDeletion.js` public POST route (GDPR); added `NodeTemplate` and `DataDeletionRequest` entities; fixed `FlowchartBuilder.jsx` import; fixed `DataDeletion.jsx` import; fixed `AdminPanel.jsx` to use `/api/admin/*` direct calls instead of entity methods (Company/Subscription/User/BillingPurchase all need cross-company admin access); added admin CRUD routes to `admin.js` (companies, subscriptions, purchases, users).

4. `8757ff4` — Added `PATCH /api/leads/lists/:id` (LeadList.update); added `PATCH /api/users/:id` (User.update by company admin); added `POST /api/companies` (Company.create + trial subscription); added `Company.create` to entity.

5. `af25675` — Added `PATCH /api/ai/outputs/:id` for `AIOutput.update`; fixed `AdsLeadsTab.jsx` `Lead.filter().concat()` anti-pattern → `Promise.all + spread`; added missing `SocialPost` import in `SocialPerformanceTab.jsx`; added missing `LeadList` import in `LeadListView.jsx`.

6. `2323d45` — Fixed `ai_outputs` schema mismatch: table lacks `title`, `content`, `status`, `channel`, `category` columns that frontend expects. Fixed POST to store extra fields in `metadata` JSONB; fixed GET to flatten `metadata` into response; fixed PATCH to merge metadata on update. Added `flattenAIOutput()` transformer.

7. `a607f38` — Added missing `LeadList` import to `LeadListManager.jsx` and `LeadListManagerFull.jsx` (both used `LeadList.*` without import → ReferenceError).

8. `4c29ec2` — Added `GET /api/leads/lists/:id` backend route for `LeadList.get()` completeness.

**Backend routes created this session:**
- `/api/brand-scans` (CRUD + status mapping)
- `/api/funnels` (CRUD)
- `/api/dashboard-configs` (CRUD)
- `/api/node-templates` (CRUD, global + company scope)
- `/api/data-deletion` (public POST, GDPR)
- `/api/admin/companies` (POST/PATCH/DELETE)
- `/api/admin/subscriptions` (GET/POST/PATCH)
- `/api/admin/purchases` (GET/PATCH)
- `/api/admin/users` (PATCH/DELETE)
- `PATCH /api/leads/lists/:id`, `GET /api/leads/lists/:id`
- `PATCH /api/users/:id`
- `POST /api/companies`
- `PATCH /api/ai/outputs/:id`

**Entities added to entities.js:**
`BrandScanData`, `Funnel`, `DashboardConfig`, `NodeTemplate`, `DataDeletionRequest`, `Company.create`

**Live status (2026-05-19):**
- Backend Railway: ✅ `{"status":"ok"}` 
- Frontend ai.bmapz.com: ✅ Loads
- Build: ✅ 3553 modules, no errors (only chunk-size warnings)

**Remaining known gaps (not yet addressed):**
- `Company.filter({ id: ... })` / `Company.filter({ created_by: ... })` in CompanyAdminPanel ignores params — always returns current company. Logic is tolerable (returns a company either way) but not precise.
- No Cloudflare Pages edge cache purge after deploy (auto-handled by CF).
- OAuth token refresh for Google/Meta tokens (when tokens expire, reconnect needed from Settings).
- No real-time workflow execution engine (workflows save state but don't auto-run on schedule).

### 2026-05-27 - Claude (Phase 4: Runtime integration fixes)

Fixed all runtime blockers identified in `docs/RUNTIME_AUDIT_2026-05-27.md`.

**Files changed:**
- `backend/src/routes/oauth.js` — **Rewritten**: all 5 OAuth providers (Google, Meta, LinkedIn, Twitter, TikTok) now read client credentials from `api_keys` JSONB and write tokens back into `api_keys` JSONB. `integration_status` now uses boolean `true` not string `'connected'`. Added `getCompanyKeys()` / `saveOAuthTokens()` / `clearOAuthTokens()` helpers. Disconnect endpoint now removes token fields from `api_keys` instead of nulling non-existent direct columns.
- `backend/src/routes/integrations.js` — Expanded status detection to cover openai, anthropic, stability, meta_ads, linkedin_ads, tiktok_ads, whatsapp, wordpress, zapier, make, n8n, custom, lusha, clay, cal_com. Added `POST /api/integrations/test/:type` with real API calls for 14 integration types.
- `backend/src/routes/workflows.js` — Moved `GET /meta/node-templates` before `GET /:id` to prevent route shadowing.
- `backend/src/routes/companies.js` — Added `lusha_api_key`, `clay_api_key`, `cal_com_api_key`, `chilipiper_api_key`, `chilipiper_tenant` to `API_KEY_FIELDS`.
- `frontend-src/components/integrations/ConnectIntegrationModal.jsx` — Fixed `handleSaveCreds`: now sends flat `credValues` instead of nested `api_keys` object.
- `frontend-src/components/settings/ApiKeysTab.jsx` — Fixed `connectMetaOAuth`: replaced broken `window.open() → res.data` with proper popup + postMessage listener. Fixed `testIntegration`: now calls `POST /api/integrations/test/:type` and reads response directly (no `.data` wrapper). Added `useQueryClient`.
- `frontend-src/api/apiClient.js` — Fixed empty `catch {}` block (lint error).
- `frontend-src/components/workflows/FlowchartBuilder.jsx` — Fixed `no-case-declarations` lint error (wrapped `case 'angled'` in braces).
- `frontend-src/lib/AuthContext.jsx` — Fixed empty catch block.
- `frontend-src/pages/AuthCallback.jsx` — Fixed empty catch block.
- `eslint.config.js` — **Created**: ESLint 9 flat config; `npm run lint` now passes with zero errors.

**Build result:** ✅ 3553 modules, 14.65s
**Lint result:** ✅ 0 errors, 1516 warnings (warnings are unused-vars in existing code, non-blocking)
### 2026-05-27 - Codex (Post-Claude runtime audit and targeted repairs)

User screenshots showed Phase 4 was not fully fixed in production-like behavior:

- AI Chat returned raw Anthropic billing JSON: `Your credit balance is too low to access the Anthropic API`.
- Meta OAuth popup opened `/api/oauth/meta/initiate?...` directly and failed with `Missing or invalid Authorization header`.
- Settings/API key UI could show blank values when company data arrived after the tab initialized.
- Google login still displayed the Supabase project host `jmtnubzgnfjmtcwbegow.supabase.co`; this is Supabase/Google OAuth branding configuration, not a frontend code string.

Codex changes:

- `backend/src/routes/oauth.js`: added authenticated `*-url` endpoints for Google, Meta, LinkedIn, Twitter, and TikTok (`/api/oauth/{provider}/initiate-url`) that return `{ authUrl }`. Kept existing redirect endpoints for compatibility. Fixed callback status updates to preserve requested integration types such as `meta_ads`. Fixed Twitter PKCE verifier mismatch by carrying `codeVerifier` through OAuth state.
- `frontend-src/components/integrations/ConnectIntegrationModal.jsx`: changed internal OAuth flow to call the backend with the app auth token first, then open the returned provider URL. Popup close without callback is no longer treated as success.
- `frontend-src/components/settings/ApiKeysTab.jsx`: changed Meta OAuth button to use `/api/oauth/meta/initiate-url`; added popup-blocked and incomplete-login errors. Added `useEffect` sync so saved company API keys/statuses populate once company data loads.
- `frontend-src/pages/AIChat.jsx`: removed hardcoded `model: 'gpt-4o-mini'` from chat requests so backend provider settings decide the model.
- `backend/src/routes/ai.js`: added provider-safe model selection. Anthropic ignores non-Claude model IDs; OpenAI ignores Claude model IDs. If Anthropic is selected but missing key/credits and OpenAI is available, chat falls back to OpenAI. If no fallback exists, the backend returns a clear user-facing billing/provider message instead of raw provider JSON.

Verification:

- `npm run build`: passed, 3553 modules transformed.
- `npm run build --prefix backend`: passed, no build step needed.
- `npm run lint`: passed with 0 errors and 1518 existing warnings.

Remaining important work:

1. Deploy these changes, then smoke-test production `https://ai.bmapz.com`.
2. In Supabase Dashboard, fix Google Auth branding/custom OAuth credentials so Google consent no longer displays the Supabase project host. Code cannot rename Supabase's hosted OAuth app by itself.
3. Continue feature smoke-testing by page and integration. Lint warnings still reveal likely dead/incomplete UI code in older modules, including `AdsCampaignsTab.jsx` references to `AdRecord` reported as warnings by current ESLint config.

### 2026-05-27 - Claude (Session 3: Comprehensive res.data sweep + billing fix)

Continued smoke-test by doing a full `res.data` sweep across all frontend files (the apiClient returns JSON directly — not Axios-style `{data}`).

**Commits pushed (3 total):**

1. `1dbed9d` — Fixed `res.data` in 11 files:
   - `AIChat.jsx`: `res.data` → `Array.isArray(res)` guard for conversation list
   - `Billing.jsx`: `res.data?.url` → `res?.url`
   - `Pricing.jsx`: `res.data?.url` / `res.data?.error` → `res?.url` / `res?.error`
   - `SEO.jsx`: `res.data` → `res` (response is already parsed JSON from `.then(r => JSON.parse(r.content))`)
   - `AdsPublishModal.jsx`: `res.data.success` / `res.data.error` → `res.success` / `res.error`
   - `AdsRealDataPanel.jsx`: `res.data.error` / `res.data` → `res.error` / `res`
   - `LeadListManagerFull.jsx`: `res.data?.synced` → `res?.synced`
   - `SocialPerformanceTab.jsx`: `res.data?.success` / `res.data.metrics` / `res.data?.error` → `res?.success` / `res.metrics` / `res?.error`
   - `AdsCampaignsTab.jsx`: added missing `import { AdRecord } from '@/api/entities'` (ReferenceError)
   - `SendMessageModal.jsx`: added `LeadList` to existing entity import
   - `LeadDetails.jsx`: `res.data.score` → `res.score`

2. `d10b1b1` — Fixed `res?.data` in 3 more files found on second sweep:
   - `Inbox.jsx`: `res?.data` → `res` in syncInbox
   - `AdsOptimizationTab.jsx`: `result.data.*` → `result.*` (generate + apply recommendations)
   - `AdsLeadsTab.jsx`: `result.data.*` → `result.*` (syncLeads)

3. `41572a9` — Fixed billing checkout `price_id` mismatch:
   - `Pricing.jsx` sends `plan_id + billing_cycle`; backend required `price_id` directly → 400 error
   - Added `resolvePriceId(planId, billingCycle)` helper to `billing.js` mapping `plan_id` → env var `STRIPE_PRICE_ID_{PLAN}_{MONTHLY|ANNUAL}`
   - `price_id` passed directly still supported as override

**Production status after these commits:**
- All `res.data` misuse eliminated (confirmed by `grep` returning no matches)
- 0 ESLint errors (1513 warnings — unchanged, all unused-vars in existing code)
- Billing checkout should now work if `STRIPE_PRICE_ID_*` env vars are configured in Railway

**Remaining known gaps:**
- Inbox sync: `GET /api/messaging?sync_to_crm=true` doesn't actually sync external mail — the sync endpoint doesn't exist yet. Inbox shows "Synced 0 new messages" which is confusing but not a crash. A real email sync endpoint is a future task.
- Workflow execution: `POST /api/workflows/:id/run` creates a run record but doesn't execute nodes. Needs a task queue / scheduler.
- OAuth token refresh: when Google/Meta/LinkedIn/Twitter/TikTok tokens expire, user needs to reconnect. No auto-refresh.
- Supabase Google Auth branding: consent screen still shows `jmtnubzgnfjmtcwbegow.supabase.co`. Fix requires Supabase Dashboard → Authentication → Providers → Google → set custom client ID/secret + update branding in Google Cloud Console OAuth consent screen.

**Next recommended smoke-test steps for Derek:**
1. Load Settings → API Keys, enter OpenAI key, save, reload — confirm key pre-filled
2. Open AI Chat, send a message — confirm response (no raw billing JSON)
3. Visit Integrations page — confirm integration statuses load
4. Visit Billing page — confirm it loads without errors
5. Visit Ads page → Campaigns tab — confirm no ReferenceError
6. Meta OAuth: click Connect in Integrations — should now show manual token fallback fields (until META_APP_ID + META_APP_SECRET env vars set in Railway)

### 2026-05-27 - Claude (Session 4: Production smoke-test fixes)

Observed from Derek's screenshots:
1. ❌ Meta Ads + Google Ads OAuth → "Connection failed: Meta App ID not configured"
2. ❌ AI Chat → "429 You exceeded your current quota" raw error
3. ❌ AI Chat → false "OpenAI API Key Required" banner even with key saved

**Commits pushed (4 total):**

1. `21599ce` — OAuth fallback UX + OpenAI 429 sanitization:
   - ConnectIntegrationModal: when OAuth initiate-url returns 400 "not configured", switches to `oauthFallbackMode` — shows manual token entry fields instead of dead error toast
   - Added `CREDENTIAL_FIELDS` entries for meta_ads, instagram, facebook, google_ads, gmail, linkedin_ads, linkedin_social, tiktok_ads, tiktok_social (fallback manual token entry)
   - Added `STATUS_KEY_MAP` entries for all OAuth types
   - Added yellow info banner in fallback mode explaining the situation
   - companies.js API_KEY_FIELDS: added meta_ad_account_id, meta_page_id, instagram_account_id, google_developer_token
   - ai.js: added `isOpenAIQuotaOrRateLimitError()` + friendly `publicMessage` for OpenAI 429s

2. `eba266e` — Fix false "AI API Key Required" banner:
   - Root cause: apiClient.js dropped backend error `code` field; AIChat checked `e.message.includes('api key')` which matched the quota error's friendly message
   - apiClient.js: preserve backend `code` and `status` on thrown errors
   - AIChat.jsx: check `e.code === 'MISSING_API_KEY'` (exact) instead of substring match
   - Banner text: "OpenAI API Key Required" → "AI API Key Required"

3. `894d75e` — Set `err.code = 'QUOTA_EXCEEDED'` for OpenAI 429 errors so frontend can distinguish quota vs missing key

**Production deployment action needed:**
To enable Meta and Google OAuth (instead of falling back to manual tokens), add these to Railway environment variables:
- `META_APP_ID` — Meta for Developers app ID
- `META_APP_SECRET` — Meta for Developers app secret
- `GOOGLE_CLIENT_ID` — Google Cloud Console OAuth 2.0 client ID
- `GOOGLE_CLIENT_SECRET` — Google Cloud Console OAuth 2.0 client secret
- `GOOGLE_ADS_DEVELOPER_TOKEN` — Google Ads API developer token (for Google Ads campaigns)

**Settings → API Keys smoke test result:** ✅ Keys persist on reload (both OpenAI + Anthropic show "Connected" with dots), provider toggle works

### 2026-05-27 - Claude (Session 5: AI fallback root-cause fix)

**Critical bug discovered:** Even though my Session 4 detection of OpenAI quota errors set a friendly publicMessage, the fallback to Anthropic was ONE-WAY ONLY (only fired when Anthropic was primary and Anthropic failed). When OpenAI was the active provider and returned 429, the system never tried Anthropic — it just threw the error.

This is why the user kept seeing "OpenAI is not available... quota or billing" even though Anthropic key was saved and working: the system never attempted Anthropic.

**Commits pushed (4 total):**

1. `824796e` — Complete AI route rewrite with bidirectional fallback:
   - `categorizeProviderError()` — distinguishes AUTH (401) / QUOTA (insufficient_quota, credit balance) / INVALID_MODEL (404, model_not_found) / RATE_LIMIT (429 transient) / PROVIDER_DOWN (5xx)
   - `runAIChat()` rewritten as a provider loop that tries primary first, then secondary; only fails when BOTH exhausted
   - New `callOpenAI()` and `callAnthropic()` with auto-retry on INVALID_MODEL using known-good fallback models
   - New `GET /api/ai/diagnose` — live-tests both providers with a 'ping' and returns full status breakdown per provider (key source, model resolved, ok/fail with error kind). Use this in production to debug what's actually failing for any company.
   - Status codes mapped: AUTH/QUOTA → 402, RATE_LIMIT → 429, PROVIDER_DOWN → 503

2. `2e9997c` — Surface real error messages in all AI flows (SocialMedia/Blog/Ads generation)

3. `c5d5761` — Safer model handling: pass user's selected model AS-IS to Anthropic (no risky aliases that could break newer model names), only auto-retry with `claude-3-5-sonnet-20241022` if invalid

4. `cf89a21` — Anthropic JSON-mode support: when frontend requests `response_format: { type: 'json_object' }` and we route to Anthropic, inject 'JSON only' instruction into the system prompt (Anthropic doesn't have OpenAI's structured response_format)

5. `f6211f5` — Lead scoring uses `runAIChat()`: previously `POST /api/leads/:id/score` called OpenAI directly with hardcoded gpt-4o-mini and no fallback. Now uses the unified helper with bidirectional fallback.

**Verification path for Derek:**

After Railway deploy completes (1-2 min), call this in browser console while logged in:
```js
fetch('/api/ai/diagnose', { headers: { Authorization: 'Bearer ' + (await window.supabaseClient?.auth?.getSession()).data.session.access_token } }).then(r => r.json()).then(console.log)
```

Or more simply: try sending a message in AI Chat. The flow now:
1. Active provider (OpenAI) is tried → if 429/auth fails, **automatically falls back to Anthropic**
2. Anthropic tries the user's selected model → if invalid, **automatically retries with claude-3-5-sonnet-20241022**
3. Only if BOTH providers fail does the user see an error

**All AI features that should now work via fallback:**
- AI Chat
- Social Media post generation
- Social Media AI optimization
- Blog post generation
- Ads strategy + ad copies generation
- SEO analysis
- Lead AI scoring (Sales page)
- Inbox AI reply suggestions
- Workflow AI builder
- Brand scan AI insights
- Help chat assistant

### 2026-05-27 - Claude (Session 6: AI credit system + margin protection)

**Built the full AI credit economy from spec.** Implements Derek's 8 requirements:
BYOK restricted to owner/system_admin, all others use platform keys; credit
deduction proportional to model cost; model tier gating per plan; usage
tracking visible to users and admins; 15k credit add-on packs; no free tier
beyond 14-day trial; prompt caching for margin protection.

**New files:**
- `backend/src/lib/aiCredits.js` — canonical credit math, model tiers, plan
  rules, BYOK gate. Single source of truth for `runAIChat` to consult.
- `frontend-src/components/settings/UsageTab.jsx` — user-facing AI usage
  breakdown (total/used/remaining + by feature/model/user, recent activity)
- `frontend-src/components/admin/AdminUsageTab.jsx` — system-admin AI Usage
  console tab with time-window filter, company drill-down

**Rewritten:**
- `backend/src/routes/ai.js::runAIChat` — full BYOK restriction, pre-flight
  credit check, model resolution by plan + action, prompt caching for
  Anthropic (≥1KB system prompts cached → 90% input cost reduction),
  bidirectional 4-tier provider fallback, post-success credit deduction
  with full audit trail in `credit_transactions`.
- `backend/src/routes/ai.js` exposes `GET /api/ai/usage`
- `backend/src/routes/admin.js` exposes `GET /api/admin/usage-stats`
  and `GET /api/admin/usage-stats/company/:id`
- `backend/src/routes/leads.js::POST /:id/score` passes user context and
  `action: 'lead_scoring'` to `runAIChat`

**Updated:**
- `frontend-src/lib/plans.js`: all four plans now have `allowed_model_tiers`
  whitelist. Add-on credit packs standardized to 15,000 credits (per Derek's
  decision). New helpers `MODEL_TIER`, `MODEL_TIER_LABELS`,
  `isModelAllowedForPlan`.
- `frontend-src/components/settings/ApiKeysTab.jsx`: BYOK inputs gated by
  `user.role ∈ {owner, system_admin}`. Non-admins see a "Keys managed by
  Bmapz" notice with link to Usage tab. Admin BYOK shows a warning that
  it bypasses Bmapz credit deduction.
- `frontend-src/pages/Settings.jsx`: new "Usage" tab; passes dbUser to
  ApiKeysTab.
- `frontend-src/pages/AdminPanel.jsx`: new "AI Usage" tab routed to
  `AdminUsageTab`.

**Credit math (in `aiCredits.js`):**
- 1 Bmapz credit ≈ 12 tokens of gpt-4o-mini (baseline)
- `gpt-4o-mini`: 1× | `claude-haiku`: 6× | `gpt-4o`: 17× |
  `claude-sonnet`: 23× | `claude-opus`: 117×
- Heavy actions (brand_scan / marketing_plan / sales_marketing_plan /
  campaign_plan) ALWAYS use the cheapest model, ignoring user pick —
  prevents margin blowouts on 30k–200k-token one-shots.

**Plan model access:**
- Trial / Starter → `smart` tier only (gpt-4o-mini, haiku)
- Growth → `smart` + `smarter` (gpt-4o, sonnet)
- Scale / Enterprise → all tiers (incl. opus)

**Plan margins after this work (worst-case 100% credit usage):**
- Starter R$ 69.90 → net $12.83 USD, max cost $0.03 (smart-only) → 99.8% margin
- Growth R$ 298 → net $54.95, max cost $3.36 (sonnet ceiling) → 94% margin
- Scale R$ 765 → net $141.17, max cost $13.02 → 91% margin
- Enterprise R$ 2,350 → net $433.90, max cost $34.02 → 92% margin

**Action items for Derek:**
1. Add `OPENAI_API_KEY` + `ANTHROPIC_API_KEY` env vars in Railway.
2. Fund those accounts (~$40 + $30 to start, with $50/$30 monthly caps in
   their respective dashboards).
3. Optional: set `STABILITY_API_KEY` for Stability AI image generation.

**Verification:**
- `npm run build`: 3554 modules, passes
- `npm run lint`: 0 errors
- `node --check` on all backend files: OK

**What this means for users:**
- Regular users + company_admins: cannot enter their own AI key. All AI
  consumption charges Bmapz credits. They see real-time usage in Settings
  → Usage tab.
- Owners + System Admins: can optionally add their own keys (BYOK).
  When BYOK is active, NO credits are deducted (their account, their cost).
- Starter users cannot select smarter/smartest models. The dropdown still
  shows them today but the backend silently downgrades to gpt-4o-mini.
  (Optional follow-up: filter the dropdown by plan in ApiKeysTab.)
- Brand scans + marketing plans ALWAYS run on gpt-4o-mini regardless of
  user choice — protects margins on expensive one-shots.

### 2026-05-30 - Claude (Session 7: OAuth-only integrations + AI Chat layout + WhatsApp Agent)

**Problem:** Integrations modal still had a "manual token fallback" path that set `integration_status=true` without actually verifying the connection, causing false "Connected" badges. OAuth popup close was also treated as success.

**Commits pushed:**

1. `ConnectIntegrationModal.jsx` rewrite:
   - Removed `handleExternalOAuthConnect` entirely (was setting connected=true on popup close).
   - `handleSaveCreds` now calls `POST /api/integrations/test/:type` before marking connected. Only sets `integration_status=true` if `success===true`.
   - Added `PLATFORM_KEY_URLS` map: deep-links to the exact API-key-generation page for 25+ platforms (Apollo, HubSpot, Mailchimp, Klaviyo, ActiveCampaign, etc.).
   - Added `PLATFORM_STEPS` map: 3–4 step walkthroughs shown before credential fields per platform.
   - Added `CREDENTIAL_FIELDS` for: apollo, lemlist, mailchimp, klaviyo, activecampaign, brevo, convertkit, mailerlite, intercom, mixpanel, segment, hotjar, perplexity, jasper, loom, demio, shopify, webflow, zoom.
   - OAuth platforms (Meta/Google/LinkedIn/Twitter/TikTok) show "Connect with X" button; if env vars not set, shows "Awaiting platform setup" — NO manual fallback.

2. `AIChat.jsx` responsive layout:
   - `h-[calc(100dvh-14rem)] md:h-[calc(100dvh-2.5rem)]` — fills layout correctly on mobile and desktop without bottom empty space.
   - Mobile chat sidebar: overlay with backdrop instead of inline collapse.
   - Send button: text "Send" hidden on mobile.

3. WhatsApp AI Agent:
   - `backend/src/routes/whatsappWebhook.js`: GET (verify) + POST (handle messages). Identifies user by email in intro message, routes through `runAIChat`, replies via WhatsApp Cloud API.
   - Requires env vars: `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`.
   - `VITE_WHATSAPP_AGENT_NUMBER` → Cloudflare Pages env for frontend "Send message to Agent" button.

**Action items for Derek:**
- Register a WhatsApp Business account in Meta Business Manager.
- Set webhook URL = `https://bmapz-production.up.railway.app/api/whatsapp/webhook` with the verify token.
- Add `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` to Railway.
- Add `VITE_WHATSAPP_AGENT_NUMBER` to Cloudflare Pages environment.

### 2026-05-30 - Claude (Session 8: Logo, favicon, profile picture upload fix, deep-link integrations)

**Changes:**

1. **Bmapz AI logo + favicon**: Derek added `public/bmapz-logo.png` (170KB) and `public/favicon.ico` (4.3KB) directly. `index.html` updated with favicon.ico link, apple-touch-icon, and title "Bmapz AI". Committed and pushed both files.

2. **Sidebar logo + user avatar**:
   - `Sidebar.jsx`: Logo section now renders `<img src="/bmapz-logo.png">` with fallback text. Added `UserAvatar` component (profile picture or initials). Footer avatar + name links to `/Profile`.

3. **Profile picture upload fix** (`backend/src/routes/uploads.js` — new file):
   - Root cause: frontend was uploading directly to Supabase Storage. The `assets` bucket didn't exist, and RLS blocked user-level uploads.
   - Fix: `POST /api/uploads` route using `supabaseAdmin` (service role, bypasses RLS). Auto-creates the `assets` bucket on first use. Returns `{ url, path }`.
   - `frontend-src/api/integrations.js` `UploadFile()` updated: now POSTs multipart to `/api/uploads` with JWT instead of going directly to Supabase.

4. **Deep-link integration UX** (ConnectIntegrationModal.jsx):
   - `PLATFORM_KEY_URLS`: direct links to exact key-generation pages for Apollo, Lusha, Clay, HubSpot, Salesforce, and 20+ others.
   - `PLATFORM_STEPS`: 3–4 step walkthroughs per platform rendered above the credential input fields.
   - `isManualCreds` open to ALL users (removed the prior admin-only gate).

5. **`backend/src/routes/companies.js`**: `API_KEY_FIELDS` expanded with 20+ new field names for email marketing, analytics, eCommerce, etc.

**Verification:**
- Build passes: 3554 modules, 0 errors.
- Profile picture upload tested: saves to Supabase Storage via backend, returns CDN URL.

### 2026-05-30 - Claude (Session 9: Trial credit bypass + scan token gate)

**Context:** Trial users were hitting "Out of AI credits (0 remaining)" even though the 14-day trial is supposed to have unconditional AI access. Also, brand/full/lite scans were never supposed to be part of the trial.

**Root cause of "Out of AI credits" for trial users:**
- `getCompanyPlan()` auto-seeded 8000 trial credits. But some companies had a subscription row with `ai_credits_used > 0` and `ai_credits_total = 0` — the Case B backfill check (`all three = 0`) didn't fire.
- The credit gate then saw `remaining = 0 - used = negative` and blocked the request.

**Fix — two-part:**

1. **Trial unconditional pass** (`backend/src/routes/ai.js`):
   ```js
   const isOnTrial = planId === 'trial' || planStatus === 'trialing' || planStatus === 'inactive';
   if (willUsePlatformKey && !isOnTrial && remainingCredits < 1) { throw CREDITS_EXHAUSTED; }
   ```
   Trial users ALWAYS pass the credit gate. Usage is still logged for analytics.

2. **Scan token gate** (`backend/src/lib/aiCredits.js` + `backend/src/routes/ai.js`):
   ```js
   export const SCAN_ACTIONS = new Set(['brand_scan', 'full_scan', 'lite_scan']);
   export const PLAN_SCAN_TOKENS = { trial:0, starter:0, growth:1, scale:2, enterprise:5 };
   export function canRunScanAction(action, planId) {
     if (!SCAN_ACTIONS.has(action)) return true;
     return (PLAN_SCAN_TOKENS[planId] || 0) > 0;
   }
   ```
   Gate in `runAIChat` (fires AFTER credit check):
   ```js
   if (SCAN_ACTIONS.has(action) && !canRunScanAction(action, planId)) {
     // 402 error with user-facing message explaining upgrade path
   }
   ```
   Trial AND Starter users cannot run any scans. Growth = 1 scan/cycle, Scale = 2, Enterprise = 5.

3. **`BrandScan.jsx`** passes `action: 'brand_scan'` to `InvokeLLM()` so the gate fires.

4. **`integrations.js` `InvokeLLM()`** updated to forward `action` param to `/api/ai/chat`.

**Commits:** `e5b5d5e` (trial bypass), `a0f3c8b` (scan gate + BrandScan wiring).

**Active build:** `889c4572` — deployed 2026-05-30 03:47 AM GMT-3.

---

## Current Status (as of 2026-05-30)

### What's Working
- ✅ AI Chat with bidirectional fallback (OpenAI ↔ Anthropic)
- ✅ AI credit system: trial = unconditional access, paid = enforced credits
- ✅ Scan token gate: trial/starter blocked, growth/scale/enterprise tiered
- ✅ BYOK restricted to owner/system_admin only
- ✅ Model tier gating by plan (trial/starter = smart only)
- ✅ Credit deduction proportional to model cost multiplier
- ✅ Usage tracking in Settings → Usage tab and AdminPanel → AI Usage tab
- ✅ Profile picture upload via backend (bypasses Supabase Storage RLS)
- ✅ Logo + favicon deployed
- ✅ Integration modal: real connection test before marking Connected
- ✅ Integration modal: step-by-step walkthroughs + deep-links for 25+ platforms
- ✅ Audio transcription Node.js compatibility fix (`toFile` from openai SDK)
- ✅ WhatsApp Agent webhook code ready (pending env vars)

### Pending — Requires Derek Action (Outside Code)
| Item | What Derek must do |
|------|--------------------|
| Platform OAuth (Meta/Google/LinkedIn/Twitter/TikTok) | Register Bmapz as an OAuth app on each platform's developer portal. Add `META_APP_ID`, `META_APP_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, etc. to Railway. Redirect URI = `https://bmapz-production.up.railway.app/api/oauth/<provider>/callback` |
| Google consent screen | Create Google Cloud project → OAuth consent screen → set app name "Bmapz AI" + logo → create OAuth 2.0 client ID → add client ID/secret in Supabase Dashboard → Authentication → Providers → Google |
| WhatsApp Business | Create WhatsApp Business account in Meta Business Manager → configure webhook → add `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` to Railway → add `VITE_WHATSAPP_AGENT_NUMBER` to Cloudflare Pages |
| Stripe billing | Set `STRIPE_PRICE_ID_STARTER_MONTHLY`, `STRIPE_PRICE_ID_GROWTH_MONTHLY`, etc. in Railway for checkout to work |

### Pending — Code Work
| Item | Notes |
|------|-------|
| Monthly scan counter | Growth users can run unlimited scans today (PLAN_SCAN_TOKENS check is a static boolean, not a monthly counter). Need `scan_tokens_used_this_cycle` tracked on subscriptions table with monthly reset. |
| Model dropdown gating | Backend silently downgrades to cheapest model for trial/starter users. Frontend model selector should filter options by plan tier to avoid confusion. |
| Inbox sync | `POST /api/messaging/sync` now exists. Gmail and Instagram attempt real imports when permissions exist; WhatsApp depends on webhook delivery; LinkedIn DM sync requires approved LinkedIn Messaging API access. |
| Workflow execution | `POST /api/workflows/:id/run` creates a run record but doesn't execute nodes. Needs a task queue. |
| Phase 2 integrations | One-time platform OAuth app setup for social/ad platforms (admin-only UI not built yet). |
| pt-BR translation | Sessions 10–13 complete. ~50 components remain untranslated. Priority: ConnectIntegrationModal, AdsCopyForm, BrandScanSetup, LeadListManager, LeadListManagerFull. See Session 13 work log below. |

### 2026-05-30 - Claude (Sessions 10–13: pt-BR full-app translation)

**Task:** Translate all user-facing strings in every frontend component to support pt-BR localization via `LanguageContext.jsx` and `t()` / `isPt` pattern.

**Translation system:**
- `LanguageContext.jsx` at `frontend-src/components/ui/LanguageContext.jsx`
- `t('key')` = dictionary lookup; `isPt ? 'PT' : 'EN'` = inline for complex JSX interpolations
- `language === 'pt-BR'` (NOT `'pt'`) — check `isPt` shorthand from `useLanguage()`
- Arrays/objects with translated labels must be inside the component (or `useMemo`) since `t()` is a hook result

**Components translated (Sessions 10–13, ~45 files):**
- Pages: `Home.jsx`, `Sales.jsx`, `Settings.jsx`, `Profile.jsx`, `Pricing.jsx`, `AdminPanel.jsx`, `AIChat.jsx`, `Inbox.jsx`, `Workflows.jsx`, `BrandScan.jsx`, `Ads.jsx`, `SocialMedia.jsx`, `SEO.jsx`, `Dashboards.jsx`, `Blog.jsx`, `TextTemplates.jsx`, `LeadDetails.jsx`
- Components: `Sidebar.jsx`, `Layout.jsx`, `CompanyAdminPanel.jsx`, `DisqualifyDialog.jsx`, `KanbanFilters.jsx`, `GettingStarted.jsx`, `OnboardingWizard.jsx`, `LeadKanban.jsx`, `SendMessageModal.jsx`, `AdsStrategyForm.jsx`, `LeadListView.jsx`

**Key patterns applied:**
- `ALL_COLUMNS` moved inside component as `useMemo(() => [...], [t])` in LeadListView
- `DISQUALIFICATION_REASONS`, `sortOptions`, `OBJECTIVES` arrays moved inside components
- Sub-components in same file each get their own `const { t } = useLanguage()`
- Complex count interpolations use `isPt ? <PT JSX> : <EN JSX>` pattern
- Fixed duplicate `performance` and `connected` keys in LanguageContext

**Remaining untranslated (high priority):**
- `ConnectIntegrationModal.jsx` (large) — key integration UI
- `AdsCopyForm.jsx`, `AdsStrategyOutput.jsx`, `AdsCopyOutput.jsx`, `AdsCreativesTab.jsx`
- `LeadListManager.jsx`, `LeadListManagerFull.jsx`
- `BrandScanSetup.jsx`, `BrandScanReport.jsx`
- `MessageBubble.jsx`, `DashboardEditor.jsx`, `StatsCard.jsx`

**All builds passed** after each session (✓ 3554–3555 modules, no errors).

### 2026-05-30 - Claude (Session 14: File upload fix, ConnectIntegrationModal translation, SEO fix, page sweep)

**Commit:** `b7fc9a3`

**Bug fixes (Task 3 — page sweep):**

1. **File upload `file_url` bug** — `UploadFile()` in `integrations.js` returns `{ url, path }` but 6 components were accessing `r.file_url` (undefined). Fixed across:
   - `SocialMedia.jsx` — media attachments now upload correctly
   - `AIChat.jsx` — file attachments to AI chat now work
   - `AdsCreativesTab.jsx` — ad creative image uploads now work
   - `WorkflowAIPanel.jsx` — audio transcription + file attachment uploads now work
   - `FlowchartBuilder.jsx` — workflow file attachment uploads now work
   - `AddLeadForm.jsx` — CSV/file import for lead extraction now works
   - `Integrations.jsx` — lead import from file now works
   Pattern: changed `const { file_url } = await UploadFile(...)` → `const { url: file_url } = await UploadFile(...)` OR `r.url || r.file_url` in `.map()` calls.

2. **SEO analysis prompt** — Previous prompt was too vague: "Return a JSON with score, issues, and recommendations." AI would not know to return the structured format the page expected (`checklist_results` with 26 specific keys, `top_issues` with `plain_english`/`recommendation`, score breakdown, etc.). Replaced with a detailed 50-line prompt specifying the exact JSON schema. SEO results will now populate the full checklist and issue detail panels.

3. **LanguageContext duplicate key warnings** — Removed orphaned `openPlatform: 'Open Platform →'` entries from both `en` and `pt-BR` sections (old, unused). Build no longer shows duplicate-key warnings.

**Translation completed (Task 0):**

`ConnectIntegrationModal.jsx` — fully translated. All remaining hardcoded strings replaced:
- Step 2 OAuth intro text (parameterized `integration.name` with `isPt ? ... : ...`)
- Deep-link button: `Open {name} → generate your token` → `t('openPlatform') {name} → t('generateYourToken')`
- "Why a token instead of password?" explanation block (parameterized)
- Save & Test button: `t('savingAndTesting')` / `t('saveAndTestConnection')`
- Unsupported integration section (parameterized)
- Bottom back link → `← t('back')`
- Step 3 success: `t('integrationConnectedTitle')`, `t('integrationSuccessDesc')`, `t('integrationDone')`
- 7 toast messages: `t('popupBlockedMsg')`, `t('connectionNotCompletedMsg')`, `t('connectedAndVerifiedMsg')`, `t('savedButTestFailedMsg')`, `t('connectionTestFailedMsg')`, `t('failedToSaveMsg')`, `t('disconnectedMsg')`

Added 17 new keys to `LanguageContext.jsx` (both `en` + `pt-BR`):
`generateYourToken`, `whyTokenTitle`, `integrationSuccessDesc`, `unsupportedIntegrationSetup`, `unsupportedIntegrationPlatform`, `popupBlockedMsg`, `connectionNotCompletedMsg`, `connectedAndVerifiedMsg`, `savedButTestFailedMsg`, `connectionTestFailedMsg`, `failedToSaveMsg`, `disconnectedMsg`, + `openPlatform` (clean entry), `generateYourToken`, `whyTokenTitle`, `integrationSuccessDesc`

**Build:** ✅ 3555 modules, no errors, no duplicate-key warnings.

**Remaining translation work (still pending):**
- `AdsCopyForm.jsx`, `AdsStrategyOutput.jsx`, `AdsCopyOutput.jsx`
- `LeadListManager.jsx`, `LeadListManagerFull.jsx`
- `BrandScanSetup.jsx`, `BrandScanReport.jsx`
- `MessageBubble.jsx`, `DashboardEditor.jsx`, `StatsCard.jsx`

### 2026-07-10 - Codex (System diagnosis, Supabase hardening, truthful live-data UX)

**User request:** diagnose the full Bmapz AI project, fix current issues where safe, document remaining work, and prepare Claude pickup instructions.

**Files changed:**
- `backend/src/routes/ads.js`
- `frontend-src/components/ads/AdsRealDataPanel.jsx`
- `frontend-src/pages/Inbox.jsx`
- `frontend-src/pages/AIChat.jsx`
- `frontend-src/components/ui/LanguageContext.jsx`
- `eslint.config.js`
- `docs/SYSTEM_AUDIT_2026-07-10.md`
- `docs/CLAUDE_PICKUP_PROMPT_2026-07-10.md`
- `supabase/backups/2026-07-10_security_snapshot.md`
- `supabase/migrations/003_security_rls_hardening.sql`

**Supabase:**
- Project checked: `jmtnubzgnfjmtcwbegow` / `Bmapz AI`.
- Found RLS disabled on `accounts`, `admin_change_logs`, and `data_deletion_requests`.
- Found multiple RLS-enabled public tables with no policy.
- Created local security snapshot: `supabase/backups/2026-07-10_security_snapshot.md`.
- Applied remote migration: `20260710194731_security_rls_hardening_20260710`.
- Post-apply verification confirmed the three disabled tables now have RLS enabled and the missing-policy tables now return at least one policy.

**Runtime/product fixes:**
- Ads data loading no longer shows success unless real campaigns are returned.
- Ads backend now accepts frontend platform keys: `google_ads`, `meta_ads`, `linkedin_ads`.
- Inbox sync now calls `POST /api/messaging/sync`.
- Gmail sync imports recent inbox email if connected with Gmail read scope.
- Instagram sync attempts Meta page conversation/message import when Meta permissions allow it.
- WhatsApp is webhook-based; the sync result explains that no pull-history sync exists.
- LinkedIn DM sync is marked as restricted because the normal LinkedIn social/ads token cannot read direct messages.
- AI Chat bottom layout now has a clearer contained surface and footer/input area.
- Removed duplicate translation keys in `LanguageContext.jsx`.
- ESLint config now handles Node `.cjs` maintenance scripts.

**Live/deployment notes:**
- `https://ai.bmapz.com` responds HTTP 200 OK.
- Old documented Railway URL `https://bmapz-production.up.railway.app/health` returns 404 "Application not found"; find the current Railway backend URL and update Cloudflare `VITE_API_URL` plus docs.
- GitHub workflow `.github/workflows/deploy.yml` still rewrites `vite.config.js` and `frontend-src/App.jsx` during CI; remove this after confirming repo source builds directly in CI.

**Local backups checked:**
- `C:\Users\derek\OneDrive\Documents\BMapz\Backups\Bmapz.ai App`
- Found Base44/reference backups including `bmapz-ai-sales-marketing-automation 09.05.2026 (pre-calude).zip` and `bmapz-standalone-v1.tar.gz`.

**Verification:**
- `npm run build`: passed.
- `npm run build --prefix backend`: passed.
- `npx eslint . --quiet`: passed.
- Full `npm run lint` still has many old warnings, mostly unused imports/vars; no quiet-mode errors remain.

**Additional verification after Inbox sync change:**
- `node --check backend/src/routes/messaging.js`: passed.
- `node --check backend/src/routes/oauth.js`: passed.
- `node --check backend/src/routes/whatsappWebhook.js`: passed.
- `npm run build`: passed.
- `npm run build --prefix backend`: passed.
- `npx eslint . --quiet`: passed.

**Next Claude step:**
- Use `docs/CLAUDE_PICKUP_PROMPT_2026-07-10.md`.
- Highest priority: find current Railway backend URL, confirm Cloudflare `VITE_API_URL`, then run production smoke tests for login, AI Chat, integrations, Ads, Inbox, Social, Settings, and Workflows.

### 2026-07-10 - Claude (Session 15: Infra verification, CI cleanup, 4 new features)

**Commits:** `3bd40eb` (Codex work committed), `2b2b62e` (CI cleanup), `01518b4` (features).

#### Infra findings — IMPORTANT CORRECTIONS to the 2026-07-10 audit

1. **The Railway backend URL is NOT dead.** `https://bmapz-production.up.railway.app/health`
   returns `200 {"status":"ok"}`. Auth-protected routes return proper 401 JSON, and
   `/api/ai/diagnose` (added Session 5) exists — the deployed backend is CURRENT.
   The 404 in the audit was transient (Railway incident or redeploy window).
   No Railway or Cloudflare change is needed.
2. **Cloudflare `VITE_API_URL` is correct.** The deployed JS bundle at ai.bmapz.com has
   `https://bmapz-production.up.railway.app` baked in — matches the live backend.
   CORS preflight from `https://ai.bmapz.com` returns 204. End-to-end wiring is intact.
3. **Google OAuth branding** — verified via the Supabase authorize redirect: Google login
   uses a CUSTOM client (`25970699691-….apps.googleusercontent.com`), so branding is
   fixable in Google Cloud Console (project that owns that client):
   - OAuth consent screen → set App name "Bmapz AI", logo, support email; publish app.
   - To remove the `jmtnubzgnfjmtcwbegow.supabase.co` host from the consent line entirely,
     a Supabase **custom Auth domain** (e.g. `auth.bmapz.com`, paid feature) is required,
     then update the redirect URI in Google Cloud + Site URL in Supabase.
   This is dashboard work — no code change possible. (Derek action.)

#### CI cleanup (task 6 — done)

- `.github/workflows/deploy.yml` no longer rewrites `vite.config.js` / `App.jsx`, no longer
  strips null bytes (all files verified clean UTF-8), and uses repo `package.json` directly
  (`frontend-package.json` was byte-for-byte equivalent in deps/scripts).
- NOTE: the repo `App.jsx` is NEWER than the old CI heredoc (server-error screen, /Admin +
  /CompanyAdmin aliases, richColors toaster). The old workflow was silently reverting these
  every deploy. Next push to main deploys the repo version — watch the first CI run.
- `vite.config.js` gained the dev-server `/api` proxy block CI used to inject.

#### New features (all 4 delivered, build-verified)

1. **AI Automations (cron jobs)** — sidebar tab "AI Automations" (`/AIAutomations`):
   - Schedule any prompt/task: every X min (5-min floor), hourly, daily, weekly, monthly.
   - Backend scheduler (`lib/automationScheduler.js`, 60s tick, started in index.js) runs due
     automations through `runAIChat` — plan/credit/BYOK rules and Company Brain all apply.
   - Results land in AI Outputs (type `automation`, status pending) for review/approval.
   - Routes: `/api/automations` CRUD + `POST /:id/run` (run-now). Claim-before-run pattern
     prevents retry storms; per-tick cap of 10.
2. **Design Studio** — sidebar tab "Design" (`/Design`):
   - Single image or carousel; 10 aspect-ratio presets (1:1, 4:5, 9:16, 16:9, 1.91:1 link/ads,
     2:1 blog hero, 3:1 banner, Pinterest 2:3, X 16:9, leaderboard 728×90).
   - Backgrounds: color presets + picker, uploaded image, AI-generated (via /api/ai/generate-image,
     persisted to storage so URLs don't expire).
   - Text layers H1–H5/subtitle/body; 27-font library (Google Fonts loaded on demand); size,
     weight, color, align; drag positioning. Image + logo layers (auto "Company logo" button
     when `company.logo_url` exists) with width/opacity controls.
   - Per-company brand template presets → `design_templates` table (save/load/delete).
   - Export: full-resolution PNG via canvas (word-wrapped text, cover-fit backgrounds).
   - Send-to: Social (attaches to post media + opens editor), Ads (attaches as creatives),
     Blog (inserts markdown images) via `lib/designHandoff.js` localStorage handoff.
   - The raw "AI Image" button in Social's media section now routes to Design Studio.
3. **Company Omniscient AI Brain** (`backend/src/lib/companyBrain.js`):
   - Compiles company profile, briefing, ICP, tone, competitors, live CRM funnel stats,
     messaging volume by channel, workflows, recent social/ads/blog/SEO items, and
     previously APPROVED vs REJECTED AI outputs into a ≤6KB system block.
   - Injected into EVERY `runAIChat` call (opt-out: `skipBrain: true`). 5-min per-company
     cache; Anthropic prompt caching makes repeat input ~90% cheaper.
   - Net effect: chat, ads, social, blog, workflows, automations all generate with full
     company context — no more generic output.
4. **Auto-updating AI models** (`backend/src/lib/modelRegistry.js` + aiCredits changes):
   - Pulls live model catalogs from OpenAI (`/v1/models`) + Anthropic (`/v1/models`) with
     platform keys; 12h in-process cache; static fallback if both fail.
   - `aiCredits.js` now infers credit multiplier + tier for UNKNOWN models by family
     (opus 90×, fable 30×, sonnet 25×, haiku 6×, gpt-5 20×, o-series 40×, mini 1×, nano 0.5×),
     so new provider releases are priced and plan-gated automatically.
   - New endpoint `GET /api/ai/models` returns the catalog with per-plan `allowed` flags
     (ready for the Settings model dropdown to consume — see "Remaining").

#### DB migration required (Derek/Codex action)

- Apply `supabase/migrations/004_ai_automations_design.sql` to Supabase
  (tables `ai_automations`, `design_templates`, company-scoped RLS).
  Until applied, the two new tabs will show empty lists and saves will error.

#### Production smoke test — what was verified vs needs Derek

Verified (no login required):
- ai.bmapz.com loads; login page renders with zero console errors.
- Backend /health 200; protected routes 401 JSON; CORS from ai.bmapz.com OK.
- Deployed bundle API URL matches the live backend.

Needs Derek (authenticated — Claude cannot enter credentials):
1. Google login → lands on Home.
2. AI Chat → send a message → contextual reply (should now reference company specifics —
   the Brain in action).
3. Settings → API Keys save/test; Usage tab loads.
4. Integrations → Meta OAuth initiate (or "Awaiting platform setup" if env vars unset).
5. Ads → Load Real Data with nothing connected → must show error/warning, NOT success
   (Codex fix — verify).
6. Inbox → Sync → truthful per-channel statuses (Gmail import only after reconnecting
   Gmail with read scope).
7. Social/Blog/Design/AI Automations → create a design, send to Social; create an
   automation, Run Now, check AI Outputs.
8. Workflows → create from template, activate.

#### Full assessment for go-to-market (stage-2 readiness)

DONE this session: CI trust restored (builds = repo source), infra verified healthy,
4 product features (automations, design, brain, model auto-update), RLS hardening
committed, truthful-data fixes committed.

REMAINING before stage 2 (external integrations) — priority order:
1. Apply migration 004 (blocker for the 2 new tabs).
2. Watch first CI deploy after push (workflow simplified).
3. Google consent branding + custom auth domain (Derek, dashboards).
4. Authenticated smoke-test round (checklist above).
5. Registered OAuth apps: META_APP_ID/SECRET, GOOGLE_CLIENT_ID/SECRET (+ ADS developer
   token), LinkedIn/TikTok/Twitter — Railway env vars (blocks real social/ads data).
6. Settings model dropdown should consume GET /api/ai/models (currently hardcoded list;
   backend already tolerant of any model).
7. Workflow execution engine (runs are recorded, nodes not executed) — biggest remaining
   product gap.
8. Monthly scan-token counter reset + Stripe price IDs in Railway (billing).
9. Remaining pt-BR components (AdsCopy*, LeadListManager*, BrandScan*, MessageBubble,
   DashboardEditor, StatsCard) + full-lint warning cleanup (~1500 unused-var warnings).

**Verification (this session):**
- `npm run build`: ✓ 3557 modules.
- `npm run build --prefix backend`: ✓.
- `npx eslint . --quiet`: ✓ 0 errors.
- Backend module graph import test: ✓; schedule math spot-checked ✓.
- `git status --short`: clean except untracked local `.claude/` (intentionally not committed).

**Handover to Codex:** start with migration 004 apply + authenticated smoke checklist;
then item 6 (models dropdown) is a small, well-scoped task: fetch `/api/ai/models`,
filter `allowed`, render grouped by provider in ApiKeysTab.

### 2026-07-13 - Claude (Session 16: Google login fix verified, image gen, migration applied, UX round)

**Commits:** `80e2395` (Google direct sign-in), `3313336` (this round). Both deployed via CI.

#### Google login branding — RESOLVED (correct root cause)

Prior sessions repeatedly blamed the Google Cloud consent screen. That was wrong —
Derek had it configured correctly all along. The real cause: `signInWithOAuth`
routes the browser through `<project>.supabase.co`, and Google always displays the
redirect host. Fixed by switching to Google Identity Services + `signInWithIdToken`
(sign-in happens ON ai.bmapz.com; no Supabase redirect). Verified live by Derek:
Google now shows Bmapz branding. Fallback to old redirect flow if GIS script is
blocked. Files: `lib/googleAuth.js`, `components/auth/GoogleSignInButton.jsx`.

#### Fixed this session

1. **Image generation platform-wide** — root cause: `ai_image_model` in company
   settings could hold a CHAT model; `images.generate` then 404'd ("OpenAI model
   not available"). Route now whitelists real image models, tries
   gpt-image-1 → dall-e-3 → dall-e-2 (per-model size/quality mapping, b64+url
   handling), Stability as last resort, and stops the chain early on auth/quota
   errors. Affects Design AI backgrounds, Social AI image, Ads creatives.
2. **AI Automations save error** — migration 004 was never applied; applied to
   production Supabase via the dashboard SQL editor (through Derek's logged-in
   browser session): `ai_automations` + `design_templates` + RLS. Result:
   "Success. No rows returned". Both new tabs now function.
3. **Insights section restored** — `WorkflowAnalytics` (workflow analytics,
   channel stats, AI insights) was a registered route with NO nav link. Added
   "Insights" to sidebar (Content & AI) and mobile More-drawer. That's the
   answer to "what happened to the insights section".
4. **Design round-trip drafts** — Social/Blog/Ads save their in-progress draft
   when jumping to Design (`saveDesignReturn`); Design shows a green highlighted
   "Send back to your … draft" button; on send the draft is restored with the
   exported images attached to that exact post/creative set. Blog editor and
   Ads creatives tab gained "Design Studio" buttons.
5. **Undo (Ctrl+Z)** — Design Studio (50-step history, 500ms coalescing, keeps
   native undo inside text fields) and Dashboards edit mode (30-step widget
   history + visible ↩ Undo button).
6. **Responsive pass** — Design canvas fits container width via ResizeObserver
   (wide banners/stories no longer overflow); Design/Automations/Insights added
   to mobile bottom nav; AIOutputs filter row wraps; base Table already scrolls;
   Layout already had mobile header + bottom nav; fixed corrupted bullet chars
   in Dashboards subtitle.

#### Verification
- `npm run build` ✓ · backend `node --check` ✓ · `npx eslint . --quiet` 0 errors ✓
- Migration applied in production (verified success in SQL editor).
- CI deploy of `3313336` pending at time of writing; smoke test follows.

#### Remaining before stage 2 (updated priority)
1. Authenticated end-to-end verification of: image generation (needs OpenAI
   account with image API access/credits — if OpenAI quota is exhausted, images
   still fail with a clear message; consider funding OpenAI or adding
   STABILITY_API_KEY in Railway), automation scheduled run (wait for first
   cron fire), Design → Social/Ads/Blog round-trip.
2. Platform OAuth app registrations (META_APP_ID/SECRET, GOOGLE_CLIENT_ID/SECRET,
   etc. in Railway) — blocks real ads/social data (stage-2 core).
3. Settings model dropdown → consume `GET /api/ai/models` (small task, backend done).
4. Workflow execution engine (runs recorded, nodes not executed) — biggest gap.
5. Monthly scan-token reset; Stripe price IDs in Railway.
6. Remaining pt-BR components + lint warning cleanup.

**Handover to Codex:** items 3 (models dropdown) and 5 are small and well-scoped.
Item 4 (workflow engine) is the big one: suggest a tick-based executor in
backend (like automationScheduler) walking workflow nodes with delay handling.

#### Session 16 addendum — production smoke test results (authenticated, via Derek's browser)

- AI Automations: created "Relatório semanal de vendas" → saved ✓ → Run Now ✓ →
  result appeared in AI Outputs as pending ("⏰ … — manual run") ✓ → paused after
  test (left in place as an example; Derek can enable it).
- Image generation: Design → AI Background → "dark blue tech gradient…" →
  "Fundo gerado!" and the background rendered on canvas ✓ (backend fallback
  chain deployed on Railway and working).
- Insights (/WorkflowAnalytics): loads with stat cards + both tabs ✓.
- Dashboards: loads with widgets; corrupted bullet chars fixed ✓.
- Design page: undo button, responsive canvas, send-to panel all render ✓.
- Google login: verified by Derek — Bmapz branding shows, Supabase host gone ✓.

### 2026-07-13 - Claude (Session 17: workflow engine, Design fixes, Owner/BYOK revenue fix)

**Commit pushed** (design + engine + role fix bundled). CI green.

#### Workflow execution engine (the "scheduled steps don't run" fix)
- `backend/src/lib/workflowEngine.js`: 60s ticker advances every active
  `workflow_runs` row through its nodes. The core fix: `wait` nodes park the run
  via `next_action_at` and resume at the node AFTER the wait — previously waits
  and everything downstream never executed.
  - Sends: email via shared `lib/emailSender.js` (Gmail/SMTP/Resend), WhatsApp via
    Cloud API; LinkedIn/unconfigured channels are queued (status 'queued') for
    manual send. Every send is written to `messages` (shows in Inbox + analytics).
  - Conditions (`replied`/`no_response`/`opened`/`clicked`/`meeting_booked`)
    evaluated from the lead's messages/activities; unknowns take the 'no' branch.
  - Claim-before-run (pushes next_action_at forward) + MAX_STEPS_PER_TICK guard
    prevent hot-loops. Personalizes {{lead_name}}/{{first_name}}/{{company}}.
- `backend/src/routes/workflows.js`: `/:id/run` now enrolls+starts; new
  `/:id/enroll` (one or many `lead_ids`). `enrollLead()` skips duplicate active runs.
- `backend/src/routes/email.js` refactored onto `lib/emailSender.js` (no behaviour change).
- `backend/src/index.js`: `startWorkflowEngine()` on boot.
- Frontend `Workflows.jsx`: "Enroll leads" item in each workflow's menu → modal to
  pick leads (search + multi-select) → `POST /:id/enroll`. Guards: workflow must be active.

#### Design fixes
- `+ Text` button no longer breaks into two lines (shadcn `[&>span]:line-clamp-1`
  forced the icon+label span to display:-webkit-box → vertical stack; icon is now a
  direct trigger child, label in a plain span, trigger `justify-start`).
- Canvas scales to viewport height (resize listener) AND container width
  (ResizeObserver) — adjusts on laptop/monitor/phone instead of a fixed 420px.

#### SECURITY / BUSINESS MODEL — Owner/BYOK billing-bypass closed
- Root cause: signup / `/auth/me` JIT / `/complete-profile` assigned `role:'owner'`
  to EVERY new customer, and `canUseBYOK` = owner||system_admin → every customer
  could add their own API key and bypass Bmapz credit billing (the monetization).
- Fix (forward-looking, deployed): new customers = `company_admin` (top customer
  role, full workspace control, NO BYOK). `owner`/`system_admin` are Bmapz-internal,
  grantable only from the platform Admin Panel (`requireAdmin` admin routes).
  Company-scoped role update + invite endpoints clamp to company_admin/user.
- **Historical note (superseded by Session 18):** the one-time SQL downgrade was
  pending in Session 17. Codex later verified directly in Supabase that only
  `d2mdigitalmarketing@gmail.com` remains Owner; no further downgrade is needed.
  SQL to run in Supabase SQL editor:
  ```sql
  update public.users set role = 'company_admin'
  where role = 'owner' and lower(email) <> 'd2mdigitalmarketing@gmail.com'
  returning email, role;
  ```
- Business rule documented in Claude memory (bmapz-role-model).

**Verification:** `npm run build` ✓, backend `node --check` (auth, users, workflows,
email, engine) ✓, `npx eslint . --quiet` 0 errors ✓, engine module load + helper
spot-check ✓.

**Stage plan (Derek's framing):** Stage 2 = register app with external platforms +
build integrations. Stage 3 = go-to-market / commercialization.

### 2026-07-14 - Codex (Session 18: authorization, workflow safety, Stage 2)

**Active claims:** Codex owns `backend/src/routes/admin.js`,
`backend/src/lib/workflowEngine.js`, `backend/src/routes/ads.js`,
`frontend-src/components/settings/ApiKeysTab.jsx`, and the new audit/migration
documents until this handoff is released. Claude should review the diff before
editing those files.

**Verified against production Supabase:**

- Exactly one `owner` remains: `d2mdigitalmarketing@gmail.com`.
- Current other roles are `company_admin` and `user`; no accidental legacy customer Owner remains.
- RLS is enabled on all public tables and all audited tables have policies.
- Supabase migration `security_and_workflow_indexes_20260713` was applied, followed by the RPC privilege correction. `handle_new_user()` is no longer executable by `PUBLIC`, `anon`, or `authenticated`.
- The only remaining security advisor warning is the dashboard setting for leaked-password protection.
- No workflow runs existed during this audit; no real lead was enrolled or contacted.

**Implemented locally:**

- Admin user role updates now use a server-side role allowlist and hierarchy. The platform Owner can still grant Owner; company-scoped endpoints remain unable to grant internal roles.
- Workflow enrollment requires `status = active`; worker claims are atomic on the old `next_action_at`; send nodes use a `run_id + node_id` idempotency key.
- Google Ads now calls REST v24, accepts the company developer token, normalizes customer IDs, and refreshes expired Google access tokens.
- TikTok Ads campaign retrieval is now implemented against Marketing API v1.3 with truthful warnings when performance fields are not returned.
- Meta/Google Ads/LinkedIn Ads/TikTok Ads integration test buttons now perform live provider reads instead of checking only whether a token string exists.
- Settings AI model dropdowns use `GET /api/ai/models` and retain a static fallback.

**Stage 2 boundary:** app registration/approval and Railway secret entry must be
performed by the platform owner. Never put those values in Git, screenshots, or
handoff documents. See `docs/CODEX_AUDIT_2026-07-13.md` and
`docs/CLAUDE_PICKUP_PROMPT_2026-07-13.md`.

**Verification still required before release:**

- `npm run build`
- `npm run build --prefix backend`
- `npx eslint . --quiet`
- `git diff --check`
- sandbox-mailbox workflow test with no real recipient

### 2026-07-13 - Claude (Session 18: Design Studio v2 — full editing suite)

**Commit:** "Design Studio v2: full editing suite (10 new capabilities)". CI deployed.

#### What was added to /Design (all 10 requested features)

| # | Feature | How it works |
|---|---------|--------------|
| 1 | Remove background | Select an image → "Remove BG". New `POST /api/ai/edit-image` (backend/src/routes/ai.js) fetches the source, runs gpt-image-1 `images.edit` with `background:'transparent'`, returns a data URL the frontend persists to storage and swaps into the layer. |
| 2 | Enhance quality | Same endpoint, `operation:'enhance'` (quality/sharpness prompt, content preserved). |
| 3 | Drag-resize | Blue corner handle on every selected layer (`startDrag(..., 'resize')`). Text scales wFrac + font size together; images/shapes scale `w`. |
| 4 | Drag-crop | "Crop" button on images → 4 edge handles trim the crop window `{x,y,w,h}` (fractions of source). Preview = CSS window (`aspectRatio` wrapper + translated inner img); export = `drawImage` source-rect. "Reset" restores full image. Note: crop math assumes unrotated axes — cropping a rotated image works but feels axis-shifted (known minor). |
| 5 | Border radius | Slider (0–50%) on images, `rect` shape and frames. Export clips via `roundedPath` (roundRect with arcTo fallback). |
| 6 | Shapes/icons/frames | `SHAPES` (unit-square polygons: rect/circle/triangle/diamond/hexagon/star/arrow/line + frame/frame-dashed/frame-double) render as SVG polygons (or CSS) in preview and canvas paths in export. `ICONS` = 28 emoji inserted as big text layers (emoji render identically in canvas `fillText`). |
| 7 | Rotate & flip | `rotation` slider (−180…180, dbl-click resets) + Flip H/V toggles on every layer. Export wraps drawing in `withTransforms` (translate to box center → rotate → scale ±1 → alpha). |
| 8 | AI generate/edit | "+ AI Image" toolbar button generates an image as a LAYER (aiMode 'layer'); "AI Background" kept (aiMode 'bg'). Free-form AI edit input on selected images (`operation:'custom'`). All AI outputs persisted via `persistDataUrl` → UploadFile. |
| 9 | Brand toggle | Header switch → `design.brandMode` (saved in templates). ON: bg presets + shape palettes = `company.briefing.brand_colors` (fallback Bmapz palette), new text uses `brand_font` (default Montserrat, H1 tinted primary), new carousel slides auto-add company logo, AI prompts append the palette. |
| 10 | Opacity | Slider on EVERY layer type (was image-only). |

Also: Delete/Backspace removes the selected layer (skipped inside inputs);
`updateLayerSilent` keeps measured `natAsp` out of undo history; double-frame
preview = nested bordered divs (matches export's two stroked rects).

#### Files touched
- `frontend-src/pages/Design.jsx` — substantially rewritten (~1200 lines).
  Layer model now: common `{x,y,rotation,flipH,flipV,opacity,radius}` +
  image `{url,w,natAsp,crop}` + text `{text,font,size,weight,color,align,wFrac}`
  + shape `{shape,fill,w,hRel,strokeW}`.
- `backend/src/routes/ai.js` — new `POST /api/ai/edit-image` (remove_bg |
  enhance | custom). 20MB cap, data-URL and http sources, one retry without
  optional params for accounts that reject them.
- `backend/src/lib/workflowEngine.js` — kept Codex's idempotency check
  (messages.metadata contains {run_id,node_id} prevents duplicate sends).

#### Verification
- `npm run build` ✓ · `node --check` backend ✓ · `npx eslint . --quiet` 0 errors ✓.
- Static review of all 10 features against code done; live smoke of /Design
  pending post-deploy (page loads + toolbar/panel render confirmed in prior
  sessions' pattern).

#### Known minors / next pickup (Claude)
1. Crop on a ROTATED image: handles follow the rotation, drag axes don't.
   Fix later: temporarily zero rotation during crop mode, restore after.
2. `images.edit` requires the platform OpenAI key to have gpt-image-1 access;
   if the org lacks it, Remove BG/Enhance/AI-edit fail with the categorized
   error toast. Consider a fallback (e.g. self-hosted rembg) later.
3. Emoji icons export via canvas depend on OS emoji font (fine on Win/Mac).
4. Z-order controls (bring forward/back) not yet built — layers render in
   creation order; workaround is delete/re-add. Good candidate next session.
5. Text layers ignore radius (no background box concept yet); a text
   background-pill option would pair well with radius.

#### Still open from previous sessions
- Derek runs the legacy-owner downgrade SQL manually (Session 17 note).
- Stage 2: external platform OAuth registrations + live integrations.
- Settings model dropdown → GET /api/ai/models (small, backend ready).

#### Addendum: Redo everywhere (same session)

Redo (Ctrl+Y and Ctrl+Shift+Z) added wherever undo makes sense:
- **Design Studio** — undo now feeds a redo stack; any NEW edit clears the redo
  branch (standard branch-invalidate semantics); ↪ Redo button in header.
- **Dashboards edit mode** — redo over the widget history; ↪ button beside Undo;
  shortcuts only fire while editing and outside inputs.
- **Workflow builder (FlowchartBuilder)** — had NO history at all. Added full
  undo/redo over `{nodes, connections}` via an observer `useEffect` that
  snapshots every graph change and collapses rapid changes (node drags) within
  500ms into ONE step (`restoringRef` guard prevents undo/redo from re-snapshotting
  themselves). Ctrl+Z/Ctrl+Y/Ctrl+Shift+Z + ↩/↪ toolbar buttons next to
  Auto-Layout. Time-travel marks hasUnsavedChanges so auto-save persists it.

Both commits pushed; CI deploy of the second commit pending at write time.

### 2026-07-24 - Claude (Session 19: Inbound/SDR/Notifications system + Design Studio v3)

Two large feature areas. All pushed; frontend builds, eslint --quiet 0 errors,
backend node --check + module-load all pass. **One blocker: migration 007 not yet
applied (Supabase dashboard session expired mid-apply) — the new tabs error until it runs.**

#### PART 2 — Inbound lead / SDR / Notifications (revenue engine)

DB: `supabase/migrations/007_notifications_sdr_triggers.sql` — tables
`notifications`, `sdr_agents`, `sdr_conversations` (company-scoped RLS);
`workflows.trigger_type`/`trigger_config`; `leads.disqualification_reason/notes`.
**MUST BE APPLIED** (renamed 005→007 to avoid collision with Codex's 005/006).

Notifications (backend `lib/notify.js` + `routes/notifications.js`; frontend
`components/layout/NotificationBell.jsx`, `pages/Notifications.jsx`, Home widget):
bell w/ unread badge in desktop sidebar + mobile header; full page; Home card.

SDR — client-facing AI Sales Development Rep (`backend/lib/sdrEngine.js`,
`routes/sdr.js`; `frontend/pages/SDR.jsx`, nav "SDR" w/ Headset icon):
- Client-SAFE prompt (uses company facts, NOT the internal Company Brain that
  leaks funnel numbers; hides prices unless show_prices). Structured turns:
  reply + outcome(none|offer_product|handover|qualified|not_qualified|support)
  + qualification answers + internal note + funnel-stage rec.
- handleInboundForSdr = full loop (find/create convo → reply → send on channel →
  persist → apply outcome side-effects: notifications + CRM stage moves).
- Chats tab: transcript + INTERNAL-ONLY panel (qualification answers, SDR
  reasoning/conditions). Settings tab: identity/greeting/goal/persona/guardrails,
  show-prices, products (how-to-pitch + offer-when), qualifying questions,
  conversation flow, hand-over channels(checkboxes)+recipients, active channels,
  live tester. 'Fill with AI' = Company-Brain autofill with a token-cost
  confirmation popup (`autofillSdrConfig`).

Workflow builder (LIVE path = WorkflowCanvas/BuilderModal/NodePanel — NOT the
legacy FlowchartBuilder). New node types wired end-to-end (palette + defaults +
settings panel + engine executor):
- SDR (hands the lead's conversation to the bot; channel + custom opener)
- Hand-over to Sales (notify via notification/email/sms/whatsapp checkboxes +
  recipients + team message + move-to-SQL toggle)
- Lead Qualification (move next/previous stage or set any of the 9 funnel stages)
- Start node Entry-Point selector (manual | new_lead | inbound_message |
  new_conversation) → persisted to workflows.trigger_type.
Engine (`backend/lib/workflowEngine.js`): executors for the 3 new types;
`enrollByTrigger` (auto-enroll into active workflows by trigger_type);
`handleInboundEvent` (resolve/create lead → fire triggers → SDR answers → notify)
wired into `messaging.js insertMessageIfNew` for real inbound (Gmail/Instagram).
**ENGINE BUG FIX**: builder saves nodes/connections as JSON STRINGS in JSONB[];
engine expected objects, so ALL builder-made workflows silently no-op'd.
nodesOf/connsOf now normalize both.

#### PART 1 — Design Studio v3 (Canva-like)

`frontend/pages/Design.jsx` (large), `lib/designHandoff.js`, `backend/routes/ai.js`:
- Background is a real object: selectable (click canvas), draggable (object-position),
  opacity, flip H/V; 'Detach as layer' + 'Set as slide background'. Export honors all.
- Crop: preset ratios (1:1/4:5/3:4/16:9/9:16) + Free hand-drag.
- Shapes/frames FILL WITH IMAGE (clipped inside borders); +circle frame.
- Libraries: shapes 11→22, icons 28→64.
- Layer reorder: drag rows in the Layers panel (+ ▲▼); array order = z-order.
- Design-brief hand-off: Social 'Create image from brief' + Ads single & A/B
  'Open in Design Studio' → normalizeBrief through saveDesignReturn → Design shows
  brief card + prefills AI prompt (briefToPrompt).
- Higher-quality / less-altering AI: /api/ai/edit-image quality:'high' +
  input_fidelity:'high' + progressive fallback; remove_bg/enhance prompts demand
  pixel-preservation; AI generate quality:'hd'.

Canva integration (Design, Ads, Social, Blog):
- `backend/routes/oauth.js` Canva Connect OAuth2+PKCE(S256) + refreshCanvaToken;
  `backend/routes/canva.js` status/designs/export(→PNG import)/import(→Canva).
- `frontend/components/integrations/CanvaPicker.jsx` (connect + grid + export)
  wired into all 4 sections; Design also has 'Edit in Canva' (export→upload→open).
- Registered in ConnectIntegrationModal (INTERNALIZED_OAUTH_MAP/STATUS_KEY_MAP +
  canva oauthPath). **Needs CANVA_CLIENT_ID/SECRET in Railway + a Canva dev app**
  with redirect URI <API_URL>/api/oauth/canva/callback (same code-ready/env-pending
  model as Meta/Google). UI shows a clear not-configured/connect state until then.

#### Pending / Derek actions
1. **Apply migration 007** (Supabase SQL editor) — blocker for Notifications/SDR/
   trigger tabs. Session expired during this session's attempt.
2. Canva: register a Canva developer app + set CANVA_CLIENT_ID/SECRET (Railway) to
   activate the Canva buttons (they show "not configured" until then).
3. Image AI features (Design remove-bg/enhance/generate, SDR autofill) need the
   platform OpenAI key funded / with gpt-image-1 access.
4. Legacy-owner downgrade SQL (Session 17) still Derek's to run manually.
5. Full inbound auto-trigger only fires from Gmail/Instagram sync today; the
   WhatsApp webhook is the INTERNAL agent (left as-is). A dedicated client-facing
   WhatsApp number would extend SDR inbound — future.

#### Known follow-ups (next Claude)
- SDR: no public unauthenticated web-widget endpoint yet (test/inbound are auth'd);
  a public embed would need a service path + rate limiting.
- Canva import() uses a 'presentation' preset design_type; may want per-section
  sizing. Export polling capped at ~30s.
- The legacy FlowchartBuilder.jsx still carries the old redo work but is dead
  code (Workflows renders WorkflowBuilderModal). Consider deleting it.

### 2026-07-24 - Claude (Session 20: 12-item audit & fix)

Migration 007 (updated with user_id + allowed_outcomes + human_takeover) APPLIED
to production Supabase ("Success. No rows returned"). All 12 items done + pushed.

1. **Notification dropdown clipping** â€” NotificationBell now fixed-positioned via
   the button's bounding rect + viewport-clamped, so it never gets cut by the
   sidebar. z-[60/61].
2. **qualify condition vs action** â€” Answered + aligned. The `qualified`/
   `disqualified` CONDITION now reads the lead's real CRM state (funnel_stage â‰¥ MQL
   or status='qualified'; disqualified/lost) in evalCondition â€” the SAME fields the
   Lead-Qualification ACTION, the Sales board, and the SDR write. Condition =
   read/branch; qualify action = write/move. Not redundant; fully connected.
3. **Lead Qualification template** â€” Added to WorkflowBuilderModal TEMPLATES:
   new-lead trigger â†’ SDR â†’ wait â†’ Qualified? â†’ (yes) set SQL + hand-over /
   (no) nurture.
4. **SDR name save / per-user** â€” sdr_agents got user_id; getSdrAgent(companyId,
   userId) is per-user (name defaults to company.personal_agent_name); inbound uses
   getCompanySdrAgent (any enabled). Root 'table not found' was the un-applied
   migration â†’ now applied, saving works.
5. **Free-drag crop** â€” Rewritten: full image shown fixed + a movable crop-rectangle
   overlay with 8 handles; dragging an edge moves ONLY that edge (image never
   shifts); drag inside to pan the window. Double-click image also crops.
6. **Frame image position + drag-to-fill** â€” Double-click a filled frame â†’ adjust
   mode, drag the image inside to reposition (fillPosX/Y, object-position, honored
   in preview + export). Drag an image layer onto a frame â†’ becomes the fill ONLY
   when dropped inside; green ring + live in-frame preview while hovering.
7. **Removed enhance + remove-bg** â€” Backend /api/ai/edit-image now only free-form
   'custom' edits; both UI buttons + Scissors/Star imports deleted.
8. **More frames** â€” Added frame-rounded/dotted/circle-dashed; ALL shapes (circle,
   hexagon, star, heart, diamond, pentagon, octagon, rect) are now image frames.
9. **SDR â†” Inbox** â€” SDR logs BOTH sides of every conversation to `messages`
   (logToInbox) so the Inbox shows the full thread + history. Fixed the Inbox reply
   path (email/send now handles {message_id, reply_content} â€” was broken) for email
   + whatsapp. Human reply from Inbox â†’ sdr_conversations.human_takeover=true â†’ SDR
   stops auto-replying.
10. **Acceptable-outcomes guardrail** â€” sdr_agents.allowed_outcomes; the SDR prompt
    lists ONLY allowed outcomes and sdrRespond hard-clamps any disallowed outcome to
    'none'. (Settings UI checkboxes still TODO â€” see below.)
11. **Where do saved posts/ads/images go?** â€” Audited, nothing lost:
    - Social posts (draft/scheduled/published): SocialMedia â†’ **Posts** tab (Drafts
      count) + Content tab + Calendar.
    - Ads (strategies/copies/creatives): Ads â†’ **Saved (N)** button â†’ AdsSavedRecords.
    - Design: **Save as Template** (Brand Templates) persists the whole design;
      images can also be Downloaded or Sent to Social/Ads/Blog. AI Outputs section
      holds AI-generated content from chat/automations.
    - Gap (minor): a Design that's neither saved-as-template nor sent/downloaded is
      not auto-persisted (intermediate canvas state). Acceptable; templates cover it.
12. **Migration applied** âœ“.

**Commits:** `2fd6ecf` (pt1: #1,#4,#7,#9,#10), `7063219` (pt3: #5,#6,#8),
`3535fd2` (#2,#3). All pushed + CI.

#### Follow-ups (next Claude)
- SDR Settings UI: add checkboxes for `allowed_outcomes` (backend + guardrail done;
  the field just needs a UI control in SDR.jsx Settings). Currently defaults to all.
- SDR name field: verify it persists per-user end-to-end in the live app (migration
  now applied).
- Inbox: could add an explicit "SDR is handling / Take over" badge per thread using
  sdr_conversations.human_takeover (backend flag exists).
- Design known-minor: rotated-image crop axes still shift (documented Session 18).
- Codex left docs/CODEX_AUDIT_2026-07-13.md + CLAUDE_PICKUP_PROMPT_2026-07-13.md â€”
  review next session.

### 2026-07-24 - Claude (Session 21: template unification, frame detach, SDR outcomes)

Three requests, all built + verified (`npm run build`, `node --check`, `eslint`
all clean). No auth/billing/OAuth changes. ONE schema change (migration 008).

1. **Workflow templates unified into one real library.** There used to be two
   disconnected surfaces: the Workflows-page "Templates" tab showed pretty cards
   that created BLANK workflows (`steps:[]`), while the builder modal's popover
   had the only templates that actually built node graphs. Fixed by extracting a
   single source of truth: `frontend-src/components/workflows/workflowTemplates.js`
   (`WORKFLOW_TEMPLATES` + `WORKFLOW_TEMPLATE_LIST`, 9 complete templates with
   category/description). Both surfaces now read it. The gallery's "Use Template"
   opens the builder pre-loaded via a new `initialTemplate` prop on
   `WorkflowBuilderModal` (seeds nodes/connections/name/type, starts `unsaved`
   so it auto-persists a real draft). Removed the dead `getStarterTemplates`/
   `STARTER_WORKFLOW_TEMPLATES` blank-creators from `Workflows.jsx`.

2. **Frame-filled images are now detachable.** `Design.jsx` gained
   `detachImageFromFrame(l)` (mirrors `detachBackground`): pops the frame's fill
   back out as an independent image layer (at the frame's x/y/w, appended → top of
   z-order) and clears `imageUrl/fillPosX/fillPosY` off the shape. New "Detach"
   button (Scissors icon, re-added to imports) sits next to "Clear" in the shape
   fill panel, with helper text.

3. **SDR "Acceptable outcomes" + custom outcomes.** The SDR can now ONLY choose
   from outcomes the user enables/defines (prompt + hard clamp both enforce it).
   - **Schema (MIGRATION 008 — Derek must run `008_sdr_custom_outcomes.sql` in the
     Supabase SQL editor):** adds `sdr_agents.custom_outcomes JSONB DEFAULT '[]'`.
   - Backend `sdrEngine.js`: `PREDEFINED_OUTCOMES` metadata; `customOutcomesOf`
     (slug + dedup, never collides with built-ins), `allOutcomeKeys`,
     `nextFunnelStage`; `allowedOutcomesOf` now treats `[]` = none vs unset = all;
     `buildSdrSystemPrompt` lists built-in + custom outcomes with their effects and
     a strict "only these keys" rule; `sdrRespond` clamps to `allOutcomeKeys`;
     `applySdrOutcome` executes custom-outcome effects (mark_qualified / set_stage
     [a stage or 'next'] / handover / redirect_url) + notifies.
   - Backend `routes/sdr.js`: `custom_outcomes` added to patchable fields;
     **`updateAgentRow` helper retries the PATCH without `custom_outcomes` if the
     column is missing**, so SDR saves DO NOT break in the window before migration
     008 is applied.
   - Frontend `SDR.jsx`: "Acceptable outcomes" Settings section — built-in
     checkboxes (`form.allowed_outcomes`) + a custom-outcome editor
     (`form.custom_outcomes`: label, when-to-use description, effect toggles, stage
     select, link). `normalize`/`cleanForm` round-trip both.

**Verification note:** ran a self-authored adversarial-review workflow, but its
agents errored on the account monthly spend limit before producing findings —
verification was done manually + by static checks (build/lint/node-check, template
graph node-ref audit, layer z-order, outcome-key stability).

#### Follow-ups (next agent)
- **Derek action:** run `supabase/migrations/008_sdr_custom_outcomes.sql` in
  Supabase (SQL editor). Until then, custom outcomes silently no-op on save (the
  PATCH strips the column gracefully); built-in allowed_outcomes still work.
- Optional: reflect custom-outcome handover/qualified effects in the
  `sdr_conversations.status` mapping inside `handleInboundForSdr` (currently only
  built-in outcomes update status; custom effects still fire + notify).
- Optional i18n: the 9 built-in workflow templates have English names/descriptions
  (the old starter cards used translation keys `wfT*Name/Desc`, now unused).

### 2026-07-24 - Codex (Session 22: post-Claude audit, repairs, live verification)

**Scope audited:** every file changed from Claude Sessions 19-21, with deeper
runtime review of Design, SDR, AI Chat, Workflows, Inbox, Notifications, Canva,
Ads/Social integrations, Company Brain, OAuth, and Supabase migrations.

**Production findings reproduced before local fixes:**

- AI Chat returned `TEST_OK` from the live provider, proving the platform AI key
  works. After reload the conversation disappeared from the sidebar because the
  frontend expected an array while `/api/ai/outputs` returns `{ data, total }`.
  The test row was deleted after verification.
- Workflows showed `Templates (13)` and `Drafts (0)` although Supabase contained
  9 static templates and 4 real drafts. The backend ignored `is_template`.
- All audited routes loaded without browser console errors. Frontend and Railway
  health both returned HTTP 200.
- Desktop Design/Chat/Inbox rendered without horizontal overflow. Mobile
  Workflows overflowed by about 31px because the four tabs could not fit.

**Local repairs (not committed or deployed yet):**

- AI Chat: fixed output-list parsing and persistent conversation updates;
  persisted rename/pin/delete; wired image/text attachments into AI messages;
  added attachment rendering; converted OpenAI image message parts for Anthropic.
- Workflows: server-side field allowlists/company ownership, real template
  filtering, native JSON graph saves, safe legacy parsing, condition branch fix,
  run-wide loop cap, condition events limited to the current run, visible failure
  when automatic sends or SDR opening messages fail, and mobile tab overflow fix.
- SDR/Inbox: removed duplicate inbound logs, normalized sender handles, respected
  human takeover, mapped custom outcomes to conversation status, added truthful
  WhatsApp/Instagram delivery failures, real Instagram replies, Gmail sender
  grouping, and per-channel sync result messages. LinkedIn DM sync remains
  restricted until LinkedIn grants Messaging API access; WhatsApp receives new
  messages by webhook rather than history-pull.
- Notifications: user-specific rows are now filtered by the authenticated user
  in both API and RLS policy; company-wide rows remain shared.
- Integrations/OAuth: signed and time-limited OAuth state for all providers;
  Meta endpoints use configurable Graph v24; LinkedIn Ads uses the current
  versioned `/rest/adAccounts/.../adCampaigns` API and Ads scopes; Google Ads
  test refreshes expired OAuth tokens; integration status is derived from actual
  required credentials instead of stale flags.
- Canva: blocked arbitrary/internal URL fetches, limited imports to approved
  HTTPS storage and 15 MB, fixed the asset metadata header, and made create-design
  request explicit per current Canva Connect documentation.
- Ads/Social/Messaging: request field allowlists prevent records being moved to a
  client-supplied company; Meta calls were moved off retired v18/v19 endpoints.
- Company Brain cache is invalidated immediately after company settings changes.
- Legacy `/companies/deduct-credits` now requires a company admin and accepts only
  a positive bounded integer.

**Supabase applied and verified:**

- Registered idempotent migrations `notifications_sdr_triggers` and
  `sdr_custom_outcomes`; Session 21's manual SQL is now represented in migration
  history.
- Applied `sdr_notification_security`; local source is
  `supabase/migrations/009_sdr_notification_security.sql`.
- Added the missing SDR lead index and notification-user index; tightened RLS for
  user-specific notifications and SDR configurations.
- Safety state after audit: 0 active workflows, 0 active runs, 0 enabled SDR
  agents, 0 workflow messages in the last day. Exactly one Owner remains:
  `d2mdigitalmarketing@gmail.com`.
- Security advisor now reports only the dashboard setting "Leaked Password
  Protection Disabled". Old RLS init-plan performance warnings remain; unused
  index notices are expected on this low-volume database and should not be
  removed yet.

**Verification passed:** frontend production build (3,565 modules), backend
build, ESLint quiet, all 41 backend files `node --check`, `git diff --check`,
9 workflow template graph validation, SDR outcome guardrails, desktop/mobile
production smoke tests. Known performance follow-up: main JS bundle is about
3.2 MB (895 KB gzip) and needs route-level code splitting before go-to-market.

**Stage 2 decision:** not go-to-market ready yet. The repaired code must be
reviewed, committed, pushed, and deployed. Then each external provider app must
be registered/approved and tested with sandbox/test accounts. Do not activate a
workflow or SDR against real leads until provider-specific end-to-end tests pass.

### 2026-07-24 - Claude (Session 23: Codex handoff commit + 6 feature/bug items)

Branch `claude/release-2026-07-24` → merged to `main`.

**Session 22 Codex work committed (`4925937`).** Audited line-by-line before
committing: it builds on Session 21 rather than reverting it (template library,
`initialTemplate` pre-load and SDR custom-outcome guardrails all intact, and
custom outcomes now additionally map to conversation status). `.claude/` and the
two old Codex audit docs were deliberately left untracked. Note
`OAUTH_STATE_SECRET` is new but falls back to `SUPABASE_SERVICE_ROLE_KEY`, so
existing deployments keep working without a Railway change.

**1. Social posts silently failed to save + images vanished (`9b0994d`).**
Root cause: `social_posts.scheduled_for` is TIMESTAMPTZ but the editor sent `''`
for an unscheduled post. Postgres rejects `''` for a timestamp, so the insert
failed — and neither mutation had an `onError`, so the failure was invisible.
Fixed on both sides (frontend sends null; the social route coerces
`''`/undefined → NULL for `scheduled_for`/`published_at`), added error toasts and
a saving spinner. Separately, the media strip only rendered `uploadedMedia` and
was never seeded from a saved post's `media_urls`, so opening a post showed no
images and saving wrote the empty list back over them; the update path also
ignored `uploadedMedia` entirely. Added `openExistingPost()` (used by all seven
edit call sites) and a single `handleSavePost()`. `content_type` is normalized
against its CHECK constraint so an AI free-text type cannot reject a save.

**2. Brand templates no longer collapse carousels (`99db5c7`).** `loadTemplate`
defaulted `format` to `'single'` when the saved config lacked it, collapsing
multi-slide templates and desyncing the format toggle from the loaded slides.
Format is now derived from the template's real slide count, and the aspect ratio
only changes when the template specifies one. Switching to Single now confirms
before discarding slides.

**3. Custom aspect ratios (`99db5c7`).** A "Custom" canvas size with width/height
inputs (clamped 100–4096px) + quick presets, resolved through `resolveRatio()` so
preview and export both honour it.

**4. AI carousels (`99db5c7`).** The AI dialog can generate a whole carousel: a
planner splits the concept into N cohesive slide prompts (with a templated
fallback), generates one image per slide in a shared style, and appends them with
live progress. Pre-checks itself when the Carousel format is already selected.

**5. Lead ownership + history (`6462384`) — NEEDS MIGRATION 010.** Each lead now
has exactly one owner (`leads.owner_id`), visible company-wide, and every step is
recorded in the new `lead_activities` timeline. Its RLS is intentionally
company-wide readable (cross-company still blocked). `PATCH /api/leads/:id/owner`
rejects users outside the company. The SDR and the workflow engine write history
too, so automated handling appears alongside manual work. UI: owner select +
timeline + note box on the lead page, owner badge on every Kanban card.

**6. Global read-only support assistant (`8a4f02a`).** A help bubble on every
screen (mounted in `Layout.jsx`, z-[100]) toggling into a chat panel. A THIRD
agent, separate from the Company Brain chat and the SDR: strictly read-only, and
its prompt tells it to give click-by-click steps instead of acting. Before
answering it reads a privacy-safe diagnostic snapshot (counts, connected
integrations, whether the brain is filled, whether the SDR is enabled) so it can
name the real blocker; the snapshot contains no message bodies or contacts. It
links only to real app screens and those links become in-app navigation. Uses
`skipBrain`, so the internal Company Brain is never exposed via support.
Backend: `POST /api/help/assistant`, `GET /api/help/diagnostics`.

**Verification:** frontend build (3,567 modules), backend build, `eslint .
--quiet` clean, all 43 backend files `node --check`, `git diff --check` clean.
Migration 008 (`custom_outcomes`) was confirmed present in production by querying
`information_schema` directly.

#### Derek actions required
- **Run `supabase/migrations/010_lead_ownership_history.sql`** in the Supabase SQL
  editor. Until then lead ownership/history will error (the column and table do
  not exist yet); nothing else is affected.

#### Follow-ups
- Route-level code splitting for the ~3.2 MB bundle is still open (Codex's note).
- The support assistant is read-only by design — if it should ever perform
  actions, that belongs to the Company Brain agent, not this one.

### 2026-07-30 - Claude (Session 24: Ads audit + code splitting)

**Ads audited against every Social Media failure mode (`de1392d`).** Same class
of bug, one part worse: the UI saves `strategy_data`/`copies_data`/`form_data`
but the columns are `strategy`/`copy_data` and there was no `form_data` column,
and none of those names were in the backend allowlist — so strategy, copy and
campaign content was silently discarded and saved records reopened empty.
Campaigns live entirely in `form_data`, so every campaign setting was lost and
pause/resume never persisted. Fixed with alias mapping + migration 012, echoing
the UI's field names back on read. Also hardened `published_at` (TIMESTAMPTZ)
and `budget` (NUMERIC) against `''`, and clamped `status` to its CHECK values.

**Systemic:** a survey showed most pages define only `onSuccess` (AdminPanel 9,
Blog 4, Dashboards 4, Notifications 4 — zero error handling), so silent write
failures were app-wide. Added a MutationCache handler on the shared QueryClient
that reports any mutation error not handled locally.

**Route-level code splitting (`44912ef`).** Pages are now `React.lazy()` behind a
Suspense boundary. Note: giving recharts/jspdf/html2canvas their own
`manualChunks` entries made things WORSE — it pulled them into the entry graph
and modulepreloaded them on first paint; only react/router/query are manually
chunked now. **Measured in production: 3,170 kB -> 619 kB initial JS.**

**Pre-existing crash found while smoke-testing:** `LanguageProvider` was mounted
inside `Layout` (authenticated pages only), but `/Pricing` is public and calls
`useLanguage`, so the pricing page rendered BLANK for every logged-out visitor.
Provider hoisted to `App.jsx`; verified rendering on production.

#### Derek actions required (Supabase SQL editor)
Run migrations 010, 011 and 012 — all additive and safe to re-run.
