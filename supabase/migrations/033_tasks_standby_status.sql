-- 033: Add a 'standby' column to the task board, before 'todo'.
--
-- Standby is for work that is real and agreed but not yet ready to start —
-- waiting on someone else, on a date, or on a decision. Without it those cards sat
-- in "To do" and made the column a poor signal of what is actually actionable.
--
-- The CHECK constraint is REWRITTEN rather than dropped: the column is constrained
-- at every moment, and every existing row already satisfies the wider set, so this
-- cannot fail on data. No column, table or foreign key is added, so no PostgREST
-- embed anywhere can become ambiguous.

alter table public.tasks drop constraint if exists tasks_status_check;
alter table public.tasks add constraint tasks_status_check
  check (status in ('standby', 'todo', 'doing', 'done', 'blocked', 'cancelled'));

-- The AI-worker index enumerates the unfinished statuses, so it has to learn about
-- 'standby' as well — otherwise a standby task assigned to the agent would fall
-- outside the index that exists to find exactly those.
drop index if exists idx_tasks_ai_pending;
create index idx_tasks_ai_pending on public.tasks (company_id, status)
  where assignee_type = 'ai' and status in ('standby', 'todo', 'doing');

-- ── REPORT ──────────────────────────────────────────────────────────────────
select 'standby accepted by constraint' as check,
       case when pg_get_constraintdef(oid) like '%standby%' then 'yes' else 'NO' end as detail
from pg_constraint where conname = 'tasks_status_check'
union all
select 'tasks by status',
       coalesce((select string_agg(status || '=' || n, ', ')
                 from (select status, count(*)::text n from public.tasks group by status) s), '(no tasks yet)');
