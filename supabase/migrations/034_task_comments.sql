-- 034: Comments on tasks, including instructions aimed at the AI agent
--
-- A task could be completed but not discussed, and an AI result could be wrong
-- with no way to say what to fix short of deleting the task and starting again.
-- Comments make a finished task correctable: leaving one addressed to the agent
-- re-runs the work WITH that feedback, and the thread records why the result
-- changed.
--
-- `directed_to_ai` distinguishes "note for the team" from "agent, redo it like
-- this", so the history reads correctly later.
--
-- Adds no column or foreign key to any existing table pair, so it cannot make a
-- PostgREST embed ambiguous the way 021 did. Client grants are revoked and RLS
-- enabled, consistent with 029.

create table if not exists public.task_comments (
  id            uuid primary key default gen_random_uuid(),
  task_id       uuid not null references public.tasks(id) on delete cascade,
  company_id    uuid not null references public.companies(id) on delete cascade,
  body          text not null,
  author_type   text not null default 'user' check (author_type in ('user', 'ai')),
  author_id     uuid references public.users(id) on delete set null,
  directed_to_ai boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists idx_task_comments_task on public.task_comments (task_id, created_at);

alter table public.task_comments enable row level security;
revoke all privileges on public.task_comments from anon, authenticated;

drop policy if exists task_comments_company_read on public.task_comments;
create policy task_comments_company_read on public.task_comments
  for select to authenticated
  using (
    company_id in (
      select users.company_id from public.users where users.id = (select auth.uid())
      union
      select unnest(users.accessible_company_ids) from public.users where users.id = (select auth.uid())
    )
  );

select 'task_comments created' as check,
       case when exists (select 1 from information_schema.tables
                         where table_schema='public' and table_name='task_comments')
            then 'yes' else 'MISSING' end as detail
union all
select 'client grants (must be none)',
       coalesce((select string_agg(distinct grantee, ', ') from information_schema.role_table_grants
                 where table_schema='public' and table_name='task_comments'
                   and grantee in ('anon','authenticated')), '(none - good)');
