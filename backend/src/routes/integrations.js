import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/integrations/status — full integration status for the company
router.get('/status', requireAuth, async (req, res) => {
  try {
    const { data: companyRow } = await supabaseAdmin
      .from('companies')
      .select('integration_status, api_keys')
      .eq('id', req.companyId)
      .single();

    const company = { ...(companyRow?.api_keys || {}) };
    const status = companyRow?.integration_status || {};

    // Auto-detect connections from stored tokens
    const detected = {
      gmail: !!(company?.google_access_token),
      google_analytics: !!(company?.google_access_token && company?.google_analytics_property_id),
      google_search_console: !!(company?.google_access_token && company?.google_search_console_url),
      google_ads: !!(company?.google_access_token && company?.google_ads_customer_id),
      google_drive: !!(company?.google_drive_token),
      youtube: !!(company?.google_access_token),
      meta: !!(company?.meta_access_token),
      facebook: !!(company?.meta_access_token && company?.facebook_page_id),
      instagram: !!(company?.meta_access_token && company?.instagram_business_account_id),
      linkedin: !!(company?.linkedin_access_token),
      twitter: !!(company?.twitter_access_token),
      tiktok: !!(company?.tiktok_access_token),
      email_smtp: !!(company?.smtp_host && company?.smtp_user),
      email_resend: !!(company?.resend_api_key),
      apollo: !!(company?.apollo_api_key),
      hunter: !!(company?.hunter_api_key),
      stripe: !!(company?.stripe_connected),
    };

    // Merge: use stored status, then detected
    const merged = { ...detected, ...status };

    // Include google_connected_email for display
    res.json({
      status: merged,
      google_connected_email: company?.google_connected_email,
      facebook_page_id: company?.facebook_page_id,
      instagram_business_account_id: company?.instagram_business_account_id,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/integrations/google/drive/files — list Drive files
router.get('/google/drive/files', requireAuth, async (req, res) => {
  try {
    const { query = '', page_token, mime_type } = req.query;

    const { data: companyRow } = await supabaseAdmin
      .from('companies')
      .select('api_keys')
      .eq('id', req.companyId)
      .single();
    const company = companyRow?.api_keys || {};

    const token = company.google_drive_token || company.google_access_token;
    if (!token) return res.status(401).json({ error: 'Google Drive not connected' });

    const params = new URLSearchParams({
      fields: 'nextPageToken,files(id,name,mimeType,thumbnailLink,webViewLink,createdTime,size)',
      orderBy: 'modifiedTime desc',
      pageSize: '30',
    });

    // Build query
    const qParts = ['trashed=false'];
    if (mime_type) {
      qParts.push(`mimeType='${mime_type}'`);
    } else {
      qParts.push("(mimeType contains 'image/' or mimeType='application/pdf')");
    }
    if (query) qParts.push(`name contains '${query}'`);
    params.set('q', qParts.join(' and '));

    if (page_token) params.set('pageToken', page_token);

    const r = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const d = await r.json();

    if (d.error) {
      if (d.error.status === 'UNAUTHENTICATED') {
        return res.status(401).json({ error: 'Google Drive token expired. Please reconnect.' });
      }
      throw new Error(d.error.message);
    }

    res.json(d);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/integrations/google/analytics — fetch GA4 data
router.get('/google/analytics', requireAuth, async (req, res) => {
  try {
    const { days = 28 } = req.query;
    const { data: companyRow } = await supabaseAdmin
      .from('companies')
      .select('api_keys')
      .eq('id', req.companyId)
      .single();
    const company = companyRow?.api_keys || {};

    if (!company.google_access_token || !company.google_analytics_property_id) {
      return res.json({ error: 'Google Analytics not connected' });
    }

    const endDate = 'today';
    const startDate = `${days}daysAgo`;

    const r = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${company.google_analytics_property_id}:runReport`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${company.google_access_token}`,
        'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateRanges: [{ startDate, endDate }],
          metrics: [
            { name: 'sessions' },
            { name: 'users' },
            { name: 'pageviews' },
            { name: 'bounceRate' },
            { name: 'averageSessionDuration' },
          ],
          dimensions: [{ name: 'date' }],
          orderBys: [{ dimension: { dimensionName: 'date' } }],
        }),
      }
    );
    const d = await r.json();
    if (d.error) throw new Error(d.error.message);
    res.json(d);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/integrations/apollo/enrich — enrich a lead with Apollo
router.post('/apollo/enrich', requireAuth, async (req, res) => {
  try {
    const { email, domain } = req.body;
    const { data: companyRow } = await supabaseAdmin
      .from('companies')
      .select('api_keys')
      .eq('id', req.companyId)
      .single();

    const apiKey = companyRow?.api_keys?.apollo_api_key || process.env.APOLLO_API_KEY;
    if (!apiKey) return res.status(400).json({ error: 'Apollo API key not configured' });

    const r = await fetch('https://api.apollo.io/api/v1/people/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ email, domain, reveal_personal_emails: true }),
    });
    const d = await r.json();
    res.json(d);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/integrations/hunter/find-email
router.post('/hunter/find-email', requireAuth, async (req, res) => {
  try {
    const { domain, first_name, last_name } = req.body;
    const { data: companyRow } = await supabaseAdmin
      .from('companies')
      .select('api_keys')
      .eq('id', req.companyId)
      .single();

    const apiKey = companyRow?.api_keys?.hunter_api_key || process.env.HUNTER_API_KEY;
    if (!apiKey) return res.status(400).json({ error: 'Hunter API key not configured' });

    const params = new URLSearchParams({ domain, first_name, last_name, api_key: apiKey });
    const r = await fetch(`https://api.hunter.io/v2/email-finder?${params}`);
    const d = await r.json();
    res.json(d);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
