# Privacy policy: "Google user data" section — DRAFT for counsel review

Status: **DRAFT. Not published.** `frontend-src/pages/PrivacyPolicy.jsx` has no Google section today, and Google requires one
(with the Limited Use statement) before it will verify the OAuth app for Gmail, Drive, YouTube and the other Google scopes.
A privacy policy makes legal representations, so this file is deliberately NOT pasted into the live page. Each sentence below is
tied to evidence in the code, and every claim that code cannot prove is marked **CONFIRM** for Derek or counsel.

Written 2026-10-07 against commit `0a0b716`. Re-check the "evidence" column if the code changes.

---

## Proposed text

### Google user data

When you choose to connect your Google account, Bmapz AI asks Google for permission to access only the data needed for the features
you use. Which permissions are requested depends on which feature you connect:

| Feature | What we ask Google for | What we do with it |
|---|---|---|
| Sending email from Bmapz AI | Permission to send email on your behalf (Gmail "send") and your email address and name | Send the messages you or your automations create, from your own address |
| Calendar / Google Meet | Access to your calendar | Create and read events so meetings can be scheduled |
| Analytics and Search Console | Read-only access | Show your website performance in your Bmapz AI dashboards |
| YouTube | Read-only access to your channel | Show your channel data in your dashboards |
| Google Ads | Access to your Google Ads account | Read and report on your campaigns |
| *Gmail inbox sync and Google Drive browsing* | *Read access to your mailbox / files* | *Show your received email in the Bmapz AI Inbox / let you pick files. **Only if enabled — see CONFIRM 1.*** |

**How we use it.** We use Google user data only to provide and improve these user-facing features inside Bmapz AI. We do not use it
for advertising, we do not sell it, and we do not use it to build or train generalized artificial-intelligence models.

**Storage.** The access credentials Google gives us are stored against your company's account in our database. Gmail messages
we import (only when inbox sync is enabled) are stored in your company's Inbox and are visible only to the people in your company
who have access to it. **CONFIRM 2** (encryption wording, see below).

**Sharing.** We do not share Google user data with anyone except: (a) service providers that process it on our behalf to run the
feature you asked for, described next; (b) where required by law; (c) as part of a merger or acquisition, with notice to you.

**Artificial-intelligence processing.** If your company turns on the AI sales agent (SDR), the text of an incoming message — which
can include an email imported from your Gmail — is sent to our AI model providers (OpenAI and Anthropic) so the agent can draft a
reply. We send it only for that purpose. **CONFIRM 3** (vendor terms).

**Human access.** Our team does not read your Google user data unless you ask us to for support, it is needed to investigate abuse or
a security problem, or the law requires it. **CONFIRM 4**.

**Your control.** You can disconnect Google at any time in Integrations; this deletes the stored credentials from our systems, and you
can also remove Bmapz AI's access in your Google Account at https://myaccount.google.com/permissions. To have your data deleted, use
https://ai.bmapz.com/DataDeletion or write to privacy@bmapz.com. **CONFIRM 5** (retention period).

**Limited Use.** Bmapz AI's use and transfer to any other app of information received from Google APIs will adhere to the
[Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use
requirements.

---

## Evidence behind each statement (verified in the code, 2026-10-07)

| Statement | Evidence | Status |
|---|---|---|
| Only the listed permissions are requested | `GOOGLE_SCOPES_MAP` and `googleScopesFor()` in `backend/src/routes/oauth.js`; `gmail.compose` and `youtube.upload` removed; restricted scopes (`gmail.readonly`, `drive*`) are filtered out unless `GOOGLE_ENABLE_RESTRICTED_SCOPES=true`. Test: `backend/tests/google-and-oauth.test.mjs` | verified |
| Gmail send is used | `sendViaGmail` in `backend/src/lib/emailSender.js` calls only `users/me/messages/send` | verified |
| Inbox sync reads mail | `syncGmail` in `backend/src/routes/messaging.js` calls `messages.list` and `messages.get`; it is blocked unless `gmail.readonly` was granted | verified |
| Imported mail is stored in the company's Inbox | `insertMessageIfNew` writes to the `messages` table with `company_id` | verified |
| Imported inbound mail can reach an AI model | `insertMessageIfNew` -> `handleInboundEvent` -> `handleInboundForSdr` (`backend/src/lib/sdrEngine.js`), which sends the message text and the conversation history to the model. Runs only if the company's SDR agent is `enabled` (default `false`, `sdrEngine.js:64`) | verified |
| The Company Brain does not read email content | `companyBrain.js:159` selects only `channel, direction` from `messages` | verified |
| Disconnect deletes stored credentials | `POST /api/oauth/disconnect` -> `clearOAuthTokens` removes `google_access_token`, `google_refresh_token`, `google_token_expires_at`, `google_connected_email`, `google_scopes` | verified |
| Disconnect revokes the grant at Google | **Not implemented** before commit after `0a0b716`; see below | see note |
| No advertising use, no sale | No code path found that sends Google data to an ad platform or broker | verified by search, not by proof of absence |

## CONFIRM before publishing

1. **Is Gmail inbox sync / Drive browsing going to be offered at launch?** The default launch configuration does NOT request those
   permissions (they trigger Google's paid yearly security assessment). If they stay off, delete the last row of the table and the
   sentence about stored Gmail messages — a policy should not describe data you do not collect.
2. **Encryption.** Credentials sit in the `companies.api_keys` JSON column. Supabase encrypts the database at rest at the storage
   layer, but there is NO extra application-level encryption of these tokens. Do not write "encrypted" beyond "encrypted at rest by our
   database provider" unless that changes.
3. **AI providers' terms.** Confirm in the current OpenAI and Anthropic API terms that API inputs are not used to train their models
   under the plan you are on, and keep the sentence only if true. Google's Limited Use rules allow sending data to a third party
   only where needed to provide the user-facing feature and forbid use for training generalized models.
4. **Human access.** Derek and any other App Owner can read the database. The sentence is a commitment about your own team's
   behaviour; only you can make it.
5. **Retention.** Imported Gmail messages remain in the Inbox until the company deletes them or deletes the lead
   (`admin.js` deletes a lead's messages). State the real period you intend, or say "until you delete them or your account".
6. Contact addresses `privacy@bmapz.com` and `contato@bmapz.com` appear on the existing pages. Confirm both mailboxes exist and are
   monitored: Google, Meta and TikTok reviewers do write to them.
7. The page must also list the data in the Data Safety (Google Play) and privacy-label (Apple) forms when the mobile apps ship.

## Where it goes
Add as a new section in `frontend-src/pages/PrivacyPolicy.jsx` (same visual style as the others), keep the page reachable logged-out
at `/PrivacyPolicy` (it is), and make sure the page footer or header links the homepage and terms. Google's brand verification also
requires the app's homepage to be public and to link to this policy.
