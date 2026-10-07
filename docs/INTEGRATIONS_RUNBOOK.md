# Integrations runbook

> **Generated** by `node docs/tools/gen-runbook.cjs` from `docs/audit-2026-10-06/` (adversarial re-verification of the 2026-09-23 research,
> run on 2026-10-06/07). **None of it has been run by a human against a real console.** Console screens change often: where a step and the
> live screen disagree, trust the screen, and record the difference in `AGENT_HANDOFF.md`. Never enter or paste Derek's credentials for him.

## Evidence status

| Group | Verified | Claims: confirmed / corrected / refuted / unverifiable | Confidence | Code audit |
|---|---|---|---|---|
| Google (Gmail send, Calendar, Analytics, Search Console, YouTube, Ads) | yes | 16 / 10 / 1 / 4 | medium | done |
| Meta (Facebook, Instagram, Meta Ads, WhatsApp) | yes | 7 / 13 / 2 / 2 | medium | done |
| LinkedIn and X (Twitter) | yes | 15 / 10 / 0 / 2 | medium | done |
| TikTok and Canva | yes | 16 / 10 / 0 / 9 | medium | done |
| Stripe (billing) and Resend (email) | yes | 24 / 8 / 1 / 5 | medium | done |
| Perplexity, Apollo, Hunter, Stability | yes | 11 / 19 / 2 / 7 | medium | done |

## Already done (verified from outside)

- `api.bmapz.com` is attached in Railway, DNS is in place and the certificate is issued (Let's Encrypt). `GET https://api.bmapz.com/health` answers.
- Railway `API_URL=https://api.bmapz.com`. Confirm any time with `curl https://api.bmapz.com/health` -> `"oauth_host":"api.bmapz.com"` and the commit matches `git rev-parse --short HEAD`.
- Compliance pages that every platform asks for are public: https://ai.bmapz.com/PrivacyPolicy, /TermsOfService, /DataDeletion (the lowercase forms also work).
- **Still missing for Google verification:** the privacy policy has no Google section yet. Draft + evidence: `docs/PRIVACY_GOOGLE_SECTION_DRAFT.md`.

## Order of work (recommended)

The principle: **start every queue that has a human reviewer first** (they run while you do everything else), then do what needs no approval.

1. **Start the slow queues**: Google Search Console domain verification (a DNS TXT record) and brand verification; Meta Business Verification; the TikTok app review submission; Canva review submission; (optional) LinkedIn Advertising API request.
2. **Same day, no approval needed**: Google OAuth client + first connect (test user); Stripe sandbox + webhook; Resend subdomain; Meta development-mode connect and WhatsApp test number.
3. **Then**: LinkedIn sign-in/posting, X (needs a funded card), TikTok sandbox, Canva with your own team, Perplexity (prepaid credit first), Hunter, Apollo, Stability.
4. After each connect: press **Test** on its card (or `POST /api/integrations/test/<type>`) and record the exact message in `AGENT_HANDOFF.md`. A deploy being green is not evidence; a passing test is.

### DNS you will be asked for later (all in the same registrar panel; nameservers are ns1/ns2.dns-parking.com)

- Google Search Console DOMAIN property: one `TXT` at the apex (`@`), value supplied by Search Console. Do not remove it afterwards.
- Resend sending subdomain (use `send.bmapz.com`): the records Resend shows on its Records tab. Copy them from there; they changed in August 2026 (CNAME-based SPF for new domains), so do not reuse any older list.
- Do **not** touch the existing apex `MX` (Hostinger), the apex SPF `TXT`, or `_dmarc`. A second SPF or DMARC record invalidates the first.

---

## Google (Gmail send, Calendar, Analytics, Search Console, YouTube, Ads)

**Railway variables:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `(optional) GOOGLE_ENABLE_RESTRICTED_SCOPES, GOOGLE_ADS_API_VERSION`

**Redirect / callback URLs to register:**
- https://api.bmapz.com/api/oauth/google/callback
- https://bmapz-production.up.railway.app/api/oauth/google/callback  (remove before "Verify branding")

**Press Test on:** `gmail`, `google_calendar`, `google_meet`, `youtube`, `google_analytics`, `google_search_console`, `google_ads`

**What the code now does differently (read before you connect):**
- One Google token serves every Google service; authorisation now merges scopes (include_granted_scopes) so connecting a second service no longer breaks the first.
- Restricted scopes (Gmail read, Drive) are OFF by default: they need a paid yearly security assessment. Gmail SEND, Calendar, Analytics, Search Console, YouTube and Ads are on. Inbox sync and Drive browsing return when GOOGLE_ENABLE_RESTRICTED_SCOPES=true.
- Google Ads developer tokens no longer exist and are not sent by default. A Cloud project that has only Test access can reach Google Ads TEST accounts only; the Ads test says so by name.

**Testable today with no human review?** Yes. YES, with limits. Create the Cloud project, enable the APIs, register Branding, set Audience to External in Testing, add up to 100 test users, declare the scopes in Data Access, and create the Web client. Then connect with a listed test account, click through 'Google hasn't verified this app' and read real Analytics, Search Console, Calendar, YouTube, Drive and Gmail data. Google requires no review for this. The limits are: (1) refresh tokens last 7 days, (2) only the listed test users can connect (up to 100), and (3) Ads: Test access reaches Google Ads TEST accounts only. Explorer (2,880 production ops per day, no planning tools) arrives only if Google auto-approves it, with no SLA, so do not plan on it. A real advertiser account is therefore NOT reliably testable today without a human review step. Stage everything else first: ads, brand verification and CASA are the only things that wait on Google. The callback must use the Railway URL until api.bmapz.com resolves. Both URIs can be registered together.

**What a customer launch needs** (Sensitive scopes only (adwords, analytics.readonly, webmasters.readonly, calendar, youtube.*, gmail.send, userinfo.email, drive.file): about 2-4 weeks if the DNS, homepage and privacy-policy prerequisites are ready on day one and there is one resubmission round. Add up to 1 more week for Ads Basic running in parallel. With restricted scopes (full drive, Gmail read/modify): plan 5-10 weeks, with a yearly renewal. Pace the plan around two clocks: DNS + brand verification first (days), then verification.):
- Public home page at ai.bmapz.com that works logged out, plus privacy policy, terms and data-deletion pages with Limited Use wording and a list of Google data used
- Search Console Domain-property verification of bmapz.com (DNS TXT) by an account that owns the Cloud project, and bmapz.com in Authorized domains
- Callback moved to https://api.bmapz.com/api/oauth/google/callback and the Railway URI removed from the production client
- Brand verification (a few minutes up to 2-3 business days, valid for 7 days)
- Publish to In production and submit sensitive-scope verification: per-scope justification, why narrower scopes are insufficient, unlisted YouTube demo video (3-5 business days typical)
- If any restricted scope is kept (drive full, gmail.readonly/modify/compose/metadata/insert): CASA Tier 2 via an authorized assessor, Letter of Assessment, repeated every 12 months (several weeks, paid by developer)
- Google Ads: Basic access (brand verification first, about 10 business days) for production accounts at scale. Standard later for unlimited operations
- youtube.upload: YouTube API compliance audit, otherwise uploads stay private

**Costs and waits:**
- Google Cloud project, OAuth client, enabling APIs: **$0** - Billing not confirmed as required in this session. Prior researcher said it is optional.
- Brand verification and sensitive-scope verification: **$0 published** - Google's pages state no fee. A third-party guide says there is no cost. Wait: brand 2-3 business days, sensitive 3-5 business days typical, no SLA.
- CASA Tier 2 security assessment (only if restricted scopes: full drive, gmail.readonly/modify/compose/metadata/insert): **No Google-published price. Third-party estimates: about $540-$720 (TAC Security self-serve), about $700 (Netsentries), $3,000+ (Prescient); another source cites $15k-$75k for legacy tracks** - Paid by the developer, repeated every 12 months. 'Several weeks' per Google. Avoid by using drive.file and gmail.send.
- Google Ads API access levels (Test, Explorer, Basic, Standard): **No fee stated on Google's pages** - Waits: Test instant; Explorer 'may' auto-approve, no SLA; Basic about 10 business days after brand verification; Standard manual audit after Basic, no separate SLA.
- YouTube API compliance audit (to un-lock public uploads / raise quota): **No fee found** - Wait unpublished. Not fetched beyond the videos.insert note.
- Search Console domain verification (DNS TXT): **$0** - Registrar DNS change. Propagation minutes to hours.

**Changed since the first research (2026-09-23):**
- The Google Ads API access-levels page now shows a last-updated date of 2026-09-30, after the researcher's 09-23 snapshot. It lists Explorer's blocked features (account creation, user management, planning tools, billing) and 'Google may allow you to apply' wording. I cannot tell which sentences changed. -> Explorer is NOT a production path for a SaaS. Treat Basic (brand verification, about 10 business days) as the real minimum.
- Google Ads API v25.2 was released on 2026-09-23 and v25.1 on 2026-08-19. v22 is on its tentative Oct 2026 sunset. The 'safe' assumption is that it can disappear at any time this month. -> v24 is fine for go-live (projected sunset May 2027). Do not build on v22. If the code pins v22, upgrade now.
- The developer-token page now says the API Center in the manager account is deprecated and will be removed. The Ads OAuth overview page still says a developer token is required, so the Ads docs are internally inconsistent. -> Do not spend time hunting for a developer token. Check whether the Ads client library still requires a placeholder value.
- The brand-verification and sensitive-scope pages are dated 2026-08-19, so the OAuth verification rules did not change after 09-23. I found no policy change, price change or console redesign announced after 09-23 in the pages I fetched. -> The 09-23 verification timeline assumptions still hold: brand 2-3 days, sensitive 3-5 business days, restricted several weeks plus CASA.
- The prior file's Ads console URL (console.cloud.google.com/google-ads/overview) disagrees with Google's setup guide (console.cloud.google.com/google/ads-apis/overview). -> Use the guide's URL. This avoids a dead end at the very step where Derek checks the access level.

**Step by step (verified):**

0. DECISIONS (my recommendations). (A) Ship v1 with SENSITIVE and NON-SENSITIVE scopes only. Replace Drive full 'drive' with 'drive.file', and Gmail read/modify with 'gmail.send' (+ 'gmail.labels' if needed). That avoids CASA, its yearly cost and its weeks of delay. If the app genuinely must read the user's whole Drive or inbox, make that a separate later release with its own verification. (B) Do NOT click Publish app until the branding is verified and you are ready to submit verification the same day: the 100-new-user cap is lifetime and cannot be reset. (C) Use one Google account that is the long-term owner of the business for the project and for Search Console.
1. DNS FIRST (this is the slow part): in the SAME Google account go to https://search.google.com/search-console > Add property > 'Domain' > enter bmapz.com > copy the TXT value starting google-site-verification=. At the registrar panel (nameservers ns1/ns2.dns-parking.com) add a TXT record: Host = @ (or blank), Value = what you copied. Leave the existing SPF TXT, MX and _dmarc records untouched. Do not merge the new value into the SPF line. Click Verify (DNS can take minutes to hours).
2. Create the project: https://console.cloud.google.com/projectcreate > Name 'bmapz-ai-prod' > Create. Make sure it is selected in the project picker for all later steps.
3. Enable APIs at https://console.cloud.google.com/apis/library (search each name, click Enable): Google Ads API; Google Analytics Data API; Google Analytics Admin API; Google Search Console API (search 'Search Console'); Google Calendar API; YouTube Data API v3; Google Drive API; Gmail API (only if gmail.send or other Gmail scopes are kept).
4. Branding: https://console.cloud.google.com/auth/branding > App name: Bmapz AI | User support email: a real inbox | App home page: https://ai.bmapz.com (open it in a private window first: it must show a public page without login) | Privacy policy: https://ai.bmapz.com/PrivacyPolicy | Terms of service: https://ai.bmapz.com/TermsOfService | Authorized domains: bmapz.com (one entry covers ai. and api.) | Developer contact email: a real inbox. Add the logo only if it is final, because later changes force re-verification. Save.
5. Audience: https://console.cloud.google.com/auth/audience > User type External. Leave status 'Testing'. Under Test users add your own Google account and any internal testers (max 100).
6. Data Access: https://console.cloud.google.com/auth/scopes > Add or remove scopes. Select or paste under 'Manually add scopes': https://www.googleapis.com/auth/adwords , https://www.googleapis.com/auth/analytics.readonly , https://www.googleapis.com/auth/webmasters.readonly , https://www.googleapis.com/auth/calendar , https://www.googleapis.com/auth/youtube.readonly , https://www.googleapis.com/auth/youtube.upload , https://www.googleapis.com/auth/userinfo.email , plus per decision A: https://www.googleapis.com/auth/drive.file and https://www.googleapis.com/auth/gmail.send. Update > Save. Anything labeled Restricted (drive, gmail.readonly/modify/compose) means CASA. If the code still requests them, change GOOGLE_SCOPES_MAP or accept the delay. Check that every scope the code sends is listed here.
7. Create the OAuth client: https://console.cloud.google.com/auth/clients > Create client > Application type 'Web application' > Name 'Bmapz AI backend' > Authorized JavaScript origins: https://ai.bmapz.com (only if the browser calls Google directly) > Authorized redirect URIs, add BOTH: https://api.bmapz.com/api/oauth/google/callback and https://bmapz-production.up.railway.app/api/oauth/google/callback > Create. If the console rejects either URI, keep the other and tell me. The Railway one is only for testing, because it can never pass brand verification.
8. In the dialog COPY the Client ID and Client secret immediately (the secret is not shown in full afterwards). In Railway > backend service > Variables set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET. Leave GOOGLE_ADS_DEVELOPER_TOKEN empty. Only if the app will not boot or the Ads client library errors, set it to any non-empty placeholder. Redeploy.
9. First test: connect from https://ai.bmapz.com with a test user. On the 'Google hasn't verified this app' screen click Advanced > Go to Bmapz AI (unsafe) > Allow all boxes. The authorization URL must use access_type=offline and prompt=consent so a refresh token is returned. Tokens from this stage last 7 days.
10. Google Ads today: open https://console.cloud.google.com/google/ads-apis/overview (right project selected). Access level will say Test (test accounts only). Expand 'Upgrade access level' > Apply for access (Explorer). It may or may not auto-approve, and it allows only 2,880 production ops per day and no keyword planning. Test the Ads call path against a Google Ads TEST account meanwhile. Use API v24 or v25, never v22.
11. Brand verification: Google Auth Platform > Verification Center (left menu, https://console.cloud.google.com/auth/verification if it does not appear) > Verify branding. Before clicking, remove the railway.app redirect URI from this client (or use a second client for testing). Confirm Search Console shows bmapz.com verified under the SAME Google account that owns the project. Result: minutes to 2-3 business days. It stays valid for only 7 days, so be ready to publish.
12. Within those 7 days: Audience > Publish app (status becomes In production) > Prepare for verification. For each sensitive scope write a justification and say why a narrower scope is not enough. Upload an unlisted YouTube demo video that shows the full consent flow and the feature using each scope. Submit. Typical 3-5 business days. Respond to Google's emails from the support inbox.
13. Privacy policy at https://ai.bmapz.com/PrivacyPolicy must (a) list each Google data type used and why, (b) include: 'Bmapz AI's use and transfer to any other app of information received from Google APIs will adhere to Google API Services User Data Policy, including the Limited Use requirements.' (verify the exact sentence on Google's policy page), (c) say Google data is not sold, not used for ads and not read by humans without consent, (d) say Google user data is not used to train generalized AI/ML models, and (e) link to https://ai.bmapz.com/DataDeletion. Make sure the homepage links to the privacy policy.
14. After brand verification passes, apply for Google Ads Basic at https://console.cloud.google.com/google/ads-apis/overview > Upgrade access level > Apply for access > Basic. About 10 business days. Basic is 15,000 operations per day for the whole project. Apply for Standard only once you approach that.
15. If youtube.upload must publish public videos, apply for the YouTube API Services compliance audit for this project. Until then uploads are private.
16. When api.bmapz.com resolves, set the backend callback to the api.bmapz.com URI and confirm no railway.app URI is left on the production client.

**Things that commonly break the FIRST connect:**
- Redirect URI must match byte for byte: https://api.bmapz.com/api/oauth/google/callback and https://bmapz-production.up.railway.app/api/oauth/google/callback, with no trailing slash, no http, no wildcard. Print what the backend sends and compare.
- Only test users listed under Audience can connect while the status is Testing (max 100). Anyone else gets access_denied. This is the usual 'works for me, not for the customer' failure.
- Refresh tokens issued in Testing die after 7 days, so a working connect today will break next week. Log it explicitly.
- Scopes requested in the auth URL must also be declared in Data Access. APIs must be enabled in the SAME Cloud project that owns the OAuth client, or you get 403 SERVICE_DISABLED. Ads access level is read from the project that owns the OAuth credentials.
- The Railway redirect URI can never be a verified authorized domain, so it blocks brand verification. Remove it from the production client before 'Verify branding'.
- https://ai.bmapz.com must be a public page when logged out and must link to the privacy policy. Check in a private window. If it redirects to login, brand verification fails.
- Search Console verification must be a DNS Domain property for bmapz.com done with an account that owns the Cloud project. The TXT goes at host @. Do not edit the SPF record. A subdomain-only property does not verify the parent.
- Google Ads: a Test-access project reaches only Google Ads test accounts. Explorer is not guaranteed (no SLA) and limits production to 2,880 ops per day. Basic needs brand verification first and about 10 business days. The 15,000 ops per day is shared across all customers.
- Do not use the manager-account API Center. It is deprecated. Use https://console.cloud.google.com/google/ads-apis/overview. Do not chase a developer token. Stale docs still mention it.
- Pick API v24 or v25. v22 sunsets this month and v23 in Feb 2027.
- Any restricted scope in the code (drive, gmail.readonly, gmail.modify, gmail.compose, gmail.metadata, gmail.insert, mail.google.com) forces a CASA assessment for the whole verification. The sensitive-only submission cannot go through while those scopes are included.
- 100 new users lifetime cap on the unverified-app screen once in production, not resettable. Publishing early burns slots. Gmail-scoped tokens die on password change. Re-auth loops hit the 100-refresh-tokens-per-account limit.
- The authorizing user also needs real permissions on the underlying resource (Search Console property, GA4 property, Ads customer ID). A clean grant with too little access returns empty lists, not errors.
- YouTube uploads from an unverified API project are forced private until the compliance audit passes.

**Not confirmed from an official source (re-check against the live console before relying on it):**
- Scope sensitivity labels for adwords, analytics.readonly, webmasters.readonly, calendar and youtube.* came from secondary sources. Google's pages I could fetch did not print the labels. Gmail and Drive labels are official. Check the Sensitive badge in Data Access when adding each scope. webmasters.readonly is the least corroborated.
- I could not read GOOGLE_SCOPES_MAP, so I do not know which Gmail and Drive scopes the code requests. The CASA decision depends entirely on that list.
- Whether refresh tokens in production while unverified avoid the 7-day expiry is inferred. Google ties the expiry to Testing and I found no explicit sentence for unverified-in-production. Test it on day 8.
- Whether test users from the Testing phase count against the 100 lifetime unverified-app cap is not stated in what I fetched.
- Explorer approval time is not published. Whether an auto-upgrade lands the same day cannot be confirmed. The 2,880 ops per day production ceiling would also make it unusable for customers.
- Ads error code names for Test-access projects calling production accounts could not be re-confirmed. The access-levels page was updated 2026-09-30 and I cannot diff it against the 09-23 version.
- The Ads API sunset months (v22 Oct 2026, v23 Feb 2027, v24 May 2027) come from secondary snippets because Google's sunset page did not parse. Google says tentative dates can fall on any day in the month.
- The exact Limited Use sentence is widely used by other companies but did not appear in the Google policy excerpt I received. Re-read the policy. Also confirm the Gmail/Drive generalized AI/ML training ban wording. It is critical for an AI product and I could not verify it from the page.
- Business entity country is unknown. I found no Google OAuth or Ads API rule in what I read that depends on country, but the Ads Standard audit and CASA assessor paperwork may ask for business details.
- Whether the Cloud console accepts https://bmapz-production.up.railway.app/... as a redirect URI, and whether api.bmapz.com is accepted before its DNS exists, is not documented. Try it. The public-suffix claim for up.railway.app was not re-verified.
- The exact path of the Verification Center in the current console (https://console.cloud.google.com/auth/verification) was not confirmed. Navigate via Google Auth Platform in the left menu if the link fails.
- YouTube default quota, upload quota ('1 unit in the Video Uploads quota bucket', 100 calls/day) and the audit form are only partly confirmed. Whether Bmapz needs more than the default is unknown.
- Brand verification may reject logo, app name or homepage text for reasons not in the documentation. Allow for one resubmission cycle.
- Not re-verified this session: client-secret one-time display, 'billing not required', 10-authorized-domain max, access_type=offline/prompt=consent behavior (standard Google behavior).

---

## Meta (Facebook, Instagram, Meta Ads, WhatsApp)

**Railway variables:** `META_APP_ID`, `META_APP_SECRET`, `META_GRAPH_VERSION (default v25.0)`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`

**Redirect / callback URLs to register:**
- https://api.bmapz.com/api/oauth/meta/callback
- https://bmapz-production.up.railway.app/api/oauth/meta/callback

**Press Test on:** `meta`, `facebook`, `instagram`, `meta_ads`, `whatsapp`

**What the code now does differently (read before you connect):**
- Default API version moved v24.0 -> v25.0 (the Marketing API retired v24.0 on 2026-10-06). Override with META_GRAPH_VERSION.
- Facebook/Instagram insights now request current metrics and surface Meta's error instead of showing empty data. UNVERIFIED against a live token: re-check on first connect.
- read_insights and instagram_manage_insights are now requested and become part of App Review.
- WhatsApp webhook: https://api.bmapz.com/api/whatsapp/webhook (verify token = WHATSAPP_VERIFY_TOKEN). Known gap: inbound BSUID senders and template-only outbound messages (see AGENT_HANDOFF.md).

**Testable today with no human review?** Yes. Yes for an end-to-end developer test, with limits. Meta's App Review page says review is not required when only people with a role on the app use it, and Business Verification likewise (previous verifier confirmed that on the verification page). So with Derek as admin of a Business-type app he can complete the Facebook/Instagram/ads OAuth dialog, receive a user token, call me/accounts, read the IG business account, publish a Page post and an IG media container, and list ad accounts (Marketing API development tier, score 60). WhatsApp: the Cloud API test number is auto-created, sends template messages (hello_world) to up to 5 allowlisted recipients and can receive replies via webhook with no review and no payment method (5-recipient and no-payment points rest on secondary sources). NOT testable without review: any customer or non-role user connecting, Messenger/Instagram message webhooks from non-role users, Marketing API volume above score 60, WhatsApp to arbitrary numbers, and sending from a real production number (needs registration, display name approval, 2-step PIN, likely payment method). Allow 3-5 hours of console prerequisites first and expect at least one failed first attempt on use-case choice, token type or redirect URI.

**What a customer launch needs** (4-8 weeks to customer-facing Facebook/Instagram connect (best case about 2.5-3 weeks if Business Verification clears in days and the first submission passes; 10+ weeks if rejected twice). Ads at scale about 6-10 weeks because the 15-day qualifying-traffic window runs in parallel but the upgrade review has no published SLA. WhatsApp own-number production 1-3 weeks (number registration plus optional verification). Arithmetic: BV 3 days to 3 weeks, screen recordings and logged API calls 3-5 days (parallel), App Review 1-3 weeks per round, one rejection round likely.):
- Business-type Meta app(s) with correct use cases, tied to Bmapz business portfolio
- Business Verification of that portfolio (legal name and documents must match; entity country unknown)
- App icon 1024x1024, privacy URL https://ai.bmapz.com/PrivacyPolicy, terms URL https://ai.bmapz.com/TermsOfService, data deletion URL https://ai.bmapz.com/DataDeletion (or callback), app category and purpose, contact email, in BOTH apps
- Advanced Access via App Review for each of the permissions customers will grant (email/public_profile auto; pages_show_list, pages_read_engagement, pages_manage_posts, pages_messaging, instagram_basic, instagram_content_publish, instagram_manage_messages, ads_management, ads_read, business_management) plus public_profile for Facebook Login for Business
- At least one successful API call per permission within the 30 days before submitting, and one 1080p screen recording per permission plus reviewer test instructions and non-personal test logins
- Annual Data Use Checkup once Advanced Access is held (paraphrase of access-levels page)
- Marketing API standard-tier upgrade: 500+ calls in 15 days with under 15% errors, then Upgrade request in App Review dashboard
- WhatsApp own-number production: register real number (display name, 2-step PIN), likely payment method; raising 250-recipient/day limit needs verification or volume
- If customers connect their own WhatsApp numbers: Tech Provider path, Embedded Signup v4, Access Verification, customer payment methods

**Costs and waits:**
- Meta app creation, developer registration, Graph API calls: **No fee found** - No published fee in any page fetched.
- App Review (Advanced Access): **No fee found** - Wait: official 'decision within a week'; third-party reports 17-20 days; rejections add a full cycle. No SLA published.
- Business Verification: **No fee found** - Needs legal documents (name, address, phone/domain match). No Meta SLA; secondary sources 2 business days to 14 business days, community reports of weeks.
- Marketing API standard tier upgrade: **No fee found** - Wait: at least 15 days of qualifying traffic (500+ calls, under 15% errors) plus review with no published SLA.
- WhatsApp test number messages (up to 5 recipients): **Free (secondary sources)** - No payment method needed for test WABA template sends per previous verifier and search snippets; not confirmed on an official page I could fetch.
- WhatsApp production messages: **Per-message by category and recipient country (pricing page, since 2025-07-01)** - Marketing always charged; utility charged outside 24h windows; authentication charged; service replies free. Payment method requirement not stated on pages fetched. Real phone number cost is your carrier.
- Ad spend and ad account payment method: **Customer's own ad budget** - Reading ads data and creating test objects do not need spend by themselves; Meta fees only apply to ads that run.
- Tech Provider path (only if customer-owned WhatsApp numbers): **No fee found** - Requires Business Verification, App Review, Access Verification; onboarding limit 10 then 200 customers per rolling 7 days; each customer needs a payment method.
- Operator time: **About 3-5 hours console work to first working test; additional 1-2 days for review materials** - Screen recordings per permission (11) are the biggest manual chunk.

**Changed since the first research (2026-09-23):**
- Embedded Signup v2 deprecation date (2026-10-15) now 9 days away; v4 (Facebook Login for Business configuration based) is the replacement -> No impact on the current own-number WhatsApp setup. Becomes a hard requirement if Bmapz lets customers connect their own WhatsApp numbers; do not build on v2/v3.
- WhatsApp per-message rate updates effective 2026-10-01 for Bangladesh, Iraq, Nepal, Sri Lanka, Kazakhstan, Kuwait, Morocco, Oman and Ukraine (deadline already passed) -> None for US-style tests; relevant only for those recipient countries.
- Meta expanded its AI Developer Assistant to handle app review, business verification and permission questions by mid-September 2026, ahead of support tickets (third-party report, ppc.land) -> If an App Review or Business Verification gets stuck or rejected, first-line help is the AI assistant, which may lengthen recovery time.
- Community reports in September 2026 of Business Verification stuck In Review for 5+ business days to several weeks despite a stated ~2 business day target -> Start Business Verification on day 1; do not plan the launch date around Meta's stated 2-day figure.
- No new Graph API version since v26.0 (2026-07-29); v24.0 remains available until 2028-02-18; no new permission deprecations found -> META_GRAPH_VERSION=v24.0 is safe for launch; no forced code change before 2028.

**Step by step (verified):**

PART 1 - PREREQUISITES (about 60-90 min). 1. Log in to Facebook with the personal account that will own everything (turn on two-factor authentication first). Register as a developer at https://developers.facebook.com/ if not already.
2. Create the business portfolio at https://business.facebook.com/overview > Create a business portfolio. Use the exact legal business name, address, phone and website https://ai.bmapz.com. This same legal name must match documents for Business Verification later. (Reported limit: one person can create only 2 portfolios.) Do not create a second one now.
3. Make sure these assets exist and sit inside the portfolio (https://business.facebook.com/settings > Accounts): a Facebook Page you admin (create 'Bmapz Test Page' if needed), an Instagram Business or Creator account connected to that Page (Instagram app > Settings > Account type; then Page settings > Linked accounts), and one ad account (Accounts > Ad accounts). Add each via Add > Create or Add existing.
PART 2 - APP A: OAuth connector (Facebook/Instagram/Ads) (about 60 min). 4. Go to https://developers.facebook.com/apps > Create app. Name 'Bmapz Connect', contact email, select the portfolio from step 2. On the use-case screen select ONLY: 'Manage everything on your Page', 'Manage messaging & content on Instagram', and 'Create & manage app ads with Meta Marketing API'. Do NOT select 'Authenticate and request data from users with Facebook Login' (Meta says it is incompatible with the Page use case). If any of the three is greyed out, stop and tell me which one: do not guess, use cases cannot be removed later. If the list offers 'Other' > 'Business' type instead, choose Business type and add products manually.
5. App settings > Basic: copy App ID into META_APP_ID; click Show next to App secret, re-enter password, copy into META_APP_SECRET. Fill: Privacy Policy URL https://ai.bmapz.com/PrivacyPolicy; Terms of Service URL https://ai.bmapz.com/TermsOfService; User data deletion = Data deletion instructions URL https://ai.bmapz.com/DataDeletion; App domains: ai.bmapz.com, api.bmapz.com, bmapz-production.up.railway.app; upload a 1024x1024 app icon; category 'Business and pages'; save.
6. Dashboard > Use cases > Manage everything on your Page > Customize > Permissions and features: Add pages_read_engagement, pages_manage_posts, pages_messaging (business_management, pages_show_list, public_profile are pre-added). Same screen for the Instagram use case: Add instagram_basic, instagram_content_publish, instagram_manage_messages. Ads use case: Add ads_management, ads_read. Add email if offered. Do NOT click Request advanced access yet.
7. Left menu > Facebook Login for Business > Settings > Client OAuth Settings. Turn ON Client OAuth login, Web OAuth login, Enforce HTTPS and Use Strict Mode for redirect URIs. In Valid OAuth Redirect URIs paste BOTH (one per line, no trailing slash): https://api.bmapz.com/api/oauth/meta/callback and https://bmapz-production.up.railway.app/api/oauth/meta/callback . Save. (If the provider key in the backend is not 'meta', replace that segment; ask the code auditor.) If the app shows plain Facebook Login instead, same field exists there.
8. App roles > Roles: add every tester as Administrator/Developer/Tester; each must accept the invitation. Keep the app in Development/no toggle: no App Review is needed for role-holders.
9. Only if the Facebook dialog returns fewer permissions than requested: Facebook Login for Business > Configurations > Create configuration, login variation General, token type User access token (NOT system-user token), tick all permissions, save, copy Configuration ID and give it to the code auditor.
PART 3 - APP B: WhatsApp (about 45 min). 10. https://developers.facebook.com/apps > Create app > name 'Bmapz WhatsApp' > use case 'Connect with customers through WhatsApp' > select the SAME portfolio. Do the same Basic settings as step 5 (privacy, terms, data deletion instructions URL, icon, App domains). Copy this app's App secret into WHATSAPP_APP_SECRET (it differs from META_APP_SECRET).
11. App B > WhatsApp > API Setup: a test business number is created automatically; copy 'Phone number ID' (digits, not the +1555 number) into WHATSAPP_PHONE_NUMBER_ID. Under To > Manage phone number list add your own mobile (max 5); enter the WhatsApp code it sends.
12. Permanent token: https://business.facebook.com/settings > Users > System users > Add > name 'bmapz-whatsapp', role Admin > Assign assets: select App B and grant Manage app; also assign the WhatsApp Business Account asset with full control > Generate token > choose App B, expiry Never if offered (otherwise 60 days and put a renewal in your calendar) > tick business_management, whatsapp_business_management, whatsapp_business_messaging > copy into WHATSAPP_ACCESS_TOKEN immediately (shown once).
13. Run `openssl rand -hex 24` (or any long random string) -> WHATSAPP_VERIFY_TOKEN.
PART 4 - DEPLOY AND CONNECT (about 20 min). 14. In Railway set: META_APP_ID (App A), META_APP_SECRET (App A), META_GRAPH_VERSION=v24.0 (supported until 2028-02-18; leave as is), WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_VERIFY_TOKEN, WHATSAPP_APP_SECRET (App B). Redeploy and wait for it to be healthy BEFORE step 15.
15. App B > WhatsApp > Configuration > Webhook > Edit. Callback URL = https://bmapz-production.up.railway.app/<WhatsApp webhook path from the code auditor> (switch to https://api.bmapz.com/... only after DNS and TLS work; Meta supports a single callback). Verify token = the WHATSAPP_VERIFY_TOKEN value. Click Verify and save, then Webhook fields > Manage > subscribe 'messages'. If no events ever arrive, also subscribe the WABA to the app: POST https://graph.facebook.com/v24.0/<WABA_ID>/subscribed_apps with the system-user token.
16. For Page/Instagram messaging webhooks on App A: Dashboard > Webhooks, subscribe the Page and Instagram objects to messages, using the backend route and verify token from the code auditor (route not supplied; open item).
PART 5 - TESTS (no review needed). 17. TEST OAuth: from https://ai.bmapz.com, signed in as the app admin, click Connect Meta. Expect Page, Instagram and ad-account assets. Check granted scopes with https://graph.facebook.com/v24.0/debug_token?input_token=<USER_TOKEN>&access_token=<APP_ID>|<APP_SECRET> ; then /me/accounts, /<PAGE_ID>?fields=instagram_business_account, /me/adaccounts.
18. TEST WhatsApp out: POST https://graph.facebook.com/v24.0/<PHONE_NUMBER_ID>/messages, header Authorization: Bearer <WHATSAPP_ACCESS_TOKEN>, body {"messaging_product":"whatsapp","to":"<digits only, country code, no +>","type":"template","template":{"name":"hello_world","language":{"code":"en_US"}}}. TEST in: reply from your phone and confirm the backend accepted the X-Hub-Signature-256 check (it must use WHATSAPP_APP_SECRET of App B and the RAW body).
19. Run the write path tests (Page post, Instagram media + media_publish) with the Page token. These calls also satisfy the 'one successful call per permission within 30 days' review rule, so run one call for EACH of the 11 permissions and note the date.
PART 6 - CUSTOMER LAUNCH (weeks, start in parallel on day 1). 20. Start Business Verification immediately: https://business.facebook.com/settings > Security Center > Start verification. Use legal name, address and phone matching your registration documents (business country unknown, document list differs by country). Meta publishes no SLA; expect days to weeks.
21. Record one 1080p-or-better screen recording per permission (11 files, English UI, show a user granting the permission and the app using it), write reviewer instructions, create a non-personal test login. Keep the 15-day Marketing API traffic going in parallel (500+ ads_read/ads_management calls, under 15% errors).
22. App A > App Review > Permissions and features > Request advanced access for each permission, answer Data Use Checkup questions, Submit for review. Decision window: officially a week, realistically 1-3 weeks; handle rejection with the AI Developer Assistant first (Meta moved support there from tickets by mid-September per ppc.land) and resubmit.
23. After approval: Marketing API Access Tier > Upgrade (once 500 calls/15 days and error rate under 15% are met). For production WhatsApp: add and verify a real phone number, display name, 2-step PIN, payment method in WhatsApp Manager.

**Things that commonly break the FIRST connect:**
- Wrong app type or use-case choice at creation: use cases cannot be removed, 'Authenticate and request data from users with Facebook Login' is incompatible with 'Manage everything on your Page', and Instagram Facebook-Login products need a Business-type app. Fix is delete and recreate.
- A business portfolio is mandatory for this build (app accesses data Bmapz does not own; the WhatsApp quickstart also forces select-or-create a portfolio). Business Verification and portfolio legal name must match later.
- Redirect URI must match exactly under Strict Mode. Register BOTH https://api.bmapz.com/api/oauth/meta/callback and https://bmapz-production.up.railway.app/api/oauth/meta/callback under Facebook Login for Business > Settings > Client OAuth Settings, and the redirect_uri sent in the dialog must be byte-identical to the one used in the code-for-token exchange. api.bmapz.com cannot be used until its DNS and TLS certificate are live (Enforce HTTPS); use the Railway host until then. Provider segment 'meta' is assumed.
- scope vs config_id: the Instagram Facebook-Login doc shows scope is still used, the generic FLB doc says config_id replaced scope. Try scope first; if permissions are missing, create a configuration with token type User access token.
- Token type: FLB can return a User token or a Business Integration System User token; a backend written for a short-lived user token plus long-lived exchange will break on a system-user token. Choose User token in the configuration.
- Connecting Facebook user must hold an ACCEPTED role on the app, a Page task (admin or equivalent), an Instagram Business/Creator account connected to that Page, and ad account access; otherwise OAuth succeeds with empty assets or fewer granted scopes.
- One app vs two secrets: if WhatsApp is in a separate app (recommended) WHATSAPP_APP_SECRET must be that app's secret; using META_APP_SECRET makes every webhook signature check fail silently.
- WhatsApp webhook route path in the backend is unknown to me; GET must answer 200 with the bare hub.challenge, POST signature must be computed over the raw body, valid public TLS needed, only one callback URL allowed per app, and the field 'messages' must be subscribed (plus WABA subscribed_apps if no events).
- WhatsApp temporary API Setup token dies within hours; use the System User token (needs both app and WABA assigned). Test number only reaches 5 allowlisted recipients, and outside a 24-hour window only template messages (hello_world) are allowed.
- Webhook delivery in Development mode: community reports say some webhooks, and production-number webhooks, are not delivered until the app is Live; Business-type apps may have no toggle. Unconfirmed officially.
- Marketing API development tier (score 60, 300s block) will throttle any sync loop; upgrade is usage-gated (500 calls/15 days, under 15% errors).
- Public pages must stay reachable without login with the exact case-sensitive paths (/PrivacyPolicy, /TermsOfService, /DataDeletion); Basic settings need privacy URL and a data-deletion URL or callback or the app cannot be published/submitted.
- Embedded Signup v2 is deprecated 2026-10-15: matters only if Bmapz plans customer-owned WhatsApp numbers.

**Not confirmed from an official source (re-check against the live console before relying on it):**
- Per-permission access levels could not be read: permission reference pages returned HTTP 500 for both previous researchers, and I did not retry the new /documentation/development/permissions URL that appeared in search results. The Customize use case screen is the authority.
- The fetch tool returns model-summarised and sometimes Portuguese-translated pages; version dates and key requirements were cross-checked across two pages each, but exact sentences are paraphrased and not guaranteed verbatim.
- No official Meta page found that states the 20-day App Review expectation; it comes from bundle.social and singhamandeep.com (third-party). The official guide still says within a week.
- Business Verification: no official SLA, no official country list, no official sole-proprietor guidance found. Whether Derek's business entity country affects document types, Tech Provider eligibility, WhatsApp billing currency (Brazil BRL localisation since 2026-07-01) or availability is unknown.
- Use-case compatibility matrix for Page + Instagram + Marketing API (and WhatsApp) in one app is not published; only the Facebook Login vs Page incompatibility is documented. My two-app recommendation is a judgment call.
- Whether 'Never' is still offered as System User token expiry, and any limit on system users for an unverified portfolio, was not confirmed from the docs fetched.
- Whether Business-type apps have a Development/Live toggle today and whether Live mode is required for WhatsApp production-number webhooks and for Page/Instagram messaging webhooks from non-role users was not confirmed from official docs.
- Whether a second business portfolio is required for the user-token flow: I judged no, from the FLB wording that ties the client portfolio to the system-user token flow; not proven.
- The 2-portfolios-per-person creation cap comes from a Vonage support article, not Meta.
- Whether the 5 test-recipient limit and 'no payment method for test WABA' still hold: confirmed only by secondary sources and the previous verifier, not an official page fetched today.
- Whether production WhatsApp sending requires a payment method before the first message: official pages fetched did not say.
- Callback provider key is assumed to be 'meta'; the WhatsApp and Page/Instagram webhook route paths and whether the backend implements a data-deletion callback are unknown (code not read by design).
- Embedded Signup v3 deprecation date is unconfirmed (v2 is 2026-10-15 officially).
- Changes since 2026-09-23: I found NO official Meta policy, pricing, or version change dated between 2026-09-23 and 2026-10-06. Graph API still tops out at v26.0 (2026-07-29); the WhatsApp changelog's latest entry I could see is 2026-05-12. Nothing in Meta's docs can be diffed against 09-23, so absence of evidence is not proof. New or newly relevant items: Embedded Signup v2 deprecation on 2026-10-15 (9 days out), Meta's AI developer assistant replacing support tickets (mid-September per ppc.land), September community reports of Business Verification delays, WhatsApp rate changes effective 2026-10-01 for nine non-US countries (deadline already passed).
- Console labels (Use cases, Facebook Login for Business > Settings, Security Center path, Business settings paths) were not re-verified because they sit behind login and Meta redesigns them often; treat click paths as best current knowledge and stop on any mismatch.

---

## LinkedIn and X (Twitter)

**Railway variables:** `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_API_VERSION (default 202606)`, `(optional) LINKEDIN_ADS_WRITE=true`, `TWITTER_CLIENT_ID`, `TWITTER_CLIENT_SECRET`

**Redirect / callback URLs to register:**
- https://api.bmapz.com/api/oauth/linkedin/callback
- https://api.bmapz.com/api/oauth/twitter/callback
- (and the bmapz-production.up.railway.app equivalents while testing)

**Press Test on:** `linkedin`, `linkedin_ads`, `twitter`

**What the code now does differently (read before you connect):**
- X: a failed post used to be recorded as PUBLISHED; success is now HTTP 201 with an id. Access tokens last ~2 hours and are now refreshed (refresh tokens rotate and the new one is stored). PKCE is S256.
- X is PAY-PER-USE: $0.015 per post and $0.20 per post containing a link, charged to Bmapz's prepaid credits for EVERY customer post. Decide who pays and set a spend limit BEFORE offering X posting.
- LinkedIn: posting and ads share one stored token, and LinkedIn invalidates an older token when a different scope set is granted. Authorisation now requests the union, and records the granted scopes so the test can tell "connected" from "cannot post".
- LinkedIn ads creation bodies are known-incomplete (runSchedule, locale, targeting, x-restli-id header): not usable until the Advertising API is approved and the adapter is fixed against a real account.

**Testable today with no human review?** Yes. Split by flow. (1) LinkedIn sign-in plus member posting: yes, no LinkedIn review, as soon as a LinkedIn Page exists, the app is created and the Page super admin verifies it (Derek self-approves if he creates the Page), then both self-serve products are added. Any LinkedIn member can then consent; there is no tester allowlist. (2) X OAuth plus posting: yes, no review; credentials are instant, but a post call needs credits. Since 2026-10-02 saving a first eligible card yields $20 credit (about 1,300 plain posts or 100 link posts), so end-to-end can be tested for about $0 if the card is eligible, otherwise buy credits (minimum unknown). A card is required either way and Derek must enter it himself. (3) LinkedIn Ads (r_ads, r_ads_reporting): NO, blocked until Advertising API approval; keep that connect behind a flag. Bottom line: sign-in, member posting and X posting are testable the same day; Ads is not.

**What a customer launch needs** (LinkedIn sign-in/posting and X posting: 1 working day of Derek time (about 1.5 to 3 hours of console work) if a Page exists and the Page super admin is Derek. Add a few days if the Page must be created and matured or a bmapz.com mailbox is missing. LinkedIn Ads: plan 2 to 6 weeks from submission (no published SLA; 21-day survey deadline; third-party reports range from 1-5 business days to 3-4 months), with rejection risk. Overall customer launch for posting: days; for ads reporting: weeks.):
- LinkedIn sign-in and member posting: Page + verified app + two self-serve products + both redirect URIs registered + app is public (no review needed for any member to consent).
- X posting: Web App with both callback URIs, funded credits with a spend limit and a plan for who pays (Bmapz pays $0.015 per plain post and $0.20 per link post for every customer post).
- LinkedIn Ads reporting: Advertising API access request approved at Development tier (business email on bmapz.com, legal-entity, website, privacy policy, Page of the same organization; survey completed within 21 days). Standard tier NOT needed for read-only; rejection forces a new app (new client id/secret).
- Re-consent flow for 60-day LinkedIn tokens (no programmatic refresh) and a stable scope set to avoid token invalidation.
- Compliance: LinkedIn data storage limits (48h/24h member data, 1 year ad reporting data) and deletion on member request; no export of member data to customers.
- Not in current scope: posting to Company Pages needs Community Management API (separate app, legal-entity review, screen recording for Standard tier).

**Costs and waits:**
- LinkedIn app creation, Sign In with LinkedIn (OIDC), Share on LinkedIn: **No fee found in docs** - Self-service; no published fee or SLA.
- LinkedIn Advertising API access (Development tier): **No fee found in docs; wait: no published SLA** - 21-day survey deadline is official; third-party reports 1 business day to 3-4 months. Ad spend itself is separate and not an API fee.
- LinkedIn Advertising API Standard tier upgrade: **No fee found; wait: up to 30 business days (official, partner support guide)** - Not needed for read-only reporting; analytics-only upgrade requests are rejected.
- LinkedIn Community Management API (Company Page posting, future): **No fee found; wait: no published SLA** - Needs a separate app, legal-entity review, and a screen recording for Standard tier.
- X API Post: Create: **$0.015 per request** - Paid by Bmapz from prepaid credits for every customer post.
- X API Post: Create containing a URL: **$0.200 per request** - 13 times the plain rate; most marketing posts include links.
- X API Post read / User read / Owned Read / DM Event read: **$0.005 / $0.010 / $0.001 / $0.010 per resource** - Monthly cap 3 million Post reads on pay-per-usage; higher volume requires an Enterprise plan.
- X credit top-up: **Minimum not published (third-party snippet says $5)** - Credits bought upfront in console.x.com; set a per-cycle spend limit; auto-recharge at most every 5 minutes and paused at zero balance.
- X free credit incentive (new 2026-10-02): **-$20 one-time credit on saving first eligible card; first auto-recharge matched up to $50** - Eligibility rules not published; may depend on country.
- X subscription tiers (Free/Basic/Pro): **Not available to new developers per secondary sources** - Official pricing page shows pay-per-usage only.

**Changed since the first research (2026-09-23):**
- X added a free-credit incentive: one-time $20 credits when an account saves its first eligible payment card, plus a match of the first auto-recharge up to $50 (changelog entry dated 2026-10-02, also on the pricing page). -> The earlier 'no free path, budget $5-10' advice is outdated: a first end-to-end X test can cost $0 if the card is eligible. A card is still mandatory, and 'no free tier' remains true.
- LinkedIn Marketing version 202510 now sunsets in 9 days (2026-10-15); 202511 follows on 2026-11-16. The prior report said 'about three weeks'. -> Any script, Postman collection or fallback config still sending 202510/202511 breaks. Bmapz's pinned 202606 is unaffected (Active until 2027-06-15); latest is 202609 (until 2027-09-15).
- No LinkedIn policy, pricing, scope or console change dated after 2026-09-23 was found; the versioning and migrations pages were last updated 2026-09-16 and the increasing-access page 2026-07-28. -> The LinkedIn conclusions (self-serve sign-in/posting, vetted Advertising API, Development tier) are current as of 2026-10-06 per the fetched docs, but absence of later changes cannot be proven.

**Step by step (verified):**

PREP A. Make sure a mailbox on your own domain exists (for example derek@bmapz.com via the Hostinger mail you already have: MX mx1/mx2.hostinger.com). LinkedIn's Advertising vetting verifies a business email and rejects personal Gmail. No DNS change is needed for LinkedIn or X, and do not add a second SPF record.
PREP B. Have a company X account ready (not a personal one) and a payment card you will enter yourself in the X console.
LINKEDIN 1. Signed in to LinkedIn as the person who will be super admin, create the Bmapz Page at https://www.linkedin.com/company/setup/new/ (type Company). Use the real company name 'Bmapz' and website https://ai.bmapz.com (or https://bmapz.com if it resolves). The Page choice is permanent and must belong to the same organization you will describe to LinkedIn.
LINKEDIN 2. Go to https://www.linkedin.com/developers/apps/new . App name: Bmapz AI (do not include the words LinkedIn or Microsoft). LinkedIn Page: select the Bmapz Page. Privacy policy URL: https://ai.bmapz.com/PrivacyPolicy . App logo: upload the Bmapz logo. Tick the legal terms. Click Create app.
LINKEDIN 3. Open the app, Settings tab, click Verify, generate the verification URL, open it while signed in as the Page super admin and approve. Confirm the app shows as verified. Do this before step 4.
LINKEDIN 4. Products tab: click Request access (Add) on 'Sign In with LinkedIn using OpenID Connect' and on 'Share on LinkedIn'. Then open the Auth tab and confirm the OAuth 2.0 scopes list shows openid, profile, email and w_member_social. Do not continue until all four appear.
LINKEDIN 5. Auth tab, 'Authorized redirect URLs for your app', add and save BOTH: https://api.bmapz.com/api/oauth/linkedin/callback and https://bmapz-production.up.railway.app/api/oauth/linkedin/callback . No trailing slash, no query, no #. (Confirm with the code audit that the provider path segment really is 'linkedin'.)
LINKEDIN 6. Auth tab, Application credentials: copy Client ID and Primary Client Secret. In Railway, Variables, set LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET and LINKEDIN_API_VERSION=202609 (202606 also works until 2027-06-15; never 202510 or 202511). Paste secrets directly into Railway, not into chat or email. Redeploy.
LINKEDIN 7. Test from https://ai.bmapz.com: connect LinkedIn, consent, confirm sign-in returns name/email, then publish one short text post and delete it on LinkedIn. Optional token check: https://www.linkedin.com/developers/tools/oauth/token-inspector .
LINKEDIN 8 (only after 7 works; start the clock then). Products tab, Advertising API, Request access. Read https://learn.microsoft.com/en-us/linkedin/marketing/restricted-use-cases first. Complete the access form and the vetting survey within 21 days using your bmapz.com business email, legal company name and address, website https://ai.bmapz.com, privacy policy https://ai.bmapz.com/PrivacyPolicy . Describe the use case as read-only ad account reporting for customers who authorize with their own LinkedIn logins. Do NOT apply for Standard tier. Do NOT add Community Management API to this app. Watch the email inbox for reviewer follow-ups.
LINKEDIN 9 (after Ads shows Approved). Create or confirm a Campaign Manager ad account at https://www.linkedin.com/campaignmanager/accounts for your own login (needed to test r_ads). If connect still fails for read access, add the 9-digit ad account id under Products, View Ad Accounts, Add Ad Account. Then enable the ads connect with the single union scope set 'openid profile email w_member_social r_ads r_ads_reporting' so tokens are not invalidated by scope changes, and re-consent once.
X 1. Sign in at https://console.x.com with the company X account and accept the Developer Agreement.
X 2. Create App: name 'Bmapz AI', description and use case (scheduling and publishing social posts on behalf of users who connect their own X accounts). If the console asks for a Project, create one named Bmapz.
X 3. In the app open User authentication settings, turn on OAuth 2.0. App type: Web App (confidential client, issues a Client Secret). If shown, App permissions: Read and write. Callback URI / Redirect URL: add both https://api.bmapz.com/api/oauth/twitter/callback and https://bmapz-production.up.railway.app/api/oauth/twitter/callback (exact, no trailing slash). Website URL: https://ai.bmapz.com . Terms of service: https://ai.bmapz.com/TermsOfService . Privacy policy: https://ai.bmapz.com/PrivacyPolicy . Save. (Confirm with the code audit that the provider path segment really is 'twitter'.)
X 4. Keys and tokens: copy the OAuth 2.0 Client ID and generate/copy the Client Secret immediately (shown once). In Railway set TWITTER_CLIENT_ID and TWITTER_CLIENT_SECRET. Redeploy. If you lose the secret, regenerate it and update Railway at once.
X 5. Billing in the console: save your card (you enter it yourself) to receive the one-time $20 credit if the card is eligible; otherwise buy the smallest credit amount offered. Set a maximum spend per billing cycle (suggest $25 for testing). Leave auto-recharge off until you know your volume. Decide who pays: every customer post costs Bmapz $0.015, or $0.20 if it contains a link.
X 6. Test from https://ai.bmapz.com: connect X with scope 'tweet.read tweet.write users.read offline.access', confirm the app stores a refresh token, post one plain text test with NO link, then delete it on X. Check the credit balance dropped by about $0.015.
BOTH 7. Copy back to Claude (not secrets): the LinkedIn Page URL, a screenshot of the LinkedIn Auth tab scopes and Products statuses, the Advertising API status (Pending/Approved/Denied), the X app type shown, whether the X $20 credit appeared, and any error text from the first connect.

**Things that commonly break the FIRST connect:**
- No LinkedIn Page exists, or Derek is not its super admin: the app cannot be created/verified. The Page must be the real Bmapz organization (a Page of a different organization is a listed denial reason for Ads) and the association is permanent.
- App not yet verified by the Page super admin: treat products and Advertising request as blocked until verification is done (30-day window).
- Redirect URI mismatch: the exact callback sent (api.bmapz.com is not live until DNS is done) must be registered on both platforms. Register both hosts on LinkedIn (401 Redirect_uri doesn't match / 400 invalid_redirect_uri) and X (exact match including trailing slash).
- LinkedIn scopes requested before products are added: any scope not on the Auth tab (r_ads, r_ads_reporting, or openid before the OIDC product) returns 401 Invalid scope for the whole request. Keep ads scopes behind a flag until Ads is approved.
- LinkedIn scope-set changes invalidate earlier tokens and force re-consent; separate connects with different scopes can break each other. Use one stable scope set per member.
- LINKEDIN_API_VERSION unset, deprecated or sunset (202510 sunsets 2026-10-15, 202511 on 2026-11-16) returns an error; no default version is applied.
- LinkedIn access tokens last 60 days and no programmatic refresh is available to this app: schedule re-consent prompts.
- Advertising API: personal Gmail, no legal entity, wrong Page, app name containing LinkedIn/Microsoft, or survey not finished within 21 days causes rejection or 'Insufficient Details'; a rejection can require a brand-new app (new client id/secret, new Page verification).
- Community Management API (Company Page posting) cannot coexist with other products on one app and is not covered by current scopes.
- X: no credits means posting fails and requests are blocked at zero balance; a card is required. Spend is paid by Bmapz per customer post.
- X: wrong app type (Native/SPA) means no Client Secret is issued; secret is shown only once, so regenerating invalidates the one already in Railway.
- X: scope list must include offline.access or the token dies in about 2 hours with no refresh token. The authorization code reportedly expires within 30 seconds, so the callback must exchange it immediately. Use api.x.com for the token endpoint.
- X refresh-token rotation/lifetime undocumented: persist the newest refresh_token on every refresh or users get silently disconnected.
- Callbacks live on the backend host (api.bmapz.com or Railway), not on https://ai.bmapz.com; the backend must redirect the browser back to the app origin after storing tokens.

**Not confirmed from an official source (re-check against the live console before relying on it):**
- Advertising API Development-tier review time: no official SLA. Third-party sources range from 1-5 business days to 4-8 weeks to 3-4 months; my 2-6 weeks is an estimate. Official figures: 21-day survey window; up to 30 business days only for the Standard-tier upgrade.
- Whether the legal-entity and business-email vetting applies identically to the Advertising API as to Community Management: official explicit text is on the Community Management page; the Ads application is covered only by the generic status-definitions and partner-support pages.
- Business entity country is unknown: LinkedIn's registered-organization check and X's definition of an 'eligible payment card' (for the $20 credit) may depend on country. Not confirmed anywhere.
- X minimum credit purchase: not stated in official docs (a search snippet says $5). Credit expiry and refund terms not documented in pages fetched.
- X refresh-token lifetime and whether refresh tokens rotate on each use: not found in the fetched docs.
- X console exact labels (OAuth 2.0 settings, App permissions control, Projects requirement, Keys and tokens) could not be seen first-hand; the steps use doc wording and may differ slightly on screen.
- X free-tier closure and legacy Basic/Pro migration dates (2026-02-06, 2026-06-01, 2026-09-01) come from third-party sources; the official X developer community thread returned HTTP 403. The official pricing page confirms only pay-per-usage with no subscriptions.
- Does GET /2/users/me with a customer token bill as User Read ($0.010) or an Owned Read ($0.001)? Docs say owned reads are your own app's own data; unclear for customer-token calls.
- LinkedIn: official text confirms the Page super admin has 30 days to approve; the Settings > Verify > Generate URL navigation and the 'denial invalidates all generated links' claim were not confirmed.
- LinkedIn: whether /rest/posts with only the self-serve Share on LinkedIn product (w_member_social) works without Community Management API is supported by secondary sources only; the Posts API page lists the permission but not the product gating.
- LinkedIn: whether Development tier needs each customer's ad account mapped in the portal for read-only access is ambiguous (getting-started says mapping is required for Development tier; increasing-access and partner guide say reads are unlimited).
- LinkedIn Page creation prerequisites for a brand-new personal account (profile age, connections) were not verified.
- Whether a LinkedIn Company Page website field must match the bmapz.com email domain exactly (bmapz.com vs ai.bmapz.com subdomain) is not stated.
- api.twitter.com was only tested for reachability (HTTP 400 on a deliberately invalid request), not for a successful token exchange; X could stop serving it without notice.
- No LinkedIn or X policy change dated after 2026-09-23 was found other than the X 2026-10-02 credit incentive; absence of other changes is not proven.
- Callback path segment names (linkedin, twitter) were assumed from env var names; verify against the backend route names.

---

## TikTok and Canva

**Railway variables:** `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `CANVA_CLIENT_ID`, `CANVA_CLIENT_SECRET`, `CANVA_IMPORT_ALLOWED_HOSTS`

**Redirect / callback URLs to register:**
- https://api.bmapz.com/api/oauth/tiktok/callback
- https://api.bmapz.com/api/oauth/canva/callback
- (register both hosts where the console allows several; Canva needs the redirect_uri sent explicitly when there are two, which the code does)

**Press Test on:** `tiktok_social`, `canva`, `(tiktok_ads is EXPECTED to fail and says why)`

**What the code now does differently (read before you connect):**
- TikTok access tokens last 24 hours; the refresh token is now stored and used (before, every connection died a day after it was made).
- TikTok publishing is NOT implemented: a post targeting TikTok now fails with a plain message instead of being marked published.
- TikTok Ads cannot work with the Login Kit token. The TikTok Business API is a separate program with its own app and connect flow, which is not built.
- Canva is platform-app-only. The design picker needs the design:meta:read scope: tick it in the Canva developer portal too, then reconnect.

**Testable today with no human review?** Yes. Yes, but only on narrow paths, and NOT for customers or ads. (1) CANVA: self-service; create a PUBLIC-type app, ticking the 5 scopes and registering the redirect URL gives a Client ID/secret at once, and the owner's own Canva account (or members of the owning Canva team) can run the full OAuth+PKCE connect, refresh rotation, asset upload and import. Based on the official Quickstart (no review step) plus the Brand-Restricted default; the pre-review audience sentence is not found verbatim, so it is a strong inference. People outside our Canva team cannot be expected to connect. (2) TIKTOK: only via a Sandbox ('without having to submit your app for review'). Add Login Kit + Content Posting API with Direct Post, register the HTTPS redirect URIs, add your own TikTok account as a target user (needs that account's login, max 10), and set that TikTok account to PRIVATE (otherwise the publish is blocked with unaudited_client_can_only_post_to_private_accounts). The post will be private. Production client key cannot call APIs before approval. video.list in sandbox is unverified. (3) TIKTOK BUSINESS/ADS: NOT testable today without the separate developer-app review (2-3 business days per search extracts of the official docs; third-party for older guide) and a TikTok For Business account; there is no confirmed self-serve sandbox. So: Canva owner-flow = yes; TikTok sandbox login+private post = yes; any real customer on either platform = no; TikTok ads = no.

**What a customer launch needs** (Canva: 1-4 weeks after a clean submission (no SLA; plan for at least one rework round). TikTok: app review about 1-2 weeks, then audit 2-6 weeks, so 3-8 weeks before customers can publish publicly; Login Kit sign-in itself can go live after step 1. TikTok ads (optional): add about 1 week if started in parallel. Everything runs in parallel, so the whole group is realistically 4-8 weeks from submission, with the audit as the long pole. Day-0 work (accounts, console setup, URL verification, sandbox tests, demo video) is about 4-6 hours spread across the TikTok propagation wait.):
- CANVA: submit the integration (created as PUBLIC) for Canva review and get it approved; before submitting: no local/127.0.0.1 redirect URLs, at least one valid redirect URL, marketplace listing text and graphics, platform documentation, a working test login for Bmapz (reviewers must be able to log in to ai.bmapz.com), reliable (non-free) hosting, no Preview-API endpoints, and Apps Marketplace developer verification (name, email, phone, physical address, registration details, identity document proving identity/legal entity). Review has no published duration.
- TIKTOK step 1 - App review for Login Kit + Content Posting: verified URL properties (Terms, Privacy, Web URL, and any pull-from URLs), a fully developed live website at https://ai.bmapz.com with Privacy/Terms links visible without opening menus, 1-5 demo videos (max 50 MB each) clearly showing every requested product and scope, a Web redirect URI, and a compliant posting UI built from the creator_info response. Official time: several days to two weeks.
- TIKTOK step 2 - Content Posting API audit (apply at https://developers.tiktok.com/application/content-posting-api) to lift SELF_ONLY and the 5-users-per-24h cap. No official SLA; third-party reports say 2-6 weeks or 'weeks, and variable'. Until it passes, every customer post is private and at most 5 customers can post per 24h.
- TIKTOK ADS (only if shipping): separate registration and developer-app review on https://business-api.tiktok.com/portal (about 2-3 business days per search extracts; official page not directly readable), a TikTok For Business account, likely company-domain email/website (unverified), and answering that the app is used by external accounts. Each customer then authorizes their advertiser account.
- Operator-side: a company-owned TikTok developer account/organization and Canva account (not personal), the business entity's legal details and ID for Canva developer verification, and DNS access at the registrar panel for TikTok URL verification (add as a NEW TXT record; do not touch the single SPF TXT).
- Decisions: whether to ship TikTok ads at launch (recommendation: NO, defer; it is a separate program and the env var list for this group has no ads app id/secret) and whether to keep video.list (recommendation: drop unless the UI shows the user's videos).

**Costs and waits:**
- TikTok app review (Login Kit + Content Posting): **No fee found** - Wait: 'several days to two weeks' (official FAQ). Docs are silent on fees, which is not proof of none.
- TikTok Content Posting API audit: **No fee found** - No published SLA. Third-party: 'weeks, and variable' / 2-6 weeks.
- TikTok sandbox: **No fee found** - Up to 5 sandboxes, 10 target users each; setup hours (target user propagation up to an hour, unverified today).
- TikTok API for Business developer app: **No developer fee found; needs a TikTok For Business account** - Review 2-3 business days (search extract of official docs / older integrator guide). Whether an ad account with spend is needed is unverified. Official pages not readable (JS-rendered).
- Canva public integration (create + submit + review): **No fee found; no paid Canva plan needed for a public integration (search extract, not a fetched sentence)** - Review has no published duration: 'It's not practical for us to provide an average or expected duration'. Marketplace listing, if applicable, is added manually 'typically within a week' after release (apps surface; unconfirmed for REST-only).
- Canva PRIVATE integration: **Requires a Canva Enterprise plan (price not published; contact sales)** - NOT recommended: team-only and cannot be converted to public.
- Canva developer verification: **No fee stated** - Requires name, email, phone, address, registration details and an identity document; verification time not stated.
- DNS TXT verification record for TikTok: **None** - Added at the registrar panel; keep exactly one SPF record.

**Step by step (verified):**

0. DO THESE FIRST (15 min, unblocks everything): (a) Use a COMPANY-owned Google/email identity for both consoles, not a personal one. (b) Make sure https://ai.bmapz.com (the root page, not just /PrivacyPolicy) shows visible footer links to https://ai.bmapz.com/PrivacyPolicy and https://ai.bmapz.com/TermsOfService without opening a menu; TikTok review requires them visible on a fully developed website. (c) Set the TikTok test account to PRIVATE (TikTok app > Settings and privacy > Privacy > Private account).
CANVA 1. Go to https://www.canva.dev/ and click 'Developer Portal'; sign in with the company-owned Canva account that will own the app. If Canva prompts you to turn on multi-factor authentication, do it (older docs required it; not confirmed in today's pages).
CANVA 2. Create a new app using the 'Canva for your platform' / REST APIs surface. When asked for the type choose PUBLIC, never Private (Private needs an Enterprise plan, works for your own team only and cannot be changed later). Name it 'Bmapz AI'.
CANVA 3. Open Outside Canva > Configuration > Credentials. Copy Client ID -> Railway variable CANVA_CLIENT_ID. Click 'Generate secret', copy it immediately -> CANVA_CLIENT_SECRET (assume it is shown only once).
CANVA 4. Same page, scopes: tick design:content = Read and Write, asset = Read and Write, profile = Read. Do not tick the extra design:meta or brandtemplate:* scopes that the Canva sample app shows (the app requests only the 5 scopes; extra ones weaken the review).
CANVA 5. Open Outside Canva > Redirect URLs. Add URL 1: https://api.bmapz.com/api/oauth/canva/callback and URL 2: https://bmapz-production.up.railway.app/api/oauth/canva/callback. The maximum number of URLs is undocumented: if the portal accepts only one, enter the Railway one now and swap to api.bmapz.com when the domain is live. Never add 127.0.0.1 or localhost (it blocks submission). With two URLs the backend MUST send redirect_uri on both the authorize and token calls.
CANVA 6. Railway: set CANVA_IMPORT_ALLOWED_HOSTS to the public hostname(s) that serve files Canva will fetch (exact format: ask the code auditor). Open one such file URL in a private browser window to prove it needs no login.
CANVA 7. TEST from https://ai.bmapz.com with YOUR OWN Canva account (the owner). Expect: connect succeeds, profile works, refresh gives a new refresh token and the old one fails, asset/design import by URL completes. Do NOT test with another person's Canva account unless they are a member of your Canva team; others are expected to fail until approval. Copy back to me: the exact error text of any failure.
CANVA 8. Before submitting, check every Canva endpoint Bmapz calls in its reference page for a 'Preview' badge; a public app using Preview APIs cannot pass review. Then in the app's left menu choose Submit for review and provide: listing text and graphics, a test login for Bmapz, platform documentation, and the developer verification details (name, email, phone, physical address, registration details, ID document). Copy back: the submission date and any Canva feedback.
TIKTOK 1. Go to https://developers.tiktok.com/ and sign in with the company email. Developer Portal > My organizations > Create organization (use the full legal business name; it cannot be renamed and is shown to TikTok users). Then Manage apps > Connect an app, owner = the organization, platform = Web.
TIKTOK 2. Fill the app form: name Bmapz AI; icon 1024x1024 JPG/PNG up to 5 MB; category; description; Web/website URL https://ai.bmapz.com ; Terms of Service URL https://ai.bmapz.com/TermsOfService ; Privacy Policy URL https://ai.bmapz.com/PrivacyPolicy.
TIKTOK 3. Add products: Login Kit and Content Posting API. On Content Posting API enable the Direct Post configuration. Scopes: user.info.basic and video.publish. Add video.list ONLY if the Bmapz screen really shows the user's TikTok videos and the demo video will show it; otherwise leave it off.
TIKTOK 4. Under Login Kit (Web) add Redirect URIs, exactly: https://api.bmapz.com/api/oauth/tiktok/callback and https://bmapz-production.up.railway.app/api/oauth/tiktok/callback (https, no trailing slash, no query, no #; limit 10). The authorize URL is https://www.tiktok.com/v2/auth/authorize/ and scopes in it are COMMA-separated.
TIKTOK 5. Click 'URL properties' at the top of the app page and verify https://ai.bmapz.com (and the Privacy and Terms URLs, plus any storage/CDN host the code uses with PULL_FROM_URL). Follow the method the console shows; if it is a DNS TXT record, add it at the registrar panel as a NEW TXT record on the name TikTok shows and do NOT edit or duplicate the SPF TXT record. Copy back: whether it shows Verified.
TIKTOK 6. SANDBOX (can be done before review): on the app page flip the Sandbox toggle > Create Sandbox > name it > clone the production config > Confirm. In the sandbox add Login Kit, Content Posting API with Direct Post, the same scopes and the same two redirect URIs, then click Apply changes. Under Target users click Add account and log in with your PRIVATE test TikTok account; the list can take up to an hour to show.
TIKTOK 7. Open the sandbox's Credentials panel. Copy the Client key -> Railway TIKTOK_CLIENT_KEY and Client secret -> TIKTOK_CLIENT_SECRET. If the sandbox shows the same values as production, tell me; if production values are hidden until approval, that is expected. Keep the production values aside for after approval.
TIKTOK 8. TEST from https://ai.bmapz.com: connect (expect access token and open_id), user info, then a Direct Post. Expected result: the post appears as private/Only me on the private test account. If you see unaudited_client_can_only_post_to_private_accounts the TikTok account is not private. Also run the creator_info query first (required). Copy back: any error code from TikTok.
TIKTOK 9. Record 1-5 demo videos (max 50 MB each) showing login/consent, the composer built from creator_info (nickname, caption, privacy, interaction toggles, commercial-content disclosure), a preview, the consent text and the post, plus every requested scope in use. Click Submit for review on the PRODUCTION app. Wait: several days to two weeks. Copy back: date submitted and any rejection reason.
TIKTOK 10. After app review is approved: put the PRODUCTION client key/secret into Railway, then apply for the Content Posting API audit at https://developers.tiktok.com/application/content-posting-api (no SLA; plan 2-6 weeks). Until it passes, all posts are private and only 5 users per 24h can post; do not onboard customers for public posting before that.
TIKTOK ADS (DEFER unless advertiser features ship at launch): separate program at https://business-api.tiktok.com/portal . Register as a developer with a company email/website, create a developer app (docs: https://business-api.tiktok.com/portal/docs/create-a-developer-app/v1.3), choose that it serves external accounts, add the ads redirect URI(s) used by the code (confirm the exact path with the code auditor; I could not see it), wait about 2-3 business days, and copy back the App ID and Secret. Note: the group's env var list has no variable for these, so the code auditor must confirm where ads credentials are configured. The API version api/v1.3 is current.
ORDER OF WORK TODAY: TikTok console setup + URL verification + sandbox (start the one-hour target-user clock first) -> Canva console setup and own-account test while waiting -> record videos -> submit TikTok app review -> submit Canva review.

**Things that commonly break the FIRST connect:**
- TikTok production key cannot call any API before approval; testing with production credentials will look like a code bug. Use the sandbox credentials.
- TikTok unaudited posting: the target TikTok ACCOUNT must be private, else the publish call is blocked (unaudited_client_can_only_post_to_private_accounts). Posts that do succeed are private and capped at 5 users per 24h.
- TikTok sandbox target-user list can take up to an hour (unverified this session); authorizing a non-listed account fails.
- TikTok redirect URI must be byte-identical to a registered one: https only, no query, no fragment, under 512 chars, max 10; scopes in the authorize URL are comma-separated.
- TikTok URL verification (Terms, Privacy, Web URL, and pull-from domains) must be done before the review can be submitted; DNS TXT additions must not disturb the single SPF TXT record.
- TikTok review/audit rejection risks: ai.bmapz.com root page not showing Privacy/Terms links without a menu; composer not driven by creator_info; requesting scopes not shown in the demo (video.list); beta/incomplete app.
- TikTok Ads is a separate program (business-api.tiktok.com) with its own app id/secret and review; TIKTOK_CLIENT_KEY/SECRET will not work there. The env var list for this group contains no ads credential variable.
- Canva: only owners/team members can connect before approval; a customer outside our Canva team is expected to be rejected. Test with the owner's own Canva account.
- Canva: choosing Private instead of Public at app creation is irreversible, needs an Enterprise plan and makes customer launch impossible; the app would have to be recreated (new client id/secret).
- Canva: with two redirect URLs registered the backend must send redirect_uri explicitly; the max number of redirect URLs is undocumented, so if the second is rejected use the Railway URL first.
- Canva: PKCE S256 required; scopes space-separated and must be ticked in the portal; the secret is generated once; each refresh token is single-use so a rotation bug appears hours after a successful connect.
- Canva: any Preview-API endpoint in Bmapz's calls will fail public review; any local/127.0.0.1 redirect URL blocks submission; Marketplace developer verification needs an identity document and legal-entity details.
- Canva: possible MFA prompt before app creation (older docs; unconfirmed today).

**Not confirmed from an official source (re-check against the live console before relying on it):**
- Business entity country is unknown: TikTok API/product availability, TikTok for Business account/verification, and Canva developer verification (legal-entity document) can depend on country. Not checked.
- Canva: no official sentence found stating who may authorize an app before review; 'team members only' rests on a search extract of Canva's Creating-integrations text (Brand Restricted default) plus the 'public after review' wording. First attempt by a non-team user is the real test.
- Canva: whether Marketplace developer verification applies to REST-API-only public integrations is not stated; assume yes.
- Canva: maximum number of redirect URLs, HTTPS enforcement for non-local URLs, refresh-token lifetime and the exact access-token lifetime (4h) were not confirmed in today's pages.
- Canva: MFA requirement and the exact portal URL for the Developer Portal were not confirmed today (reach it from the canva.dev 'Developer Portal' link).
- Canva: which of Bmapz's endpoints (URL asset upload, URL design import) are Preview, and thus review-blocking, was not checked.
- TikTok: whether the sandbox has its own client key/secret, and whether production credentials are hidden until approval, is not stated by TikTok (a third-party doc says keys can be revealed 'once your App is Live').
- TikTok: whether video.list / Display API work in sandbox is unverified; video.list may be unnecessary.
- TikTok: the exact UX requirements the audit checks (nickname, preview, consent declaration, commercial-content toggles) were not re-fetched in full; only corroborated via a third-party 2026 write-up.
- TikTok: whether editing redirect URIs or config on an already-approved app triggers re-review is not stated; registering both callbacks before submission avoids the question.
- TikTok Business API: official portal pages are JS-rendered; registration eligibility (individual developer rejection, company email), approval time (2-3 business days), token lifetimes, and the existence of a Business API sandbox are only from third-party or search extracts. v1.3 current is medium confidence.
- TikTok Business API: the callback path the code uses for ads and the env vars holding the ads app id/secret are unknown (group env list shows only TIKTOK_CLIENT_KEY/SECRET). Code auditor must confirm.
- No TikTok policy change after 2026-09-23 was detected (key pages are headed 'last updated August 4, 2026'), but absence of evidence is not proof; Canva's changelog shows only unrelated entries (2026-09-23 GA of chart-data/video autofill; 2026-09-29 and 2026-10-01 new Preview generation APIs; 2026-09-21 Autofill opened to Pro/Teams).
- Calendar estimates for the TikTok audit and the Canva review are judgment based on third-party reports; neither platform publishes an SLA.

---

## Stripe (billing) and Resend (email)

**Railway variables:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_<STARTER|GROWTH|SCALE>_<MONTHLY|ANNUAL>`, `(optional) STRIPE_API_VERSION`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`

**Redirect / callback URLs to register:**
- Stripe webhook: https://api.bmapz.com/api/stripe/webhook (switch the existing endpoint's URL, do not add a second one)

**Press Test on:** `stripe`, `resend`

**What the code now does differently (read before you connect):**
- SNAPSHOT, not Thin: the dashboard wizard now defaults to Thin events, which this handler cannot read. The dashboard can only create an endpoint for the LATEST API version, so create it through the API with api_version=2024-06-20 to match the handler.
- Failed Resend sends used to be reported as sent, and the fallback sender noreply@bmapzai.com is a domain that does not resolve. RESEND_FROM_EMAIL must be an address on a domain verified in Resend (use a subdomain such as send.bmapz.com; the apex already has an SPF record and Hostinger mail).
- Webhook failures now make Stripe retry (they used to be acknowledged), unpaid/incomplete subscriptions are mapped onto the five statuses the table allows, and a delayed-payment checkout no longer grants the plan before the money arrives.
- Open: checkout.session.completed performs several non-atomic writes; making it transactional is the recorded follow-up.

**Testable today with no human review?** Yes. Yes, for everything except real money. Stripe: create a sandbox, reveal sk_test_ key, register a Snapshot webhook at https://bmapz-production.up.railway.app/api/stripe/webhook, and run test Checkout (card 4242 4242 4242 4242) or stripe trigger; nothing is reviewed. Resend: zero-DNS smoke test works at once with onboarding@resend.dev to the account owner's own address only; a full test to arbitrary recipients needs the verified subdomain, which is DNS-only and typically verifies in about 15 minutes (up to 72 hours), no reviewer. Not testable today: live charges (Stripe activation/KYC) and sending to the public from resend.dev. Two things can still make a 'green' test misleading: webhook payload API version differs from the version the handler was written for, and Thin (not Snapshot) selected in the wizard.

**What a customer launch needs** (Resend: same day (about 15 minutes to 72 hours after DNS records are saved). Stripe sandbox plus webhook: under half a day of work. Stripe live: depends entirely on activation review, no published SLA; unofficial sources say 1-5 business days, so plan about a week and allow 2+ weeks if Stripe asks for extra documents (country unknown).):
- Stripe business verification/activation submitted and cleared (business type, business and product details, representative identity, payout bank account, public business info); business country decided first because it cannot be changed after activation
- Live-mode Products and Prices created (live Price IDs will differ from sandbox) and wired into the app
- Live STRIPE_SECRET_KEY (sk_live_/rk_live_) and a NEW live-mode webhook endpoint created via API with api_version matching the handler, giving a NEW live whsec_ value; all set in Railway
- Resend subdomain verified with DNS records added in Hostinger hPanel, RESEND_API_KEY (preferably sending-only, domain-restricted) and RESEND_FROM_EMAIL on that subdomain
- One real low-value live subscription tested end to end, then refunded
- Webhook URL later switched to api.bmapz.com once that domain is stable (update the existing endpoint's URL rather than adding a second one, to avoid double deliveries)

**Costs and waits:**
- Stripe account, sandbox, API keys, webhooks: **$0** - Page states no setup fees and no monthly fees for standard pricing (source: stripe.com/pricing, Brazil-localised view).
- Stripe card processing (live): **Country-dependent; Brazil page shows 3.99% + R$0.39 domestic, +2% international** - US/other rates not confirmed because business country is unknown.
- Stripe Billing (subscriptions): **0.7% of Billing volume (pay-as-you-go) per the pricing page** - Applies on top of processing fees; Checkout and Payment Links are included with Payments; Checkout custom domain US$10/month if wanted (optional).
- Stripe dispute fee: **R$55.00 on the Brazil page** - Other countries differ; unconfirmed for Bmapz's country.
- Stripe live activation/KYC review: **No fee published** - No published SLA; unofficial reports 1-5 business days.
- Resend Free plan: **$0: 3,000 emails/month, 100/day, 3 domains, 30-day retention** - Source: resend.com/pricing fetched today. Daily cap can break signup loops.
- Resend Pro plan (needed if volume exceeds free caps): **$20/month for 50,000 emails; $35/month for 100,000** - Pro: no daily limit, 10 domains, 5 webhook endpoints (pricing page).
- Resend domain verification / DNS: **$0 from Resend; Hostinger zone editing assumed included with the domain** - Wait: usually about 15 minutes, up to 72 hours before status becomes failed.
- Wait: Stripe webhook retries: **n/a** - Live: retried up to 3 days with exponential backoff; manual resend in Dashboard up to 15 days, CLI up to 30 days (docs).

**Changed since the first research (2026-09-23):**
- Stripe released API version 2026-09-30.endive (new major release with many breaking changes) on 2026-09-30; it is now the 'current version'. -> New Stripe accounts and Dashboard-created webhook endpoints will default to it. billing.js still pins 2024-06-20 for requests, but webhook payloads follow the endpoint/account version, so an endpoint created in the Dashboard can send a different shape than the handler expects. Create the endpoint via API with api_version=2024-06-20.
- Thin events for v1 API resources became generally available with Endive, and the Workbench 'Create an event destination' wizard now asks for payload format with Thin marked recommended. -> Adds a step the 2026-09-23 runbook lacked; picking the default breaks a classic webhook handler. Must choose Snapshot.
- Stripe keys docs now steer new integrations to a separate general-purpose Sandbox instead of the account's test mode, and discourage unrestricted secret keys for new use cases (date of change unknown). -> Setup step 1-2 wording changes; sk_ still works but rk_ is preferred long-term.
- Resend's August 2026 DNS change (CNAME-based SPF for newly created domains) is already in effect today, as is the free plan's 3-domain allowance (changelog dated 2026-08-25). -> A domain added now is in the new bucket; do not pre-write DNS records, copy them from the Records tab.
- No Resend pricing, free-tier or sending-policy change dated after 2026-09-23 was found; the pricing page shows no announcement banner. A Stripe Projects integration was announced by Resend on 2026-09-22 (irrelevant to setup). -> None identified; free plan still 3,000/month and 100/day.

**Step by step (verified):**

ORDER: do Resend steps R1-R5 FIRST (DNS wait time runs in the background), then Stripe S1-S9. Total hands-on time about 60-90 minutes.
R1. Go to https://resend.com/domains and click Add Domain. Name: notify.bmapz.com (do NOT use send.bmapz.com, because Resend's Return-Path defaults to a 'send' label under the domain). Region: us-east-1 (default; pick another only if most users are in EU/Brazil/Japan; it is baked into the DNS records). Leave Return-Path as 'send'. Leave Sending enabled and do NOT enable Receiving.
R2. Open the new domain's Records tab. Expect either the classic set (TXT DKIM at resend._domainkey.notify; MX and TXT SPF at send.notify) or, for domains created after August 2026, CNAME records instead. Use ONLY what the tab shows. Classic example values for reference: MX send.notify -> feedback-smtp.us-east-1.amazonses.com priority 10; TXT send.notify -> "v=spf1 include:amazonses.com ~all"; TXT resend._domainkey.notify -> p=<long key>.
R3. DNS is at HOSTINGER (nameservers ns1/ns2.dns-parking.com), not Cloudflare. Log in to Hostinger hPanel (https://hpanel.hostinger.com), open Domains > bmapz.com > DNS / DNS Zone Editor (exact menu label not verified; it may be called DNS records or DNS Details). Add each Resend record: Type, Name, Content/Value, Priority (MX only), TTL default. In the Name field type ONLY the host part relative to bmapz.com (for example resend._domainkey.notify and send.notify), never the full name with .bmapz.com. If the MX value shows .bmapz.com appended after saving, re-save the value with a trailing dot. Do NOT touch the existing apex records (MX mx1/mx2.hostinger.com, apex SPF TXT, _dmarc TXT). Do NOT add another SPF or DMARC record at the apex. First scan the zone list for any existing notify or send records and remove conflicts (a CNAME cannot coexist with TXT/MX at the same name).
R4. Back in Resend click Verify DNS Records. Wait; usually about 15 minutes, up to 72 hours. If stuck, check from a terminal with: nslookup -type=TXT resend._domainkey.notify.bmapz.com 8.8.8.8 ; and use Restart verification. Status must read verified.
R5. Create the API key at https://resend.com/api-keys: Name bmapz-production, Permission Sending access, Domain notify.bmapz.com (permission/domain names as shown in the dialog). Copy the re_... value immediately (shown once) and paste it into Railway as RESEND_API_KEY. Set RESEND_FROM_EMAIL to the plain address noreply@notify.bmapz.com (not 'Name <addr>' unless the code audit confirms the code accepts a display name). Redeploy Railway. Optional: if the app supports Reply-To, point it at a Hostinger mailbox such as support@bmapz.com, since noreply@notify cannot receive mail.
R6. Smoke test: trigger one transactional email to your own inbox; in Gmail use Show original and confirm DKIM: PASS and SPF: PASS. Then one to a different address to prove the 403 limit is gone. Before the domain verifies, the only temporary fallback is RESEND_FROM_EMAIL=onboarding@resend.dev, which can email only the Resend account owner's address.
S1. Sign in at https://dashboard.stripe.com. Decide the business country now; it cannot be changed after activation. Create a separate Sandbox from the account switcher (Stripe says use a general-purpose Sandbox for new integrations rather than the legacy test mode; exact menu label not verified). Work only inside the sandbox until S9.
S2. Open https://dashboard.stripe.com/test/apikeys (inside the sandbox). Click the Standard secret key to reveal it (sk_test_...). Paste into Railway as STRIPE_SECRET_KEY. Do not paste keys into chat or the repo.
S3. Create the Bmapz Products and recurring Prices in the sandbox (Product catalog). Copy each price_... ID and give them to the app config (the code audit says where price IDs are read from). Live mode will need its own Price IDs.
S4. Create the webhook endpoint so that its event payload version matches the code: because the Dashboard offers only the latest API version, create it by API using the sandbox secret key (run from a terminal that has the key in an environment variable, not typed into chat): curl https://api.stripe.com/v1/webhook_endpoints -u "$STRIPE_SECRET_KEY:" -d url=https://bmapz-production.up.railway.app/api/stripe/webhook -d api_version=2024-06-20 -d description="Bmapz production (sandbox)" -d "enabled_events[]=checkout.session.completed" -d "enabled_events[]=customer.subscription.updated" -d "enabled_events[]=customer.subscription.deleted" -d "enabled_events[]=invoice.paid" -d "enabled_events[]=invoice.payment_failed" and add one -d "enabled_events[]=..." line for every other event routes/stripeWebhook.js actually handles (for example customer.subscription.created, invoice.payment_action_required, charge.refunded, charge.dispute.created). The JSON response contains secret: whsec_... which is the value for STRIPE_WEBHOOK_SECRET.
S4-alt. If you prefer clicking: https://dashboard.stripe.com/test/webhooks > Create an event destination > Your account > Payload format: Snapshot (NOT Thin) > choose the API version (2024-06-20 if the dropdown offers it; if only the latest is offered, use S4 instead) > select the same events > Continue > Webhook endpoint > Continue > paste the URL > Create > click Reveal secret and copy whsec_....
S5. In Railway set STRIPE_WEBHOOK_SECRET to that whsec_ value and redeploy. Do NOT subscribe to invoice.created, invoice.finalized or invoice.finalization_failed unless the handler returns HTTP 2xx for them (otherwise invoice finalization is delayed up to 72 hours).
S6. Test: from https://ai.bmapz.com buy a plan with test card 4242 4242 4242 4242 (any future expiry, any CVC); or run stripe trigger checkout.session.completed and stripe trigger invoice.paid. Open Workbench > Webhooks > your endpoint > Event deliveries: each event must show Delivered with 200. 400 = signature failure (raw body parsed, or wrong whsec_, or a sandbox secret used in live); 3xx = URL redirects; 5xx = read Railway logs. Confirm the app marks the subscription active and the Resend welcome/receipt email arrives.
S7. GO LIVE (only after S6 is green): finish business verification at https://dashboard.stripe.com/account/onboarding. Wait for Stripe's review (no published time).
S8. After activation, switch the Dashboard to live mode and repeat: (a) https://dashboard.stripe.com/apikeys: reveal the default Standard live secret key (live mode only lets you reveal keys Stripe created; a key you create yourself is shown once); (b) recreate Products and Prices in live mode and update the app's price IDs; (c) create a NEW live webhook endpoint with the S4 curl but using the live key, same URL, same api_version, same events, capturing the new live whsec_; (d) set Railway STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET to the live values together in one deploy; (e) if the app uses the Customer Portal, configure it in live mode too (assumed to be separate; not verified).
S9. Run one real low-value subscription end to end, confirm Delivered 200 in the live Event deliveries tab, then refund it. When https://api.bmapz.com/api/stripe/webhook is working, update the existing endpoint's URL in place (do not keep two endpoints active, because Stripe would deliver every event twice).
Copy back to the assistant (never paste secrets in chat): confirmation that R4 shows verified, the screenshot of Event deliveries with 200s, the list of event names selected in S4/S4-alt, and the names (not values) of the Railway variables set.

**Things that commonly break the FIRST connect:**
- Stripe webhook wizard defaults to recommending Thin payloads; a Thin destination sends different, minimal events and a classic constructEvent handler will not work. Pick Snapshot.
- Stripe webhook API-version mismatch: payload shape follows the endpoint api_version (or account default, probably 2026-09-30.endive for a new account), while billing.js pins 2024-06-20. Basil+ moved subscription current_period_* to items and invoice.subscription under parent, so a handler written for the old shape can silently break. Create the endpoint through the API with api_version=2024-06-20.
- Raw body: any JSON body parser before /api/stripe/webhook causes signature failure (docs: manipulating the raw body breaks verification).
- Wrong-mode whsec_: sandbox and live endpoints have different signing secrets; the live endpoint must be created separately.
- Redirects count as failures; register the final URL (check trailing slash, HTTP to HTTPS, and the future switch to api.bmapz.com).
- CSRF/auth middleware on the webhook route; Stripe is not logged in and sends no CSRF token.
- Invoice finalization stalls up to 72 hours if invoice.created is subscribed and any endpoint on the account does not answer 2xx; only subscribe to events the handler acknowledges.
- Live Price IDs differ from sandbox Price IDs; the app will fail with a no-such-price error if sandbox IDs are left in live config.
- Business country is locked after activation; wrong choice means a new Stripe account.
- Stripe live activation (KYC) is a human review with no published SLA; live charges are impossible until it clears.
- Resend: 403 for every recipient except the account owner while RESEND_FROM_EMAIL is onboarding@resend.dev; fixed only by a verified domain.
- Resend: DNS is at Hostinger (dns-parking.com), not Cloudflare; records added anywhere else do nothing. Hostinger/zone editors may auto-append bmapz.com to names and values; use relative host names and a trailing dot on MX values if needed.
- Resend: records for domains created after August 2026 may be CNAMEs rather than TXT+MX; hand-copying from old guides will fail. Also a CNAME cannot share a name with TXT/MX, so check for pre-existing notify/send records.
- Resend: do not add a second SPF or second DMARC record. A DMARC record (v=DMARC1; p=none) already exists at the apex and the apex SPF is Hostinger's; Resend's records belong only on the subdomain.
- Resend: free plan is capped at 100 emails/day and 3,000/month; a signup loop or load test can hit the daily cap and fail.
- RESEND_FROM_EMAIL format: if the code concatenates a display name, a value already in 'Name <addr>' form would double-wrap; use the plain address unless the code audit confirms otherwise.

**Not confirmed from an official source (re-check against the live console before relying on it):**
- Business country is unknown: Stripe availability, activation documents, payout currency and card pricing all depend on it. The Stripe pricing page I could fetch geolocated to Brazil (domestic card rate in BRL; Billing 0.7% of billing volume; no setup or monthly fees); US/other-country rates were not confirmed.
- No official Stripe activation SLA exists in the docs; the 1-5 business day figure is from third-party sites only.
- Many Stripe docs pages were returned in Portuguese by the fetch tool, so UI labels were translated back from Portuguese; exact English labels (Create an event destination, Reveal secret, Event deliveries) may differ slightly.
- I could not confirm whether the Stripe Dashboard webhook wizard lists 2024-06-20 in its API-version dropdown; the upgrade doc says non-latest versions need the API, so S4 (API) is the safe path.
- Whether a stripe-node version in the backend accepts apiVersion 2024-06-20 and whether the handler's field access matches that version were not checked (source code not read, by instruction).
- Whether 2024-06-20 will remain accepted indefinitely: no sunset notice found, no guarantee found. Clover and Dahlia breaking-change lists were not fetched.
- Whether a live secret key is usable/revealable before activation completes is not documented.
- Exact hPanel menu path/labels for the Hostinger DNS Zone Editor were not verified (the Hostinger support URL I tried returned 404); only that Hostinger's own nameservers are ns1/ns2.dns-parking.com and that it offers a DNS zone editor.
- Whether existing records already occupy notify.bmapz.com or send.* in the Hostinger zone was not determinable (ANY lookups return a placeholder). Also unknown whether api.bmapz.com and ai.bmapz.com already resolve.
- Exact host labels for a SUBDOMAIN's Resend records (resend._domainkey.notify, send.notify) are inferred from the root-domain examples; the Records tab is authoritative.
- Whether Resend will issue classic TXT+MX or CNAME records for a domain added today is indeterminate from docs.
- Resend permission names (full_access/sending_access), the sending_access-only domain restriction, the simulator test addresses, and region-change procedure were not re-verified.
- Whether a verified subdomain authorises sending from the root domain (and vice versa) is not stated in fetched pages.
- Resend changelog fetch returned titles without dates, so a complete list of Resend changes after 2026-09-23 was not obtained; none affecting setup was found. The prior file's July 2026 free-tier-increase blog post could not be reconciled with the pricing page.
- Whether Resend manually reviews or rate-holds brand-new accounts is undocumented.
- Customer Portal and other Billing settings being separate per mode (test vs live) is assumed from Stripe's go-live guidance, not verified for the portal specifically.
- Which events routes/stripeWebhook.js handles, and whether the handler returns 2xx for ignored events, is unknown and must be diffed against the event list by the code auditor.
- Gmail/Yahoo bulk-sender DMARC requirements for Bmapz volume were not researched; the existing apex DMARC is p=none with no reporting address.

---

## Perplexity, Apollo, Hunter, Stability

**Railway variables:** `PERPLEXITY_API_KEY`, `HUNTER_API_KEY`, `STABILITY_API_KEY`, `(Apollo has NO Railway variable: each company connects its own key in Integrations)`

**Redirect / callback URLs to register:**
- (API keys only, no redirect URIs)

**Press Test on:** `perplexity`, `apollo`, `hunter`, `stability`

**What the code now does differently (read before you connect):**
- Perplexity moved to the Agent API on 2026-09-27 (Sonar chat completions retired). lib/perplexity.js implements it with the old path as a fallback; the connection test reports which surface answered. NOT live-verified: the first real key settles it.
- Apollo's health endpoint answers 200 with NO key, so the old test passed for a company with no key; it now checks is_logged_in.
- Apollo is PER-COMPANY ONLY (no platform key). Apollo's developer FAQ says exposing Apollo data to people who are not Apollo customers needs a custom data-licensing contract, which one platform key serving every tenant would be. Enrichment no longer reveals personal emails unless the caller opts in (it cost extra credits and exposed personal addresses on every call).
- Perplexity: the Agent API is rate-limited to 1 request per second per ORGANIZATION at the first tier (not per key), so parallel searches can 429 and fall through to the next provider. $10 is a sensible first purchase; the project setup also asks for company name, address and tax details.
- Hunter reports an exhausted monthly quota as HTTP 429 and a rate limit as 403 (the opposite of the usual meaning).
- Stability: image generation still uses the legacy v1 endpoint (maintenance mode, no published sunset); migrating to v2beta is a recorded follow-up.

**Testable today with no human review?** Yes. Yes for all four: keys are self-service and no document describes a review, allowlist or waitlist. What each costs you today: Hunter and Apollo are free (Apollo needs an @bmapz.com work-email account and a mailbox that can receive its verification mail; some endpoints may be plan-gated, so test the exact ones the app calls). Stability is free only for 25 credits via Google login (third-party sourced), otherwise paid. Perplexity needs a card plus a prepaid purchase (budget $10) and company name/address/tax details to create the project; a single Agent API test call costs roughly $0.001 to $0.006. I could not make any authenticated call myself (no keys; I may not create accounts or enter credentials), so every 'works' statement is from official docs plus unauthenticated live probes, not an end-to-end run. For Perplexity test the Agent API (/v1/agent, preset fast) and ALSO whatever path the backend actually uses; do not assume the legacy Sonar call works for a new account.

**What a customer launch needs** (First connect (all four keys set and probed): about 1.5 to 2.5 hours hands-on today, most of it Perplexity company details/card and Apollo email verification. Customer launch: 1 to 3 days for Perplexity, Hunter and Stability (self-serve upgrades, top-ups, terms reading, metering). Apollo is the long pole: if a data-licensing contract or OAuth partner registration is needed there is no published SLA; plan for 2 to 6 weeks as an estimate (not sourced) or ship Apollo as bring-your-own-key at launch to avoid the dependency.):
- Perplexity: move to Agent API shape (input/preset; read output[] message text and the search_results item for citations), keep a funded balance with Auto reload on, and accept that the org-wide Agent limit is 1 QPS at Tier 0 (3 QPS after $50 cumulative, 8 after $250); all tenants share it, so add queueing/429 handling and cost metering per tenant.
- Apollo: a paid Apollo plan sized to your rate limits (Free is 50/min, 200/hour, 600/day across ALL tenants) AND resolve the data-licensing question: if Bmapz shows Apollo-sourced data to its customers from your single key, Apollo says a custom contract is required (apply via Apollo's partner/API-reseller form; no published SLA). Alternative: each customer connects their own Apollo account through OAuth 2.0 (Partners) after Bmapz registers an app, or customers paste their own keys.
- Hunter: Free (50 credits/month, shared by every tenant) will be exhausted immediately; a paid plan (Starter $49/month or $34/month billed yearly for 2,000 credits; Growth $149 or $104 for 10,000; Scale $299 or $209 for 25,000) or credit packs. Hunter terms on passing data to your end users were not found/verifiable.
- Stability: buy credits (pay as you go at $0.01 per credit; free 25 only once); decide whether customers are charged per image; check licence terms for commercial resale (not verifiable, docs unreadable).
- For all four: read each vendor's API/terms of service for resale or multi-tenant pass-through (Perplexity's terms page returns 403; Hunter's ToS fetched but I did not find a resale clause; Stability not readable), and put per-tenant usage limits in Bmapz so one customer cannot burn the shared quota.

**Costs and waits:**
- Perplexity prepaid credits: **$10 recommended starting purchase; $10 is the only published minimum (Stripe Projects path); console minimum unpublished** - Add payment method itself does not charge. Unused-credit refund policy unverifiable (Help Center 403). Source: https://docs.perplexity.ai/docs/getting-started/integrations/stripe-projects.md
- Perplexity Agent API per call: **fast Search web_search $0.001 per invocation plus model tokens; Perplexity's low-preset example run $0.0055; standard web_search $0.0025; perplexity/sonar model $0.25 in / $2.50 out per 1M tokens** - Source: https://docs.perplexity.ai/docs/getting-started/pricing.md and /docs/agent-api/models.md. No per-request fee beyond tools and tokens.
- Perplexity usage tiers (rate limit upgrades): **Tier 1 at $50 cumulative purchases (3 QPS), Tier 2 $250 (8 QPS), Tier 3 $500 (17 QPS), Tier 4 $1,000 (33 QPS)** - No published SLA for tier changes; cumulative purchases, never downgraded. Source: rate-limits page.
- Perplexity AWS Marketplace contract (optional): **credits starting at $1,000 on a 1-month contract** - Only reported by search result summary, not read on the page; optional.
- Apollo Free plan: **$0** - Rate limits 50/min, 200/hour, 600/day on listed endpoints; some endpoints need a work email and may be plan-gated. Source: https://docs.apollo.io/docs/rate-limits
- Apollo paid plans and credits: **price not verified from Apollo; enrichment costs 1 credit (email/demographics) up to 9 credits per person (+8 if mobile), org enrichment/search 1 credit, news search 1 credit per page** - Third-party blogs claim about $119/user/month for Organization; unconfirmed. Source for credits: https://docs.apollo.io/docs/api-pricing.md
- Apollo data-licensing contract (if exposing Apollo data to non-Apollo users): **custom, not published** - No published SLA or price. Source: https://docs.apollo.io/docs/developer-faqs.md
- Hunter Free: **$0, 50 credits/month, no rollover** - Email found 1 credit, email verified 0.5 credit; GET /v2/account is free. Source: https://hunter.io/pricing
- Hunter paid plans (monthly price / billed yearly per month): **Starter $49 / $34 for 2,000 credits per month; Growth $149 / $104 for 10,000; Scale $299 / $209 for 25,000; Enterprise custom** - Credit packs and a 'Data Platform' API-only option also exist (prices not read). Source: https://hunter.io/pricing
- Stability AI credits: **$0.01 per credit; $10 buys 1,000 credits; 25 free credits one time via Google login** - Third-party source (June 2026); official docs unreadable; minimum purchase and expiry unknown. Typical image: Core 3 credits ($0.03), Ultra 8 ($0.08), SD3.5 Medium 3.5, SD3.5 Large 6.5.
- Waits: **No review wait for any of the four keys (minutes). Perplexity Router access, Apollo data-licensing contract, Apollo OAuth partner registration: no published SLA.** - Vendor review/response times not published.

**Changed since the first research (2026-09-23):**
- Perplexity's Sonar sunset date (2026-09-27) has passed. Docs now say Sonar Chat Completions support ended, sync and streaming requests keep working by being reformulated as Agent API requests (gradual rollout by model), and async Sonar requests are unsupported. -> The researcher's 'time bomb on Sunday' framing is out of date: it did not become a clean hard failure, but behaviour is now unspecified and new accounts may not have Sonar access. Use the Agent API.
- Perplexity's preset mapping changed to sonar->fast, sonar-pro->fast, sonar-reasoning-pro->low, sonar-deep-research->high, with xhigh pushed for deep research. -> Migration table in the old file is wrong by one tier for pro and reasoning-pro.
- Perplexity's rate-limit page no longer lists Sonar RPM limits (only Router, Agent, Search, Embeddings); Agent Tier 0 is 1 QPS per organization. -> The '50 RPM / 5 RPM deep research' figures are stale.
- Perplexity legacy Sonar quickstart now carries a 'replaced by the Agent API, kept for customers with continued Sonar access' banner; model catalog has been refreshed (gpt-6 family, claude-sonnet-5-5, claude-opus-5-5, kimi-k3, etc.). -> Do not hard-code model ids; prefer presets.
- Apollo docs were updated on 2026-09-28 (API pricing and credits) and 2026-09-29 (Developer FAQ); FAQ now says all plans include at least basic API access but advanced functionality is only on certain plans, and the create-key page says access depends on plan. A published per-plan rate-limit table exists. -> The researcher's flat 'all plans include API access' headline is not safe; test endpoints on Free before relying on it. Exact pre-09-23 wording of the FAQ is unknown, so I cannot say which sentence is new.
- Apollo's API gateway returns structured errors today: no key gives HTTP 422 AUTH.AUTHENTICATION.API_KEY_REQUIRED, a bad key gives HTTP 401 AUTH.AUTHENTICATION.API_KEY_INVALID; auth/health still returns 200 healthy:true is_logged_in:false for both. -> Gives a reliable way to distinguish missing, invalid and unscoped keys; I cannot tell whether this format is new since 09-23.
- Perplexity Router API is still private preview but now documents Anthropic Messages, OpenAI Chat and Responses formats on https://api.perplexity.ai/router/v1 for open-weight models only. -> No change to recommendation: it is not a web-search replacement.

**Step by step (verified):**

PREP (5 min): have ready a credit card, your Google account, business name + address + tax details, and a working @bmapz.com mailbox (bmapz.com mail is hosted at Hostinger, so create e.g. derek@bmapz.com there first; Apollo Free needs a work email). Do the free ones first so you get two green checks before spending money.
HUNTER (10 min, free): (a) open https://hunter.io/users/sign_up?from=api and create the account; (b) open https://hunter.io/api-keys (must be signed in) and copy the key; (c) verify, zero credits: curl -s https://api.hunter.io/v2/account -H "X-API-KEY: PASTE_KEY" -> expect HTTP 200 with your plan and request counts; 401 authentication_failed = wrong key; (d) copy the key back to me / set Railway variable HUNTER_API_KEY. Do NOT test with domain-search or email-finder: Free is only 50 credits/month.
APOLLO (15 min, free): (a) go to https://www.apollo.io/sign-up and register with the @bmapz.com address (NOT gmail), confirm the email; (b) in the app click Settings > Integrations > API Keys > Create new key; (c) Name: bmapz-production; Description: Bmapz AI backend; toggle 'Set as master key' ON (avoids 403s and is required for the usage probe); click Create API key; Copy the key immediately; (d) verify with two checks: curl -s https://api.apollo.io/api/v1/auth/health -H "x-api-key: PASTE_KEY" and require BOTH healthy:true and is_logged_in:true (status 200 alone proves nothing), then curl -s -X POST https://api.apollo.io/api/v1/usage_stats/api_usage_stats -H "Content-Type: application/json" -H "x-api-key: PASTE_KEY" -> expect 200 with limits (401 = bad key, 403 = key valid but not master/scoped); (e) set Railway variable APOLLO_API_KEY. Then run ONE real call the app uses (e.g. people search) on the free plan to find out if it is plan-gated.
STABILITY (10 min): (a) open https://platform.stability.ai, click Login and choose 'Continue with Google' (that is the only way the 25 free credits are reported to be granted); (b) open https://platform.stability.ai/account/keys and copy the sk- key (an API key is auto-created on signup per third-party guides); (c) verify without spending credits: curl -s https://api.stability.ai/v1/user/balance -H "Authorization: Bearer PASTE_KEY" -> expect JSON with a credits number greater than 0 (401 Incorrect API key = wrong key); (d) set Railway variable STABILITY_API_KEY. If credits are 0, buy $10 (1,000 credits) from the account page.
PERPLEXITY (25 min, costs about $10): (a) sign in at https://console.perplexity.ai with the Perplexity account; (b) Settings (left sidebar, Project section): enter organization name, address and tax details; (c) open https://console.perplexity.ai/project/billing: Add payment method (does not charge), then Buy more credits (budget $10; console minimum is not published), then Auto reload > Change preferences so production never hits zero; (d) open https://console.perplexity.ai/project/keys, Generate API Key, COPY IT NOW (shown once); (e) verify on the supported surface: curl -s https://api.perplexity.ai/v1/agent -H "Authorization: Bearer PASTE_KEY" -H "Content-Type: application/json" -d '{"preset":"fast","input":"Who is the CEO of Apple? Cite sources."}'. Expect HTTP 200. Answer text: output[].content[].text where the output item type is "message" (there is NO top-level output_text in raw JSON; output_text exists only in the official SDKs). Sources: the output[] item with type "search_results", field results[].url (marker [n] in the text = result id n). Cost per call is in usage.cost.total_cost. (f) Only if the backend still calls Sonar, also try: curl -s https://api.perplexity.ai/v1/sonar -H "Authorization: Bearer PASTE_KEY" -H "Content-Type: application/json" -d '{"model":"sonar","messages":[{"role":"user","content":"Reply OK"}]}' and treat success as temporary (and possibly absent on a new account); (g) set Railway variable PERPLEXITY_API_KEY.
RAILWAY (5 min): in the Railway project open the service behind https://bmapz-production.up.railway.app, Variables tab, add PERPLEXITY_API_KEY, APOLLO_API_KEY, HUNTER_API_KEY, STABILITY_API_KEY with the keys pasted with no trailing space or newline; deploy; confirm the new deployment is Active before testing through the app.
DECISION FOR DEREK: use the Agent API with preset 'fast' for Perplexity (do not stay on Sonar; do not use the Router, it has no web search). Ship Apollo as owner-only or customer-own-key until Apollo answers the data-licensing question.
WHAT TO COPY BACK TO ME: the HTTP status and body (with the key removed) of each of the five verify commands, whether Apollo's people search worked on the free plan, the Stability credits number, and the Perplexity balance after purchase.

**Things that commonly break the FIRST connect:**
- PERPLEXITY: new-account access to legacy Sonar is not guaranteed (legacy page is kept 'for customers with continued Sonar access'). If the backend calls Sonar and gets an error, switch to /v1/agent with preset fast rather than debugging keys.
- PERPLEXITY: the backend must read the raw JSON correctly. If it expects choices[0].message.content or top-level citations[] it breaks on the Agent API; if it expects a top-level output_text it also breaks (that is SDK-only). Needs output[] parsing. (Code check belongs to the separate auditor.)
- PERPLEXITY: needs an organization name, address and tax details, a card and a prepaid purchase (budget $10; console minimum unpublished) before any call succeeds; keys are blocked at zero balance (status code undocumented).
- PERPLEXITY: Agent API Tier 0 limit is 1 request per second for the whole organization; a burst or parallel test returns 429 and looks like a broken key.
- APOLLO: auth/health returns 200 with is_logged_in:false for a missing OR bogus key; assert is_logged_in===true, or better call usage_stats (401 bad key, 403 wrong scope, 200 good).
- APOLLO: Free account on a gmail/outlook address is blocked from search, enrichment and record retrieval; register with a real @bmapz.com mailbox (needs a Hostinger mailbox to receive the verification email).
- APOLLO: key must be created by an admin or a permission profile that allows it; scoped keys 403 on unselected endpoints and some endpoints are master-key only; Free plan may still gate specific endpoints (plan matrix not published).
- APOLLO: Free limits 50/min, 200/hour, 600/day; key is sent in x-api-key (not Authorization).
- HUNTER: quota exhaustion shows as HTTP 429 and rate limits as 403, not 401; only 50 credits/month so never use finder/verifier/domain-search as a key test; use GET /v2/account.
- STABILITY: no free credits unless the account was created via Google; zero balance causes a payment/credits error that is easy to mistake for a bad key; official docs unreadable so exact zero-balance status code is unknown.
- STABILITY: image endpoints are POST-only multipart (GET returns 404); do not test with a browser or GET.
- ALL FOUR: Railway variable pasted with a trailing space/newline gives a 401 that looks like a revoked key; confirm the redeploy finished before testing. Key values are shown once (Perplexity, Stability, Apollo).

**Not confirmed from an official source (re-check against the live console before relying on it):**
- No authenticated call was made to any of the four vendors (no keys; creating accounts or entering credentials is not permitted for me), so 'works with a real key' is inferred from docs and unauthenticated probes only.
- Perplexity: whether POST /chat/completions or /v1/sonar with model sonar actually returns 200 today, in what response shape (legacy choices/citations vs Agent shape), and whether a brand-new account is eligible for Sonar at all. Docs say reformulation is 'rolling out gradually by model'.
- Perplexity: exact HTTP status and body for zero balance, for a bad preset/model on the Agent API, and for 429 (error-handling doc URL is 404).
- Perplexity: minimum credit purchase in the direct console (only the Stripe Projects path states $10); Auto reload threshold; refund policy (Help Center returns 403 to fetchers); free signup credits (none documented); Perplexity API terms of service (403) regarding multi-tenant resale.
- Perplexity: Router private preview access process and lead time (email api@perplexity.ai; no SLA); docs inconsistency on the fast preset model (gpt-6-luna vs gpt-5.6-luna) suggests ids change often.
- Apollo: which endpoints work on a Free plan (the docs contradict each other on 'depends on plan' vs 'all plans include basic access'); paid plan prices (blog figures such as about $119/user/month for Organization are not confirmed from Apollo); Apollo data-licensing contract and OAuth partner-app review timelines (no published SLA); whether Bearer auth is ignored; whether the business entity country affects availability.
- Hunter: free-plan API access rests on the pricing comparison table structure plus the 'Get a free API key' docs button, not a prose sentence; Hunter reselling/pass-through terms not checked; business entity country not known to matter.
- Stability: official docs are a JavaScript app that no fetch tool could read; free-credit rule, price per credit, minimum purchase, credit expiry, balance endpoint cost, per-model credit costs and whether v1 endpoints are deprecated all rest on third-party sources or live 401 probes; business entity country may affect payment/availability.
- Whether Railway egress IPs could be blocked by any vendor (no docs mention it).
- Which Perplexity endpoint, model string, and response parsing the Bmapz backend uses was not checked (code is out of scope); that determines whether the Sonar change is a non-event or an outage.

---

## Mobile apps (Android + iOS)

See `docs/audit-2026-10-06/mobile-research.md`.

