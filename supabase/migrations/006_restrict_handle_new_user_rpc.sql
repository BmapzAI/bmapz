-- The auth trigger function must not be exposed as a public RPC.
-- Trigger execution remains available to the service role/function owner.

begin;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to service_role;
commit;
