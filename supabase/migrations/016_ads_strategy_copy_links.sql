-- 016: Ads hierarchy links + automatic lead hand-over
--
-- The Strategy and Copy generators now sit INSIDE the campaign hierarchy rather
-- than floating beside it:
--
--   Strategy   → highest level, attached to a campaign (ad_campaigns.strategy)
--   Campaign   → ad group → ad
--   Copy       → lowest level, attached to a single ad (ads.copy_data)
--
-- Copy therefore inherits the campaign's strategy and the ad group's targeting,
-- so what it writes is consistent with the plan above it.

begin;

-- Which ad group / ad a generated copy set came from, so the Copy tab can show
-- and reload the exact context it was written for.
alter table public.ads
  add column if not exists copy_source text;           -- 'ai' | 'manual' | 'imported'

alter table public.ad_groups
  add column if not exists strategy_notes text;        -- how this group serves the strategy

-- Automatically hand ad leads to the sales team as they arrive.
alter table public.companies
  add column if not exists ads_auto_handover boolean default false;

commit;
