# Bmapz Runtime Audit - 2026-05-27

## Current Verified Status

- Current branch: `main`
- Latest commit inspected: `57ee39c`
- Git status: only `.claude/` is untracked.
- Frontend build command that works now: `npm run build`
- Frontend build result: passes, with chunk-size warnings.
- Backend build sanity command: `npm run build --prefix backend`
- Backend build result: passes, but only echoes "No build step needed for Node.js ESM".
- Lint result: fails before checking code because ESLint 9 is installed but there is no `eslint.config.js`.

## Important Correction

Old coordination files still tell agents to run `npm run build:frontend`. That script no longer exists in the current `package.json`.

Use this instead:

```powershell
$env:Path='C:\Program Files\nodejs;' + $env:Path
& "C:\Program Files\nodejs\npm.cmd" run build
```

Backend:

```powershell
$env:Path='C:\Program Files\nodejs;' + $env:Path
& "C:\Program Files\nodejs\npm.cmd" run build --prefix backend
```

## Highest Priority Errors

### 1. Manual integration credentials are not saved correctly

File: `frontend-src/components/integrations/ConnectIntegrationModal.jsx`

Current code sends:

```js
Company.update(company.id, {
  api_keys: { ...(company.api_keys || {}), ...credValues },
  integration_status: ...
})
```

But `backend/src/routes/companies.js` only accepts individual API-key field names and then stores them into the `api_keys` JSONB column. It ignores a nested `api_keys` object because `api_keys` is not in `DIRECT_COLUMNS`, `API_KEY_FIELDS`, or `SETTINGS_FIELDS`.

Impact: keys entered from Integrations modal can appear saved in the UI flow but are ignored by the backend.

Fix:

- Send flat key fields from the frontend:

```js
await Company.update(company.id, {
  ...credValues,
  ...(statusKey ? { integration_status: { ...(company.integration_status || {}), [statusKey]: true } } : {}),
});
```

- Or update `companies.js` PATCH to explicitly merge nested `api_keys` if present.
- Prefer flat keys for consistency with `ApiKeysTab.jsx`.

### 2. OAuth routes read and write non-existent direct company columns

File: `backend/src/routes/oauth.js`

Schema stores keys and tokens in `companies.api_keys` JSONB. But OAuth code uses direct column selects and updates like:

```js
.select('google_client_id, google_client_secret')
.update({ google_access_token: ..., google_refresh_token: ... })
```

Those columns do not exist in the Supabase schema. This affects Google, Meta, LinkedIn, Twitter/X, TikTok, refresh, and disconnect flows.

Impact: OAuth connections can fail with Supabase column errors, or tokens can fail to persist.

Fix:

- Replace direct credential selects with:

```js
.select('api_keys, integration_status')
```

- Read values from `company.api_keys`.
- When saving OAuth tokens, merge into existing `api_keys`:

```js
const apiKeys = company?.api_keys || {};
await supabaseAdmin.from('companies').update({
  api_keys: { ...apiKeys, google_access_token, google_refresh_token, google_token_expires_at },
  integration_status: mergedStatus,
}).eq('id', companyId);
```

- Apply the same pattern to disconnect and refresh.

### 3. `ApiKeysTab.jsx` Meta OAuth button is broken

File: `frontend-src/components/settings/ApiKeysTab.jsx`

Current code:

```js
const res = await window.open(`${import.meta.env.VITE_API_URL}/api/oauth/meta/initiate?...`)
const { authUrl } = res.data;
```

`window.open()` returns a browser window object, not an API response. `res.data` will not exist.

Fix:

- Use the pattern from `ConnectIntegrationModal.jsx`: open the backend OAuth URL directly and listen for `postMessage`.
- Or remove the dead `authUrl` expectation entirely.

### 4. API-key test logic reads API responses incorrectly

File: `frontend-src/components/settings/ApiKeysTab.jsx`

Current code:

```js
const res = await api.get('/api/integrations/status');
const { success, message } = res.data;
```

But `api.get()` returns parsed JSON directly, not an Axios-style `{ data }` wrapper.

Impact: tests likely show wrong success/failure state even when backend responds.

Fix:

```js
const res = await api.get('/api/integrations/status');
const status = res.status || {};
const success = Boolean(status[type]);
```

For real tests, add backend endpoints such as `POST /api/integrations/test/:type`.

### 5. Integration status value types are inconsistent

Files:

- `backend/src/routes/oauth.js`
- `backend/src/routes/integrations.js`
- `frontend-src/components/settings/ApiKeysTab.jsx`
- `frontend-src/components/integrations/ConnectIntegrationModal.jsx`

Some code stores statuses as strings like `'connected'`; other UI checks expect `true`.

Impact: a connection can be present but not display as connected.

Fix:

- Standardize on booleans in `integration_status`, for example:

```json
{ "openai": true, "meta": true, "gmail": true }
```

- If keeping strings, update all UI checks to accept both `true` and `'connected'`.

### 6. Many integration types have UI fields but no status detection or real test implementation

`backend/src/routes/integrations.js` detects only a limited set: Gmail/Google, Meta, LinkedIn, Twitter, TikTok, SMTP/Resend, Apollo, Hunter, Stripe.

But UI exposes many more: WhatsApp, WordPress, Zapier, Make, n8n, custom API, Lusha, Clay, Cal.com, Chili Piper, etc.

Impact: user can enter keys but app may never mark them connected or actually use them.

Fix:

- Create a single integration registry mapping:
  - frontend type
  - credential fields
  - stored api_keys fields
  - status key
  - backend test function
  - features that consume it
- Implement `POST /api/integrations/test/:type`.
- Disable or label integrations as "Coming soon" until they have a backend test and usage path.

### 7. AI provider/model list may include invalid or stale model IDs

File: `frontend-src/components/settings/ApiKeysTab.jsx`

Examples:

- `claude-sonnet-4-5`
- `claude-opus-4-5`
- `claude-haiku-4-5`

These should be verified against current provider docs/API before using. Invalid model IDs will make AI features fail even with correct API keys.

Fix:

- Use known valid model IDs supported by the installed SDK.
- Add backend validation/test calls for OpenAI and Anthropic keys and selected models.

### 8. Workflow metadata route is shadowed by `/:id`

File: `backend/src/routes/workflows.js`

`router.get('/meta/node-templates')` is declared after `router.get('/:id')`.

Impact: `/api/workflows/meta/node-templates` is interpreted as `id = "meta"` and returns "Workflow not found".

Fix:

- Move `/meta/node-templates` before any `/:id` routes.
- Add a smoke test for it.

### 9. Workflow execution is mostly placeholder behavior

File: `backend/src/routes/workflows.js`

`POST /api/workflows/:id/run` creates a run record but does not execute workflow nodes.

Impact: workflow builder may save and "start" workflows, but actual automation skills/actions do not run.

Fix:

- Build a workflow execution engine:
  - validate node graph
  - execute trigger/action/condition nodes
  - log each step to `workflow_runs`
  - call email/social/enrichment/AI APIs through existing backend services
  - return meaningful failure/success state

### 10. Admin routes are now protected, but old smoke-test claims are too broad

File: `backend/src/routes/admin.js`

Admin routes correctly use `requireAuth` and `requireAdmin`. However, previous handoff claims like "all API calls return 200" are too broad and should not be used as proof. Some routes should return 403 for non-admin users.

Fix:

- Smoke test by user role:
  - owner/system_admin
  - company_admin
  - normal user
- Mark expected 403 responses as "pass" where appropriate.

### 11. Lint is not configured

Current `npm run lint` fails because ESLint 9 requires `eslint.config.js`.

Fix:

- Add `eslint.config.js`, or downgrade/migrate to a supported config.
- Then run `npm run lint` and fix actual lint/runtime issues.

## How Claude Should Continue

1. Do not assume the previous "all functional" smoke test is accurate.
2. Start with API key persistence and OAuth JSONB storage, because this blocks AI, social, ads, email, and automation features.
3. Fix stale scripts and docs: `npm run build`, not `npm run build:frontend`.
4. Add targeted backend tests or scripts for:
   - `PATCH /api/companies/current` with flat API keys
   - `PATCH /api/companies/current` with nested `api_keys` if supported
   - `GET /api/integrations/status`
   - `POST /api/integrations/test/openai`
   - OAuth callback persistence into `api_keys`
   - `/api/workflows/meta/node-templates`
5. Only then proceed to feature completeness: workflows, social publishing, ads imports, email sending, and blog publishing.

