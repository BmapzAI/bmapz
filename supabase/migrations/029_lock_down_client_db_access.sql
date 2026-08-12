-- 029: Close direct client access to the database
--
-- FOUND BY AUDIT (first run with a live database connection). Every table in
-- `public` had RLS enabled with a sensible company-scoped policy, BUT the `anon`
-- and `authenticated` roles also held full SELECT/INSERT/UPDATE/DELETE table
-- grants. The policies were the ONLY thing standing between the public anon key
-- (which ships inside the frontend bundle, by design) and the data — and three
-- of those policies were written as "a company member may do ALL on their own
-- company's rows", which is right for leads but wrong for billing and identity.
--
-- Concretely, before this migration a signed-in customer could, with nothing but
-- the anon key and their own JWT:
--
--   1. BILLING BYPASS — PATCH /rest/v1/subscriptions?company_id=eq.<their own>
--      with {"plan":"enterprise","ai_credits_used":0}. The `scoped_to_company`
--      policy permits ALL on their own company's row, so they could grant
--      themselves an unlimited plan and zero their usage, repeatedly.
--
--   2. CROSS-COMPANY BREACH — PATCH /rest/v1/users?id=eq.<their own id> with
--      {"accessible_company_ids":["<any company uuid>"]}. The users policy is
--      `auth.uid() = id` with cmd=ALL, so writing your OWN row is allowed — and
--      every other table's policy TRUSTS accessible_company_ids. That single
--      write grants read/write over another company's leads, messages,
--      ai_outputs and its `companies` row, which holds api_keys. This is the
--      exact cross-company leak the project treats as unacceptable.
--
--   3. CREDIT MINTING — POST /rest/v1/rpc/consume_ai_credits with a NEGATIVE
--      p_credits. The function is SECURITY INVOKER with no sign check and
--      EXECUTE granted to PUBLIC, so a negative amount subtracts usage.
--
-- WHY THE FIX IS SAFE: the frontend never touches a table. It imports Supabase
-- solely for auth (`supabase.auth.*` — verified: zero `.from(`, `.rpc(` or
-- `.channel(` calls in frontend-src, so no Realtime either). All data flows
-- through the Express backend, which uses SUPABASE_SERVICE_ROLE_KEY; service_role
-- has BYPASSRLS and its own grants, so nothing here is visible to the app.
--
-- Defence in depth, in order of durability:
--   (a) revoke the table grants        — removes the capability entirely
--   (b) keep + narrow the RLS policies — still correct if a grant ever returns
--   (c) a BEFORE UPDATE trigger        — survives BOTH being undone
--
-- Layer (c) matters because grants are easy to restore by accident (a future
-- migration, a dashboard click, `grant all on all tables`). A trigger keeps
-- privilege escalation impossible regardless.
--
-- Adds no foreign keys and no columns, so it cannot make a PostgREST embed
-- ambiguous the way 021 did.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Pin search_path on every function (Supabase lint 0011).
--    A SECURITY DEFINER function with a mutable search_path can be hijacked by
--    an attacker who creates a same-named object in an earlier schema.
--    `public, pg_temp` (not '') because the bodies reference public tables;
--    pg_catalog is always resolved first, so built-ins keep working.
-- ─────────────────────────────────────────────────────────────────────────────
alter function public.enforce_internal_role_company()      set search_path = public, pg_temp;
alter function public.enforce_active_company_access()      set search_path = public, pg_temp;
alter function public.enforce_username_cooldown()          set search_path = public, pg_temp;
alter function public.enforce_handle_cooldown()            set search_path = public, pg_temp;
alter function public.slugify_handle(text)                 set search_path = public, pg_temp;
alter function public.consume_ai_credits(uuid, numeric)    set search_path = public, pg_temp;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Stop clients calling these functions over REST (lints 0028 / 0029).
--    Trigger functions need no EXECUTE grant to fire, so revoking costs nothing.
--    consume_ai_credits keeps service_role EXECUTE — the backend calls it.
-- ─────────────────────────────────────────────────────────────────────────────
revoke all on function public.enforce_internal_role_company()   from public, anon, authenticated;
revoke all on function public.enforce_active_company_access()   from public, anon, authenticated;
revoke all on function public.enforce_username_cooldown()       from public, anon, authenticated;
revoke all on function public.enforce_handle_cooldown()         from public, anon, authenticated;
revoke all on function public.slugify_handle(text)              from public, anon, authenticated;
revoke all on function public.consume_ai_credits(uuid, numeric) from public, anon, authenticated;

grant execute on function public.consume_ai_credits(uuid, numeric) to service_role;
grant execute on function public.slugify_handle(text)              to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. consume_ai_credits must never be able to ADD credits.
--    Its only caller (routes/ai.js) always passes a positive amount, so this is
--    a no-op for the app. A negative amount now fails loudly instead of
--    silently minting credit — and if a refund feature is added later it must be
--    written deliberately rather than by sign-flipping a debit.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.consume_ai_credits(p_subscription_id uuid, p_credits numeric)
returns numeric
language plpgsql
set search_path = public, pg_temp
as $$
declare
  new_used numeric;
begin
  if p_credits is null or p_credits < 0 then
    raise exception 'consume_ai_credits: p_credits must be >= 0 (got %)', p_credits
      using errcode = 'check_violation';
  end if;

  update public.subscriptions
  set ai_credits_used = coalesce(ai_credits_used, 0) + p_credits
  where id = p_subscription_id
  returning ai_credits_used into new_used;

  return new_used;
end;
$$;

revoke all on function public.consume_ai_credits(uuid, numeric) from public, anon, authenticated;
grant execute on function public.consume_ai_credits(uuid, numeric) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Revoke every client table/view grant in `public`.
--    The app cannot notice: it reaches the database only as service_role.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  r record;
  n integer := 0;
begin
  for r in
    select c.relname, c.relkind
    from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
    where ns.nspname = 'public' and c.relkind in ('r', 'v', 'm', 'p', 'f')
  loop
    execute format('revoke all privileges on public.%I from anon, authenticated', r.relname);
    n := n + 1;
  end loop;
  raise notice 'Revoked anon/authenticated privileges on % object(s) in public', n;
end $$;

-- Sequences too: without USAGE a client could not insert anyway, but leaving
-- them granted advertises the schema and allows nextval() churn.
do $$
declare r record;
begin
  for r in select sequencename from pg_sequences where schemaname = 'public' loop
    execute format('revoke all privileges on sequence public.%I from anon, authenticated', r.sequencename);
  end loop;
end $$;

-- And stop FUTURE tables from being born with client grants. This is the latent
-- form of the same bug: add a table in a later migration and it would silently
-- become world-writable via the anon key.
alter default privileges for role postgres in schema public revoke all on tables    from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Narrow the two policies that granted clients WRITE access to
--    billing and identity. Kept as SELECT so the layer still reads correctly if
--    grants are ever restored. service_role bypasses RLS, so the app is
--    unaffected either way.
-- ─────────────────────────────────────────────────────────────────────────────
-- auth.uid() is wrapped in a scalar sub-select so Postgres evaluates it ONCE per
-- query instead of once per row (Supabase lint 0003, auth_rls_initplan).
drop policy if exists scoped_to_company on public.subscriptions;
create policy subscriptions_company_read on public.subscriptions
  for select to authenticated
  using (
    company_id in (
      select users.company_id from public.users where users.id = (select auth.uid())
      union
      select unnest(users.accessible_company_ids) from public.users where users.id = (select auth.uid())
    )
  );

drop policy if exists users_own on public.users;
create policy users_own_read on public.users
  for select to authenticated
  using ((select auth.uid()) = id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. The durable layer: privileged columns on `users` are backend-only.
--    `role` decides Owner/system_admin (and therefore BYOK and Design Studio
--    access); `company_id` and `accessible_company_ids` decide which companies'
--    data every other RLS policy will let you touch. None of them may ever be
--    set by a client, whatever the grants happen to say.
--
--    The check keys off the PostgREST JWT role: only `anon`/`authenticated` are
--    restricted. service_role (the backend) and direct SQL — migrations, the
--    Supabase SQL editor, psql, which carry no request.jwt.claims — pass through
--    untouched, so this cannot lock Derek out of his own database.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.guard_privileged_user_columns()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  claims   jsonb;
  jwt_role text;
begin
  begin
    claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  exception when others then
    claims := null;   -- malformed or absent: treated as "not a client request"
  end;

  jwt_role := coalesce(
    claims->>'role',
    nullif(current_setting('request.jwt.claim.role', true), '')
  );

  if jwt_role is null or jwt_role not in ('anon', 'authenticated') then
    return new;
  end if;

  if new.role is distinct from old.role
     or new.company_id is distinct from old.company_id
     or new.accessible_company_ids is distinct from old.accessible_company_ids
  then
    raise exception
      'role, company_id and accessible_company_ids can only be changed by the Bmapz backend'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_privileged_user_columns() from public, anon, authenticated;

drop trigger if exists trg_guard_privileged_user_columns on public.users;
create trigger trg_guard_privileged_user_columns
  before update on public.users
  for each row execute function public.guard_privileged_user_columns();

-- ─────────────────────────────────────────────────────────────────────────────
-- REPORT: anything still reachable by a client should come back empty.
-- ─────────────────────────────────────────────────────────────────────────────
select 'client-reachable tables in public' as what,
       coalesce(string_agg(distinct table_name, ', '), '(none — good)') as detail
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'authenticated')
union all
select 'client-executable app functions',
       coalesce(string_agg(distinct routine_name, ', '), '(none — good)')
from information_schema.routine_privileges
where specific_schema = 'public' and grantee in ('anon', 'authenticated')
  and privilege_type = 'EXECUTE';
