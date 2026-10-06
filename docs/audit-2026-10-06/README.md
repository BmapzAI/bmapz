# Integration re-verification, 2026-10-06 - raw evidence

One JSON per finished agent. `verify-*` = adversarial re-check of the 2026-09-23 research as of today
(claims with verdicts and quotes, corrected setup steps, costs, launch requirements). `audit-*` = the code
compared with current vendor docs (findings with file:line, doc quote, exact fix; pinned versions; test cases).

HAVE: verify + audit for google, meta, linkedin_x, tiktok_canva, stripe_resend (all medium confidence, none run by a human).
NOT FINISHED (the usage limit stopped the run): verify + audit for perplexity_prospecting (Perplexity/Apollo/Hunter/Stability),
and the audit for llm_models (OpenAI/Anthropic model ids). Re-run only those.
The setup steps in `verify-*.corrected_setup_steps` are the source for docs/INTEGRATIONS_RUNBOOK.md, which is NOT written yet.
