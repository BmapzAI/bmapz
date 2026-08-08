import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v24.0';
const LINKEDIN_API_VERSION = process.env.LINKEDIN_API_VERSION || '202606';
const AD_RECORD_FIELDS = ['type', 'platform', 'title', 'status', 'external_id', 'ad_account_id',
  'campaign_id', 'ad_set_id', 'budget', 'budget_type', 'objective', 'audience', 'creative',
  'performance', 'strategy', 'copy_data', 'form_data', 'published_at'];

// The Ads UI has always spoken in `strategy_data` / `copies_data`, but the
// columns are `strategy` / `copy_data`. Those names were not in the allowlist,
// so the actual strategy, copy and campaign content was silently dropped on save
// and came back empty on load. Accept both spellings and map to the real columns.
const AD_FIELD_ALIASES = { strategy_data: 'strategy', copies_data: 'copy_data' };

// Empty strings from form inputs are invalid for these column types and make
// Postgres reject the whole row, which reads to the user as "nothing saved".
const AD_NULLABLE_TIMESTAMPS = ['published_at'];
const AD_NULLABLE_NUMBERS = ['budget'];
const AD_STATUSES = ['draft', 'active', 'paused', 'completed', 'failed'];

const pickFields = (body, fields) => {
  const src = { ...(body || {}) };
  for (const [alias, column] of Object.entries(AD_FIELD_ALIASES)) {
    if (alias in src && !(column in src)) src[column] = src[alias];
  }
  return Object.fromEntries(
    fields
      .filter(field => field in src)
      .map(field => {
        let value = src[field];
        if (AD_NULLABLE_TIMESTAMPS.includes(field) && (value === '' || value === undefined)) value = null;
        if (AD_NULLABLE_NUMBERS.includes(field)) {
          if (value === '' || value === undefined || value === null) value = null;
          else {
            // Accept "R$ 1.500" / "1,500" style input without failing the insert.
            const n = Number(String(value).replace(/[^0-9.-]/g, ''));
            value = Number.isFinite(n) ? n : null;
          }
        }
        // status is CHECK-constrained — never let a stray value reject the row.
        if (field === 'status' && !AD_STATUSES.includes(String(value || '').toLowerCase())) value = 'draft';
        return [field, value];
      })
  );
};

// Echo the UI's field names back so saved records load correctly.
const withAdAliases = (row) => (row && typeof row === 'object')
  ? { ...row, strategy_data: row.strategy ?? null, copies_data: row.copy_data ?? null }
  : row;

// ─── Ad Records (saved campaigns/creatives) ───────────────────────────────────

router.get('/records', requireAuth, async (req, res) => {
  try {
    const { platform, type, limit = 50, offset = 0 } = req.query;
    let query = supabaseAdmin
      .from('ad_records')
      .select('*', { count: 'exact' })
      .eq('company_id', req.companyId)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (platform) query = query.eq('platform', platform);
    if (type) query = query.eq('type', type);

    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ data: (data || []).map(withAdAliases), total: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/records', requireAuth, async (req, res) => {
  try {
    const payload = pickFields(req.body, AD_RECORD_FIELDS);
    const insert = (body) => supabaseAdmin
      .from('ad_records')
      .insert({ ...body, company_id: req.companyId })
      .select()
      .single();

    let { data, error } = await insert(payload);
    // form_data only exists after migration 012 — save the rest rather than
    // failing the whole record.
    if (error && /form_data/i.test(error.message || '')) {
      const { form_data, ...rest } = payload; // eslint-disable-line no-unused-vars
      ({ data, error } = await insert(rest));
    }
    if (error) throw error;
    res.json(withAdAliases(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/records/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('ad_records')
      .select('*')
      .eq('id', req.params.id)
      .eq('company_id', req.companyId)
      .single();
    if (error) throw error;
    res.json(withAdAliases(data));
  } catch (err) {
    res.status(404).json({ error: 'Ad record not found' });
  }
});

router.patch('/records/:id', requireAuth, async (req, res) => {
  try {
    const payload = pickFields(req.body, AD_RECORD_FIELDS);
    const run = (body) => supabaseAdmin
      .from('ad_records')
      .update(body)
      .eq('id', req.params.id)
      .eq('company_id', req.companyId)
      .select()
      .single();

    let { data, error } = await run(payload);
    if (error && /form_data/i.test(error.message || '')) {
      const { form_data, ...rest } = payload; // eslint-disable-line no-unused-vars
      ({ data, error } = await run(rest));
    }
    if (error) throw error;
    res.json(withAdAliases(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/records/:id', requireAuth, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('ad_records')
      .delete()
      .eq('id', req.params.id)
      .eq('company_id', req.companyId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Real campaign data from ad platforms ─────────────────────────────────────

router.get('/campaigns', requireAuth, async (req, res) => {
  try {
    const { platform } = req.query;
    const normalizedPlatform = normalizeAdPlatform(platform);
    if (!normalizedPlatform) {
      return res.status(400).json({
        error: 'Choose a supported ad platform: google_ads, meta_ads, linkedin_ads, or tiktok_ads.',
      });
    }

    const { data: companyRow } = await supabaseAdmin
      .from('companies')
      .select('*')
      .eq('id', req.companyId)
      .single();
    const company = companyRow
      ? { ...companyRow, ...(companyRow.api_keys || {}), ...(companyRow.settings || {}) }
      : {};

    const response = { platform: normalizedPlatform, campaigns: [], source: 'live' };

    if (normalizedPlatform === 'google_ads') {
      const googleAccessToken = await getGoogleAdsAccessToken(req.companyId, company);
      if (googleAccessToken && company.google_ads_customer_id) {
        try {
          const r = await fetch(
            `https://googleads.googleapis.com/v24/customers/${company.google_ads_customer_id.replace(/-/g, '')}/googleAds:searchStream`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${googleAccessToken}`,
                'developer-token': company.google_ads_developer_token || process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                query: `SELECT campaign.id, campaign.name, campaign.status, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions FROM campaign WHERE segments.date DURING LAST_30_DAYS`,
              }),
            }
          );
          const d = await r.json();
          if (!r.ok || d.error) {
            throw new Error(d.error?.message || 'Google Ads API returned an error.');
          }
          response.campaigns = mapGoogleAdsCampaigns(d);
        } catch (e) {
          return res.status(502).json({ error: `Google Ads fetch failed: ${e.message}` });
        }
      } else {
        return res.status(400).json({ error: 'Google Ads is not fully connected. Connect OAuth and set Customer ID first.' });
      }
    }

    if (normalizedPlatform === 'tiktok_ads') {
      if (company.tiktok_access_token && company.tiktok_advertiser_id) {
        try {
          const r = await fetch('https://business-api.tiktok.com/open_api/v1.3/campaign/get/', {
            method: 'POST',
            headers: {
              'Access-Token': company.tiktok_access_token,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              advertiser_id: String(company.tiktok_advertiser_id),
              page_size: 50,
              page: 1,
            }),
          });
          const d = await r.json();
          if (!r.ok || d.code !== 0) throw new Error(d.message || 'TikTok Ads API returned an error.');
          response.campaigns = (d.data?.list || []).map(c => ({
            campaign_id: c.campaign_id,
            campaign_name: c.campaign_name,
            status: c.operation_status || c.status,
            objective: c.objective_type,
            spend: Number(c.spend || 0),
            impressions: Number(c.impressions || 0),
            clicks: Number(c.clicks || 0),
            ctr: c.ctr,
            cpc: c.cpc,
            conversions: Number(c.conversion || c.conversions || 0),
          }));
          if (response.campaigns.length && response.campaigns.every(c => c.spend === 0 && c.impressions === 0)) {
            response.warning = 'TikTok returned live campaigns, but this endpoint did not include performance metrics for them.';
          }
        } catch (e) {
          return res.status(502).json({ error: `TikTok Ads fetch failed: ${e.message}` });
        }
      } else {
        return res.status(400).json({ error: 'TikTok Ads is not fully connected. Connect TikTok and set Advertiser ID first.' });
      }
    }

    if (normalizedPlatform === 'meta_ads') {
      if (company.meta_access_token && company.meta_ads_account_id) {
        try {
          const fields = 'campaign_id,campaign_name,spend,impressions,clicks,ctr,cpc,conversions,reach';
          const r = await fetch(
            `https://graph.facebook.com/${META_GRAPH_VERSION}/act_${company.meta_ads_account_id}/insights?level=campaign&date_preset=last_30d&fields=${fields}&access_token=${company.meta_access_token}`
          );
          const d = await r.json();
          if (!r.ok || d.error) {
            throw new Error(d.error?.message || 'Meta Ads API returned an error.');
          }
          response.campaigns = (d.data || []).map(c => ({
            campaign_id: c.campaign_id,
            campaign_name: c.campaign_name,
            spend: Number(c.spend || 0),
            impressions: Number(c.impressions || 0),
            clicks: Number(c.clicks || 0),
            ctr: c.ctr,
            cpc: c.cpc,
            reach: Number(c.reach || 0),
            conversions: extractMetaConversions(c.conversions),
          }));
        } catch (e) {
          return res.status(502).json({ error: `Meta Ads fetch failed: ${e.message}` });
        }
      } else {
        return res.status(400).json({ error: 'Meta Ads is not fully connected. Connect Meta OAuth and set Meta Ads Account ID first.' });
      }
    }

    if (normalizedPlatform === 'linkedin_ads') {
      const linkedinToken = company.linkedin_ads_access_token || company.linkedin_access_token;
      if (linkedinToken && company.linkedin_ads_account_id) {
        try {
          const r = await fetch(
            `https://api.linkedin.com/rest/adAccounts/${company.linkedin_ads_account_id}/adCampaigns?q=search&search=(test:False)&pageSize=25`,
            {
              headers: {
                Authorization: `Bearer ${linkedinToken}`,
                'Linkedin-Version': LINKEDIN_API_VERSION,
                'X-Restli-Protocol-Version': '2.0.0',
              },
            }
          );
          const d = await r.json();
          if (!r.ok || d.message) {
            throw new Error(d.message || 'LinkedIn Ads API returned an error.');
          }
          response.campaigns = (d.elements || []).map(c => ({
            campaign_id: c.id,
            campaign_name: c.name,
            status: c.status,
          }));
        } catch (e) {
          return res.status(502).json({ error: `LinkedIn Ads fetch failed: ${e.message}` });
        }
      } else {
        return res.status(400).json({ error: 'LinkedIn Ads is not fully connected. Connect LinkedIn and set Ad Account ID first.' });
      }
    }

    if (!response.campaigns.length) {
      return res.json({
        ...response,
        warning: 'No live campaigns were returned by the ad platform for the last 30 days.',
      });
    }

    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ads/platform-leads — fetch leads from ad platforms
router.get('/platform-leads', requireAuth, async (req, res) => {
  try {
    const { platform, campaign_id } = req.query;
    const { data: companyRow } = await supabaseAdmin
      .from('companies')
      .select('*')
      .eq('id', req.companyId)
      .single();
    const company = companyRow
      ? { ...companyRow, ...(companyRow.api_keys || {}), ...(companyRow.settings || {}) }
      : {};

    const leads = [];

    if (platform === 'meta' || !platform) {
      if (company.meta_access_token && company.meta_ads_account_id) {
        try {
          const formsResp = await fetch(
            `https://graph.facebook.com/${META_GRAPH_VERSION}/act_${company.meta_ads_account_id}/leadgen_forms?access_token=${company.meta_access_token}`
          );
          const formsData = await formsResp.json();
          for (const form of (formsData.data || []).slice(0, 3)) {
            const leadsResp = await fetch(
              `https://graph.facebook.com/${META_GRAPH_VERSION}/${form.id}/leads?fields=id,created_time,field_data&limit=50&access_token=${company.meta_access_token}`
            );
            const leadsData = await leadsResp.json();
            for (const lead of (leadsData.data || [])) {
              const fields = {};
              (lead.field_data || []).forEach(f => { fields[f.name] = f.values?.[0]; });
              leads.push({
                platform: 'meta',
                external_id: lead.id,
                name: fields.full_name || `${fields.first_name || ''} ${fields.last_name || ''}`.trim(),
                email: fields.email || '',
                phone: fields.phone_number || '',
                created_at: lead.created_time,
                raw: fields,
              });
            }
          }
        } catch { /* skip */ }
      }
    }

    res.json(leads);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

function normalizeAdPlatform(platform) {
  const raw = String(platform || '').toLowerCase();
  const map = {
    google: 'google_ads',
    google_ads: 'google_ads',
    meta: 'meta_ads',
    facebook: 'meta_ads',
    instagram: 'meta_ads',
    meta_ads: 'meta_ads',
    linkedin: 'linkedin_ads',
    linkedin_ads: 'linkedin_ads',
    tiktok: 'tiktok_ads',
    tiktok_ads: 'tiktok_ads',
  };
  return map[raw] || null;
}

function mapGoogleAdsCampaigns(payload) {
  const batches = Array.isArray(payload) ? payload : [];
  return batches.flatMap(batch => (batch.results || []).map(row => {
    const campaign = row.campaign || {};
    const metrics = row.metrics || {};
    const costMicros = Number(metrics.costMicros || metrics.cost_micros || 0);
    const clicks = Number(metrics.clicks || 0);
    const impressions = Number(metrics.impressions || 0);
    return {
      campaign_id: campaign.id,
      campaign_name: campaign.name,
      status: campaign.status,
      spend: costMicros / 1000000,
      impressions,
      clicks,
      ctr: impressions > 0 ? `${((clicks / impressions) * 100).toFixed(2)}%` : '0.00%',
      cpc: clicks > 0 ? (costMicros / 1000000 / clicks).toFixed(2) : '0.00',
      conversions: Number(metrics.conversions || 0),
    };
  }));
}

function extractMetaConversions(conversions) {
  if (!Array.isArray(conversions)) return 0;
  return conversions.reduce((sum, item) => sum + Number(item.value || 0), 0);
}

async function getGoogleAdsAccessToken(companyId, company) {
  const refreshToken = company.google_ads_refresh_token || company.google_refresh_token;
  const clientId = company.google_ads_client_id || company.google_client_id || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = company.google_ads_client_secret || company.google_client_secret || process.env.GOOGLE_CLIENT_SECRET;
  const currentToken = company.google_access_token;
  const expiresAt = company.google_token_expires_at ? new Date(company.google_token_expires_at).getTime() : 0;

  if (currentToken && expiresAt > Date.now() + 5 * 60 * 1000) return currentToken;
  if (!refreshToken || !clientId || !clientSecret) return currentToken || null;

  const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  const tokens = await tokenResp.json();
  if (!tokenResp.ok || tokens.error || !tokens.access_token) {
    throw new Error(tokens.error_description || tokens.error || 'Google OAuth token refresh failed. Reconnect Google Ads.');
  }

  // Read-merge-write over the whole api_keys blob: if the read fails and we
  // merge onto `{}`, the update DELETES every other stored credential. Skip
  // persisting rather than wiping — the token below still works for this call.
  const { data: row, error: readErr } = await supabaseAdmin
    .from('companies').select('api_keys').eq('id', companyId).single();
  if (readErr) {
    console.error('[ads] Google token refresh: api_keys read failed, not persisting:', readErr.message);
    return tokens.access_token;
  }
  const apiKeys = row?.api_keys || {};
  await supabaseAdmin.from('companies').update({
    api_keys: {
      ...apiKeys,
      google_access_token: tokens.access_token,
      google_token_expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
    },
  }).eq('id', companyId);
  return tokens.access_token;
}
