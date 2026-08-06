-- EMERGENCY ROLLBACK for migration 021 — only if the app is STILL broken.
--
-- Migration 021 added users.active_company_id, which gave `users` a second
-- foreign key to `companies`. That made PostgREST unable to resolve
-- `select('*, companies(*)')` and took the app down. The deployed backend now
-- names the foreign key explicitly, so this rollback should NOT be needed.
--
-- Run this ONLY if the app still fails to load after the fix is deployed.
-- Cost of running it: the account switcher stops working (everything else is
-- unaffected). It is safe and reversible — re-run 021 to restore.

begin;

drop trigger if exists trg_enforce_active_company_access on public.users;
drop function if exists public.enforce_active_company_access();
drop index if exists idx_users_active_company;

alter table public.users drop column if exists active_company_id;

commit;

-- Confirm the second foreign key is gone (expect exactly ONE row: company_id):
select
  tc.constraint_name,
  kcu.column_name
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
where tc.table_schema = 'public'
  and tc.table_name = 'users'
  and tc.constraint_type = 'FOREIGN KEY'
  and kcu.column_name in ('company_id', 'active_company_id');
