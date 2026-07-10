-- AI Automations (cron jobs) + Design Studio templates.
-- Backend accesses these tables with the service-role key; RLS policies
-- mirror the company-scoped pattern used across the schema so direct
-- client access (if ever enabled) stays safe.

begin;

-- ============================================================
-- AI AUTOMATIONS — scheduled prompts/tasks executed by the backend
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ai_automations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  -- What to do on each run. 'ai_prompt' runs the prompt through the company
  -- AI brain and stores the result in ai_outputs for review/approval.
  task_type TEXT NOT NULL DEFAULT 'ai_prompt' CHECK (task_type IN ('ai_prompt')),
  prompt TEXT NOT NULL,
  output_category TEXT DEFAULT 'strategies',
  -- Schedule
  schedule_type TEXT NOT NULL DEFAULT 'daily'
    CHECK (schedule_type IN ('every_minutes','hourly','daily','weekly','monthly')),
  interval_minutes INTEGER,        -- for every_minutes
  run_minute INTEGER DEFAULT 0,    -- 0-59
  run_hour INTEGER DEFAULT 9,      -- 0-23 (daily/weekly/monthly)
  run_day_of_week INTEGER,         -- 0-6, Sunday=0 (weekly)
  run_day_of_month INTEGER,        -- 1-28 (monthly)
  enabled BOOLEAN DEFAULT TRUE,
  -- Execution bookkeeping
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  last_status TEXT,                -- 'success' | 'error'
  last_result JSONB DEFAULT '{}',
  run_count INTEGER DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_automations_company ON public.ai_automations(company_id);
CREATE INDEX IF NOT EXISTS idx_ai_automations_due ON public.ai_automations(enabled, next_run_at);

ALTER TABLE public.ai_automations ENABLE ROW LEVEL SECURITY;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'ai_automations'
      and policyname = 'company_member_access'
  ) then
    create policy company_member_access on public.ai_automations
      for all to authenticated
      using (
        company_id in (select company_id from public.users where id = (select auth.uid()))
        or exists (select 1 from public.users where id = (select auth.uid()) and role = 'system_admin')
      )
      with check (
        company_id in (select company_id from public.users where id = (select auth.uid()))
        or exists (select 1 from public.users where id = (select auth.uid()) and role = 'system_admin')
      );
  end if;
end $$;

-- ============================================================
-- DESIGN TEMPLATES — per-company brand design presets (Design Studio)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.design_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  -- Full design document: { format, aspect_ratio, slides: [{ background, layers: [...] }] }
  config JSONB NOT NULL DEFAULT '{}',
  thumbnail_url TEXT,
  is_brand_preset BOOLEAN DEFAULT FALSE,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_design_templates_company ON public.design_templates(company_id);

ALTER TABLE public.design_templates ENABLE ROW LEVEL SECURITY;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'design_templates'
      and policyname = 'company_member_access'
  ) then
    create policy company_member_access on public.design_templates
      for all to authenticated
      using (
        company_id in (select company_id from public.users where id = (select auth.uid()))
        or exists (select 1 from public.users where id = (select auth.uid()) and role = 'system_admin')
      )
      with check (
        company_id in (select company_id from public.users where id = (select auth.uid()))
        or exists (select 1 from public.users where id = (select auth.uid()) and role = 'system_admin')
      );
  end if;
end $$;

commit;
