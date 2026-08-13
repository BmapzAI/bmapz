-- 031: Task management
--
-- Work management for the "My Tasks" surface: the tab in the AI Chat section
-- (kanban / list / calendar), the Home widget (To do / Doing / Done), and the
-- table-entry mode in AI chat. Tasks are assignable to a teammate or to the AI
-- agent, followable, prioritised, scheduled, and connected to the section they
-- came from so the AI can act on them.
--
-- ── A DELIBERATE DESIGN NOTE ON FOREIGN KEYS ────────────────────────────────
-- `tasks` references `users` THREE times: created_by, assignee_id, completed_by.
-- That is intentional and safe, but it means a PostgREST embed like
-- `tasks(*, users(*))` is AMBIGUOUS and will fail — the same class of failure
-- that migration 021 caused when it gave `users` a second FK to `companies` and
-- took the whole app down, because `select('*, companies(*)')` could no longer
-- resolve.
--
-- So: the backend NEVER implicitly embeds users on tasks. It resolves the people
-- in a second query and merges (see routes/tasks.js `attachPeople`), the same
-- pattern middleware/auth.js `loadDbUser` adopted after that outage. If an embed
-- is ever genuinely needed it MUST name the constraint, e.g.
--   assignee:users!tasks_assignee_id_fkey ( id, full_name, username )
--
-- No new foreign key is added to any EXISTING table pair here, so this migration
-- cannot break an existing embed anywhere in the app.

create extension if not exists pgcrypto;

create table if not exists public.tasks (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies(id) on delete cascade,

  title             text not null,
  description       text,

  -- 'blocked' and 'cancelled' exist so a task can leave the board without being
  -- deleted; the three visible columns are todo / doing / done.
  status            text not null default 'todo'
                      check (status in ('todo', 'doing', 'done', 'blocked', 'cancelled')),
  priority          text not null default 'medium'
                      check (priority in ('low', 'medium', 'high', 'urgent')),

  due_at            timestamptz,

  -- Manual ordering inside a column. A float, not an integer, so dragging a card
  -- between two others is a single UPDATE (midpoint) instead of renumbering the
  -- whole column.
  position          double precision not null default 0,

  -- 'private' = only the creator and the assignee may see it. 'company' = anyone
  -- in the company. Enforced in the backend (which runs as service_role and so
  -- bypasses RLS) and mirrored in the policy below.
  visibility        text not null default 'company'
                      check (visibility in ('company', 'private')),

  created_by        uuid references public.users(id) on delete set null,

  -- Who is doing the work. 'ai' means the Bmapz agent owns it; assignee_id is
  -- then null. Kept as an explicit type rather than a magic user row so the AI
  -- never needs a fake account.
  assignee_type     text not null default 'unassigned'
                      check (assignee_type in ('user', 'ai', 'unassigned')),
  assignee_id       uuid references public.users(id) on delete set null,

  -- Where the task came from / which part of the product can act on it.
  section           text default 'general'
                      check (section in ('general', 'ads', 'sales', 'workflow', 'inbox',
                                         'blog', 'sdr', 'seo', 'social', 'design', 'dashboard')),
  -- Optional pointer to the thing the task is about. Deliberately NOT a foreign
  -- key: it points at different tables depending on linked_type, and adding real
  -- FKs to leads/campaigns/posts would add more embed ambiguity for no benefit.
  linked_type       text,
  linked_id         uuid,

  completed_at      timestamptz,
  completed_by_type text check (completed_by_type in ('user', 'ai', 'system')),
  completed_by      uuid references public.users(id) on delete set null,

  -- What the AI produced when it completed the task, plus a pointer into the
  -- AI Outputs archive so the result is reviewable where every other generation is.
  ai_result         jsonb,
  ai_output_id      uuid,
  ai_error          text,

  metadata          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Followers: anyone in the company can follow a task to be notified about it.
create table if not exists public.task_followers (
  task_id    uuid not null references public.tasks(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, user_id)
);

-- An append-only trail so "who did what" is answerable, including the AI.
create table if not exists public.task_activity (
  id            uuid primary key default gen_random_uuid(),
  task_id       uuid not null references public.tasks(id) on delete cascade,
  company_id    uuid not null references public.companies(id) on delete cascade,
  activity_type text not null,          -- created|status_changed|assigned|commented|ai_completed|…
  summary       text,
  details       jsonb not null default '{}'::jsonb,
  actor_type    text not null default 'user' check (actor_type in ('user', 'ai', 'system')),
  actor_user_id uuid references public.users(id) on delete set null,
  actor_label   text,
  created_at    timestamptz not null default now()
);

-- ── Indexes ─────────────────────────────────────────────────────────────────
-- The board query is always company + status, ordered by position.
create index if not exists idx_tasks_company_status on public.tasks (company_id, status, position);
create index if not exists idx_tasks_assignee       on public.tasks (assignee_id) where assignee_id is not null;
create index if not exists idx_tasks_created_by     on public.tasks (created_by)  where created_by  is not null;
-- Calendar view + overdue sweeps.
create index if not exists idx_tasks_due            on public.tasks (company_id, due_at) where due_at is not null;
-- The AI worker picks up tasks assigned to it that are not finished.
create index if not exists idx_tasks_ai_pending     on public.tasks (company_id, status)
  where assignee_type = 'ai' and status in ('todo', 'doing');
create index if not exists idx_task_followers_user  on public.task_followers (user_id);
create index if not exists idx_task_activity_task   on public.task_activity (task_id, created_at desc);

-- ── updated_at ──────────────────────────────────────────────────────────────
drop trigger if exists trg_updated_tasks on public.tasks;
create trigger trg_updated_tasks before update on public.tasks
  for each row execute function public.update_updated_at();

-- ── Per-user setting: hand new tasks to the AI automatically ────────────────
alter table public.users add column if not exists auto_assign_tasks_to_ai boolean not null default false;

-- ── Access ──────────────────────────────────────────────────────────────────
-- Consistent with migration 029: clients never reach tables directly (the
-- frontend uses Supabase for auth only and all data flows through the backend on
-- the service-role key). RLS is enabled with a correct company-scoped read policy
-- as a second layer, and no grant is issued to anon/authenticated.
--
-- 029's `alter default privileges ... revoke all on tables from anon,
-- authenticated` means these tables are born WITHOUT client grants — this is that
-- protection doing its job — but the revokes are repeated explicitly so the
-- guarantee is visible here and survives being created by another role.
alter table public.tasks          enable row level security;
alter table public.task_followers enable row level security;
alter table public.task_activity  enable row level security;

revoke all privileges on public.tasks          from anon, authenticated;
revoke all privileges on public.task_followers from anon, authenticated;
revoke all privileges on public.task_activity  from anon, authenticated;

-- auth.uid() wrapped in a sub-select so it is evaluated once per query, not once
-- per row (Supabase lint 0003).
create policy tasks_company_read on public.tasks
  for select to authenticated
  using (
    company_id in (
      select users.company_id from public.users where users.id = (select auth.uid())
      union
      select unnest(users.accessible_company_ids) from public.users where users.id = (select auth.uid())
    )
    and (
      visibility = 'company'
      or created_by  = (select auth.uid())
      or assignee_id = (select auth.uid())
    )
  );

create policy task_followers_own_read on public.task_followers
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy task_activity_company_read on public.task_activity
  for select to authenticated
  using (
    company_id in (
      select users.company_id from public.users where users.id = (select auth.uid())
      union
      select unnest(users.accessible_company_ids) from public.users where users.id = (select auth.uid())
    )
  );

-- ── REPORT ──────────────────────────────────────────────────────────────────
select 'tasks tables created' as check,
       (select count(*)::text from information_schema.tables
        where table_schema = 'public'
          and table_name in ('tasks', 'task_followers', 'task_activity')) || ' of 3' as detail
union all
select 'auto_assign_tasks_to_ai on users',
       case when exists (select 1 from information_schema.columns
                         where table_schema = 'public' and table_name = 'users'
                           and column_name = 'auto_assign_tasks_to_ai')
            then 'yes' else 'MISSING' end
union all
select 'client grants on new tables (must be none)',
       coalesce((select string_agg(distinct table_name, ', ')
                 from information_schema.role_table_grants
                 where table_schema = 'public'
                   and table_name in ('tasks', 'task_followers', 'task_activity')
                   and grantee in ('anon', 'authenticated')), '(none - good)');
