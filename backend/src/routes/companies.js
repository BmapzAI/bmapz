import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth, requireCompanyAdmin } from '../middleware/auth.js';

const router = Router();

// GET /api/companies/current — current user's company
router.get('/current', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('companies')
      .select('*')
      .eq('id', req.companyId)
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/companies/current — update company settings
router.patch('/current', requireAuth, requireCompanyAdmin, async (req, res) => {
  try {
    const allowedFields = [
      // Company info
      'name', 'website', 'industry', 'description', 'logo_url',
      'services_description', 'value_propositions',
      'years_in_business', 'business_model', 'average_ticket',
      'repurchase_cycle', 'marketing_structure', 'sales_structure',
      'geographic_market', 'owner_email',
      // ICP and strategic data (JSONB columns)
      'icp', 'briefing', 'company_details',
      // Legacy fields
      'icp_description', 'target_audience', 'tone_of_voice',
      // AI settings
      'openai_api_key', 'openai_model', 'anthropic_api_key',
      'ai_image_provider', 'ai_image_model', 'personal_agent_name', 'stability_api_key',
      // OAuth app credentials
      'google_client_id', 'google_client_secret',
      'meta_app_id', 'meta_app_secret',
      'linkedin_client_id', 'linkedin_client_secret',
      'twitter_client_id', 'twitter_client_secret',
      'tiktok_client_key', 'tiktok_client_secret',
      // OAuth tokens
      'google_access_token', 'google_refresh_token', 'google_token_expires_at',
      'google_connected_email', 'google_drive_token',
      'meta_access_token', 'meta_token_expires_at',
      'linkedin_access_token', 'linkedin_token_expires_at',
      'twitter_access_token', 'twitter_access_secret',
      'tiktok_access_token', 'tiktok_token_expires_at',
      'facebook_page_id', 'facebook_page_access_token',
      'instagram_business_account_id',
      // Email/SMTP
      'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from',
      'resend_api_key', 'resend_from_email',
      'gmail_sender_email', 'gmail_client_id', 'gmail_client_secret', 'gmail_refresh_token',
      // Ad platform keys
      'apollo_api_key', 'hunter_api_key',
      'google_ads_developer_token', 'google_ads_client_id', 'google_ads_client_secret',
      'google_ads_refresh_token', 'google_ads_customer_id', 'google_ads_connected',
      'meta_ads_account_id', 'meta_ads_connected',
      'linkedin_ads_access_token', 'linkedin_ads_account_id', 'linkedin_ads_connected',
      'tiktok_advertiser_id', 'tiktok_ads_account_id', 'tiktok_ads_connected',
      // Analytics
      'google_analytics_property_id', 'google_search_console_url',
      // CMS
      'wordpress_url', 'wordpress_user', 'wordpress_app_password',
      // Automation webhooks
      'zapier_webhook_url', 'make_webhook_url', 'n8n_webhook_url',
      'custom_api_url', 'custom_api_key', 'custom_api_headers',
      // Messaging
      'whatsapp_api_token', 'whatsapp_phone_id', 'whatsapp_verify_token',
      // Stripe
      'stripe_account_id', 'stripe_connected',
      // Status / misc
      'connected_integrations', 'integration_status', 'plan_features', 'custom_fields',
    ];

    const updates = {};
    for (const key of allowedFields) {
      if (key in req.body) {
        updates[key] = req.body[key];
      }
    }

    const { data, error } = await supabaseAdmin
      .from('companies')
      .update(updates)
      .eq('id', req.companyId)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/companies/subscription — current subscription
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

// GET /api/companies/credits — credit balance
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

// POST /api/companies/deduct-credits — deduct AI credits
router.post('/deduct-credits', requireAuth, async (req, res) => {
  try {
    const { amount = 1, feature = 'ai_call' } = req.body;

    // Get current subscription
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

    // Log credit transaction
    await supabaseAdmin
      .from('credit_transactions')
      .insert({
        company_id: req.companyId,
        type: 'deduction',
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
