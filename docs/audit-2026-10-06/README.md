# Integration re-verification, 2026-10-06/07 - raw evidence

One JSON per finished agent. `verify-*` = adversarial re-check of the 2026-09-23 research as of today (claims with verdicts and quotes,
corrected setup steps, costs, launch requirements). `audit-*` = the code compared with current vendor docs (findings with file:line, doc quote,
exact fix; pinned versions; test cases).

DONE (all medium confidence; NONE run by a human against a real console): verify + audit for google, meta, linkedin_x, tiktok_canva, stripe_resend,
perplexity_prospecting (Perplexity / Apollo / Hunter / Stability).

ALSO DONE (added 2026-10-07): `audit-llm_models.json` (OpenAI / Anthropic model ids, API versions, credit pricing; its findings are fixed in commit f22a005, see AGENT_HANDOFF.md) and
`mobile-research.md` / `.json` (store rules, OAuth in a native shell, enrolment costs; single-source, not adversarially verified, and written WITHOUT knowing which mobile approach was chosen).
If a file is absent here, that work is still open: re-run only that piece.

Not an agent audit but worth knowing: on 2026-10-07 every write to the billing tables was compared with the LIVE database constraints (see AGENT_HANDOFF.md, "Money paths, second pass"); `backend/tests/billing-ledger-and-portal.test.mjs` keeps that comparison from rotting.

`docs/INTEGRATIONS_RUNBOOK.md` is generated from the `verify-*.corrected_setup_steps` here: `node docs/tools/gen-runbook.cjs`.
File names were once mis-assigned by a case-sensitive matcher (the agent had written "stripe-resend" with a hyphen): trust the `group` field INSIDE a file, not only its name.
