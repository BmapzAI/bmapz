-- Notifications, SDR (client-facing sales bot), and workflow triggers.
-- Backend accesses these with the service-role key; RLS mirrors the
-- company-scoped pattern used across the schema.

begin;

-- ============================================================
-- NOTIFICATIONS — in-app updates for the whole company
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID,                 -- null = whole company; set = a specific user
  type TEXT NOT NULL DEFAULT 'info',   -- info | lead | handover | sdr | workflow | qualification | system
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,                    -- in-app path, e.g. /Sales or /SDR
  icon TEXT,                    -- optional emoji
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low','normal','high')),
  read BOOLEAN DEFAULT FALSE,
  lead_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_company ON public.notifications(company_id, read, created_at DESC);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='notifications' and policyname='company_member_access') then
    create policy company_member_access on public.notifications for all to authenticated
      using (company_id in (select company_id from public.users where id = (select auth.uid()))
             or exists (select 1 from public.users where id = (select auth.uid()) and role = 'system_admin'))
      with check (company_id in (select company_id from public.users where id = (select auth.uid()))
             or exists (select 1 from public.users where id = (select auth.uid()) and role = 'system_admin'));
  end if;
end $$;

-- ============================================================
-- SDR AGENTS — one client-facing sales-development bot config per company
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sdr_agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID,                    -- per-USER SDR (each user names/tunes their own); NULL = company default
  enabled BOOLEAN DEFAULT FALSE,
  name TEXT,                       -- defaults to company.personal_agent_name, user-settable
  greeting TEXT,
  goal TEXT,
  persona TEXT,
  guardrails TEXT,
  show_prices BOOLEAN DEFAULT FALSE,
  products JSONB DEFAULT '[]',     -- [{name, description, price?, how_to_pitch, conditions}]
  qualifying_questions JSONB DEFAULT '[]',  -- [{question, purpose, maps_to}]
  conversation_flow JSONB DEFAULT '[]',     -- ordered steps: ['greeting','reason','qualify','handoff']
  handoff_conditions TEXT,
  handoff_channels JSONB DEFAULT '{"notification":true}', -- {email,sms,notification,whatsapp}
  handoff_recipients TEXT,         -- comma-separated emails/phones
  -- The ONLY outcomes the SDR is allowed to decide (a hard guardrail).
  allowed_outcomes JSONB DEFAULT '["offer_product","handover","qualified","not_qualified","support"]',
  outcomes JSONB DEFAULT '{}',     -- extra per-outcome config
  channels JSONB DEFAULT '["whatsapp","email","instagram"]', -- where the SDR is active
  ai_configured BOOLEAN DEFAULT FALSE, -- true once Company Brain autofill has run
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- One SDR config per (company, user). NULLs are distinct in Postgres unique
-- indexes, so COALESCE pins a single company-default row (user_id NULL).
CREATE UNIQUE INDEX IF NOT EXISTS idx_sdr_agents_company_user
  ON public.sdr_agents(company_id, COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid));
ALTER TABLE public.sdr_agents ENABLE ROW LEVEL SECURITY;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='sdr_agents' and policyname='company_member_access') then
    create policy company_member_access on public.sdr_agents for all to authenticated
      using (company_id in (select company_id from public.users where id = (select auth.uid()))
             or exists (select 1 from public.users where id = (select auth.uid()) and role = 'system_admin'))
      with check (company_id in (select company_id from public.users where id = (select auth.uid()))
             or exists (select 1 from public.users where id = (select auth.uid()) and role = 'system_admin'));
  end if;
end $$;

-- ============================================================
-- SDR CONVERSATIONS — client-facing threads handled by the SDR
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sdr_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  channel TEXT DEFAULT 'web',
  contact_name TEXT,
  contact_handle TEXT,             -- email/phone/ig id of the prospect
  status TEXT DEFAULT 'active' CHECK (status IN ('active','qualified','not_qualified','handed_over','support','closed')),
  outcome TEXT,                    -- offer_product | handover | qualified | not_qualified | support | none
  messages JSONB DEFAULT '[]',     -- [{role:'client'|'sdr'|'human', content, at}]
  qualification JSONB DEFAULT '{}',-- extracted answers {question: answer}
  notes JSONB DEFAULT '[]',        -- internal-only SDR reasoning / conditions followed
  human_takeover BOOLEAN DEFAULT FALSE, -- true once a human replied via Inbox → SDR stops auto-replying
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sdr_conversations_company ON public.sdr_conversations(company_id, last_message_at DESC);
ALTER TABLE public.sdr_conversations ENABLE ROW LEVEL SECURITY;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='sdr_conversations' and policyname='company_member_access') then
    create policy company_member_access on public.sdr_conversations for all to authenticated
      using (company_id in (select company_id from public.users where id = (select auth.uid()))
             or exists (select 1 from public.users where id = (select auth.uid()) and role = 'system_admin'))
      with check (company_id in (select company_id from public.users where id = (select auth.uid()))
             or exists (select 1 from public.users where id = (select auth.uid()) and role = 'system_admin'));
  end if;
end $$;

-- ============================================================
-- WORKFLOW TRIGGERS + lead cleanup
-- ============================================================
-- Event that auto-enrolls leads into a workflow. 'manual' = enroll by hand.
ALTER TABLE public.workflows ADD COLUMN IF NOT EXISTS trigger_type TEXT DEFAULT 'manual';
ALTER TABLE public.workflows ADD COLUMN IF NOT EXISTS trigger_config JSONB DEFAULT '{}';

-- Columns the Sales UI already writes but the schema was missing.
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS disqualification_reason TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS disqualification_notes TEXT;

commit;
