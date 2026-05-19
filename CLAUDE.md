# Bmapz App Claude Code Guide

Claude Code and Codex are expected to collaborate in this repository.

## Project Context

- Project: Bmapz App / BmapzAI
- Production: `https://ai.bmapz.com`
- Local path: `C:\Users\derek\OneDrive\Documents\Bmapz App`
- Source was imported from Claude local agent output: `bmapz-standalone`.
- Stack: Vite + React frontend, Express backend, Supabase, Railway, Cloudflare Pages.

## Start Here

1. Read `AGENT_HANDOFF.md`.
2. Confirm which files are currently claimed.
3. Add your task, owner, and planned files before editing.
4. Release or update your claim when you finish.

## Collaboration Contract

- Do not overwrite Codex changes.
- Do not run destructive Git commands unless the user explicitly asks.
- Keep implementation notes concise and useful for the next agent.
- If you discover the real app source is in a neighboring folder or archive, record the exact path in `AGENT_HANDOFF.md` before moving files.

## Useful Commands

```powershell
git status --short --branch
git diff
git log --oneline --decorate -5
npm run install:all
npm run dev:frontend
npm run dev:backend
npm run build:frontend
npm run build:backend
npm run lint
```

## Guardrails

- Do not commit real `.env` files or production secrets.
- Do not change Railway, Cloudflare, Supabase, or GitHub deployment settings unless the task explicitly requires it.
- If touching auth, billing, OAuth, or Supabase RLS/schema, document verification steps in `AGENT_HANDOFF.md`.
- Prefer small changes and leave a clear handoff for Codex.
