-- 010: Lead ownership + lead history
--
-- A lead belongs to exactly ONE person on the sales team (leads.owner_id).
-- The owner is visible to everyone in the company (company-scoped RLS below),
-- and every step of the lead's handling is appended to lead_activities so the
-- whole company can see who did what, when — including automated steps taken by
-- the SDR agent and by workflows.

begin;

-- ── Single owner ─────────────────────────────────────────────────────────────
alter table public.leads
  add column if not exists owner_id uuid references public.users(id) on delete set null;

alter table public.leads
  add column if not exists owner_assigned_at timestamptz;

create index if not exists idx_leads_owner
  on public.leads(company_id, owner_id);

-- ── History / activity timeline ──────────────────────────────────────────────
create table if not exists public.lead_activities (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  -- Who did it: a real user, or an automated actor.
  actor_user_id uuid references public.users(id) on delete set null,
  actor_type text not null default 'user'
    check (actor_type in ('user', 'sdr', 'workflow', 'system', 'ai')),
  actor_label text,
  -- What happened.
  activity_type text not null,
  summary text not null,
  details jsonb default '{}',
  created_at timestamptz default now()
);

create index if not exists idx_lead_activities_lead
  on public.lead_activities(lead_id, created_at desc);
create index if not exists idx_lead_activities_company
  on public.lead_activities(company_id, created_at desc);

alter table public.lead_activities enable row level security;

-- The history is deliberately company-wide readable: everyone in the company can
-- see the full handling of any lead, regardless of who owns it.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'lead_activities'
      and policyname = 'company_member_access'
  ) then
    create policy company_member_access on public.lead_activities
      for all to authenticated
      using (
        company_id in (select company_id from public.users where id = (select auth.uid()))
        or exists (
          select 1 from public.users
          where id = (select auth.uid()) and role in ('owner', 'system_admin')
        )
      )
      with check (
        company_id in (select company_id from public.users where id = (select auth.uid()))
        or exists (
          select 1 from public.users
          where id = (select auth.uid()) and role in ('owner', 'system_admin')
        )
      );
  end if;
end $$;

commit;
