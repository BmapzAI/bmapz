-- 011: Sales team membership + per-member availability
--
-- A company admin decides WHO is on the sales team. Each sales team member then
-- sets their own availability, which controls whether new leads can be assigned
-- to them:
--
--   online   → available for lead assignment (leads can be routed to this person)
--   standby  → NOT available; the SDR agent handles the lead instead
--   offline  → not available for lead assignment at all
--
-- Membership is admin-controlled; status is self-controlled (see routes/users.js).

begin;

alter table public.users
  add column if not exists is_sales_team boolean default false;

alter table public.users
  add column if not exists sales_status text default 'offline';

-- Add the CHECK separately so re-running on an existing column is safe.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'users_sales_status_check'
  ) then
    alter table public.users
      add constraint users_sales_status_check
      check (sales_status in ('online', 'standby', 'offline'));
  end if;
end $$;

alter table public.users
  add column if not exists sales_status_updated_at timestamptz;

-- Fast lookup of "who can take a lead right now" for this company.
create index if not exists idx_users_sales_availability
  on public.users(company_id, is_sales_team, sales_status)
  where is_sales_team = true;

commit;
