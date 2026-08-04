-- 015: Real ad hierarchy — campaign → ad group → ad
--
-- The Ads section previously stored everything as loose rows in `ad_records`
-- with no structure, which is why nothing could be created, related, published
-- or updated properly. This introduces the three levels every ad platform
-- actually uses, plus a publish log so we can tell the user the TRUTH about what
-- reached the platform and what failed.
--
--   ad_campaigns   objective, budget, schedule            (Meta: Campaign,
--   ad_groups      targeting, bidding, schedule            Google: Ad Group,
--   ads            creative + copy                         TikTok: Ad Group/Ad)
--
-- `external_id` holds the platform's own id once published; `publish_state`
-- tracks local vs live. Nothing is ever marked "live" unless the platform
-- returned an id.

begin;

-- ── Campaigns ────────────────────────────────────────────────────────────────
create table if not exists public.ad_campaigns (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  platform text not null,                       -- meta | google | tiktok | linkedin | twitter
  name text not null,
  objective text,                               -- platform-specific objective key
  status text not null default 'draft'
    check (status in ('draft','scheduled','active','paused','completed','failed','archived')),
  -- Money is a plain number; the CURRENCY is whatever the ad account uses.
  budget numeric(14,2),
  budget_type text default 'daily' check (budget_type in ('daily','lifetime')),
  bid_strategy text,
  starts_at timestamptz,
  ends_at timestamptz,
  timezone text,
  -- Everything platform-specific that does not deserve its own column.
  settings jsonb default '{}',
  -- AI strategy that produced this campaign (Company Brain output).
  strategy jsonb default '{}',
  -- Live linkage
  external_id text,
  external_account_id text,
  publish_state text not null default 'local'
    check (publish_state in ('local','publishing','published','failed','out_of_sync')),
  last_published_at timestamptz,
  last_publish_error text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── Ad groups (Meta: ad set / Google: ad group) ───────────────────────────────
create table if not exists public.ad_groups (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  campaign_id uuid not null references public.ad_campaigns(id) on delete cascade,
  name text not null,
  status text not null default 'draft'
    check (status in ('draft','scheduled','active','paused','completed','failed','archived')),
  -- Audience: locations, ages, genders, interests, keywords, custom audiences…
  targeting jsonb default '{}',
  optimization_goal text,
  bid_amount numeric(14,2),
  budget numeric(14,2),
  budget_type text default 'daily' check (budget_type in ('daily','lifetime')),
  starts_at timestamptz,
  ends_at timestamptz,
  settings jsonb default '{}',
  external_id text,
  publish_state text not null default 'local'
    check (publish_state in ('local','publishing','published','failed','out_of_sync')),
  last_published_at timestamptz,
  last_publish_error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── Ads (the creative itself) ────────────────────────────────────────────────
create table if not exists public.ads (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  ad_group_id uuid not null references public.ad_groups(id) on delete cascade,
  name text not null,
  status text not null default 'draft'
    check (status in ('draft','scheduled','active','paused','completed','failed','archived')),
  format text,                                  -- single_image | video | carousel | text …
  -- Copy fields the platforms ask for.
  headline text,
  primary_text text,
  description text,
  call_to_action text,
  destination_url text,
  display_url text,
  media_urls text[] default '{}',
  -- Longer/structured copy variants produced by the AI copy generator.
  copy_data jsonb default '{}',
  settings jsonb default '{}',
  external_id text,
  publish_state text not null default 'local'
    check (publish_state in ('local','publishing','published','failed','out_of_sync')),
  last_published_at timestamptz,
  last_publish_error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── Publish log: what was attempted, what actually happened ──────────────────
create table if not exists public.ad_publish_log (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  campaign_id uuid references public.ad_campaigns(id) on delete cascade,
  level text not null check (level in ('campaign','ad_group','ad')),
  entity_id uuid,
  action text not null check (action in ('create','update','pause','resume','archive')),
  platform text,
  ok boolean not null default false,
  external_id text,
  message text,
  payload jsonb default '{}',
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz default now()
);

create index if not exists idx_ad_campaigns_company on public.ad_campaigns(company_id, status, created_at desc);
create index if not exists idx_ad_groups_campaign on public.ad_groups(campaign_id);
create index if not exists idx_ads_group on public.ads(ad_group_id);
create index if not exists idx_ad_publish_log_campaign on public.ad_publish_log(campaign_id, created_at desc);

alter table public.ad_campaigns enable row level security;
alter table public.ad_groups enable row level security;
alter table public.ads enable row level security;
alter table public.ad_publish_log enable row level security;

do $$
declare t text;
begin
  foreach t in array array['ad_campaigns','ad_groups','ads','ad_publish_log'] loop
    if not exists (
      select 1 from pg_policies
      where schemaname='public' and tablename=t and policyname='company_member_access'
    ) then
      execute format($f$
        create policy company_member_access on public.%I
          for all to authenticated
          using (
            company_id in (select company_id from public.users where id = (select auth.uid()))
            or exists (select 1 from public.users where id = (select auth.uid()) and role in ('owner','system_admin'))
          )
          with check (
            company_id in (select company_id from public.users where id = (select auth.uid()))
            or exists (select 1 from public.users where id = (select auth.uid()) and role in ('owner','system_admin'))
          )
      $f$, t);
    end if;
  end loop;
end $$;

commit;
