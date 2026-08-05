-- 020: Keep AI-generated output where it was generated
-- Generated copy/plans used to live only in React state, so leaving the dialog
-- or reloading the page threw the work away and the user had to generate again
-- (and pay AI credits again). These columns hold the last generation per record
-- until the user regenerates, plus any edits they save as a draft.

-- Last set of generated copy variants for an ad, and the user's edited draft.
alter table public.ads
  add column if not exists copy_drafts jsonb default '[]',
  add column if not exists copy_drafts_at timestamptz;

-- Last AI plan generated for a campaign (the "Build with AI" preview) so the
-- preview survives closing the dialog.
alter table public.ad_campaigns
  add column if not exists ai_plan jsonb,
  add column if not exists ai_plan_at timestamptz;

comment on column public.ads.copy_drafts is
  'Last AI-generated copy variants for this ad (array). Replaced on regenerate; entries may carry user edits saved as drafts.';
comment on column public.ad_campaigns.ai_plan is
  'Last AI-generated campaign plan preview, kept so the user does not have to regenerate.';
