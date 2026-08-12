-- 030: Retire the legacy `ad_records` table, and close the last client-executable
--      function left over from 029.
--
-- ORDER MATTERS, and the code half must already be deployed. Renaming this table
-- while the previous frontend was live would have broken campaign creation:
-- AdsPublishModal POSTed to /api/ads/records BEFORE calling its onConfirm
-- handler, and only called it if the POST returned — so with the table gone the
-- POST threw and onConfirm, which performs the real write to `ad_campaigns`,
-- never ran. That was fixed and deployed in the same change as this migration.
--
-- Preconditions verified against the live database before writing this:
--   * migration 025's copy is COMPLETE — legacy campaigns 1 ↔ migrated 1,
--     legacy saved 3 ↔ migrated 3. Nothing is lost by moving the table aside.
--   * `Ads.jsx` reads the merged /api/ads-manager/saved endpoint, which reads
--     `ai_outputs` first and already tolerates `ad_records` being absent.
--   * `companyBrain.js` guards its ad_records read with `adsRes.data?.length`,
--     and supabase-js resolves (never rejects) a failed query, so the
--     Promise.all that builds the company brain cannot throw.
--   * the five legacy /api/ads/records endpoints now degrade instead of throwing.
--
-- RENAME, NOT DROP. This is the safety net: if something turns out to be missing
-- the data is still right there and can be re-migrated. Drop the backup only once
-- you are certain — a month is a reasonable wait. The DROP is left commented at
-- the bottom deliberately; it should be a separate, conscious decision.

-- ── 1. The last client-executable function ──────────────────────────────────
-- `update_updated_at` is a trivial trigger function (sets NEW.updated_at) and is
-- not SECURITY DEFINER, so calling it over REST would merely error — Postgres
-- refuses to run a trigger function outside a trigger. It is revoked anyway
-- because it was the only remaining EXECUTE grant to anon/authenticated in the
-- schema, and "no client-callable functions at all" is a much easier property to
-- verify later than "one harmless exception".
revoke all on function public.update_updated_at() from public, anon, authenticated;

-- ── 2. Move `ad_records` aside ──────────────────────────────────────────────
-- `if exists` so this is safe to run twice, and safe on an environment that
-- never had the table.
alter table if exists public.ad_records rename to ad_records_backup_20260811;

-- Keep the backup unreachable from any client, exactly like every other table.
revoke all privileges on public.ad_records_backup_20260811 from anon, authenticated;

-- ── LATER, and only when certain nothing is missing ─────────────────────────
-- drop table if exists public.ad_records_backup_20260811;

-- ── REPORT ──────────────────────────────────────────────────────────────────
select 'ad_records still present' as check,
       case when exists (
         select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relname = 'ad_records'
       ) then 'YES - rename did not happen' else 'no - renamed' end as detail
union all
select 'backup table row count',
       coalesce((select count(*)::text from public.ad_records_backup_20260811), 'missing')
union all
select 'client-executable functions left',
       coalesce((select string_agg(distinct routine_name, ', ')
                 from information_schema.routine_privileges
                 where specific_schema = 'public'
                   and grantee in ('anon', 'authenticated')
                   and privilege_type = 'EXECUTE'), '(none - good)');
