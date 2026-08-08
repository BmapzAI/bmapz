-- 024: @usernames for users and @handles for companies
--
-- Case-insensitive and unique. Stored WITHOUT the leading '@' — the '@' is
-- presentation. Uniqueness is enforced on lower(username) via a unique index, so
-- '@Derek' and '@derek' cannot both exist.
--
-- IMPORTANT (lesson from migration 021): this adds only plain text columns and
-- NO foreign keys, so it cannot make any existing PostgREST embed ambiguous.

alter table public.users
  add column if not exists username text;

alter table public.companies
  add column if not exists handle text;

-- ── Backfill: existing users get their first name, existing companies a slug ──
-- Both are de-duplicated by appending a counter, so the unique index below can
-- never fail on legacy rows.

create or replace function public.slugify_handle(src text)
returns text
language sql
immutable
as $$
  -- lowercase, strip accents, keep [a-z0-9_], collapse repeats
  select nullif(
    regexp_replace(
      regexp_replace(
        lower(translate(coalesce(src, ''),
          'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
          'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn')),
        '[^a-z0-9]+', '_', 'g'),
      '^_+|_+$', '', 'g'),
    '');
$$;

do $$
declare
  r record;
  base text;
  candidate text;
  n int;
begin
  -- Users: first name, falling back to the email local part.
  for r in
    select id, full_name, email from public.users
    where username is null order by created_at nulls last, id
  loop
    base := public.slugify_handle(split_part(coalesce(nullif(trim(r.full_name), ''), r.email), ' ', 1));
    if base is null then base := public.slugify_handle(split_part(r.email, '@', 1)); end if;
    if base is null then base := 'user'; end if;

    candidate := base;
    n := 1;
    while exists (select 1 from public.users where lower(username) = candidate) loop
      n := n + 1;
      candidate := base || n::text;
    end loop;

    update public.users set username = candidate where id = r.id;
  end loop;

  -- Companies: slug of the name.
  for r in
    select id, name from public.companies
    where handle is null order by created_at nulls last, id
  loop
    base := public.slugify_handle(r.name);
    if base is null then base := 'company'; end if;

    candidate := base;
    n := 1;
    while exists (select 1 from public.companies where lower(handle) = candidate) loop
      n := n + 1;
      candidate := base || n::text;
    end loop;

    update public.companies set handle = candidate where id = r.id;
  end loop;
end $$;

-- ── Uniqueness + shape, case-insensitive ─────────────────────────────────────
create unique index if not exists idx_users_username_lower on public.users (lower(username));
create unique index if not exists idx_companies_handle_lower on public.companies (lower(handle));

alter table public.users drop constraint if exists users_username_format;
alter table public.users
  add constraint users_username_format
  check (username is null or username ~ '^[A-Za-z0-9_]{3,30}$');

alter table public.companies drop constraint if exists companies_handle_format;
alter table public.companies
  add constraint companies_handle_format
  check (handle is null or handle ~ '^[A-Za-z0-9_]{3,30}$');

comment on column public.users.username is
  'Unique @username, stored without the @. Case-insensitive unique via idx_users_username_lower.';
comment on column public.companies.handle is
  'Unique @companyname, stored without the @. Case-insensitive unique via idx_companies_handle_lower.';

-- Verify: every row should have one, and there should be no case-insensitive dupes.
-- select count(*) filter (where username is null) as users_missing from public.users;
-- select count(*) filter (where handle is null) as companies_missing from public.companies;
