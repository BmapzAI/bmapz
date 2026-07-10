-- Security hardening for Bmapz AI public schema.
-- Goal: enable RLS on all public tables and add missing company-scoped policies.
-- This file avoids secrets and customer data.

begin;

alter table if exists public.accounts enable row level security;
alter table if exists public.admin_change_logs enable row level security;
alter table if exists public.data_deletion_requests enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'accounts'
      and policyname = 'account_member_access'
  ) then
    create policy account_member_access on public.accounts
      for all
      to authenticated
      using (
        id in (
          select account_id
          from public.users
          where id = (select auth.uid())
        )
        or exists (
          select 1
          from public.users
          where id = (select auth.uid())
            and role = 'system_admin'
        )
      )
      with check (
        id in (
          select account_id
          from public.users
          where id = (select auth.uid())
        )
        or exists (
          select 1
          from public.users
          where id = (select auth.uid())
            and role = 'system_admin'
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'admin_change_logs'
      and policyname = 'system_admin_access'
  ) then
    create policy system_admin_access on public.admin_change_logs
      for all
      to authenticated
      using (
        exists (
          select 1
          from public.users
          where id = (select auth.uid())
            and role = 'system_admin'
        )
      )
      with check (
        exists (
          select 1
          from public.users
          where id = (select auth.uid())
            and role = 'system_admin'
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'data_deletion_requests'
      and policyname = 'system_admin_access'
  ) then
    create policy system_admin_access on public.data_deletion_requests
      for all
      to authenticated
      using (
        exists (
          select 1
          from public.users
          where id = (select auth.uid())
            and role = 'system_admin'
        )
      )
      with check (
        exists (
          select 1
          from public.users
          where id = (select auth.uid())
            and role = 'system_admin'
        )
      );
  end if;
end $$;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'ai_outputs',
    'blog_posts',
    'brand_scans',
    'credit_transactions',
    'dashboard_configs',
    'funnels',
    'lead_lists',
    'seo_analyses',
    'workflow_runs'
  ]
  loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = target_table
        and policyname = 'company_member_access'
    ) then
      execute format($policy$
        create policy company_member_access on public.%I
          for all
          to authenticated
          using (
            company_id in (
              select company_id
              from public.users
              where id = (select auth.uid())
              union
              select unnest(accessible_company_ids)
              from public.users
              where id = (select auth.uid())
            )
            or exists (
              select 1
              from public.users
              where id = (select auth.uid())
                and role = 'system_admin'
            )
          )
          with check (
            company_id in (
              select company_id
              from public.users
              where id = (select auth.uid())
              union
              select unnest(accessible_company_ids)
              from public.users
              where id = (select auth.uid())
            )
            or exists (
              select 1
              from public.users
              where id = (select auth.uid())
                and role = 'system_admin'
            )
          )
      $policy$, target_table);
    end if;
  end loop;
end $$;

do $$
declare
  target_table text;
begin
  foreach target_table in array array['message_templates', 'node_templates']
  loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = target_table
        and policyname = 'template_member_access'
    ) then
      execute format($policy$
        create policy template_member_access on public.%I
          for all
          to authenticated
          using (
            is_global = true
            or company_id in (
              select company_id
              from public.users
              where id = (select auth.uid())
              union
              select unnest(accessible_company_ids)
              from public.users
              where id = (select auth.uid())
            )
            or exists (
              select 1
              from public.users
              where id = (select auth.uid())
                and role = 'system_admin'
            )
          )
          with check (
            company_id in (
              select company_id
              from public.users
              where id = (select auth.uid())
              union
              select unnest(accessible_company_ids)
              from public.users
              where id = (select auth.uid())
            )
            or exists (
              select 1
              from public.users
              where id = (select auth.uid())
                and role = 'system_admin'
            )
          )
      $policy$, target_table);
    end if;
  end loop;
end $$;

commit;
