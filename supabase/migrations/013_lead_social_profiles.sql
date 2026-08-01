-- 013: lead social profile columns
--
-- The "Add lead" form collects Instagram/Facebook/TikTok handles and a LinkedIn
-- profile, but those columns never existed. POST /api/leads inserted the request
-- body as-is, so Postgres rejected the unknown column and the whole insert
-- failed — the user just saw "Failed to add lead".
--
-- These columns are added here, and routes/leads.js now filters to a known field
-- list (mapping the form's `linkedin_profile` onto the existing `linkedin_url`)
-- so an unexpected field can never break lead creation again.

begin;

alter table public.leads add column if not exists company_instagram text;
alter table public.leads add column if not exists company_facebook text;
alter table public.leads add column if not exists company_tiktok text;

commit;
