# Prompt for Codex: audit, verify and fix

Updated 2026-10-07. REPLACES the 2026-09-23 version (Codex never ran it; nothing was pushed by Codex between 2026-09-23 and 2026-10-07).
Paste everything below the line into a fresh Codex session in this repository.

---

You are picking up the Bmapz AI codebase from Claude after a large batch of backend and frontend work. **Treat everything below as claims to
check, not facts.** Your job: audit it, re-run the evidence, find what is wrong or missing (including mistakes Claude made), and fix it in small commits.
Where you disagree with Claude, say so and show why.

## The project

- Repo `BmapzAI/bmapz` (public), local `C:\Users\derek\OneDrive\Documents\Bmapz App`. Vite + React 18 (`frontend-src/`), Express ESM (`backend/src/`), Supabase Postgres 17 + RLS.
- Production: frontend `https://ai.bmapz.com` (Cloudflare Pages, via GitHub Actions on push to `main`), backend `https://api.bmapz.com` (Railway; the older `bmapz-production.up.railway.app` also answers). Supabase project `jmtnubzgnfjmtcwbegow`.
- **Read `AGENT_HANDOFF.md` first** (sections dated 2026-09-23, 2026-10-06 and 2026-10-07, and "UNFINISHED AT THE USAGE LIMIT") and `AGENT_LIVE_BOARD.md`. Add a row when you start and release it when you finish.
- The backend uses `supabaseAdmin` (service role, BYPASSRLS): backend code is the ONLY tenant guard. supabase-js **resolves** with `{data:null,error}` on failure and never throws, so a discarded `error` silently becomes "no rows".

## Constraints (non-negotiable)

1. Never commit `.env` files or secrets. Do not change Railway/Cloudflare/Supabase/GitHub deployment settings unless the task requires it.
2. Do not overwrite Claude's changes wholesale; no destructive git commands.
3. Document any auth / billing / OAuth / RLS / schema change in `AGENT_HANDOFF.md`.
4. BYOK (own AI keys) is owner/system_admin only; customers cap at `company_admin`. Design Studio is `role === 'owner'` only, including in AI replies. No one outside the App Owner's company may be `system_admin`.
5. **No assumptions: never report something working without evidence you produced.** If something needs Derek's judgement, stop and ask in plain English with pros, cons and consequences.
6. **Do NOT do these** (a classifier or a decision already blocks them): relax `Cross-Origin-Opener-Policy` on the OAuth router; widen the `companies.js` `api_keys` allowlist for secrets (Canva per-company credentials were deliberately removed); switch on `GOOGLE_ENABLE_RESTRICTED_SCOPES`; widen CORS for native app origins before the mobile approach is known.

## What changed since `3d9fb3d` (verify, do not trust)

| Commit | What |
|---|---|
| `9745dcc` | OAuth return path (callback redirects when there is no opener; modal asks the server); Google token/scope fixes; Meta v25 + insights; live-model resolution; Perplexity Agent API module; Canva platform-only; lowercase compliance routes; `/health` shows `oauth_host` |
| `c85596d` | X (failed posts were recorded as published; 2h token expiry; PKCE S256; hosts) and LinkedIn (scope union) |
| `5cd10e3` | TikTok (24h token expiry; fake "published"); Canva (missing scope; single-flight refresh) |
| `2640367`, `a0dcca3` | handoff, board, the behaviour tests in `backend/tests`, the audit evidence in `docs/audit-2026-10-06` |
| `0a0b716` | Resend failures reported as sent; Stripe webhook retry/idempotency and status mapping; connection tests |
| `05aac97` | Retry-safe plan grant; Google revoke on disconnect; runbook generator; privacy-policy draft |

## How to verify (start here)

```bash
node backend/tests/run.mjs            # 8 files, ~130 checks; no credentials or database (fake PostgREST where needed)
npx eslint . --quiet                  # must print nothing; the backend IS linted (that is what catches a missing import after a multi-file edit)
curl -s https://api.bmapz.com/health  # {"commit","oauth_host"}: the commit must match git HEAD; oauth_host must be api.bmapz.com
```
Then **read each test and ask whether it could pass while the product is broken.** Several earlier "tests" passed with no credentials at all (Gmail "credentials present", Apollo's health endpoint
answers 200 with no key). A test is only evidence if it would fail without valid credentials. Audit all ~33 cases in `routes/integrations.js` for that class again.

## Priorities

**P1. Independent review of the money path.** `routes/stripeWebhook.js`, `routes/billing.js`, `lib/paymentProviders.js`, `lib/stripeStatus.js`.
- The plan grant is meant to be retry-safe by construction: subscription write SETS a final state; the ledger row carries `metadata.payment_ref = plan:<session id>` and the existing unique index `uq_credit_tx_payment_ref` is the claim; the purchase row is inserted only if absent; every write is checked; every event type now hands the event back (deletes its `webhook_events` row, answers 5xx) on failure. Try to break it: races between two deliveries, a failure between the subscription write and the ledger row (a retry resets `ai_credits_used` to 0 again: is that acceptable?), `grantAddon` (claims its ledger row FIRST, so a failed grant is acknowledged as "already granted" on retry and the paid credits are missing; the catch only logs `NEEDS MANUAL RECONCILIATION`).
- Still open and not done: a plan change made in the Customer Portal does not update plan/credits/contacts_limit (`customer.subscription.updated` only syncs status; map the price id back to a plan); `invoice.paid` is not handled; `getStripe()` never returns null so the "provider not configured" guard is unreachable; `success_url` lacks `{CHECKOUT_SESSION_ID}`; `"resend"` in `backend/package.json` is an unused dependency; Stripe SDK is `^16` (latest 23) and `apiVersion` defaults to `2024-06-20` (env `STRIPE_API_VERSION` overrides): upgrade together and re-test.
- The live `subscriptions` table allows `trialing|active|past_due|canceled|paused`; Stripe statuses are MAPPED, the constraint is deliberately not widened. Check every place that reads `status`.

**P2. Finish the schema-leak sweep.** 192 route-level `catch` blocks still return `err.message` on a 500, bypassing the global handler in `index.js` that scrubs it (Postgres messages name tables and columns). Helper: `lib/httpError.js` (`sendServerError`). Do NOT use a blind sed (an earlier sed created infinite recursion in `consumeOAuthState`); read each block, because a few deliberately surface a message meant for the user (give those an explicit 4xx `status`).

**P3. Verify the integration code against current vendor docs.** `docs/audit-2026-10-06/*.json` has per-platform audits (file:line, quote, fix). Re-check the ones Claude fixed and the ones it did not: LinkedIn ads campaign bodies (`lib/adPublisher.js`: missing `runSchedule`, `locale`, targeting; the `x-restli-id` response header is discarded so create calls return undefined); LinkedIn feed (`GET /v2/ugcPosts` needs a restricted scope) and posting on the legacy `ugcPosts` endpoint; WhatsApp (inbound BSUID senders, template-only proactive messages, platform-number fallback for tenants); TikTok Ads (the stored token is a Login Kit token; the Business API is a separate app/flow that does not exist); X PKCE verifier travelling inside the readable `state`; Google token refresh still has two older copies (`routes/messaging.js`, `routes/ads.js getGoogleAdsAccessToken`) that should use `lib/googleToken.js`.

**P4. The OAuth return path.** Nothing has been run by a human. Read `routes/oauth.js` (`/popup.js`, `launch-url`, `consumeOAuthState`), `components/integrations/ConnectIntegrationModal.jsx` (waits up to 45s and asks `GET /api/integrations/status`), `pages/Integrations.jsx` (`?oauth=` handler). The callback page is served with COOP `same-origin` (helmet default) so the popup has no `window.opener`; the design copes with that instead of relaxing the header. Look for: the 45-second wait stranding a user who cancelled; the `?oauth=` query being only a claim; `window.close()` side effects; mobile in-app browsers.

**P5. The Integrations page reads STORED `integration_status`, not `GET /api/integrations/status`** (only `AdsRealDataPanel` calls it), so a platform key set in Railway never lights a card. Decide and implement carefully: "detected" means a credential EXISTS, not that it works.

**P6. Model handling.** `lib/aiCredits.js` `liveModelFor()` swaps a chosen model that is absent from the live catalog (`lib/modelRegistry.js`, refreshed every 12h) for a live one of the same tier; it does nothing when no catalog is loaded. Check the pricing multipliers against the current Claude 5 / GPT price lists (`inferModelMultiplier` uses family guesses), and whether `temperature` is still accepted by the newest Claude models. The OpenAI/Anthropic audit may not have finished: see `docs/audit-2026-10-06/README.md`.

**P7. Privacy.** `docs/PRIVACY_GOOGLE_SECTION_DRAFT.md` is a draft with evidence per statement; it must NOT be published without Derek/counsel. One finding to double-check: imported inbound email reaches `handleInboundEvent` -> `handleInboundForSdr` and the text is sent to an AI model when a company enables its SDR (default off).

## Known traps in this codebase

- Files are CRLF. A multi-line edit anchor written with LF silently fails to match. A script that is itself inside a template literal needs doubled backslashes: a single `\/` collapsed into `//` (a comment) and silently killed `/api/oauth/popup.js` until the EMITTED script was tested (`backend/tests/oauth-popup-script.test.mjs`).
- `supabase-js` GET `.maybeSingle()` asks for a JSON array and reads `[]` as "no row"; test doubles must answer that way.
- `tasks` has three FKs to `users` (use `attachPeople`); `ai_outputs` keeps title/content/status in `metadata` JSONB; `eslint no-undef` does not resolve JSX element names and `vite build` does not either, so green lint + build is not evidence a screen renders.
- The frontend is code-split: grepping `assets/index-*.js` proves nothing about a page. An auth-gated route returns 401 whether or not its handler changed; use `/health`'s `commit`.
- Windows PowerShell `Get-Content`/`Set-Content` corrupt UTF-8; use Node or the edit tools.

## Deliverable

A prioritised report: what you found, what you fixed (small commits, reasoning in the message), what you left and why, with the evidence for each. Update `AGENT_HANDOFF.md` and `AGENT_LIVE_BOARD.md`.
