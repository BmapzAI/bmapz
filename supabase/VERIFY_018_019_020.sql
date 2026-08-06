-- Paste this whole block into the Supabase SQL editor and press Run.
-- Every row should say PASS. Anything that says FAIL tells you exactly what to
-- re-run. This only READS — it changes nothing.

with checks as (
  -- 018: internal role lockdown
  select '018 trigger on users' as check_name,
         exists (select 1 from pg_trigger
                 where tgname = 'trg_enforce_internal_role_company'
                   and tgrelid = 'public.users'::regclass) as ok
  union all
  select '018 function enforce_internal_role_company',
         exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where p.proname = 'enforce_internal_role_company' and n.nspname = 'public')
  union all
  select '018 no system_admin outside platform company',
         not exists (
           select 1 from public.users u
           where u.role = 'system_admin'
             and u.company_id is distinct from (
               select company_id from public.users
               where role = 'owner' order by created_at asc limit 1)
         )

  -- 019: outcomes + learning + atomic credits
  union all
  select '019 brain_learnings table',
         exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'brain_learnings')
  union all
  select '019 brain_learnings RLS enabled',
         coalesce((select relrowsecurity from pg_class where oid = 'public.brain_learnings'::regclass), false)
  union all
  select '019 consume_ai_credits function',
         exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where p.proname = 'consume_ai_credits' and n.nspname = 'public')
  union all
  select '019 idx_ai_outputs_status',
         exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'idx_ai_outputs_status')
  union all
  select '019 idx_ai_outputs_company_created',
         exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'idx_ai_outputs_company_created')

  -- 020: drafts kept in place
  union all
  select '020 ads.copy_drafts column',
         exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'ads' and column_name = 'copy_drafts')
  union all
  select '020 ads.copy_drafts_at column',
         exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'ads' and column_name = 'copy_drafts_at')
  union all
  select '020 ad_campaigns.ai_plan column',
         exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'ad_campaigns' and column_name = 'ai_plan')
)
select case when ok then 'PASS' else 'FAIL' end as result, check_name
from checks
order by ok asc, check_name;

-- Functional test of the atomic credit deduction (safe: adds 0 credits).
-- Should return a number, not an error.
select public.consume_ai_credits(
  (select id from public.subscriptions order by created_at desc limit 1), 0
) as consume_ai_credits_returns;

-- Who currently holds internal roles? Expect ONLY your own platform-company users.
select email, role, company_id
from public.users
where role in ('owner', 'system_admin')
order by role, email;
