-- ============================================================
-- BMAPZ AI — Complete Supabase Schema
-- Run this in Supabase SQL Editor → New Query → Run All
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ACCOUNTS (top-level billing entities / agencies)
-- ============================================================
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  owner_email TEXT,
  company_ids TEXT[] DEFAULT '{}',
  subscription_id UUID,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','suspended','canceled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- COMPANIES (sub-accounts / client workspaces)
-- ============================================================
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  website TEXT,
  industry TEXT,
  description TEXT,
  services_description TEXT,
  logo_url TEXT,
  subscription_tier TEXT DEFAULT 'trial',
  -- ICP (Ideal Customer Profile)
  icp JSONB DEFAULT '{}',
  -- Briefing / Brand info
  briefing JSONB DEFAULT '{}',
  -- Value propositions
  value_propositions TEXT[] DEFAULT '{}',
  -- Integration connection status  { google_ads: 'connected', meta: 'connected', ... }
  integration_status JSONB DEFAULT '{}',
  -- API keys / tokens (encrypted at app level)
  api_keys JSONB DEFAULT '{}',
  -- App settings (agent_name, image_ai_provider, etc.)
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- USERS (extends Supabase auth.users)
-- ============================================================
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE,
  full_name TEXT,
  phone TEXT,
  timezone TEXT DEFAULT 'UTC',
  profile_picture TEXT,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  role TEXT DEFAULT 'user' CHECK (role IN ('owner','system_admin','company_admin','user')),
  accessible_company_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SUBSCRIPTIONS
-- ============================================================
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_email TEXT,
  plan TEXT DEFAULT 'trial' CHECK (plan IN ('trial','starter','growth','scale','enterprise')),
  status TEXT DEFAULT 'trialing' CHECK (status IN ('trialing','active','past_due','canceled','paused')),
  billing_cycle TEXT DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly','annual')),
  trial_ends_at TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  ai_credits_total INTEGER DEFAULT 8000,
  ai_credits_used INTEGER DEFAULT 0,
  scan_tokens_total INTEGER DEFAULT 0,
  scan_tokens_used INTEGER DEFAULT 0,
  contacts_limit INTEGER DEFAULT 1500,
  users_limit INTEGER DEFAULT 1,
  company_profiles_limit INTEGER DEFAULT 1,
  extra_users INTEGER DEFAULT 0,
  extra_company_profiles INTEGER DEFAULT 0,
  topup_credits_purchased INTEGER DEFAULT 0,
  annual_discount_applied BOOLEAN DEFAULT FALSE,
  founder_pricing BOOLEAN DEFAULT FALSE,
  price_brl NUMERIC(10,2),
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- LEADS
-- ============================================================
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  lead_name TEXT,
  lead_company_name TEXT,
  email TEXT,
  phone TEXT,
  role TEXT,
  website TEXT,
  company_website TEXT,
  company_linkedin TEXT,
  linkedin_url TEXT,
  source TEXT,
  status TEXT DEFAULT 'new' CHECK (status IN ('new','contacted','qualified','proposal','negotiation','won','lost','disqualified')),
  funnel_stage TEXT DEFAULT 'awareness',
  icp_score INTEGER,
  icp_reasoning TEXT,
  icp_recommendation TEXT,
  estimated_value NUMERIC(12,2),
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  is_decision_maker BOOLEAN,
  digital_presence_analysis JSONB,
  outreach_messages JSONB[] DEFAULT '{}',
  last_contacted_at TIMESTAMPTZ,
  enriched_at TIMESTAMPTZ,
  ad_platform TEXT,
  ad_form_id TEXT,
  ad_campaign_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- LEAD LISTS
-- ============================================================
CREATE TABLE lead_lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT DEFAULT 'static' CHECK (type IN ('static','dynamic')),
  filters JSONB DEFAULT '{}',
  lead_ids UUID[] DEFAULT '{}',
  lead_count INTEGER DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MESSAGES
-- ============================================================
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  direction TEXT DEFAULT 'outbound' CHECK (direction IN ('inbound','outbound')),
  channel TEXT CHECK (channel IN ('email','whatsapp','linkedin','instagram','sms','internal')),
  subject TEXT,
  content TEXT,
  html_content TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','sending','sent','delivered','read','failed','received')),
  sent_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  from_address TEXT,
  to_address TEXT,
  platform_message_id TEXT,
  thread_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MESSAGE TEMPLATES
-- ============================================================
CREATE TABLE message_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  channel TEXT,
  subject TEXT,
  content TEXT NOT NULL,
  html_content TEXT,
  variables TEXT[] DEFAULT '{}',
  category TEXT,
  is_global BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ACTIVITIES (CRM timeline)
-- ============================================================
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  user_email TEXT,
  type TEXT NOT NULL,
  title TEXT,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- WORKFLOWS
-- ============================================================
CREATE TABLE workflows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT DEFAULT 'sales_outreach' CHECK (type IN ('sales_outreach','follow_up','nurturing','qualification','custom')),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','active','paused','archived')),
  nodes JSONB[] DEFAULT '{}',
  connections JSONB[] DEFAULT '{}',
  steps JSONB[] DEFAULT '{}',
  triggers JSONB DEFAULT '{}',
  is_template BOOLEAN DEFAULT FALSE,
  leads_enrolled INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- WORKFLOW RUNS
-- ============================================================
CREATE TABLE workflow_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','paused','completed','failed','canceled')),
  current_step_index INTEGER DEFAULT 0,
  current_node_id TEXT,
  steps_completed INTEGER DEFAULT 0,
  next_action_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error TEXT,
  context JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- NODE TEMPLATES (Workflow node templates)
-- ============================================================
CREATE TABLE node_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT,
  description TEXT,
  config JSONB DEFAULT '{}',
  is_global BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SOCIAL POSTS
-- ============================================================
CREATE TABLE social_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  platform_contents JSONB DEFAULT '{}',
  platforms TEXT[] DEFAULT '{}',
  content_type TEXT DEFAULT 'text' CHECK (content_type IN ('text','carousel','video','image')),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','scheduled','published','failed')),
  scheduled_for TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  external_post_id TEXT,
  platform_post_ids JSONB DEFAULT '{}',
  hashtags TEXT[] DEFAULT '{}',
  media_urls TEXT[] DEFAULT '{}',
  performance JSONB DEFAULT '{}',
  ai_generated BOOLEAN DEFAULT FALSE,
  ai_optimized BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AD RECORDS
-- ============================================================
CREATE TABLE ad_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type TEXT DEFAULT 'campaign',
  platform TEXT,
  title TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','active','paused','completed','failed')),
  external_id TEXT,
  ad_account_id TEXT,
  campaign_id TEXT,
  ad_set_id TEXT,
  budget NUMERIC(12,2),
  budget_type TEXT DEFAULT 'daily',
  objective TEXT,
  audience JSONB DEFAULT '{}',
  creative JSONB DEFAULT '{}',
  performance JSONB DEFAULT '{}',
  strategy JSONB DEFAULT '{}',
  copy_data JSONB DEFAULT '{}',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SEO ANALYSES
-- ============================================================
CREATE TABLE seo_analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  domain TEXT,
  score INTEGER,
  issues JSONB[] DEFAULT '{}',
  recommendations JSONB[] DEFAULT '{}',
  top_keywords JSONB[] DEFAULT '{}',
  search_console_data JSONB DEFAULT '{}',
  ai_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AI OUTPUTS (saved AI generations)
-- ============================================================
CREATE TABLE ai_outputs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  type TEXT,
  prompt TEXT,
  output TEXT,
  model TEXT,
  tokens_used INTEGER,
  approved BOOLEAN DEFAULT FALSE,
  applied BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- BLOG POSTS
-- ============================================================
CREATE TABLE blog_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  excerpt TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  published_at TIMESTAMPTZ,
  tags TEXT[] DEFAULT '{}',
  seo_title TEXT,
  seo_description TEXT,
  featured_image TEXT,
  wordpress_post_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- BRAND SCANS
-- ============================================================
CREATE TABLE brand_scans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed')),
  scan_type TEXT DEFAULT 'lite' CHECK (scan_type IN ('lite','full')),
  results JSONB DEFAULT '{}',
  score INTEGER,
  recommendations JSONB[] DEFAULT '{}',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FUNNELS
-- ============================================================
CREATE TABLE funnels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  stages JSONB[] DEFAULT '{}',
  metrics JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DASHBOARD CONFIGS
-- ============================================================
CREATE TABLE dashboard_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT DEFAULT 'My Dashboard',
  widgets JSONB[] DEFAULT '{}',
  layout JSONB DEFAULT '{}',
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INTEGRATIONS (per-company third-party connections)
-- ============================================================
CREATE TABLE integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  status TEXT DEFAULT 'disconnected' CHECK (status IN ('connected','disconnected','error','pending')),
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  account_id TEXT,
  account_name TEXT,
  scopes TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, type)
);

-- ============================================================
-- BILLING PURCHASES
-- ============================================================
CREATE TABLE billing_purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_email TEXT,
  type TEXT CHECK (type IN ('credit_topup','full_scan','extra_user','extra_company_profile','plan_upgrade')),
  amount_brl NUMERIC(10,2) NOT NULL,
  quantity INTEGER DEFAULT 1,
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','refunded')),
  payment_method TEXT DEFAULT 'stripe_card',
  stripe_payment_intent_id TEXT,
  stripe_session_id TEXT,
  pix_qr_code TEXT,
  credits_granted INTEGER DEFAULT 0,
  scan_tokens_granted INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CREDIT TRANSACTIONS
-- ============================================================
CREATE TABLE credit_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  type TEXT CHECK (type IN ('usage','topup','monthly_grant','bonus','refund')),
  feature TEXT,
  credits_delta INTEGER NOT NULL,
  credits_after INTEGER,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ADMIN CHANGE LOG
-- ============================================================
CREATE TABLE admin_change_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  performed_by_email TEXT NOT NULL,
  performed_by_role TEXT,
  action_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  target_name TEXT,
  details JSONB DEFAULT '{}',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DATA DELETION REQUESTS (GDPR)
-- ============================================================
CREATE TABLE data_deletion_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  instagram_username TEXT,
  reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','processing','completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_leads_company ON leads(company_id);
CREATE INDEX idx_leads_status ON leads(company_id, status);
CREATE INDEX idx_leads_email ON leads(email);
CREATE INDEX idx_messages_lead ON messages(lead_id);
CREATE INDEX idx_messages_company ON messages(company_id);
CREATE INDEX idx_activities_lead ON activities(lead_id);
CREATE INDEX idx_activities_company ON activities(company_id);
CREATE INDEX idx_social_posts_company ON social_posts(company_id);
CREATE INDEX idx_social_posts_status ON social_posts(company_id, status);
CREATE INDEX idx_ad_records_company ON ad_records(company_id);
CREATE INDEX idx_workflow_runs_workflow ON workflow_runs(workflow_id);
CREATE INDEX idx_workflow_runs_lead ON workflow_runs(lead_id);
CREATE INDEX idx_subscriptions_company ON subscriptions(company_id);
CREATE INDEX idx_subscriptions_stripe ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_integrations_company ON integrations(company_id);
CREATE INDEX idx_users_company ON users(company_id);

-- ============================================================
-- UPDATED_AT TRIGGER (auto-update timestamps)
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'accounts','companies','users','subscriptions','leads','lead_lists',
    'messages','message_templates','workflows','workflow_runs','social_posts',
    'ad_records','seo_analyses','blog_posts','brand_scans','funnels',
    'dashboard_configs','integrations','billing_purchases','data_deletion_requests'
  ] LOOP
    EXECUTE format('CREATE TRIGGER trg_updated_%s BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION update_updated_at()', t, t);
  END LOOP;
END $$;

-- ============================================================
-- ROW LEVEL SECURITY (RLS) — Multi-tenant isolation
-- ============================================================
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE funnels ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE node_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can read/update their own profile
CREATE POLICY "users_own" ON users FOR ALL USING (auth.uid() = id);

-- Company access: user must be in company or have accessible_company_ids
CREATE POLICY "company_member" ON companies FOR ALL USING (
  id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
    UNION
    SELECT UNNEST(accessible_company_ids) FROM users WHERE id = auth.uid()
  )
);

-- Generic company-scoped policy factory (applied to all company_id tables)
-- NOTE: Backend uses service_role key which bypasses RLS — policies are for direct client access
CREATE POLICY "scoped_to_company" ON leads FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE id = auth.uid()
    UNION SELECT UNNEST(accessible_company_ids) FROM users WHERE id = auth.uid())
);
CREATE POLICY "scoped_to_company" ON messages FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE id = auth.uid()
    UNION SELECT UNNEST(accessible_company_ids) FROM users WHERE id = auth.uid())
);
CREATE POLICY "scoped_to_company" ON activities FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE id = auth.uid()
    UNION SELECT UNNEST(accessible_company_ids) FROM users WHERE id = auth.uid())
);
CREATE POLICY "scoped_to_company" ON workflows FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE id = auth.uid()
    UNION SELECT UNNEST(accessible_company_ids) FROM users WHERE id = auth.uid())
    OR is_template = TRUE
);
CREATE POLICY "scoped_to_company" ON social_posts FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE id = auth.uid()
    UNION SELECT UNNEST(accessible_company_ids) FROM users WHERE id = auth.uid())
);
CREATE POLICY "scoped_to_company" ON ad_records FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE id = auth.uid()
    UNION SELECT UNNEST(accessible_company_ids) FROM users WHERE id = auth.uid())
);
CREATE POLICY "scoped_to_company" ON subscriptions FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE id = auth.uid()
    UNION SELECT UNNEST(accessible_company_ids) FROM users WHERE id = auth.uid())
);
CREATE POLICY "scoped_to_company" ON integrations FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE id = auth.uid()
    UNION SELECT UNNEST(accessible_company_ids) FROM users WHERE id = auth.uid())
);
CREATE POLICY "scoped_to_company" ON billing_purchases FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE id = auth.uid()
    UNION SELECT UNNEST(accessible_company_ids) FROM users WHERE id = auth.uid())
);

-- Handle user creation trigger (auto-create users record on signup)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO users (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
