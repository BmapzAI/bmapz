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
| Codex | Done | Build check completed; 16 parser errors logged | 2026-05-18 |
| Claude | **✅ DONE** | All frontend parser errors fixed; **build passes** | 2026-05-18 |
| Derek | Review ready | Frontend builds clean — ready for env config, deployment test, and Phase 2 | 2026-05-18 |

## Current Blocker

**None — frontend build is passing.**

```
✓ 3554 modules transformed.
✓ built in 26.81s
dist/assets/index-DLH6jRGr.js  2,965 kB │ gzip: 829 kB
```

Warnings (non-blocking):
- Supabase is both statically and dynamically imported — harmless, no code split needed now
- Main chunk is 2.9 MB (large SPA) — acceptable for now; could be split later

Backend check:

```
npm run build:backend → passed (no compile step for Node.js ESM)
```

## Next Best Step

**For Codex:**
1. Verify `.env` / environment variables are set on Cloudflare Pages for the frontend build (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL`).
2. Push code and trigger a Cloudflare Pages deploy.
3. Smoke-test `https://ai.bmapz.com` after deploy.
4. Begin Phase 2 work from `docs/CODE_AUDIT_2026-05-18.md` (Supabase schema alignment, missing API routes, OAuth flows).

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

Claude should write updates here in plain English:

- what changed
- what passed
- what failed
- what Codex should inspect next

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
