-- 032: Let an AI Automation produce a TASK on its schedule
--
-- Closes the "tasks can be scheduled in AI automations" half of the task feature.
-- Until now an automation could only write an `ai_outputs` row for review; there
-- was no way to say "every Monday at 9, raise this piece of work and have the
-- agent do it".
--
-- Reuses the EXISTING `ai_automations.task_type` discriminator (default
-- 'ai_prompt') rather than adding a parallel flag: setting it to 'create_task'
-- switches the scheduler onto the task path. Only a template is new.
--
-- Adds one nullable JSONB column to one table, and no foreign key, so it cannot
-- make an existing PostgREST embed ambiguous the way 021 did, and it cannot break
-- an automation that is already running — an existing row keeps task_type
-- 'ai_prompt' and behaves exactly as before.

alter table public.ai_automations
  add column if not exists task_template jsonb not null default '{}'::jsonb;

comment on column public.ai_automations.task_template is
  'When task_type = ''create_task'', the shape of the task to raise on each run: '
  '{ title, description, priority, section, visibility, assignee_type, assignee_id, '
  'due_in_days }. assignee_type ''ai'' means the agent completes it immediately.';

-- Client grants are already revoked on this table by 029, and 029''s default
-- privileges keep it that way; nothing to do here for access.

-- ── REPORT ──────────────────────────────────────────────────────────────────
select 'task_template column' as check,
       case when exists (
         select 1 from information_schema.columns
         where table_schema = 'public' and table_name = 'ai_automations'
           and column_name = 'task_template'
       ) then 'present' else 'MISSING' end as detail
union all
select 'automations that would change behaviour',
       (select count(*)::text from public.ai_automations where task_type = 'create_task');
