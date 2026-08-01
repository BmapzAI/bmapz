-- 014: lead routing method + queue position
--
-- Companies can choose HOW leads are shared across available sales team members:
--   random   → picked at random from whoever is online
--   balanced → whoever currently has the fewest open leads (previous behaviour)
--   queued   → strict round-robin: first person to become available takes the
--              next lead, then the one after them, and so on
--
-- `queued` needs a stable order, which is what users.lead_queue_position gives:
-- it is stamped when a member becomes available (goes online), so the queue is
-- ordered by who has been waiting longest since their last assignment.

begin;

alter table public.companies
  add column if not exists lead_routing_method text default 'balanced';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'companies_lead_routing_method_check') then
    alter table public.companies
      add constraint companies_lead_routing_method_check
      check (lead_routing_method in ('random', 'balanced', 'queued'));
  end if;
end $$;

-- Ordering key for the queued method: when this member last became available or
-- was last handed a lead. Oldest value = next in line.
alter table public.users
  add column if not exists lead_queue_position timestamptz;

commit;
