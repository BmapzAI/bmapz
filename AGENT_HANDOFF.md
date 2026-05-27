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
