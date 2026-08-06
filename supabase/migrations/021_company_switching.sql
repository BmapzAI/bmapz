-- 021: Multi-company switching
--
-- `users.accessible_company_ids` has existed since 001 and the RLS policies
-- already honour it, but nothing ever let a user actually MOVE between those
-- companies, so scope silently stayed on their home company.
--
-- Switching deliberately does NOT overwrite `users.company_id`:
--   * company_id is the user's HOME company and part of the identity;
--   * migration 018's trigger polices company_id for owner/system_admin, so
--     rewriting it on every switch would make the App Owner's own switching
--     raise "Internal roles are restricted to the platform company".
-- Instead we track the ACTIVE company separately and resolve requests against
-- it, falling back to company_id. Switching is therefore reversible and cannot
-- corrupt a user's role or home company.

alter table public.users
  add column if not exists active_company_id uuid references public.companies(id) on delete set null;

comment on column public.users.active_company_id is
  'Company the user is currently working in. Null = use company_id (home company). Must be company_id or a member of accessible_company_ids, unless the user is owner/system_admin.';

create index if not exists idx_users_active_company on public.users(active_company_id);

-- Guard the switch at the schema level too: a user may only be active in their
-- home company or one they have been granted access to. Platform roles
-- (owner/system_admin) may act in any company — that is what runs the business.
create or replace function public.enforce_active_company_access()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.active_company_id is not null
     and new.role not in ('owner', 'system_admin')
     and new.active_company_id is distinct from new.company_id
     and not (new.active_company_id = any(coalesce(new.accessible_company_ids, '{}'::uuid[])))
  then
    raise exception 'active_company_id must be the home company or one of accessible_company_ids';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_active_company_access on public.users;
create trigger trg_enforce_active_company_access
  before insert or update of active_company_id, accessible_company_ids, company_id, role
  on public.users
  for each row
  execute function public.enforce_active_company_access();

-- Safety: clear any active company that would violate the rule above (there
-- should be none, since the column is new).
update public.users u
set active_company_id = null
where u.active_company_id is not null
  and u.role not in ('owner', 'system_admin')
  and u.active_company_id is distinct from u.company_id
  and not (u.active_company_id = any(coalesce(u.accessible_company_ids, '{}'::uuid[])));
