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
    const { data: companyRow } = await supabaseAdmin
      .from('companies')
      .select('*')
      .eq('id', req.companyId)
      .single();
    const company = companyRow
      ? { ...companyRow, ...(companyRow.api_keys || {}), ...(companyRow.settings || {}) }
      : {};

    const campaigns = {};

    if (!platform || platform === 'google') {
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
          campaigns.google = d;
        } catch (e) {
          campaigns.google = { error: e.message };
        }
      }
    }

    if (!platform || platform === 'meta') {
      if (company.meta_access_token && company.meta_ads_account_id) {
        try {
          const fields = 'id,name,status,objective,spend,impressions,clicks,ctr,cpc,reach';
          const r = await fetch(
            `https://graph.facebook.com/v19.0/act_${company.meta_ads_account_id}/campaigns?fields=${fields}&access_token=${company.meta_access_token}`
          );
          const d = await r.json();
          campaigns.meta = d.data || [];
        } catch (e) {
          campaigns.meta = { error: e.message };
        }
      }
    }

    if (!platform || platform === 'linkedin') {
      if (company.linkedin_access_token && company.linkedin_ads_account_id) {
        try {
          const r = await fetch(
            `https://api.linkedin.com/v2/adCampaignsV2?q=search&search.account.values[0]=urn:li:sponsoredAccount:${company.linkedin_ads_account_id}&count=25`,
            { headers: { Authorization: `Bearer ${company.linkedin_access_token}` } }
          );
          const d = await r.json();
          campaigns.linkedin = d.elements || [];
        } catch (e) {
          campaigns.linkedin = { error: e.message };
        }
      }
    }

    res.json(campaigns);
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
