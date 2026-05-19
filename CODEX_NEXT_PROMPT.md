# Codex — Phase 2 Pickup Prompt

Generated: 2026-05-18  
Previous agent: Claude (this session)  
Build status: **✅ Frontend build passing** (`npm run build:frontend` → 3554 modules, 26 s)

---

## Context

The standalone Bmapz app is in `C:\Users\derek\OneDrive\Documents\Bmapz App`.

- Frontend: Vite + React 18 — `frontend-src/`
- Backend: Express.js ESM — `backend/src/`
- DB: Supabase (`supabase/schema.sql`)
- Hosting: Cloudflare Pages (frontend) · Railway (backend)
- Audit reference: `docs/CODE_AUDIT_2026-05-18.md`

The JSX corruption cleanup is complete. The frontend compiles clean. What follows is
the ordered list of Phase 2 tasks.

---

## Task 1 — Smoke-test after deploy (first priority)

After Derek pushes to GitHub and the Cloudflare Pages deploy runs:

1. Open `https://ai.bmapz.com`.
2. Check browser console — no red network errors?
3. Attempt sign-up with a new email → is the user created in Supabase?
4. Attempt sign-in → does the session persist across refresh?
5. Visit each major page (Dashboard, Leads, Social, Workflows, Ads, Billing) — any blank white screens?
6. Record pass/fail for each in `AGENT_HANDOFF.md`.

---

## Task 2 — Supabase schema alignment

File: `supabase/schema.sql`  
Reference: `docs/CODE_AUDIT_2026-05-18.md` section "Supabase Schema Gaps"

Key items found in the audit:

- `credit_transactions.type` values used in code: `'usage'` (already fixed in `backend/src/routes/companies.js`). Confirm the schema `CHECK` constraint allows `'usage'`.
- `companies` table: the onboarding wizard POSTs to `/api/companies` (added during Phase 1). Confirm the backend INSERT columns match the schema exactly.
- `social_posts` table: columns `platform`, `content`, `scheduled_at`, `status`, `media_urls` — verify they match what `SocialMedia.jsx` and `SocialCalendar.jsx` expect.
- `workflows` table: column `nodes` (jsonb) and `edges` (jsonb) — confirm present.
- RLS policies: ensure the `companies` row-level policy allows the authenticated user to SELECT/UPDATE their own row.

**How to verify:** run the schema SQL in the Supabase SQL editor against the production project and compare column names against what the frontend components call. Fix any mismatches in `supabase/schema.sql` and document them.

---

## Task 3 — Missing backend API routes

File: `backend/src/index.js` and `backend/src/routes/`

Routes called by the frontend that may not exist on the backend yet:

| Frontend call | Expected route | Notes |
|---|---|---|
| `GET /api/social/analytics` | social analytics summary | `SocialPerformanceTab.jsx` |
| `POST /api/social/boost` | boost/promote post | `SocialMedia.jsx` |
| `GET /api/social/posts` | list posts | `SocialCalendar.jsx`, `SocialMedia.jsx` |
| `POST /api/social/posts` | create/schedule post | `SocialMedia.jsx` |
| `PATCH /api/social/posts/:id` | update post | `SocialCalendar.jsx` |
| `DELETE /api/social/posts/:id` | delete post | `SocialMedia.jsx` |
| `GET /api/workflows` | list workflows | `WorkflowCanvas.jsx` |
| `POST /api/workflows` | save workflow | `WorkflowCanvas.jsx` |
| `PATCH /api/workflows/:id` | update workflow | `WorkflowCanvas.jsx` |
| `DELETE /api/workflows/:id` | delete workflow | `WorkflowCanvas.jsx` |
| `POST /api/ads` | create/publish ad | `Ads.jsx` |
| `GET /api/ads` | list ads | `Ads.jsx` |
| `GET /api/blog/posts` | list blog posts | `Blog.jsx` |
| `POST /api/blog/posts` | save blog post | `Blog.jsx` |

**Approach:** For each missing route, add a stub that returns `{ data: [] }` or `{ success: true }` so the frontend does not crash. Then flesh out real DB queries iteratively.

---

## Task 4 — OAuth token refresh

File: `backend/src/routes/oauth.js` (or wherever OAuth is handled)

The audit flagged that social platform OAuth flows (LinkedIn, Meta, Twitter/X, TikTok) issue
short-lived access tokens. Token refresh is not implemented.

Steps:
1. Identify where access tokens are stored (likely `integrations` table in Supabase).
2. Add a `refresh_token` column to `integrations` if missing.
3. Add a cron or middleware that checks `expires_at` and refreshes before the token is used.
4. For platforms that do not support refresh (TikTok), surface a "reconnect" prompt in `ConnectIntegrationModal.jsx`.

---

## Task 5 — Chunk size / bundle optimization (low priority, do last)

Current bundle: 2.9 MB main chunk.  
Acceptable for now, but worth splitting when Phase 2 is otherwise stable.

Steps:
1. Add `manualChunks` to `vite.config.js` to split vendor libraries (react, supabase, recharts, etc.).
2. Rerun `npm run build:frontend` and confirm chunk sizes are more reasonable.
3. Cloudflare Pages will automatically cache split chunks by content hash.

---

## How to run the build

```powershell
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
Set-Location "C:\Users\derek\OneDrive\Documents\Bmapz App"
& "C:\Program Files\nodejs\npm.cmd" run build:frontend
```

---

## Handoff contract

After completing any task above:

1. Update `AGENT_HANDOFF.md` → **Active Claims** table (mark Done, set date).
2. Update `AGENT_LIVE_BOARD.md` → **Current Status** and **Current Blocker** rows.
3. Leave a note in `AGENT_LIVE_BOARD.md` → **Claude To Codex** section describing what changed, what passed, and what is next.
4. Do **not** edit `.github/workflows/deploy.yml` or Cloudflare/Railway settings unless a task explicitly requires it.
