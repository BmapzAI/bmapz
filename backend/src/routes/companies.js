import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth, requireCompanyAdmin } from '../middleware/auth.js';
import { invalidateCompanyBrain } from '../lib/companyBrain.js';
import { invalidateAISettingsCache } from './ai.js';
import { daysUntilHandleChange } from './users.js';
import { flattenCompany } from '../lib/companyView.js';

const router = Router();

/**
 * Fields that are true top-level columns in the companies table.
 */
const DIRECT_COLUMNS = new Set([
  'name', 'website', 'industry', 'description', 'services_description',
  'logo_url', 'icp', 'briefing', 'value_propositions', 'integration_status',
  // How new leads are shared across available sales team members
  // (random | balanced | queued) — see lib/leadAssignment.js.
  'lead_routing_method',
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

// flattenCompany / SECRET_KEY_RE now live in lib/companyView.js. They were moved
// there because routes/auth.js had its own unhardened copy of this helper, so the
// redaction below was bypassable by reading /api/auth/me instead. One shared
// definition means the two cannot drift apart again.

// GET /api/companies/current
// ─── Multi-company switching ─────────────────────────────────────────────────
// Users granted access to several companies (users.accessible_company_ids) need
// to move between them so data scope never mixes. Platform roles can reach any
// company. Switching writes active_company_id — never company_id — so a user's
// home company and role stay intact (see migration 021).

const PLATFORM_ROLES = new Set(['owner', 'system_admin']);

/** Companies this user is allowed to work in, newest-name-first. */
async function listSwitchableCompanies(dbUser) {
  if (PLATFORM_ROLES.has(dbUser.role)) {
    const { data } = await supabaseAdmin
      .from('companies').select('id, name, handle, logo_url, industry').order('name', { ascending: true });
    return data || [];
  }
  const ids = [dbUser.company_id, ...(dbUser.accessible_company_ids || [])].filter(Boolean);
  if (!ids.length) return [];
  const { data } = await supabaseAdmin
    .from('companies').select('id, name, handle, logo_url, industry')
    .in('id', [...new Set(ids)])
    .order('name', { ascending: true });
  return data || [];
}

// GET /api/companies/switchable — the switcher's option list.
router.get('/switchable', requireAuth, async (req, res) => {
  try {
    const companies = await listSwitchableCompanies(req.dbUser);
    res.json({
      data: companies,
      active_company_id: req.companyId,
      home_company_id: req.dbUser.company_id,
      can_switch: companies.length > 1,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/companies/switch { company_id } — change the active company.
router.post('/switch', requireAuth, async (req, res) => {
  try {
    const target = req.body?.company_id;
    if (!target) return res.status(400).json({ error: 'company_id is required' });

    // Authorisation is decided HERE from the user's own record — never from
    // anything the client sends beyond the target id.
    const allowed = await listSwitchableCompanies(req.dbUser);
    if (!allowed.some(c => c.id === target)) {
      return res.status(403).json({ error: 'You do not have access to that company' });
    }

    // Returning to the home company clears the override rather than storing it.
    const nextActive = target === req.dbUser.company_id ? null : target;
    const { error } = await supabaseAdmin
      .from('users')
      .update({ active_company_id: nextActive })
      .eq('id', req.dbUser.id);
    if (error) {
      if (/active_company_id|column/i.test(error.message || '')) {
        return res.status(503).json({ error: 'Run migration 021 to enable company switching.' });
      }
      throw error;
    }

    // The brain and AI settings caches are keyed by company, so nothing to
    // clear — but the switched-to company's data must be read fresh.
    const company = allowed.find(c => c.id === target);
    res.json({ success: true, active_company_id: target, company });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/companies/handle — change the @companyname.
// Kept OFF the generic settings PATCH deliberately: it is an identity with a
// 90-day cooldown (migration 027) and a case-insensitive uniqueness constraint,
// so it needs its own validation and its own error messages.
router.patch('/handle', requireAuth, requireCompanyAdmin, async (req, res) => {
  try {
    const clean = String(req.body?.handle || '').trim().replace(/^@+/, '');
    if (!/^[A-Za-z0-9_]{3,30}$/.test(clean)) {
      return res.status(400).json({ error: 'Company handle must be 3–30 characters: letters, numbers and underscore only.' });
    }

    const { data: company, error: readErr } = await supabaseAdmin
      .from('companies').select('id, handle, handle_changed_at').eq('id', req.companyId).single();
    if (readErr) return res.status(503).json({ error: 'Could not read the company. Nothing was changed.' });

    // Same handle in different case is not a change — don't spend the allowance.
    if (String(company.handle || '').toLowerCase() !== clean.toLowerCase()) {
      const remaining = daysUntilHandleChange(company.handle_changed_at);
      if (remaining > 0) {
        return res.status(429).json({
          error: `The company handle can be changed again in ${remaining} day${remaining === 1 ? '' : 's'}.`,
          code: 'HANDLE_COOLDOWN',
          days_remaining: remaining,
        });
      }
      const { data: clash, error: clashErr } = await supabaseAdmin
        .from('companies').select('id').ilike('handle', clean).limit(1).maybeSingle();
      if (clashErr) return res.status(503).json({ error: 'Could not check that handle. Nothing was changed.' });
      if (clash && clash.id !== req.companyId) {
        return res.status(409).json({ error: `@${clean} is already taken.`, code: 'HANDLE_TAKEN' });
      }
    }

    const { data, error } = await supabaseAdmin
      .from('companies').update({ handle: clean }).eq('id', req.companyId).select().single();
    if (error) {
      if (/idx_companies_handle_lower|duplicate key/i.test(error.message || '')) {
        return res.status(409).json({ error: 'That handle was just taken. Pick another.', code: 'HANDLE_TAKEN' });
      }
      if (/once every 90 days/i.test(error.message || '')) {
        return res.status(429).json({ error: error.message, code: 'HANDLE_COOLDOWN' });
      }
      if (/handle|column|does not exist/i.test(error.message || '')) {
        return res.status(503).json({ error: 'Run migrations 024 and 027 to enable company handles.' });
      }
      throw error;
    }
    invalidateCompanyBrain(req.companyId);
    res.json(flattenCompany(data, { includeSecrets: true }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/companies/handle-available?handle=acme
router.get('/handle-available', requireAuth, async (req, res) => {
  try {
    const clean = String(req.query.handle || '').trim().replace(/^@+/, '');
    if (!/^[A-Za-z0-9_]{3,30}$/.test(clean)) return res.json({ available: false, reason: 'invalid' });
    const { data, error } = await supabaseAdmin
      .from('companies').select('id').ilike('handle', clean).limit(1).maybeSingle();
    if (error) {
      if (/handle|column|does not exist/i.test(error.message || '')) {
        return res.status(503).json({ available: false, reason: 'unavailable', error: 'Run migration 024 to enable company handles.' });
      }
      throw error;
    }
    const taken = !!data && data.id !== req.companyId;
    res.json({ available: !taken, reason: taken ? 'taken' : null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/current', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('companies')
      .select('*')
      .eq('id', req.companyId)
      .single();
    if (error) throw error;
    // requireAuth only — an ordinary member must not receive credentials.
    const isAdmin = ['owner', 'system_admin', 'company_admin'].includes(req.dbUser?.role);
    res.json(flattenCompany(data, { includeSecrets: isAdmin }));
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
      const { data: existing, error: readErr } = await supabaseAdmin
        .from('companies')
        .select('api_keys, settings')
        .eq('id', req.companyId)
        .single();
      // Refuse the write if the read failed. Both columns are merged blobs that
      // get REPLACED wholesale below, so defaulting to `{}` would turn saving one
      // settings field into deleting every API key and every other setting.
      if (readErr) {
        console.error('[companies/patch] existing settings read failed, refusing to write:', readErr.message);
        return res.status(503).json({
          error: 'Could not read your current settings, so nothing was saved. Please try again.',
        });
      }
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
      return res.json(flattenCompany(current, { includeSecrets: true }));
    }

    const { data, error } = await supabaseAdmin
      .from('companies')
      .update(finalUpdates)
      .eq('id', req.companyId)
      .select()
      .single();

    if (error) throw error;
    invalidateCompanyBrain(req.companyId);
    if (hasApiKeyUpdates) invalidateAISettingsCache(req.companyId);
    // This route is requireCompanyAdmin, and the settings UI needs the values
    // back to keep showing what is saved.
    res.json(flattenCompany(data, { includeSecrets: true }));
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
