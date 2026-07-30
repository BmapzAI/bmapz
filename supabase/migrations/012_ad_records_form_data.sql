-- 012: ad_records.form_data
--
-- The Ads UI saves the inputs that produced a strategy/copy set (and the entire
-- campaign definition) as `form_data`, but there was no such column: the value
-- was silently discarded on save, so saved strategies, copies and campaigns came
-- back empty. The strategy/copy payloads themselves are stored in the existing
-- `strategy` and `copy_data` columns (see routes/ads.js, which maps the UI's
-- strategy_data/copies_data onto them).

begin;

alter table public.ad_records
  add column if not exists form_data jsonb default '{}';

commit;
