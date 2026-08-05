-- 018: Internal role lockdown
-- 'owner' and 'system_admin' are Bmapz-internal platform roles. They may only
-- be held by members of the App Owner's own company. This trigger enforces the
-- rule at the schema level, so even service-role writes (which bypass RLS)
-- cannot assign an internal role to a customer-company user.

create or replace function public.enforce_internal_role_company()
returns trigger
language plpgsql
security definer
as $$
declare
  platform_company uuid;
  owner_exists boolean;
begin
  if new.role in ('owner', 'system_admin') then
    -- The platform company is the company of the earliest-created Owner other
    -- than the row being written. Note we do NOT filter out a null company_id:
    -- if the founding owner has no company, then "the platform company" is
    -- null and only other company-less users may hold internal roles. Skipping
    -- null owners here would silently disable the whole check.
    select company_id, true into platform_company, owner_exists
    from public.users
    where role = 'owner' and id <> new.id
    order by created_at asc
    limit 1;

    -- Bootstrap only: with no other owner in the table, allow the first setup.
    if coalesce(owner_exists, false)
       and new.company_id is distinct from platform_company then
      raise exception 'Internal roles (owner/system_admin) are restricted to the platform company';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_internal_role_company on public.users;
create trigger trg_enforce_internal_role_company
  before insert or update of role, company_id on public.users
  for each row
  execute function public.enforce_internal_role_company();

-- Remediation: demote any existing system_admin that is NOT in the platform
-- company down to company_admin (the top customer role). Safe to run with the
-- trigger already in place: the new role is 'company_admin', which the trigger
-- does not police, so this cannot self-abort.
-- Review the result afterwards with:
--   select email, role, company_id from public.users where role in ('owner','system_admin');
update public.users u
set role = 'company_admin'
where u.role = 'system_admin'
  and u.company_id is distinct from (
    select company_id from public.users
    where role = 'owner'
    order by created_at asc
    limit 1
  );
