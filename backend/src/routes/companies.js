import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth, requireCompanyAdmin } from '../middleware/auth.js';
import { invalidateCompanyBrain } from '../lib/companyBrain.js';

const router = Router();

/**
 * Fields that are true top-level columns in the companies table.
 */
const DIRECT_COLUMNS = new Set([
  'name', 'website', 'industry', 'description', 'services_description',
  'logo_url', 'icp', 'briefing', 'value_propositions', 'integration_status',
]);

/**
 * Fields stored inside the api_keys JSONB column.
 */
const API_KEY_FIELDS = new Set([
  'openai_api_key', 'openai_model', 'anthropic_api_key', 'anthropic_model',
  'ai_provider', 'ai_image_provider', 'ai_image_model', 'personal_agent_name',
  'stability_api_key',
  'google_client_id', 'google_client_secret',
  'meta_app_id', 'meta_app_secret',
  'linkedin_client_id', 'linkedin_client_secret',
  'twitter_client_id', 'twitter_client_secret',
  'tiktok_client_key', 'tiktok_client_secret',
  'google_access_token', 'google_refresh_token', 'google_token_expires_at',
  'google_connected_email', 'google_drive_token',
  'meta_access_token', 'meta_token_expires_at',
  'linkedin_access_token', 'linkedin_token_expires_at',
  'twitter_access_token', 'twitter_access_secret',
  'tiktok_access_token', 'tiktok_token_expires_at',
  'facebook_page_id', 'facebook_page_access_token',
  'instagram_business_account_id',
  'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from',
  'resend_api_key', 'resend_from_email',
  'gmail_sender_email', 'gmail_client_id', 'gmail_client_secret', 'gmail_refresh_token',
  'apollo_api_key', 'hunter_api_key', 'lusha_api_key', 'clay_api_key',
  'cal_com_api_key', 'chilipiper_api_key', 'chilipiper_tenant',
  'google_developer_token', 'google_ads_developer_token', 'google_ads_client_id', 'google_ads_client_secret',
  'google_ads_refresh_token', 'google_ads_customer_id', 'google_ads_connected',
  'meta_ad_account_id', 'meta_page_id', 'meta_ads_account_id', 'meta_ads_connected',
  'instagram_account_id',
  'linkedin_ads_access_token', 'linkedin_ads_account_id', 'linkedin_ads_connected',
  'tiktok_advertiser_id', 'tiktok_ads_account_id', 'tiktok_ads_connected',
  'google_analytics_property_id', 'google_search_console_url',
  'wordpress_url', 'wordpress_user', 'wordpress_app_password',
  'zapier_webhook_url', 'make_webhook_url', 'n8n_webhook_url',
  'custom_api_url', 'custom_api_key', 'custom_api_headers',
  'whatsapp_api_token', 'whatsapp_phone_id', 'whatsapp_verify_token',
  'stripe_account_id', 'stripe_connected',
  // Sales/email tools added Session 8 with the OAuth-only / per-user-account model
  'lemlist_api_key',
  'mailchimp_api_key', 'mailchimp_server_prefix',
  'klaviyo_api_key',
  'activecampaign_api_url', 'activecampaign_api_key',
  'brevo_api_key',
  'convertkit_api_key', 'convertkit_api_secret',
  'mailerlite_api_key',
  'intercom_access_token',
  // Analytics
  'mixpanel_project_token', 'mixpanel_service_secret',
  'segment_write_key',
  'hotjar_site_id', 'hotjar_api_token',
  // AI tools (BYO accounts at user level)
  'perplexity_api_key', 'jasper_api_key', 'loom_api_key', 'demio_api_key',
  // eCommerce + site builders + meeting tools
  'shopify_store_url', 'shopify_admin_token',
  'webflow_api_token',
  'zoom_account_id', 'zoom_client_id', 'zoom_client_secret',
]);

/**
 * Fields stored inside the settings JSONB column.
 */
const SETTINGS_FIELDS = new Set([
  'years_in_business', 'business_model', 'average_ticket',
  'repurchase_cycle', 'marketing_structure', 'sales_structure',
  'geographic_market', 'owner_email',
  'icp_description', 'target_audience', 'tone_of_voice',
  'company_details', 'plan_features', 'custom_fields',
  'connected_integrations',
]);

/**
 * Flatten a company row: spread api_keys and settings JSONB into top-level keys
 * so the frontend can read company.openai_api_key etc. transparently.
 */
function flattenCompany(row) {
  if (!row) return row;
  const { api_keys, settings, ...rest } = row;
  return {
    ...rest,
    ...(api_keys || {}),
    ...(settings || {}),
  };
}

// GET /api/companies/current
router.get('/current', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('companies')
      .select('*')
      .eq('id', req.companyId)
      .single();
    if (error) throw error;
    res.json(flattenCompany(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/companies/current
router.patch('/current', requireAuth, requireCompanyAdmin, async (req, res) => {
  try {
    const directUpdates = {};
    const apiKeyUpdates = {};
    const settingsUpdates = {};

    for (const [key, value] of Object.entries(req.body)) {
      if (DIRECT_COLUMNS.has(key)) {
        directUpdates[key] = value;
      } else if (API_KEY_FIELDS.has(key)) {
        apiKeyUpdates[key] = value;
      } else if (SETTINGS_FIELDS.has(key)) {
        settingsUpdates[key] = value;
      }
    }

    const hasApiKeyUpdates = Object.keys(apiKeyUpdates).length > 0;
    const hasSettingsUpdates = Object.keys(settingsUpdates).length > 0;

    let existingApiKeys = {};
    let existingSettings = {};

    if (hasApiKeyUpdates || hasSettingsUpdates) {
      const { data: existing } = await supabaseAdmin
        .from('companies')
        .select('api_keys, settings')
        .eq('id', req.companyId)
        .single();
      existingApiKeys = existing?.api_keys || {};
      existingSettings = existing?.settings || {};
    }

    const finalUpdates = { ...directUpdates };
    if (hasApiKeyUpdates) finalUpdates.api_keys = { ...existingApiKeys, ...apiKeyUpdates };
    if (hasSettingsUpdates) finalUpdates.settings = { ...existingSettings, ...settingsUpdates };

    if (Object.keys(finalUpdates).length === 0) {
      const { data: current } = await supabaseAdmin
        .from('companies')
        .select('*')
        .eq('id', req.companyId)
        .single();
      return res.json(flattenCompany(current));
    }

    const { data, error } = await supabaseAdmin
      .from('companies')
      .update(finalUpdates)
      .eq('id', req.companyId)
      .select()
      .single();

    if (error) throw error;
    invalidateCompanyBrain(req.companyId);
    res.json(flattenCompany(data));
  } catch (err) {
    console.error('[companies/patch]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/companies — create a new company for the authenticated user
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, website, industry, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Company name is required' });

    // Create company
    const { data: company, error: companyErr } = await supabaseAdmin
      .from('companies')
      .insert({ name, website, industry, description })
      .select()
      .single();
    if (companyErr) throw companyErr;

    // Create trial subscription for new company
    await supabaseAdmin.from('subscriptions').insert({
      company_id: company.id,
      plan: 'trial',
      status: 'trialing',
      ai_credits_total: 100,
      ai_credits_used: 0,
    });

    res.json(flattenCompany(company));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/companies/subscription
router.get('/subscription', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('company_id', req.companyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    res.json(data || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/companies/credits
router.get('/credits', requireAuth, async (req, res) => {
  try {
    const { data: sub } = await supabaseAdmin
      .from('subscriptions')
      .select('ai_credits_total, ai_credits_used')
      .eq('company_id', req.companyId)
      .single();

    const remaining = sub
      ? (sub.ai_credits_total || 0) - (sub.ai_credits_used || 0)
      : 0;

    res.json({ total: sub?.ai_credits_total || 0, used: sub?.ai_credits_used || 0, remaining });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/companies/deduct-credits
router.post('/deduct-credits', requireAuth, requireCompanyAdmin, async (req, res) => {
  try {
    const amount = Number(req.body?.amount ?? 1);
    const feature = req.body?.feature || 'ai_call';
    if (!Number.isInteger(amount) || amount < 1 || amount > 1000) {
      return res.status(400).json({ error: 'amount must be an integer between 1 and 1000' });
    }

    const { data: sub, error: subErr } = await supabaseAdmin
      .from('subscriptions')
      .select('id, ai_credits_total, ai_credits_used')
      .eq('company_id', req.companyId)
      .single();

    if (subErr || !sub) return res.status(400).json({ error: 'No active subscription' });

    const remaining = (sub.ai_credits_total || 0) - (sub.ai_credits_used || 0);
    if (remaining < amount) {
      return res.status(402).json({ error: 'Insufficient AI credits' });
    }

    const newUsed = (sub.ai_credits_used || 0) + amount;
    await supabaseAdmin
      .from('subscriptions')
      .update({ ai_credits_used: newUsed })
      .eq('id', sub.id);

    await supabaseAdmin
      .from('credit_transactions')
      .insert({
        company_id: req.companyId,
        type: 'usage',
        feature,
        credits_delta: -amount,
        credits_after: (sub.ai_credits_total || 0) - newUsed,
      });

    res.json({ success: true, remaining: (sub.ai_credits_total || 0) - newUsed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
