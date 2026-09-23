# Prompt for Codex — audit, verify and fix

Paste everything below the line into a fresh Codex session in this repository.

---

You are picking up the Bmapz AI codebase from Claude, who has just finished a batch
of backend work. Your job is to **audit it, verify the claims, and fix what is
broken** — including anything Claude got wrong. Treat the notes below as *claims to
be checked*, not as facts.

## The project

- **Repo:** `BmapzAI/bmapz` (public), local path `C:\Users\derek\OneDrive\Documents\Bmapz App`
- **Stack:** Vite + React 18 (`frontend-src/`), Express ESM (`backend/src/`), Supabase Postgres 17 with RLS
- **Production:** frontend `https://ai.bmapz.com` (Cloudflare Pages), backend `https://bmapz-production.up.railway.app` (Railway)
- **Supabase project:** `jmtnubzgnfjmtcwbegow`
- **Deploys:** push to `main` triggers both. Backend = Railway. Frontend = GitHub Actions → Cloudflare Pages.
- Read `AGENT_HANDOFF.md` first. It is long but it is the real memory of this project;
  the sections dated 2026-09-23 are the work you are auditing.

## Non-negotiable constraints

1. Never commit real `.env` files or production secrets.
2. Do not change Railway, Cloudflare, Supabase or GitHub deployment settings unless the task requires it.
3. Do not overwrite Claude's changes wholesale, and do not run destructive git commands unless explicitly asked.
4. Document any auth / billing / OAuth / RLS / schema change in `AGENT_HANDOFF.md`.
5. **BYOK (bring-your-own AI key) is strictly owner/system_admin only.** Customers cap at `company_admin`. BYOK bypasses billing, which is why.
6. **Design Studio is an absolute business secret — visible only to `role === 'owner'`, including in AI replies.**
7. No one outside the App Owner's company may ever be assigned `system_admin`.
8. **Never report something as working without direct evidence. No assumptions, only verifiable facts.** If you did not observe it, say you did not observe it.
9. If something genuinely needs Derek's judgement, **stop and ask him in plain English**, laying out the pros, cons and consequences. Do not decide for him.

## What Claude changed (8 commits, `d9d4cb9..6f17d76`)

| Commit | What |
|---|---|
| `d9d4cb9` | AI history import (Claude/ChatGPT exports → Company Brain), one-way |
| `9a01038` | Verified that deploy in production; added CHECK constraints on `ai_context_imports` |
| `18c8823` | Integration test harness: 16 → 33 types; fixed a false-positive gmail test; enabled backend linting |
| `4cb53ac` | `lib/httpError.js` — stop route-level 500s leaking the DB schema (applied to `integrations.js` only) |
| `e0339a6` | Google token failures stay actionable after that scrubbing |
| `d0e653b` | **WhatsApp multi-tenant bug** — per-company number was silently ignored |
| `4711bcd` | Swept for company keys that can never be set; removed dead Stripe operands |
| `6f17d76` | `/health` now reports the running commit SHA |

## Priority 1 — finish the schema-leak fix (192 sites)

`backend/src/index.js` has a global error handler that deliberately refuses to send
`err.message` on a 5xx, because Postgres names tables, columns and constraints and a
crash would otherwise hand an attacker a map of the schema.

That handler **only runs for errors passed to `next()`**. Routes that catch their own
errors and call `res.status(500).json({ error: err.message })` answer the request
themselves and never reach it. There were 193 such sites. Claude fixed the 6 in
`integrations.js`. **192 remain.**

The helper is built and unit-tested: `backend/src/lib/httpError.js`

```js
import { sendServerError } from '../lib/httpError.js';
} catch (err) { sendServerError(res, err, '[routeName]'); }
```

For `{ success, message }` shaped endpoints pass `'success'` as the 4th argument.

Remaining by file: admin 26, adsManager 21, tasks 15, users 12, leads 12,
messaging 10, companies 10, workflows 7, social 7, oauth 7, ai 7, ads 6, seo 5,
notifications 5, billing 5, sdr 4, funnels 4, designTemplates 4, dashboardConfigs 4,
brandScans 4, blog 4, automations 4, auth 4, addons 2, help 1, dataDeletion 1, canva 1.

**Do not do this with a blind sed.** Two reasons, both real:
- A sed in this codebase already replaced an inner `decodeOAuthState` call and created
  infinite recursion in `consumeOAuthState`. It is recorded in `AGENT_HANDOFF.md`.
- Some catch blocks deliberately surface a message that IS meant for the user. Flattening
  those into "Something went wrong" is a regression in error reporting, not a fix.

Read each catch block. Where the message is genuinely user-facing, either give the error
an explicit 4xx `status` (which `safeMessage` preserves) or leave that site alone and note why.

## Priority 2 — verify Claude's integration tests are actually correct

`POST /api/integrations/test/:type` now claims to test 33 integrations with real API
calls. **Claude wrote these from documentation and could not execute most of them**,
because no provider credentials exist in Railway yet. Check each against current
provider docs:

- Correct endpoint, method, auth header shape, and API version
- Correct success-detection (some providers return HTTP 200 with an error in the body — `meta` is the classic)
- Correct company-key names against the `ALLOWED` list in `backend/src/routes/companies.js`
- `googleErr()` — do its regexes actually match the strings Google returns today?
- Perplexity is tested with model `sonar` to match `lib/webSearch.js`. Still valid?
- Canva, X/Twitter and TikTok endpoints are the ones most likely to be stale.

## Priority 3 — independently re-check the WhatsApp fix

Claim: the UI saves `whatsapp_api_token`, but four send sites read
`whatsapp_access_token`, which is not in the `ALLOWED` list and so could never be set —
meaning every company's WhatsApp messages went out from the **platform** number.

Verify it, then check the fix is complete:
- Are there send paths Claude missed? Search beyond `sdrEngine.js`, `workflowEngine.js`, `email.js`, `messaging.js`.
- Does anything else read `whatsapp_phone_id` / `whatsapp_verify_token` inconsistently?
- `whatsappWebhook.js` uses `WHATSAPP_VERIFY_TOKEN` and `WHATSAPP_APP_SECRET` from env only — is per-company inbound routing correct, or does a second tenant's inbound message land on the wrong company?

**Rerun the sweep that found it** (method is in `AGENT_HANDOFF.md`): flag every
`<keys>.<name> || process.env.<VAR>` where `<name>` is absent from the `ALLOWED` list in
`companies.js`. That left operand is dead and the failure is invisible, because the env
fallback keeps the feature working — just for the wrong tenant.

## Priority 4 — things Claude deliberately did NOT do

- **`canva_client_id` / `canva_client_secret` are dead reads.** Every other provider
  (`meta_app_id`, `linkedin_client_id`, `twitter_client_id`, `tiktok_client_key`) is
  settable per company; Canva is not, purely by omission. Fixing it is a two-string
  change to the `ALLOWED` list, but it widens what a `company_admin` can write.
  **This is Derek's decision — do not make it. Ask him.**
- **~40 integrations still have no test** (slack, notion, shopify, hubspot, zoom,
  twilio, etc.). Out of scope for the current phase; `default:` returns an honest
  "No test defined" rather than a false pass. Leave unless asked.
- **`uuid` transitive advisory** — knowingly accepted, documented.
- **Supabase leaked-password protection** is Pro-only and the org is on Free. Accepted
  and documented; password-strength settings are the compensating control and are set.

## Priority 5 — lint debt now that the backend is linted

`eslint.config.js` previously ignored `backend/**` entirely. It no longer does.
Project-wide result is **0 errors, 24 warnings**. The warnings are unused `err`
bindings in catch blocks — worth cleaning as you touch each file for Priority 1.

**One warning is intentional: `oauth.js` `popupHtml`'s unused `errorMsg`.** Provider
error text can carry token fragments, so it is deliberately replaced with a fixed
sentence. Leave it, and do not "fix" it by reintroducing the interpolation.

## How to verify anything

- **What is actually deployed:** `curl https://bmapz-production.up.railway.app/health`
  now returns `{"status":"ok","ts":...,"commit":"<short sha>"}`. Compare it to
  `git rev-parse --short HEAD`. This is the only reliable check — an auth-gated route
  returns 401 whether or not the handler behind it changed, so endpoint smoke tests
  prove a route exists and nothing about its version.
- **Backend boots:**
  ```bash
  cd backend && SUPABASE_URL="https://jmtnubzgnfjmtcwbegow.supabase.co" SUPABASE_SERVICE_ROLE_KEY=t SUPABASE_ANON_KEY=t JWT_SECRET=t PORT=3999 node -e "import('./src/index.js').then(()=>setTimeout(()=>process.exit(0),2500))"
  ```
- **Lint:** `npx eslint . --quiet` must exit 0.
- **Syntax:** `node --check <file>` on everything you touch.
- **Frontend:** the app is **code-split**. Grepping `assets/index-*.js` proves nothing
  about whether a page shipped — read the page's own chunk (e.g. `Settings-*.js`).
  Claude briefly reached a wrong conclusion on exactly this.
- **Database:** use the Supabase MCP against project `jmtnubzgnfjmtcwbegow`. Round-trip
  writes with real inserts and clean up after yourself.

## Known traps in this codebase

- `supabase-js` **resolves** on failure with `{data: null, error}` — it never throws. A
  discarded `error` silently becomes "no rows". This has caused multiple outages here.
- The backend uses `supabaseAdmin` (**service role → BYPASSRLS**). Backend code is the
  *only* tenant guard. Every query must filter by `company_id` itself.
- `tasks` has **three** FKs to `users`, so PostgREST embeds are ambiguous — use `attachPeople`.
- `ai_outputs` has no top-level title/content/category/status; they live in `metadata` JSONB.
- `companies.value_propositions` is `text[]`; `personal_agent_name` lives in `companies.api_keys`; `competitors`/`region` live in `companies.settings`.
- eslint's `no-undef` does **not** resolve JSX element names, and `vite build` does not either.
  "0 errors + green build" is not evidence that a screen renders.
- On Windows, PowerShell `Get-Content`/`Set-Content` round-trips corrupt UTF-8 (ANSI default).
  Use the edit tools or Node, never that pair.

## Deliverable

A prioritised report of what you found, what you fixed, and what you deliberately left —
with the evidence for each. Where you disagree with Claude's reasoning, say so directly
and show why. Commit in small, focused commits with the reasoning in the message.
