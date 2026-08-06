-- 023: Pluggable payment providers (App Owner controlled)
--
-- Stripe is the primary method for taking customer payments, but the platform
-- must be able to offer others (Mercado Pago, Pix, boleto, manual invoice)
-- without a code change. Which provider is live is a PLATFORM decision, so it
-- lives in a platform-level settings table only the App Owner can write.

create table if not exists public.platform_settings (
  key text primary key,
  value jsonb not null default '{}',
  updated_by text,
  updated_at timestamptz default now()
);

alter table public.platform_settings enable row level security;

-- No direct client access at all: the API layer (service role) is the only way
-- in, and it checks role = 'owner'. A permissive policy here would leak
-- provider credentials to any authenticated user.
drop policy if exists platform_settings_no_client_access on public.platform_settings;
create policy platform_settings_no_client_access on public.platform_settings
  for select using (false);

-- Seed the payment configuration: Stripe enabled, everything else declared but
-- off so the UI can list them without pretending they work.
insert into public.platform_settings (key, value)
values (
  'payments',
  jsonb_build_object(
    'active_provider', 'stripe',
    'providers', jsonb_build_object(
      'stripe',       jsonb_build_object('enabled', true,  'label', 'Stripe',       'currencies', jsonb_build_array('BRL','USD','EUR')),
      'mercadopago',  jsonb_build_object('enabled', false, 'label', 'Mercado Pago', 'currencies', jsonb_build_array('BRL')),
      'pix',          jsonb_build_object('enabled', false, 'label', 'Pix',          'currencies', jsonb_build_array('BRL')),
      'manual',       jsonb_build_object('enabled', false, 'label', 'Manual invoice','currencies', jsonb_build_array('BRL','USD','EUR'))
    )
  )
)
on conflict (key) do nothing;

-- Record which provider each purchase came through, so revenue can be
-- reconciled per provider once more than one is live.
alter table public.billing_purchases
  add column if not exists payment_provider text default 'stripe',
  add column if not exists provider_reference text;

create index if not exists idx_billing_purchases_provider on public.billing_purchases(payment_provider);
