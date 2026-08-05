-- 019: AI output outcomes + brain learning + atomic credit deduction
-- Supports: the AI Outputs archive (outcome filtering at the DB level), the
-- company-brain learning loop, and race-free credit accounting.

-- ── 1. ai_outputs: outcome lives in metadata->>'status' (the app-wide
--       convention every writer/reader already uses). These expression indexes
--       make archive filtering and the brain's outcome reads cheap.
create index if not exists idx_ai_outputs_status
  on public.ai_outputs ((metadata->>'status'));
create index if not exists idx_ai_outputs_company_created
  on public.ai_outputs (company_id, created_at desc);
create index if not exists idx_ai_outputs_type
  on public.ai_outputs (type);

-- ── 2. brain_learnings: persistent, per-scope lessons the brain feeds back
--       into every generation. scope='company' rows belong to one company
--       (tenant-isolated); scope='global' rows hold PLATFORM-WIDE AGGREGATE
--       stats only — never company content — and are readable in full only by
--       the App Owner (enforced in the API layer; service role bypasses RLS).
create table if not exists public.brain_learnings (
  id uuid primary key default uuid_generate_v4(),
  scope text not null check (scope in ('company', 'global')),
  company_id uuid references public.companies(id) on delete cascade,
  category text not null default 'general',
  lesson text,
  evidence jsonb default '{}',          -- counters: approved/rejected/edited/pending, samples
  outcomes_since_distill integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint brain_learnings_scope_company check (
    (scope = 'company' and company_id is not null) or
    (scope = 'global' and company_id is null)
  )
);
create unique index if not exists idx_brain_learnings_company_cat
  on public.brain_learnings (company_id, category) where scope = 'company';
create unique index if not exists idx_brain_learnings_global_cat
  on public.brain_learnings (category) where scope = 'global';

alter table public.brain_learnings enable row level security;
-- Company members may read their own company's lessons; global rows are
-- API-layer only (service role). No anon access.
drop policy if exists brain_learnings_company_read on public.brain_learnings;
create policy brain_learnings_company_read on public.brain_learnings
  for select using (
    scope = 'company' and company_id in (
      select company_id from public.users where id = auth.uid()
    )
  );

-- ── 3. Atomic credit deduction: the old read-modify-write raced under
--       concurrent generations (both read used=X, both wrote X+cost, one
--       deduction lost). One UPDATE = one atomic increment.
create or replace function public.consume_ai_credits(p_subscription_id uuid, p_credits numeric)
returns numeric
language sql
as $$
  update public.subscriptions
  set ai_credits_used = coalesce(ai_credits_used, 0) + p_credits
  where id = p_subscription_id
  returning ai_credits_used;
$$;
