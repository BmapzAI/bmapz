begin;

create index if not exists idx_sdr_conversations_lead
  on public.sdr_conversations(lead_id)
  where lead_id is not null;

create index if not exists idx_notifications_user
  on public.notifications(user_id, read, created_at desc)
  where user_id is not null;

drop policy if exists company_member_access on public.notifications;
create policy company_member_access on public.notifications
  for all to authenticated
  using (
    (
      company_id in (
        select company_id from public.users where id = (select auth.uid())
      )
      and (user_id is null or user_id = (select auth.uid()))
    )
    or exists (
      select 1 from public.users
      where id = (select auth.uid()) and role in ('owner', 'system_admin')
    )
  )
  with check (
    (
      company_id in (
        select company_id from public.users where id = (select auth.uid())
      )
      and (user_id is null or user_id = (select auth.uid()))
    )
    or exists (
      select 1 from public.users
      where id = (select auth.uid()) and role in ('owner', 'system_admin')
    )
  );

drop policy if exists company_member_access on public.sdr_agents;
create policy company_member_access on public.sdr_agents
  for all to authenticated
  using (
    (
      company_id in (
        select company_id from public.users where id = (select auth.uid())
      )
      and (user_id is null or user_id = (select auth.uid()))
    )
    or exists (
      select 1 from public.users
      where id = (select auth.uid()) and role in ('owner', 'system_admin')
    )
  )
  with check (
    (
      company_id in (
        select company_id from public.users where id = (select auth.uid())
      )
      and (user_id is null or user_id = (select auth.uid()))
    )
    or exists (
      select 1 from public.users
      where id = (select auth.uid()) and role in ('owner', 'system_admin')
    )
  );

commit;
