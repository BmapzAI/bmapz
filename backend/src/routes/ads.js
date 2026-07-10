import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

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
    res.json({ data, total: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/records', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('ad_records')
      .insert({ ...req.body, company_id: req.companyId })
      .select()
      .single();
    if (error) throw error;
    res.json(data);
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
    res.json(data);
  } catch (err) {
    res.status(404).json({ error: 'Ad record not found' });
  }
});

router.patch('/records/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('ad_records')
      .update(req.body)
      .eq('id', req.params.id)
      .eq('company_id', req.companyId)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
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
        error: 'Choose a supported ad platform: google_ads, meta_ads, or linkedin_ads.',
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
      if (company.google_access_token && company.google_ads_customer_id) {
        try {
          const r = await fetch(
            `https://googleads.googleapis.com/v17/customers/${company.google_ads_customer_id}/googleAds:searchStream`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${company.google_access_token}`,
                'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
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

    if (normalizedPlatform === 'meta_ads') {
      if (company.meta_access_token && company.meta_ads_account_id) {
        try {
          const fields = 'campaign_id,campaign_name,spend,impressions,clicks,ctr,cpc,conversions,reach';
          const r = await fetch(
            `https://graph.facebook.com/v19.0/act_${company.meta_ads_account_id}/insights?level=campaign&date_preset=last_30d&fields=${fields}&access_token=${company.meta_access_token}`
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
      if (company.linkedin_access_token && company.linkedin_ads_account_id) {
        try {
          const r = await fetch(
            `https://api.linkedin.com/v2/adCampaignsV2?q=search&search.account.values[0]=urn:li:sponsoredAccount:${company.linkedin_ads_account_id}&count=25`,
            { headers: { Authorization: `Bearer ${company.linkedin_access_token}` } }
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
            `https://graph.facebook.com/v19.0/act_${company.meta_ads_account_id}/leadgen_forms?access_token=${company.meta_access_token}`
          );
          const formsData = await formsResp.json();
          for (const form of (formsData.data || []).slice(0, 3)) {
            const leadsResp = await fetch(
              `https://graph.facebook.com/v19.0/${form.id}/leads?fields=id,created_time,field_data&limit=50&access_token=${company.meta_access_token}`
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
