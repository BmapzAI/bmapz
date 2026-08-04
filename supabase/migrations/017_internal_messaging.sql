-- 017: Internal team messaging
--
-- Lets people in the SAME company talk to each other inside Bmapz, and share the
-- things they are working on — a lead, a report, a draft post, a campaign, an
-- SDR configuration, an automation, saved AI work — as a rich reference that the
-- recipient can open with one click.
--
-- Distinct from `messages`, which is the CLIENT inbox (prospects, email,
-- WhatsApp). This is staff-to-staff and never leaves the company.

begin;

create table if not exists public.internal_conversations (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  kind text not null default 'dm' check (kind in ('dm', 'group')),
  title text,                                   -- groups only; DMs use the members' names
  created_by uuid references public.users(id) on delete set null,
  last_message_at timestamptz default now(),
  last_message_preview text,
  created_at timestamptz default now()
);

create table if not exists public.internal_conversation_members (
  conversation_id uuid not null references public.internal_conversations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  last_read_at timestamptz,
  muted boolean default false,
  joined_at timestamptz default now(),
  primary key (conversation_id, user_id)
);

create table if not exists public.internal_messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references public.internal_conversations(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  sender_id uuid references public.users(id) on delete set null,
  body text,
  -- A shared item: { kind, id, title, subtitle, path }. `kind` is free text so
  -- new shareable things do not need a migration.
  shared_ref jsonb,
  -- Uploaded files: [{ url, name, type, size }]
  attachments jsonb default '[]',
  edited_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_internal_convs_company
  on public.internal_conversations(company_id, last_message_at desc);
create index if not exists idx_internal_members_user
  on public.internal_conversation_members(user_id, company_id);
create index if not exists idx_internal_messages_conv
  on public.internal_messages(conversation_id, created_at desc);

alter table public.internal_conversations enable row level security;
alter table public.internal_conversation_members enable row level security;
alter table public.internal_messages enable row level security;

-- Company-scoped access. The API additionally checks membership per
-- conversation, so a company member cannot read a thread they are not part of.
do $$
declare t text;
begin
  foreach t in array array['internal_conversations','internal_conversation_members','internal_messages'] loop
    if not exists (
      select 1 from pg_policies
      where schemaname='public' and tablename=t and policyname='company_member_access'
    ) then
      execute format($f$
        create policy company_member_access on public.%I
          for all to authenticated
          using (
            company_id in (select company_id from public.users where id = (select auth.uid()))
            or exists (select 1 from public.users where id = (select auth.uid()) and role in ('owner','system_admin'))
          )
          with check (
            company_id in (select company_id from public.users where id = (select auth.uid()))
            or exists (select 1 from public.users where id = (select auth.uid()) and role in ('owner','system_admin'))
          )
      $f$, t);
    end if;
  end loop;
end $$;

commit;
