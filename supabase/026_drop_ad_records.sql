-- 026: Drop the legacy ad_records table. RUN THIS LAST, AND ONLY ONCE HAPPY.
--
-- Deliberately NOT in supabase/migrations/ — it is destructive and should be a
-- conscious decision, not something that runs as part of a migration sweep.
--
-- ORDER OF OPERATIONS
--   1. Run supabase/migrations/025_migrate_ad_records.sql  (copies, deletes nothing)
--   2. Open the Ads section → "Saved" and confirm your strategies and copies are
--      all there, and that "Load" restores them into the form correctly.
--   3. Only then run this file.
--
-- The application no longer WRITES to ad_records. It still READS it as a
-- fallback, so nothing breaks if you never run this — the table just sits there.
-- After dropping it, that fallback silently finds nothing, which is handled.

-- ── STEP 1 — verify the migration actually moved everything. ────────────────
-- Both pairs must match before you continue.
select
  (select count(*) from public.ad_records where type = 'campaign')           as legacy_campaigns,
  (select count(*) from public.ad_campaigns
     where settings ? 'migrated_from_ad_record')                             as migrated_campaigns,
  (select count(*) from public.ad_records where type in ('strategy','copy')) as legacy_saved,
  (select count(*) from public.ai_outputs
     where metadata ? 'migrated_from_ad_record')                             as migrated_saved;

-- ── STEP 2 — keep a copy for a while, then drop. ────────────────────────────
-- The rename is the safety net: if something turns out to be missing next week
-- the data is still there and can be re-migrated. Drop the backup once you are
-- certain (a month is a reasonable wait).
--
-- begin;
-- alter table public.ad_records rename to ad_records_backup_20260811;
-- commit;
--
-- ...and only much later, when you are certain nothing is missing:
-- drop table if exists public.ad_records_backup_20260811;
