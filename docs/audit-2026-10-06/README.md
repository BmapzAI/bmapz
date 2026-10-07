# Integration re-verification, 2026-10-06/07 - raw evidence

One JSON per finished agent. `verify-*` = adversarial re-check of the 2026-09-23 research as of today (claims with verdicts and quotes,
corrected setup steps, costs, launch requirements). `audit-*` = the code compared with current vendor docs (findings with file:line, doc quote,
exact fix; pinned versions; test cases).

DONE (all medium confidence; NONE run by a human against a real console): verify + audit for google, meta, linkedin_x, tiktok_canva, stripe_resend,
perplexity_prospecting (Perplexity / Apollo / Hunter / Stability).

NOT FINISHED when this was written: the audit of OpenAI / Anthropic model ids and credit pricing (`audit-llm_models.json`), and the mobile-app research
(`mobile-research.md`). If a file is absent here, that work is still open: re-run only that piece.

`docs/INTEGRATIONS_RUNBOOK.md` is generated from the `verify-*.corrected_setup_steps` here: `node docs/tools/gen-runbook.cjs`.
File names were once mis-assigned by a case-sensitive matcher (the agent had written "stripe-resend" with a hyphen): trust the `group` field INSIDE a file, not only its name.
