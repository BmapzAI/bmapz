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
