-- ============================================================
-- Session 11: Scan tokens + monthly reset + annual cancellation
-- ============================================================

-- Add scan-token tracking + monthly cycle anchor to subscriptions
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS scan_tokens_total      INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scan_tokens_used       INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scan_tokens_addon      INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cycle_started_at       TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS cycle_ends_at          TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  ADD COLUMN IF NOT EXISTS last_reset_at          TIMESTAMPTZ;

-- Annual subscriptions need a start anchor + billing cycle marker for cancellation fee
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS billing_cycle          TEXT DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly','annual')),
  ADD COLUMN IF NOT EXISTS annual_start_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS annual_prepaid_amount  NUMERIC(10,2);

-- Expand credit_transactions.type to include scan token and addon events
ALTER TABLE credit_transactions
  DROP CONSTRAINT IF EXISTS credit_transactions_type_check;
ALTER TABLE credit_transactions
  ADD CONSTRAINT credit_transactions_type_check
  CHECK (type IN (
    'usage','topup','monthly_grant','bonus','refund',
    'scan_usage','scan_addon','scan_grant',
    'cycle_reset','cancellation_fee'
  ));
