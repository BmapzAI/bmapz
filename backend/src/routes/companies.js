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
      'name', 'website', 'industry', 'description', 'logo_url',
      'icp_description', 'target_audience', 'tone_of_voice',
      'openai_api_key', 'anthropic_api_key', 'google_client_id',
      'google_client_secret', 'meta_app_id', 'meta_app_secret',
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
      'stripe_account_id', 'stripe_connected',
      'apollo_api_key', 'hunter_api_key',
      'google_ads_customer_id', 'google_ads_connected',
      'meta_ads_account_id', 'meta_ads_connected',
      'linkedin_ads_account_id', 'linkedin_ads_connected',
      'tiktok_ads_account_id', 'tiktok_ads_connected',
      'google_analytics_property_id', 'google_search_console_url',
      'ai_image_provider', 'ai_image_model',
      'personal_agent_name',
      'connected_integrations',
      'integration_status',
      'plan_features',
      'custom_fields',
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
