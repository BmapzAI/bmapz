-- 025: Migrate the legacy ad_records system into the current structures.
--
-- WHAT ad_records HOLDS AND WHERE EACH KIND BELONGS NOW
--   type = 'campaign'  -> public.ad_campaigns   (a real campaign; structural fit)
--   type = 'strategy'  -> public.ai_outputs     (saved AI work; the archive is
--   type = 'copy'      -> public.ai_outputs      literally the feature for this)
--
-- Saved strategies and copies are STANDALONE in the old system — they hang off
-- no campaign and no ad — so they cannot be moved into ad_campaigns/ads without
-- inventing fake parents that would pollute the campaign list. The AI Outputs
-- archive is their honest home: it already stores generated content with a
-- title, category and reuse, and the Ads page can still load them back.
--
-- THIS MIGRATION IS NON-DESTRUCTIVE. It COPIES. ad_records is left completely
-- untouched so the old screens keep working until you have verified the result;
-- dropping it is a separate, explicit step (see 026_drop_ad_records.sql).
-- It is also IDEMPOTENT: re-running it will not duplicate anything.

-- ── STEP 1 — PREVIEW (safe, read-only). Run this alone first. ────────────────
-- select type, count(*) as rows,
--        count(*) filter (where coalesce(strategy, '{}'::jsonb) <> '{}'::jsonb) as with_strategy,
--        count(*) filter (where coalesce(copy_data, '{}'::jsonb) <> '{}'::jsonb) as with_copies
-- from public.ad_records group by type order by type;

begin;

-- ── Campaigns → ad_campaigns ────────────────────────────────────────────────
-- Only rows that are genuinely campaign-shaped. The legacy id is recorded in
-- settings so this can be re-run safely and traced back later.
insert into public.ad_campaigns
  (company_id, platform, name, objective, status, budget, budget_type, strategy, settings, created_at)
select
  r.company_id,
  coalesce(nullif(r.platform, ''), 'meta'),
  coalesce(nullif(r.title, ''), 'Imported campaign'),
  r.objective,
  case when r.status in ('draft','active','paused','completed','failed')
       then r.status else 'draft' end,
  r.budget,
  case when r.budget_type in ('daily','lifetime') then r.budget_type else 'daily' end,
  coalesce(r.strategy, '{}'::jsonb),
  jsonb_build_object('migrated_from_ad_record', r.id, 'migrated_at', now()),
  r.created_at
from public.ad_records r
where r.type = 'campaign'
  and not exists (
    select 1 from public.ad_campaigns c
    where c.settings->>'migrated_from_ad_record' = r.id::text
  );

-- ── Strategies + copies → ai_outputs ────────────────────────────────────────
-- ai_outputs has NO top-level title/content/category columns — those live in
-- metadata, and inserting them top-level makes PostgREST reject the row. This
-- shape matches flattenAIOutput() exactly.
insert into public.ai_outputs (company_id, type, output, metadata, created_at)
select
  r.company_id,
  'ads',
  coalesce(
    nullif(r.strategy::text, '{}'),
    nullif(r.copy_data::text, '{}'),
    '{}'
  ),
  jsonb_build_object(
    'title',   coalesce(nullif(r.title, ''), 'Imported ' || r.type),
    'content', coalesce(
                 nullif(r.strategy::text, '{}'),
                 nullif(r.copy_data::text, '{}'),
                 '{}'
               ),
    'category', case when r.type = 'strategy' then 'strategies' else 'ad_copy' end,
    'status',  'approved',            -- it was deliberately saved, so treat it as approved
    'action',  'ads_' || r.type,
    'platform', r.platform,
    'form_data', coalesce(r.form_data, '{}'::jsonb),
    'migrated_from_ad_record', r.id
  ),
  r.created_at
from public.ad_records r
where r.type in ('strategy', 'copy')
  and not exists (
    select 1 from public.ai_outputs o
    where o.metadata->>'migrated_from_ad_record' = r.id::text
  );

commit;

-- ── STEP 2 — verify. Counts on the left should now appear on the right. ─────
-- select
--   (select count(*) from public.ad_records where type = 'campaign')            as legacy_campaigns,
--   (select count(*) from public.ad_campaigns
--      where settings ? 'migrated_from_ad_record')                              as migrated_campaigns,
--   (select count(*) from public.ad_records where type in ('strategy','copy'))  as legacy_saved,
--   (select count(*) from public.ai_outputs
--      where metadata ? 'migrated_from_ad_record')                              as migrated_saved;
