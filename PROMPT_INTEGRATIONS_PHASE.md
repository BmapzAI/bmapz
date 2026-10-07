# Prompt for the integrations phase (new Claude chat in the Bmapz.AI Development project)

Updated 2026-10-07. This REPLACES the 2026-09-23 version, which was wrong in several ways (see "Things that used to be believed").
Paste everything below the line into a new chat.

---

You are continuing **Bmapz AI**. The backend work for integrations is done and verified as far as it can be without real provider
credentials. This phase is: get the real credentials, configure them, connect each platform once, and prove each connection with a
test, while spending as little of Derek's time as possible. Derek has very little time and has asked you to be precise and to decide
well on his behalf; he does not have time to re-verify what you tell him, so **every claim you make to him must come from a test
result, a command output or a quoted official page, never from assumption.**

## 0. Do these FIRST, in this order, before you say anything to Derek

1. Read `AGENT_HANDOFF.md`: the sections dated 2026-10-06 and 2026-10-07, and "UNFINISHED AT THE USAGE LIMIT" (the end of the file).
2. **Read the project chat "Web app mobile development"** (Android and iOS apps are being built IN PARALLEL with this phase; the chat was
   added to the project after the previous session started, so the previous session could not read it). Write its decisions into
   `AGENT_HANDOFF.md` under a "Mobile" heading. Then read `docs/audit-2026-10-06/mobile-research.md` if it exists. Section 8 below says
   what to check against it.
3. Read `docs/INTEGRATIONS_RUNBOOK.md` (per-platform verified click-paths, costs, waits, first-connect traps). It is generated; see its header.
4. Establish ground truth (do not trust this prompt for any of it):
   ```bash
   git log --oneline -3 && git status --short          # what is checked out
   curl -s https://api.bmapz.com/health                # {"status","commit","oauth_host"} - commit must equal git HEAD
   node backend/tests/run.mjs                          # 8 files, no credentials or database needed
   npx eslint . --quiet                                # must print nothing
   ```
5. Check `docs/audit-2026-10-06/README.md`: it says which of the vendor audits finished. Re-run any that did not.

## 1. Where things stand

- **Repo** `BmapzAI/bmapz` (public), local `C:\Users\derek\OneDrive\Documents\Bmapz App`. Frontend `https://ai.bmapz.com` (Cloudflare Pages, deployed by GitHub
  Actions on push to `main`). Backend on Railway (project `e169f38c-e598-4f19-b89f-b52e5fed832a`, service `8b0a5a58-aa6a-4718-9d92-99667908e605`,
  env `6c6d5454-2b08-4e1f-b296-e3e83772e20c`). Supabase project `jmtnubzgnfjmtcwbegow`.
- **API host.** `https://api.bmapz.com` is live (custom domain on Railway, Let's Encrypt certificate, DNS added by Derek). Railway `API_URL=https://api.bmapz.com`.
  Every OAuth redirect URI is built from it: `https://api.bmapz.com/api/oauth/<provider>/callback`. The old `bmapz-production.up.railway.app` host still works
  and may be registered as a SECOND redirect URI while testing, but must be removed from the production Google client before "Verify branding".
- **Credentials.** There are NO provider credentials in Railway yet (only Supabase, OpenAI, Anthropic, JWT/OAuth-state secrets). Nothing in the integrations
  is proven against a real account. The 212 passing checks in `backend/tests` (10 files) use fakes and documented response shapes; they prove the code does what it
  intends, not that the providers behave as documented.
- **No human has completed a real OAuth connect** since the launch-ticket / nonce / popup rewrite. The first one is the most important event of this phase.
- **Tests.** `POST /api/integrations/test/<type>` (the Test button on each card) makes a real API call per integration; its messages name the fix.
  A passing test is the only acceptable evidence that something works.
- DNS for `bmapz.com` is in the **registrar panel** (nameservers `ns1/ns2.dns-parking.com`; email is Hostinger). No tool available to you reaches it:
  Derek adds DNS records himself. Never touch the apex `MX`, SPF `TXT` or `_dmarc` records.

## 2. Standing constraints (override everything)

1. Never commit real `.env` files or secrets. Credentials go in **Railway variables**. By default Derek sets them himself; do not ask him to paste secrets into chat.
2. **Never enter Derek's credentials on his behalf and never create accounts for him.** Give him the click path; he signs in.
3. Do not change Cloudflare, Supabase or GitHub deployment settings unless the task requires it. Railway variables and the `api.bmapz.com` domain are in scope.
4. **BYOK is strictly owner/system_admin only**; customers cap at `company_admin`. **Design Studio is an absolute business secret: `role === 'owner'` only, including in AI replies.**
   No one outside the App Owner's company may be assigned `system_admin`. Only App owners access all company-brain information.
5. Document every auth / billing / OAuth / RLS / schema change in `AGENT_HANDOFF.md`.
6. **"No assumptions, only verifiable facts."** Never report an integration as working without a Test result you ran and quoted.
7. If something genuinely needs Derek's judgement, ask in plain English with pros, cons and consequences, once, early, batched. Do not decide for him.
   (Exception: he explicitly delegated decisions to your best recommendation on 2026-10-06 and 2026-10-07; see section 3.)
8. The auto-mode classifier blocked an attempt to relax a security header (COOP). Do not retry blocked actions by another route; leave them for Derek.
9. Do not run destructive git commands. Do not overwrite Codex's changes. Update `AGENT_LIVE_BOARD.md` when you start and finish.

## 3. Decisions already taken (reversible; do not re-litigate, do tell Derek if one bites)

| Decision | Why | Reverse with |
|---|---|---|
| API on `api.bmapz.com` | `up.railway.app` is on the Public Suffix List, so it can never be a verified Google redirect domain | n/a (done) |
| Canva is **platform-app-only** (no per-company Canva credentials) | A company_admin must not be able to write OAuth client secrets | add `canva_client_id/secret` to the allowlist in `routes/companies.js` and restore the per-company reads in `routes/oauth.js` |
| **Google restricted scopes OFF** (Gmail read, Drive) | They need a paid yearly security assessment (about $540 to $3,000/yr, third-party figures) and 5-10 weeks; an unverified production app is capped at 100 new users for the life of the project | `GOOGLE_ENABLE_RESTRICTED_SCOPES=true` once the assessment is budgeted. Costs: Gmail inbox sync and Drive browsing are unavailable until then |
| Google Ads developer token not used | Sunset 2026-09-09; the header is ignored | `GOOGLE_ADS_SEND_DEV_TOKEN=true` |
| LinkedIn Ads scopes read-only | write needs a higher tier | `LINKEDIN_ADS_WRITE=true` |
| **Apollo is per-company only** (no platform `APOLLO_API_KEY`) | Apollo's developer FAQ: exposing Apollo data to people who are not Apollo customers needs a custom data-licensing contract; one platform key serving every tenant is that. Personal-email reveal is opt-in | restore the env fallback in `routes/integrations.js` once Apollo Partnerships has signed a contract |

## 4. How to work with Derek (his time is the scarce resource)

- **One sitting per console.** Before asking him to open a console, collect every value you will need from it, then give ONE message:
  the numbered click path (exact URLs and field values from the runbook), what to paste where, and exactly what to send back ("reply `done` and
  the Phone Number ID", nothing else). Do not ping him one field at a time.
- **He sets Railway variables himself** (Railway > service > Variables). Give the exact names; warn about a trailing newline when pasting a key.
  After he says done, confirm the redeploy finished: `curl -s https://api.bmapz.com/health` and compare `commit`.
- **Start the review queues first**, because they run while he does everything else (section 5).
- After each connect, run the Test and quote the message. If it fails, report the real error and fix the cause; never describe a failure as a success with a caveat.
- Keep a running table in `AGENT_HANDOFF.md`: platform | credential set | connected | test message | date.
- When he asks "is it ready?", answer from that table, not from memory.

## 5. Priority order

The principle: **submit everything with a human reviewer first**, then spend the waiting time on what needs no approval.

**Tier 1 - start the slow queues (day one).**
1. Google: Search Console DOMAIN property (a DNS TXT record Derek adds) -> brand verification. Needs the privacy policy to have a Google section first:
   `docs/PRIVACY_GOOGLE_SECTION_DRAFT.md` is the draft; it needs counsel/Derek sign-off before it goes on the page. Sensitive-scope verification afterwards (about 2-4 weeks).
2. Meta: Business Verification (start it day one; reports of 5+ business days to weeks despite a stated 2 days), then App Review.
3. TikTok: app review (about 1-2 weeks) then a separate content-posting audit (2-6 weeks). Sandbox works immediately for testing.
4. Canva: submit the integration for review (no published SLA; 1-4 weeks). Until approved only members of your own Canva team can connect.
5. LinkedIn Advertising API request (optional; no published SLA; weeks to months; business email on bmapz.com required).

**Tier 2 - prove the plumbing today, no approval needed.**
1. **Google** OAuth client + first connect with a test user. It exercises the launch ticket, the nonce cookie, the popup and the callback that nobody has ever run. Do this first.
2. Stripe sandbox + webhook (**create the endpoint as SNAPSHOT, and via the API with `api_version=2024-06-20`**; the dashboard wizard defaults to Thin events, which the handler cannot read).
3. Resend: add the SUBDOMAIN `send.bmapz.com`; copy the records from Resend's own Records tab (they changed in August 2026).
4. Meta development-mode connect (needs two business portfolios and an app role; 2-4 hours of prerequisite console work) and the WhatsApp test number.
5. **OpenAI and Anthropic** (keys are in Railway, never exercised): press Test on both cards, then ONE chat on a current Claude model, ONE image generation and ONE image edit. The 2026-10-07 fixes (no `temperature` on Claude 4.7+, `max_completion_tokens` on reasoning models, the new image models, refunds) are proved only against fakes; this is the first real call. Watch for the image-model names (taken from OpenAI's deprecations page) being rejected: set `OPENAI_IMAGE_MODELS` to what the account lists.

**Tier 3.** LinkedIn sign-in/posting, X (needs a funded card; see decision 10a), TikTok sandbox, Canva with Derek's own team, Perplexity (prepaid credit first), Hunter (free), Apollo, Stability (sign up with the Google button for the free credits).

## 6. Known-incomplete (do not rediscover; each is in `AGENT_HANDOFF.md` with the fix)

- LinkedIn ads campaign bodies are incomplete and the create calls lose the new id (`x-restli-id` header); TikTok Ads needs a separate Business API app and flow that is not built; TikTok publishing is not implemented; X PKCE verifier still travels in the readable `state`.
- WhatsApp: inbound webhooks may carry a BSUID instead of a phone number; proactive messages outside the 24-hour window must be templates; with no company number the platform number is used for every tenant.
- Stripe: a plan change made in the Customer Portal does not update plan/credits; `getStripe()` never returns null; success URL lacks the session id; the Stripe SDK is two majors behind (pinned for launch).
- The Integrations page shows STORED status, not `GET /api/integrations/status`; platform keys set in Railway do not light up the cards until a Test/connect writes status.
- Google token refresh still exists in two older copies (`routes/messaging.js`, `routes/ads.js`); 192 route-level `catch` blocks still return `err.message` on a 500 (helper `lib/httpError.js`).
- Perplexity is written to its documented spec and unit-tested but NOT live-verified; the first key settles which surface answers.
- AI providers (2026-10-07, `f22a005`): the price table, tiers, image models and refund path are fixed but unverified against a live key (see the handoff for the list). Dated items: `claude-haiku-4-5` is the default and has a "not sooner than 2026-10-15" floor (`ANTHROPIC_CHEAP_MODEL` repoints it); gpt-4-turbo/3.5, o1, o3-mini, gpt-4.1-nano shut down 2026-10-23; `claude-sonnet-4-5` 2026-11-30. Stability image generation is still on legacy REST v1.
- There is NO authenticated "Delete my account" (only `routes/dataDeletion.js`, which records an email for a human). Both stores require one for an app.
- Sign-in confirmation now uses `GET /api/integrations/status` -> `oauth_connected` / `oauth_stamp` per provider (a human has not yet seen it work).

## 7. Things that used to be believed (all corrected; do not repeat them to Derek)

- "The Google Ads developer token is the long pole" - false. Tokens were sunset 2026-09-09. Google Ads Explorer access is NOT a production path; Basic (brand verification, about 10 business days) is the real minimum.
- "Meta is instant and needs no approval" - false. No approval for a first developer test, but 4-8 weeks to customer-facing access.
- "19 integration cards could never light up" - overstated; see section 6.
- "Sonar (Perplexity) works until 2026-09-27" - it has been retired; the code uses the Agent API.
- "OAuth popups signal success" - they could not (the callback is served with COOP same-origin, which severs the opener). The UI now confirms with the server.

## 8. Mobile apps (Android + iOS) in parallel

Research is DONE (2026-10-07): `docs/audit-2026-10-06/mobile-research.md` (four topics, official URLs, single-source) and the summary at the end of `AGENT_HANDOFF.md`. **The approach (Capacitor / TWA / PWA / native) is NOT known to the tooling: read the project chat "Web app mobile development" FIRST** and record it in the handoff; most findings are tagged by approach.
Hold whatever the approach, when the app is listed in a store:
- **Consumption-only.** No Stripe Checkout/Portal/pricing/upgrade/top-up in the native build, no card at trial sign-up, no upgrade URLs in 402/403 bodies for app clients (add a client-type header). Plans are sold on the web.
- **OAuth.** Redirect URIs stay https on `api.bmapz.com`. Open the authorise URL in the SYSTEM browser (Google forbids embedded WebViews), return through a Universal/App Link on `ai.bmapz.com` with a fallback `/oauth/return` page; this needs `public/.well-known/apple-app-site-association` and `assetlinks.json` (JSON content type, no redirect; curl them after every Cloudflare deploy), Supabase Additional Redirect URLs, LinkedIn `enable_extended_login=true` from the app, and a status refresh when the app regains focus (the server-confirmation work is the base). WhatsApp Embedded Signup in a WebView is undocumented: route to the system browser or hide it.
- **Required new work:** authenticated in-app "Delete my account" (does not exist), an AI third-party data-sharing consent screen, a prominent disclosure before each Connect, a reviewer demo tenant (paid plan, password login, no 2FA), public Privacy/DataDeletion pages that name "Bmapz AI" exactly.
- **iOS:** Sign in with Apple OR hide Google login on iOS (email+password stays); iOS 27 SDK from April 2027; Apple secret rotates every 6 months in Supabase. **Android:** target API 36; personal Play accounts need 12 testers x 14 days; Restore Credentials from April 2027.
- Costs: Apple USD 99/yr, Google USD 25 once; D-U-N-S free (Apple 5+2 business days, Google up to 30 days). Start Google/Meta/TikTok WEB reviews now; they do not wait for the apps.
- Do NOT widen CORS for `capacitor://localhost` / `https://localhost` unless the shell bundles the site instead of loading `https://ai.bmapz.com`. Build nothing mobile-specific until the approach is known.

## 9. Open decisions to put to Derek (one message, early, plain English, with pros/cons)

a. **X posting costs Bmapz money**: $0.015 per post and $0.20 per post containing a link, from prepaid credits, for every customer post. Who pays, and what spend limit?
b. **Stripe business country** (cannot be changed after activation) and when to go live.
c. Whether and when to pay for Google's restricted-scope assessment (unlocks Gmail inbox sync and Drive).
d. Whether the platform WhatsApp number should be allowed as a fallback for tenants with no number of their own.
e. Whether to build the separate TikTok Business (ads) connection or drop TikTok Ads.
f. Whether to request LinkedIn Advertising API now.
g. **Mobile** (one message, after reading the chat): the approach if the chat did not settle it; business country and legal entity (D-U-N-S, personal vs organisation store accounts); apps consumption-only with plans sold on the web (recommended: it is the only option that is simple on both stores); iOS login (hide Google, recommended, vs Sign in with Apple); what "Delete my account" does to a company, its team and an active subscription; the AI consent wording; who builds the reviewer demo tenant.
h. Price effect of the corrected credit table (Claude Haiku 4.5 8x, Fable 78x, gpt-5-mini 3x): confirm the plan allowances still make sense now that the same work uses more credits on those models. Allowances were not changed.

## 10. Verification commands

```bash
curl -s https://api.bmapz.com/health                      # commit + oauth_host
node backend/tests/run.mjs && npx eslint . --quiet        # regression evidence
# Test one integration: the Test button on its card, or POST /api/integrations/test/<type> with a session token.
# Types: gmail google_calendar google_meet youtube google_analytics google_search_console google_ads
#        meta facebook instagram meta_ads whatsapp  linkedin linkedin_ads twitter  tiktok_social tiktok_ads canva
#        stripe resend  perplexity apollo hunter stability  openai anthropic
```
- An auth-gated route returns 401 whether or not the handler behind it changed: endpoint probes prove a route exists, not its version. Use `/health`'s `commit`.
- The frontend is code-split: grepping `assets/index-*.js` proves nothing about a page; read that page's own chunk.
- Files in this tree are CRLF: a multi-line edit anchor written with LF silently fails; use the edit tool, or normalise line endings first.
