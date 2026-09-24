# Prompt for the integrations phase

Paste everything below the line into a new Claude chat in this project.

---

You are continuing work on **Bmapz AI**. The previous session finished the backend
work and the code is ready. This phase is about obtaining real credentials from
external platforms, configuring them, and proving each one works end to end.

## Briefing

- **Repo:** `BmapzAI/bmapz` (public) · local `C:\Users\derek\OneDrive\Documents\Bmapz App`
- **Frontend:** `https://ai.bmapz.com` (Cloudflare Pages, deployed by GitHub Actions on push to `main`)
- **Backend:** `https://bmapz-production.up.railway.app` (Railway, deploys on push to `main`)
- **Railway:** project `e169f38c-e598-4f19-b89f-b52e5fed832a` · service `8b0a5a58-aa6a-4718-9d92-99667908e605` · env `6c6d5454-2b08-4e1f-b296-e3e83772e20c`
- **Supabase:** project `jmtnubzgnfjmtcwbegow`
- Read `AGENT_HANDOFF.md` before doing anything. The 2026-09-23 sections are the immediate background.

**Verified working in production right now** (checked, not assumed):
- `/health` returns the running commit SHA — use it to confirm any deploy
- All OAuth routes mounted and auth-gated; `APP_URL` confirmed live as `https://ai.bmapz.com`
- `POST /api/integrations/test/:type` covers **33 integrations**, each making a real API call
- Stripe webhook returns 400 with **zero redirects** (Stripe treats a 30x as a failure), and raw-body parsing is mounted before `express.json` so signature verification will work
- WhatsApp webhook verify handshake correctly rejects a wrong token with 403

**What has never been done:** no human has completed a real OAuth connect since the
launch-ticket/nonce/popup rewrite. **That is the single most important thing to prove
in this phase.** Until it succeeds once, treat the whole OAuth path as unproven.

**`API_URL` is set in Railway but its live value cannot be observed from outside** —
its only consumer is `oauth.js` and every route reaching it needs a session. The first
successful connect is what confirms it.

## Standing constraints — these override convenience

1. Never commit real `.env` files or production secrets. Credentials go in **Railway variables**, never in the repo.
2. **Never enter Derek's credentials on his behalf and never create accounts for him.** Give him the click-path; he does the signing in. Ask him to paste values back, or to set them in Railway himself.
3. Do not change Cloudflare, Supabase or GitHub deployment settings unless the task requires it.
4. **BYOK is strictly owner/system_admin only.** Customers cap at `company_admin`. BYOK bypasses billing.
5. **Design Studio is an absolute business secret — `role === 'owner'` only, including in AI replies.**
6. No one outside the App Owner's company may be assigned `system_admin`.
7. Document every auth / billing / OAuth / RLS / schema change in `AGENT_HANDOFF.md`.
8. **Never report an integration as working without direct evidence. No assumptions, only verifiable facts.** A green test is evidence; a successful deploy is not.
9. If something needs Derek's judgement, **stop and ask him in plain English** with the pros, cons and consequences. Do not decide for him.

## Two things changed under this project — do not plan around the old facts

**Google Ads developer tokens no longer exist.** Confirmed from Google's own docs:
"Developer tokens were sunset on September 9, 2026", and the header is now "optional
and ignored by the API servers". There is no application and no multi-week wait.
Access is now a property of the **Cloud project**: Test (automatic, *test accounts
only*) → Explorer (self-serve) → Basic (brand verification) → Standard (~10 business
days). Earlier notes in this project said the Ads token was the long pole. It is not.
The code no longer requires it.

**Perplexity sunsets Sonar chat completions on 2026-09-27.** `lib/webSearch.js` calls
exactly that surface (`model: 'sonar'` at `/chat/completions`). It was deliberately
not migrated because there was no key to test a rewrite against. **If you set up
Perplexity, migrate `lib/webSearch.js` and the `perplexity` case in
`routes/integrations.js` together, to the Agent API (`POST /v1/responses`).** Test them
with the same key in the same sitting.

## Priority order

The ordering principle: **submit everything with a human review queue on day one, then
spend the waiting time on what needs no approval at all.**

### Tier 0 — decide this first, it changes every redirect URI

`up.railway.app` is on the Public Suffix List, so Google will accept it as a redirect
URI but **you can never brand-verify it** (that needs DNS-level ownership, which Derek
does not have for Railway's domain). Google OAuth verification — required to leave
"Testing" status — will therefore be impossible on the current callback host.

**Ask Derek whether to put the API on a domain he owns** (e.g. `api.bmapz.com`,
CNAME'd to Railway) before registering anything. If yes, register **both** URLs as
redirect URIs everywhere from the start, so the switch is a config change rather than
a re-verification. This is cheap now and expensive later.

### Tier 1 — start the slow queues immediately (day 1, then wait)

| Platform | What to submit | Expected wait |
|---|---|---|
| TikTok | Production app review | days to ~2 weeks |
| LinkedIn | Advertising API product (`r_ads`, `r_ads_reporting`) | no published SLA — assume weeks |
| Meta | Business Verification + App Review (only needed for non-admin users) | days+ |
| Google Ads | Explorer access from the Cloud Console Google Ads API page | may auto-upgrade; unconfirmed |
| Resend | Add the sending domain and its DNS records | ~15 min, up to 72h to propagate |

### Tier 2 — prove the OAuth rewrite today (nothing blocks these)

1. **Google** — the highest-value first target. The OAuth client is instant and
   self-service, and one connect unlocks Gmail, Calendar, Drive, YouTube, Analytics
   and Search Console. It exercises the launch-ticket, nonce, popup and callback path
   that has never been proven. **Do this one first.**
2. **Meta** — instant, provided the connecting Facebook user holds Administrator,
   Developer or Tester on the app. No App Review needed for that. Also unlocks the
   WhatsApp Cloud API test number.

### Tier 3 — instant, self-service, low risk

Canva · Stripe (test mode) · Resend (key) · Hunter (free, no card) · Apollo ·
Stability (sign up with the **Google** button to get the free credits) ·
Perplexity (needs a prepaid credit purchase first — see the migration note above)

### Tier 4 — instant credentials, but gated by money or review

- **X/Twitter** — client ID/secret are instant, but **write access requires paid prepaid credits**. A passing read test does not prove posting works; the test says so explicitly.
- **TikTok** — use a **Sandbox** key while production review is pending. Sandbox works instantly; a production key is inert until approved.
- **LinkedIn** — sign-in and member posting work as soon as the two self-serve products are added. Ads scopes wait on Tier 1.

## Step-by-step plan

For each platform, in priority order:

1. **Tell Derek exactly what to do**, as a numbered click-path: the console URL, each
   screen, each field, and the exact values to paste. Assume he has not seen the
   console before. Never do the signing-in yourself.
2. **Give him the exact redirect URI to register**, byte-for-byte. This is the single
   most common first-connect failure — no trailing slash, no `http`, no query string.
   The pattern is `https://bmapz-production.up.railway.app/api/oauth/<provider>/callback`.
3. **Have him set the Railway variables** (exact names in the table below). Watch for a
   trailing newline pasted with the value — it produces a 401 that looks exactly like a
   revoked key.
4. **Confirm the deploy that picked up the variables is live**: `curl https://bmapz-production.up.railway.app/health` and compare `commit` to `git rev-parse --short HEAD`. A variable change restarts the service; make sure the restart finished.
5. **Run the connect** from the app: Integrations → the provider's card → Connect. Watch the popup complete and the card flip to connected.
6. **Run the test**: `POST /api/integrations/test/<type>`, via the card's Test button. Report the actual message it returns.
7. **Only then** record it as working, in `AGENT_HANDOFF.md`, with the evidence.

If a step fails, report the real error. Do not retry blindly and do not describe a
failure as a success with a caveat.

## Exact environment variable names the backend reads

Use these spellings exactly; the code reads no others.

| Platform | Railway variables |
|---|---|
| Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (`GOOGLE_ADS_DEVELOPER_TOKEN` is legacy/optional) |
| Meta | `META_APP_ID`, `META_APP_SECRET`, `META_GRAPH_VERSION` |
| WhatsApp | `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET` |
| LinkedIn | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_API_VERSION` |
| X/Twitter | `TWITTER_CLIENT_ID`, `TWITTER_CLIENT_SECRET` |
| TikTok | `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` |
| Canva | `CANVA_CLIENT_ID`, `CANVA_CLIENT_SECRET`, `CANVA_IMPORT_ALLOWED_HOSTS` |
| Billing | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| Email | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` |
| Search/AI | `PERPLEXITY_API_KEY`, `STABILITY_API_KEY` |
| Prospecting | `APOLLO_API_KEY`, `HUNTER_API_KEY` |

Webhook URLs to register: Stripe `…/api/stripe/webhook` · WhatsApp `…/api/whatsapp/webhook`.

## Known first-connect blockers, per platform

These came from research and are worth pre-empting rather than debugging:

- **Google** — the redirect URI must match byte-for-byte. While publishing status is
  "Testing", only accounts listed as test users can authorize (max 100); everyone else
  gets `access_denied`, which is the classic "works for me, not for the customer"
  failure. **Refresh tokens issued in Testing expire after 7 days** (confirmed in
  Google's docs), so a connect made today silently stops refreshing next week — do not
  mistake a working test for a working product.
- **Meta** — the connecting user must hold a role on the app, or the permissions are
  not granted in development mode.
- **LinkedIn** — an app cannot be created without a LinkedIn **Page**, and the app is
  permanently bound to it. The Page super admin must then verify the app before any
  product can be requested. Changing scopes later invalidates existing tokens.
- **TikTok** — redirect URIs must be static HTTPS with no parameters; scopes are
  **comma**-separated (Canva's are space-separated); a production key is dead until
  review passes; sandbox needs your own account added as a target user.
- **Stripe** — sandbox and live produce **different** `whsec_` signing secrets, and
  pairing the wrong one gives a 400 that looks like broken code. Objects created in
  sandbox do not exist in live. Creating a new secret key requires a 2FA code, so
  Derek needs access to that channel.
- **Resend** — a valid key is not the same as being able to send. Mail is refused
  unless the **from-domain is verified**; the test checks this and will tell you.
- **Apollo** — the key goes in an `x-api-key` header, not `Bearer`, and a non-master
  (scoped) key 403s on endpoints it was not scoped to.
- **Stability** — the free credits only come from signing up with the **Google** button.

## How to verify anything

- **What is deployed:** `curl https://bmapz-production.up.railway.app/health` → `{"status":"ok","commit":"<sha>"}`. Compare to `git rev-parse --short HEAD`. **An auth-gated route returns 401 whether or not the handler behind it changed**, so endpoint probes prove a route exists and nothing about its version.
- **An integration:** `POST /api/integrations/test/<type>` — the messages name the fix, not just the symptom (Google's "API not enabled in your Cloud project" is the most common one and is a single checkbox).
- **Connection state:** `GET /api/integrations/status`.
- **The frontend is code-split** — grepping `assets/index-*.js` proves nothing about whether a page shipped. Read the page's own chunk.

## Confidence note — read this before trusting the research above

The platform research behind this plan was produced by six agents reading official
documentation. An adversarial verification pass was planned for all six; **five of the
six failed to run** (session limit) and only **Meta** was independently checked.

Independently confirmed by direct verification: the Google Ads developer-token sunset,
the Google 7-day refresh-token rule, the Perplexity 2026-09-27 sunset, Apollo's
health endpoint returning 200 with no key, and the production facts listed at the top.

**Everything else — particularly TikTok's and LinkedIn's review timelines, and Canva's
and X's exact console flows — is single-source and unverified.** Re-check each against
the platform's current documentation before telling Derek to follow it. Console UIs
change frequently. If the docs disagree with this prompt, trust the docs and say so.
