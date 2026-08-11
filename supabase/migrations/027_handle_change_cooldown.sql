-- 027: 90-day cooldown on changing a @username or @companyname
--
-- Handles are identities: other people learn them, mention them and search by
-- them, so they must not churn. A change is allowed once every 90 days.
--
-- The timestamp is set by a TRIGGER rather than by the API, so the cooldown
-- cannot be bypassed by any code path that writes the column directly. The
-- trigger also REJECTS a too-early change, so the rule holds even against a
-- service-role write.
--
-- Safe by construction: adds only plain timestamp columns (no foreign keys), so
-- it cannot make an existing PostgREST embed ambiguous the way 021 did.

alter table public.users
  add column if not exists username_changed_at timestamptz;

alter table public.companies
  add column if not exists handle_changed_at timestamptz;

comment on column public.users.username_changed_at is
  'When the username last changed. Null = never changed since it was assigned, so the next change is free.';

-- ── Users ───────────────────────────────────────────────────────────────────
create or replace function public.enforce_username_cooldown()
returns trigger
language plpgsql
as $$
declare
  days_remaining integer;
begin
  -- Only relevant when the username actually changes to a different value.
  if new.username is distinct from old.username then
    -- Assigning one for the first time is not a "change".
    if old.username is null then
      new.username_changed_at := now();
      return new;
    end if;

    if old.username_changed_at is not null
       and old.username_changed_at > now() - interval '90 days' then
      days_remaining := ceil(
        extract(epoch from (old.username_changed_at + interval '90 days' - now())) / 86400
      );
      raise exception
        'Username can only be changed once every 90 days. Try again in % day(s).', days_remaining
        using errcode = 'check_violation';
    end if;

    new.username_changed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_username_cooldown on public.users;
create trigger trg_enforce_username_cooldown
  before update of username on public.users
  for each row
  execute function public.enforce_username_cooldown();

-- ── Companies ───────────────────────────────────────────────────────────────
create or replace function public.enforce_handle_cooldown()
returns trigger
language plpgsql
as $$
declare
  days_remaining integer;
begin
  if new.handle is distinct from old.handle then
    if old.handle is null then
      new.handle_changed_at := now();
      return new;
    end if;

    if old.handle_changed_at is not null
       and old.handle_changed_at > now() - interval '90 days' then
      days_remaining := ceil(
        extract(epoch from (old.handle_changed_at + interval '90 days' - now())) / 86400
      );
      raise exception
        'Company handle can only be changed once every 90 days. Try again in % day(s).', days_remaining
        using errcode = 'check_violation';
    end if;

    new.handle_changed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_handle_cooldown on public.companies;
create trigger trg_enforce_handle_cooldown
  before update of handle on public.companies
  for each row
  execute function public.enforce_handle_cooldown();

-- Handles assigned by migration 024 count as "never changed", so everyone gets
-- one free change. Leaving the columns null achieves exactly that.
