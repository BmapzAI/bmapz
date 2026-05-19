# Bmapz App Agent Guide

This repository is shared between Codex and Claude Code.

## Project

- Name: Bmapz App / BmapzAI
- Production URL: `https://ai.bmapz.com`
- Local workspace: `C:\Users\derek\OneDrive\Documents\Bmapz App`
- Imported source: Claude local agent output `bmapz-standalone`
- Stack: Vite + React frontend, Express backend, Supabase, Railway, Cloudflare Pages.

## Coordination Rules

- Check `AGENT_HANDOFF.md` before starting work.
- Claim the files or modules you will edit in `AGENT_HANDOFF.md`.
- Do not edit files claimed by another agent unless the handoff says they are released.
- Before switching agents, run `git status --short` and summarize what changed in `AGENT_HANDOFF.md`.
- Prefer small, reviewable changes with tests or verification notes.
- Never revert another agent's changes unless the user explicitly asks.

## Git Workflow

- Use branches prefixed with `codex/` for Codex work and `claude/` for Claude work.
- Main branch is `main`.
- Commit only coherent work units.
- Keep commit messages concrete, for example `Add shared agent handoff docs`.

## Commands

```powershell
npm run install:all
npm run dev:frontend
npm run dev:backend
npm run build:frontend
npm run build:backend
npm run lint
```

## Deployment Notes

- Railway runs the backend via `nixpacks.toml` / `Procfile`.
- Cloudflare Pages builds the frontend with `npm run build:frontend`.
- Supabase schema/migrations live in `supabase/`.
- Keep secrets out of Git. Use `.env.example`, `backend/.env.example`, and deployment platform variables.

If the active app code lives in another folder, update this section before implementation work starts.
