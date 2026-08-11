-- 028: Database-level protection against duplicated data
--
-- The application now checks for duplicates before writing, but a check-then-
-- insert is always racy: two concurrent requests can both pass the check. These
-- indexes make the guarantee durable, so a duplicate is impossible rather than
-- merely unlikely.
--
-- SAFE BY DESIGN: each index is created ONLY if the table currently has no
-- duplicates. If it does, the migration raises a NOTICE naming the table and
-- moves on instead of failing — so this cannot abort, and it never deletes
-- anything. Run the report at the bottom to see what needs attention.
--
-- Adds no foreign keys, so it cannot make an existing PostgREST embed ambiguous
-- the way 021 did.

-- Helper: create a unique index only when it would not be violated.
create or replace function public._try_unique_index(
  idx_name text, table_name text, index_expr text, dup_check_sql text
) returns void
language plpgsql
as $$
declare
  dup_count integer;
begin
  if exists (select 1 from pg_indexes where schemaname = 'public' and indexname = idx_name) then
    raise notice 'SKIP %: already exists', idx_name;
    return;
  end if;

  execute dup_check_sql into dup_count;
  if dup_count > 0 then
    raise notice 'SKIP %: % duplicate group(s) exist in public.% — resolve them, then re-run this migration',
      idx_name, dup_count, table_name;
    return;
  end if;

  execute format('create unique index %I on public.%I %s', idx_name, table_name, index_expr);
  raise notice 'CREATED %', idx_name;
end;
$$;

-- 1. One stored message per platform message id. Stops a replayed webhook
--    delivery (Meta retries at-least-once) creating a second copy.
select public._try_unique_index(
  'uq_messages_platform_message_id', 'messages',
  '(platform_message_id) where platform_message_id is not null',
  $$select count(*) from (
      select platform_message_id from public.messages
      where platform_message_id is not null
      group by platform_message_id having count(*) > 1
    ) d$$
);

-- 2. One credit transaction per payment reference. Stops a replayed Stripe
--    event granting the same paid add-on twice.
select public._try_unique_index(
  'uq_credit_tx_payment_ref', 'credit_transactions',
  '((metadata->>''payment_ref'')) where (metadata->>''payment_ref'') is not null',
  $$select count(*) from (
      select metadata->>'payment_ref' as ref from public.credit_transactions
      where (metadata->>'payment_ref') is not null
      group by 1 having count(*) > 1
    ) d$$
);

-- 3. One ACTIVE workflow run per (workflow, lead). Stops double enrolment, and
--    stops the "already enrolled?" guard breaking once duplicates exist.
select public._try_unique_index(
  'uq_workflow_runs_active', 'workflow_runs',
  '(workflow_id, lead_id) where status = ''active'' and lead_id is not null',
  $$select count(*) from (
      select workflow_id, lead_id from public.workflow_runs
      where status = 'active' and lead_id is not null
      group by 1, 2 having count(*) > 1
    ) d$$
);

-- 4. One SDR agent per (company, user). The company default is the row where
--    user_id is null, so it needs its own index.
select public._try_unique_index(
  'uq_sdr_agents_company_user', 'sdr_agents',
  '(company_id, user_id) where user_id is not null',
  $$select count(*) from (
      select company_id, user_id from public.sdr_agents
      where user_id is not null group by 1, 2 having count(*) > 1
    ) d$$
);
select public._try_unique_index(
  'uq_sdr_agents_company_default', 'sdr_agents',
  '(company_id) where user_id is null',
  $$select count(*) from (
      select company_id from public.sdr_agents
      where user_id is null group by 1 having count(*) > 1
    ) d$$
);

-- 5. One subscription per company. Several endpoints read it with .single(),
--    which ERRORS when a second row exists — so a duplicate here silently breaks
--    billing reads across the app.
select public._try_unique_index(
  'uq_subscriptions_company', 'subscriptions',
  '(company_id)',
  $$select count(*) from (
      select company_id from public.subscriptions
      group by company_id having count(*) > 1
    ) d$$
);

drop function if exists public._try_unique_index(text, text, text, text);

-- ── REPORT: anything the migration had to skip shows up here with a count. ───
select 'messages.platform_message_id' as what, count(*) as duplicate_groups from (
  select platform_message_id from public.messages
  where platform_message_id is not null group by 1 having count(*) > 1) d
union all
select 'credit_transactions.payment_ref', count(*) from (
  select metadata->>'payment_ref' from public.credit_transactions
  where (metadata->>'payment_ref') is not null group by 1 having count(*) > 1) d
union all
select 'workflow_runs active (workflow, lead)', count(*) from (
  select workflow_id, lead_id from public.workflow_runs
  where status = 'active' and lead_id is not null group by 1,2 having count(*) > 1) d
union all
select 'sdr_agents (company, user)', count(*) from (
  select company_id, user_id from public.sdr_agents
  where user_id is not null group by 1,2 having count(*) > 1) d
union all
select 'subscriptions per company', count(*) from (
  select company_id from public.subscriptions group by 1 having count(*) > 1) d;
