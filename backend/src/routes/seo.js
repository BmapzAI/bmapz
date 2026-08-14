import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { sanitizeUpdate } from '../lib/safeUpdate.js';
import { runSeoAnalysis, toRow, normalizeUrl } from '../lib/seoAnalysis.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    // Each row carries a full report, so the history list is bounded rather than
    // fetching every analysis the company has ever run.
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
    const { data, error } = await supabaseAdmin
      .from('seo_analyses')
      .select('*')
      .eq('company_id', req.companyId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/seo/analyze — run an analysis server-side and store it.
// The SEO screen and the AI chat action both come through here, so there is one
// prompt and one save path.
router.post('/analyze', requireAuth, async (req, res) => {
  try {
    const saved = await runSeoAnalysis({
      companyId: req.companyId,
      userId: req.dbUser?.id,
      userRole: req.dbUser?.role,
      url: req.body?.url,
      scanType: req.body?.scan_type || req.body?.scanType,
    });
    res.json(saved);
  } catch (err) {
    console.error('[seo/analyze] failed:', err.message);
    res.status(400).json({ error: err.message });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    // Deliberately NOT `{...req.body}`. The old spread pushed the model's report
    // keys (top_issues, checklist_results, …) in as columns, PostgREST rejected
    // the row, and the failure surfaced nowhere — the table held 0 rows for the
    // life of the feature. toRow keeps the payload and the schema in step.
    const { url, scan_type: scanType, ...analysis } = req.body || {};
    const { data, error } = await supabaseAdmin
      .from('seo_analyses')
      .insert(toRow({
        companyId: req.companyId,
        url: normalizeUrl(url || analysis.url),
        scanType,
        analysis,
      }))
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('[seo] save failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('seo_analyses')
      // sanitizeUpdate strips company_id/id/is_global: .eq('company_id') limits
      // WHICH row is updated, not what the SET clause may contain.
      .update(sanitizeUpdate(req.body))
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

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('seo_analyses')
      .delete()
      .eq('id', req.params.id)
      .eq('company_id', req.companyId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/seo/search-console — fetch real Google Search Console data (must be before /:id)
router.get('/search-console', requireAuth, async (req, res) => {
  try {
    const { days = 28 } = req.query;
    const { data: companyRow } = await supabaseAdmin
      .from('companies')
      .select('api_keys')
      .eq('id', req.companyId)
      .single();
    const company = { ...(companyRow?.api_keys || {}) };

    if (!company?.google_access_token || !company?.google_search_console_url) {
      return res.json({ error: 'Google Search Console not connected' });
    }

    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const r = await fetch(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(company.google_search_console_url)}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${company.google_access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate, endDate,
          dimensions: ['query'],
          rowLimit: 25,
        }),
      }
    );
    const d = await r.json();
    res.json(d);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /:id — must come after all named routes like /search-console
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('seo_analyses')
      .select('*')
      .eq('id', req.params.id)
      .eq('company_id', req.companyId)
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(404).json({ error: 'SEO analysis not found' });
  }
});

export default router;
