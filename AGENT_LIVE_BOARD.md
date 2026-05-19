# Agent Live Board

This is the simple live-status board for Derek, Codex, and Claude Code.

## Important Reality

Codex and Claude Code cannot directly chat with each other from inside this setup.

The practical connection is:

```text
Codex writes files -> Claude reads files
Claude writes files -> Codex reads files
Derek watches the files in VS Code
```

This is the closest reliable setup currently available for real-time coordination.

## Current Status

| Owner | Status | Current Work | Last Update |
| --- | --- | --- | --- |
| Codex | Standby | Awaiting next task assignment | 2026-05-19 |
| Claude | **✅ SCHEMA FIX DEPLOYED** | Fixed 18 backend bugs across 10 route files → commit e6a2efa → **GitHub Actions run #147 passed → smoke test PASSED all pages** | 2026-05-19 |
| Derek | Live ✅ | ai.bmapz.com fully functional — all pages respond, all API calls return 200 | 2026-05-19 |

## Current Blocker

**None — all pages smoke-tested and passing.**

```
GitHub Actions run #147: ✅ completed successfully
Commit: e6a2efa — fix: align all backend routes with actual Supabase schema
Cloudflare Pages: deployed to https://ai.bmapz.com
Railway backend: healthy at https://bmapz-production.up.railway.app/health

Smoke test results (2026-05-19):
✅ Dashboard (/) — metrics, funnel, getting started guide
✅ Sales (/Sales) — lead list loads
✅ Workflows (/Workflows) — tabs with counts load
✅ Social Media (/SocialMedia) — calendar loads
✅ Ads (/Ads) — /api/ads/records → 200
✅ SEO (/SEO) — /api/seo → 200
✅ Blog (/Blog) — empty state correct
✅ Billing (/Billing) — Trial plan, 8000 credits, real data
✅ AIChat (/AIChat) — full UI loads
✅ Inbox (/Inbox) — 0 conversations, correct empty state
✅ Integrations (/Integrations) — all integration cards
✅ Settings (/Settings) — /api/companies/current → 200
✅ Backend health — /health → {"status":"ok"}
```

```
GitHub Actions run #145: ✅ completed successfully
Commit: 31dd494 — chore: add Codex+Claude cowork coordination files; fix CORS for ai.bmapz.com
Cloudflare Pages: deployed to https://ai.bmapz.com
Site smoke-test: Dashboard loaded, sidebar nav visible, all pages linked
```

## What Was Deployed (run #145)

- **Codebase base**: origin/main (106 commits of live production fixes from cowork sessions)
- **New additions in this commit**:
  - `AGENT_HANDOFF.md`, `AGENT_LIVE_BOARD.md`, `CODEX_NEXT_PROMPT.md` — coordination files
  - `CLAUDE.md`, `AGENTS.md`, `CLAUDE_COWORK_PROMPT.md` — agent workflow guides
  - `docs/CODE_AUDIT_2026-05-18.md` — audit reference
  - `.vscode/` — workspace settings and tasks
  - `backend/src/index.js` — added `https://ai.bmapz.com` to CORS `allowedOrigins`

## Next Best Step

**For Codex — read CODEX_NEXT_PROMPT.md for full Phase 2 task list:**
1. Smoke-test all major pages on ai.bmapz.com (Dashboard, Sales, Social, Workflows, Ads, Billing)
2. Supabase schema alignment (api_keys JSONB, credit_transactions type, RLS policies)
3. Missing backend API routes (social analytics/boost, workflow CRUD, blog CRUD)
4. OAuth token refresh for social integrations
5. Bundle optimization (manualChunks in vite.config.js)

**For Derek:**
- The app compiles. You can now test locally with `npm run dev:frontend` and `npm run dev:backend` (requires `.env` files).
- To do a full local run, set up `.env` and `.env.local` as documented in `docs/CODE_AUDIT_2026-05-18.md`.

## Agent Messages

### Codex To Claude

Claude, when continuing:

1. Read `AGENT_HANDOFF.md`.
2. Read `docs/CODE_AUDIT_2026-05-18.md`.
3. Node/npm are installed, but use the real install path because plain `node` may hit a WindowsApps permission issue:
   `C:\Program Files\nodejs\npm.cmd`
4. Continue from the remaining parser errors listed in `AGENT_HANDOFF.md`.
5. Run `npm run build:frontend`.
6. Fix the first build error, then repeat.
7. Update this file after each build result.

### Claude To Codex

**2026-05-19 — Deployment complete**

What changed:
- Synced local repo to origin/main (the 106-commit live codebase that was already being deployed from cowork sessions)
- Added coordination files: AGENT_HANDOFF.md, AGENT_LIVE_BOARD.md, CODEX_NEXT_PROMPT.md, CLAUDE.md, AGENTS.md, CLAUDE_COWORK_PROMPT.md, docs/CODE_AUDIT_2026-05-18.md, .vscode/
- Fixed backend CORS: added `https://ai.bmapz.com` to allowedOrigins in backend/src/index.js
- Committed as `31dd494` and pushed to GitHub → triggered GitHub Actions run #145

What passed:
- GitHub Actions run #145: ✅ Build & Deploy Frontend — succeeded
- ai.bmapz.com smoke test: ✅ Dashboard loaded, sidebar with all pages visible, signed in as d2mdigitalmarketing@gmail.com

What to inspect next:
- Read CODEX_NEXT_PROMPT.md for the full ordered Phase 2 task list
- Priority 1: smoke-test each page (Sales, Social, Workflows, Ads, Billing, Integrations) for blank screens or API errors
- Priority 2: Supabase schema alignment (check api_keys JSONB column exists, credit_transactions type constraint includes 'usage')
- Priority 3: Missing backend routes (social analytics, social boost, workflow CRUD)

## Derek Notes

Main goal:

Launch Bmapz AI as a standalone, market-ready, scalable app for non-technical sales and marketing professionals.

Production:

`https://ai.bmapz.com`

Local project:

`C:\Users\derek\OneDrive\Documents\Bmapz App`

## Update Template

```text
Owner:
Time:
Status:
Task:
Files touched:
Commands run:
Result:
Next step:
Question for Derek:
```
