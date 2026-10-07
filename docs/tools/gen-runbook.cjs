#!/usr/bin/env node
/**
 * Generates docs/INTEGRATIONS_RUNBOOK.md from the adversarially verified research in docs/audit-2026-10-06/.
 *
 *   node docs/tools/gen-runbook.cjs
 *
 * Re-run it whenever a verify-*.json is added or replaced (the perplexity_prospecting one was still outstanding when this
 * was first written). Everything platform-specific (URLs, field values, waits, prices) comes from those files, not from
 * this script; this script only supplies the Bmapz-specific wrapper: order, env var names, which tests to press.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const EVID = path.join(root, 'docs', 'audit-2026-10-06');
const OUT = path.join(root, 'docs', 'INTEGRATIONS_RUNBOOK.md');
const read = (f) => (fs.existsSync(path.join(EVID, f)) ? JSON.parse(fs.readFileSync(path.join(EVID, f), 'utf8')) : null);

const GROUPS = [
  {
    key: 'google', title: 'Google (Gmail send, Calendar, Analytics, Search Console, YouTube, Ads)',
    vars: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', '(optional) GOOGLE_ENABLE_RESTRICTED_SCOPES, GOOGLE_ADS_API_VERSION'],
    redirect: ['https://api.bmapz.com/api/oauth/google/callback', 'https://bmapz-production.up.railway.app/api/oauth/google/callback  (remove before "Verify branding")'],
    tests: ['gmail', 'google_calendar', 'google_meet', 'youtube', 'google_analytics', 'google_search_console', 'google_ads'],
    code: [
      'One Google token serves every Google service; authorisation now merges scopes (include_granted_scopes) so connecting a second service no longer breaks the first.',
      'Restricted scopes (Gmail read, Drive) are OFF by default: they need a paid yearly security assessment. Gmail SEND, Calendar, Analytics, Search Console, YouTube and Ads are on. Inbox sync and Drive browsing return when GOOGLE_ENABLE_RESTRICTED_SCOPES=true.',
      'Google Ads developer tokens no longer exist and are not sent by default. A Cloud project that has only Test access can reach Google Ads TEST accounts only; the Ads test says so by name.',
    ],
  },
  {
    key: 'meta', title: 'Meta (Facebook, Instagram, Meta Ads, WhatsApp)',
    vars: ['META_APP_ID', 'META_APP_SECRET', 'META_GRAPH_VERSION (default v25.0)', 'WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_VERIFY_TOKEN', 'WHATSAPP_APP_SECRET'],
    redirect: ['https://api.bmapz.com/api/oauth/meta/callback', 'https://bmapz-production.up.railway.app/api/oauth/meta/callback'],
    tests: ['meta', 'facebook', 'instagram', 'meta_ads', 'whatsapp'],
    code: [
      'Default API version moved v24.0 -> v25.0 (the Marketing API retired v24.0 on 2026-10-06). Override with META_GRAPH_VERSION.',
      'Facebook/Instagram insights now request current metrics and surface Meta\'s error instead of showing empty data. UNVERIFIED against a live token: re-check on first connect.',
      'read_insights and instagram_manage_insights are now requested and become part of App Review.',
      'WhatsApp webhook: https://api.bmapz.com/api/whatsapp/webhook (verify token = WHATSAPP_VERIFY_TOKEN). Known gap: inbound BSUID senders and template-only outbound messages (see AGENT_HANDOFF.md).',
    ],
  },
  {
    key: 'linkedin_x', title: 'LinkedIn and X (Twitter)',
    vars: ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET', 'LINKEDIN_API_VERSION (default 202606)', '(optional) LINKEDIN_ADS_WRITE=true', 'TWITTER_CLIENT_ID', 'TWITTER_CLIENT_SECRET'],
    redirect: ['https://api.bmapz.com/api/oauth/linkedin/callback', 'https://api.bmapz.com/api/oauth/twitter/callback', '(and the bmapz-production.up.railway.app equivalents while testing)'],
    tests: ['linkedin', 'linkedin_ads', 'twitter'],
    code: [
      'X: a failed post used to be recorded as PUBLISHED; success is now HTTP 201 with an id. Access tokens last ~2 hours and are now refreshed (refresh tokens rotate and the new one is stored). PKCE is S256.',
      'X is PAY-PER-USE: $0.015 per post and $0.20 per post containing a link, charged to Bmapz\'s prepaid credits for EVERY customer post. Decide who pays and set a spend limit BEFORE offering X posting.',
      'LinkedIn: posting and ads share one stored token, and LinkedIn invalidates an older token when a different scope set is granted. Authorisation now requests the union, and records the granted scopes so the test can tell "connected" from "cannot post".',
      'LinkedIn ads creation bodies are known-incomplete (runSchedule, locale, targeting, x-restli-id header): not usable until the Advertising API is approved and the adapter is fixed against a real account.',
    ],
  },
  {
    key: 'tiktok_canva', title: 'TikTok and Canva',
    vars: ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET', 'CANVA_CLIENT_ID', 'CANVA_CLIENT_SECRET', 'CANVA_IMPORT_ALLOWED_HOSTS'],
    redirect: ['https://api.bmapz.com/api/oauth/tiktok/callback', 'https://api.bmapz.com/api/oauth/canva/callback', '(register both hosts where the console allows several; Canva needs the redirect_uri sent explicitly when there are two, which the code does)'],
    tests: ['tiktok_social', 'canva', '(tiktok_ads is EXPECTED to fail and says why)'],
    code: [
      'TikTok access tokens last 24 hours; the refresh token is now stored and used (before, every connection died a day after it was made).',
      'TikTok publishing is NOT implemented: a post targeting TikTok now fails with a plain message instead of being marked published.',
      'TikTok Ads cannot work with the Login Kit token. The TikTok Business API is a separate program with its own app and connect flow, which is not built.',
      'Canva is platform-app-only. The design picker needs the design:meta:read scope: tick it in the Canva developer portal too, then reconnect.',
    ],
  },
  {
    key: 'stripe_resend', title: 'Stripe (billing) and Resend (email)',
    vars: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_ID_<STARTER|GROWTH|SCALE>_<MONTHLY|ANNUAL>', '(optional) STRIPE_API_VERSION', 'RESEND_API_KEY', 'RESEND_FROM_EMAIL'],
    redirect: ['Stripe webhook: https://api.bmapz.com/api/stripe/webhook (switch the existing endpoint\'s URL, do not add a second one)'],
    tests: ['stripe', 'resend'],
    code: [
      'SNAPSHOT, not Thin: the dashboard wizard now defaults to Thin events, which this handler cannot read. The dashboard can only create an endpoint for the LATEST API version, so create it through the API with api_version=2024-06-20 to match the handler.',
      'Failed Resend sends used to be reported as sent, and the fallback sender noreply@bmapzai.com is a domain that does not resolve. RESEND_FROM_EMAIL must be an address on a domain verified in Resend (use a subdomain such as send.bmapz.com; the apex already has an SPF record and Hostinger mail).',
      'Webhook failures now make Stripe retry (they used to be acknowledged), unpaid/incomplete subscriptions are mapped onto the five statuses the table allows, and a delayed-payment checkout no longer grants the plan before the money arrives.',
      'Open: checkout.session.completed performs several non-atomic writes; making it transactional is the recorded follow-up.',
    ],
  },
  {
    key: 'perplexity_prospecting', title: 'Perplexity, Apollo, Hunter, Stability',
    vars: ['PERPLEXITY_API_KEY', 'APOLLO_API_KEY', 'HUNTER_API_KEY', 'STABILITY_API_KEY'],
    redirect: ['(API keys only, no redirect URIs)'],
    tests: ['perplexity', 'apollo', 'hunter', 'stability'],
    code: [
      'Perplexity moved to the Agent API on 2026-09-27 (Sonar chat completions retired). lib/perplexity.js implements it with the old path as a fallback; the connection test reports which surface answered. NOT live-verified: the first real key settles it.',
      'Apollo\'s health endpoint answers 200 with NO key, so the old test passed for a company with no key; it now checks is_logged_in.',
    ],
  },
];

const out = [];
const w = (s = '') => out.push(s);

w('# Integrations runbook');
w();
w('> **Generated** by `node docs/tools/gen-runbook.cjs` from `docs/audit-2026-10-06/` (adversarial re-verification of the 2026-09-23 research,');
w('> run on 2026-10-06/07). **None of it has been run by a human against a real console.** Console screens change often: where a step and the');
w('> live screen disagree, trust the screen, and record the difference in `AGENT_HANDOFF.md`. Never enter or paste Derek\'s credentials for him.');
w();
w('## Evidence status');
w();
w('| Group | Verified | Claims: confirmed / corrected / refuted / unverifiable | Confidence | Code audit |');
w('|---|---|---|---|---|');
for (const g of GROUPS) {
  const v = read(`verify-${g.key}.json`); const a = read(`audit-${g.key}.json`);
  if (!v) { w(`| ${g.title} | **NOT YET** | - | - | ${a ? 'done' : '**NOT YET**'} |`); continue; }
  const c = {}; v.claims.forEach((x) => { c[x.verdict] = (c[x.verdict] || 0) + 1; });
  w(`| ${g.title} | yes | ${c.confirmed || 0} / ${c.corrected || 0} / ${c.refuted || 0} / ${c.unverifiable || 0} | ${v.confidence} | ${a ? 'done' : '**NOT YET**'} |`);
}
w();
w('## Already done (verified from outside)');
w();
w('- `api.bmapz.com` is attached in Railway, DNS is in place and the certificate is issued (Let\'s Encrypt). `GET https://api.bmapz.com/health` answers.');
w('- Railway `API_URL=https://api.bmapz.com`. Confirm any time with `curl https://api.bmapz.com/health` -> `"oauth_host":"api.bmapz.com"` and the commit matches `git rev-parse --short HEAD`.');
w('- Compliance pages that every platform asks for are public: https://ai.bmapz.com/PrivacyPolicy, /TermsOfService, /DataDeletion (the lowercase forms also work).');
w('- **Still missing for Google verification:** the privacy policy has no Google section yet. Draft + evidence: `docs/PRIVACY_GOOGLE_SECTION_DRAFT.md`.');
w();
w('## Order of work (recommended)');
w();
w('The principle: **start every queue that has a human reviewer first** (they run while you do everything else), then do what needs no approval.');
w();
w('1. **Start the slow queues**: Google Search Console domain verification (a DNS TXT record) and brand verification; Meta Business Verification; the TikTok app review submission; Canva review submission; (optional) LinkedIn Advertising API request.');
w('2. **Same day, no approval needed**: Google OAuth client + first connect (test user); Stripe sandbox + webhook; Resend subdomain; Meta development-mode connect and WhatsApp test number.');
w('3. **Then**: LinkedIn sign-in/posting, X (needs a funded card), TikTok sandbox, Canva with your own team, Perplexity (prepaid credit first), Hunter, Apollo, Stability.');
w('4. After each connect: press **Test** on its card (or `POST /api/integrations/test/<type>`) and record the exact message in `AGENT_HANDOFF.md`. A deploy being green is not evidence; a passing test is.');
w();
w('### DNS you will be asked for later (all in the same registrar panel; nameservers are ns1/ns2.dns-parking.com)');
w();
w('- Google Search Console DOMAIN property: one `TXT` at the apex (`@`), value supplied by Search Console. Do not remove it afterwards.');
w('- Resend sending subdomain (use `send.bmapz.com`): the records Resend shows on its Records tab. Copy them from there; they changed in August 2026 (CNAME-based SPF for new domains), so do not reuse any older list.');
w('- Do **not** touch the existing apex `MX` (Hostinger), the apex SPF `TXT`, or `_dmarc`. A second SPF or DMARC record invalidates the first.');

for (const g of GROUPS) {
  const v = read(`verify-${g.key}.json`);
  w();
  w('---');
  w();
  w(`## ${g.title}`);
  w();
  w('**Railway variables:** ' + g.vars.map((x) => '`' + x + '`').join(', '));
  w();
  w('**Redirect / callback URLs to register:**');
  g.redirect.forEach((r) => w(`- ${r}`));
  w();
  w('**Press Test on:** ' + g.tests.map((x) => '`' + x + '`').join(', '));
  w();
  w('**What the code now does differently (read before you connect):**');
  g.code.forEach((c) => w(`- ${c}`));
  if (!v) { w(); w('> **Verification for this group has not finished.** Do not follow any older instructions blindly; re-run the verify agent first.'); continue; }
  w();
  w(`**Testable today with no human review?** ${v.testable_today_without_review.value ? 'Yes' : 'No'}. ${v.testable_today_without_review.reasoning}`);
  w();
  w(`**What a customer launch needs** (${v.customer_launch.realistic_calendar_time}):`);
  v.customer_launch.requires.forEach((r) => w(`- ${r}`));
  if (v.costs?.length) {
    w();
    w('**Costs and waits:**');
    v.costs.forEach((c) => w(`- ${c.item}: **${c.cost}**${c.note ? ` - ${c.note}` : ''}`));
  }
  if (v.changed_since_2026_09_23?.length) {
    w();
    w('**Changed since the first research (2026-09-23):**');
    v.changed_since_2026_09_23.forEach((c) => w(`- ${c.what} -> ${c.impact}`));
  }
  w();
  w('**Step by step (verified):**');
  w();
  v.corrected_setup_steps.forEach((s) => w(String(s).replace(/\n/g, ' ')));
  w();
  w('**Things that commonly break the FIRST connect:**');
  v.first_connect_blockers.forEach((b) => w(`- ${b}`));
  if (v.uncertainties?.length) {
    w();
    w('**Not confirmed from an official source (re-check against the live console before relying on it):**');
    v.uncertainties.forEach((u) => w(`- ${u}`));
  }
}

w();
w('---');
w();
w('## Mobile apps (Android + iOS)');
w();
const mobile = path.join(EVID, 'mobile-research.md');
w(fs.existsSync(mobile)
  ? `See \`docs/audit-2026-10-06/mobile-research.md\`.`
  : '> Not researched yet. Read the project chat "Web app mobile development" FIRST and record its approach in `AGENT_HANDOFF.md`.');
w();

fs.writeFileSync(OUT, out.join('\n') + '\n');
console.log(`wrote ${path.relative(root, OUT)} (${out.length} lines)`);
