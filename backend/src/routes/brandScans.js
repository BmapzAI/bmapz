import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { proposeActions, describeActions, friendlyError } from '../lib/aiActions.js';
import { invalidateCompanyBrain } from '../lib/companyBrain.js';

const router = Router();

/**
 * Turn a finished brand scan into a readable brief.
 *
 * The scan is stored as a JSON report. Handing that JSON to the agent — or showing
 * it in the archive — is what made other screens unreadable, so the parts that
 * carry meaning are flattened into prose first.
 */
function reportToBrief(report, companyData) {
  if (!report || typeof report !== 'object') return '';
  const list = (v, pick) => (Array.isArray(v)
    ? v.map(x => (typeof x === 'string' ? x : pick(x))).filter(Boolean).join('; ')
    : '');

  return [
    companyData?.name ? `Brand: ${companyData.name}` : null,
    companyData?.industry ? `Industry: ${companyData.industry}` : null,
    report.overview ? `Overview: ${report.overview}` : null,
    report.brand_attributes?.length ? `Brand attributes: ${list(report.brand_attributes, a => a.attribute || a.name)}` : null,
    report.brand_pillars?.length ? `Brand pillars: ${list(report.brand_pillars, p => p.pillar || p.name || p.title)}` : null,
    report.personas?.length ? `Personas: ${list(report.personas, p => p.name || p.title)}` : null,
    report.seo_keywords?.length ? `SEO keywords: ${list(report.seo_keywords, k => k.keyword || k.term)}` : null,
    report.competitors?.length ? `Competitors: ${list(report.competitors, c => c.name || c.competitor)}` : null,
    report.recommendations?.length ? `Recommendations: ${list(report.recommendations, r => r.recommendation || r.action || r.title)}` : null,
    report.opportunities?.length ? `Opportunities: ${list(report.opportunities, o => o.opportunity || o.title)}` : null,
  ].filter(Boolean).join('\n');
}

/**
 * POST /api/brand-scans/:id/actions
 *
 * Propose what to DO with a finished scan.
 *
 * A brand scan used to be a dead end: it produced a report, saved it to its own
 * table, and nothing else in the app could act on it — it was not archived, it
 * could not fill in the settings it had just researched, and it could not raise
 * the work it recommended.
 *
 * This runs the scan's findings through the SAME proposal pipeline the AI chat
 * uses, so the result is a normal action list — settings updates, tasks, saved
 * strategies — which the user approves, edits or rejects with the existing
 * approval UI, and which `POST /api/ai/actions/apply` executes. Nothing is
 * written here: proposing and applying stay separate, so a scan can never
 * silently rewrite a company's settings.
 */
router.post('/:id/actions', requireAuth, async (req, res) => {
  try {
    const { data: scan, error } = await supabaseAdmin
      .from('brand_scans')
      .select('id, company_id, domain, results, status')
      .eq('id', req.params.id)
      .eq('company_id', req.companyId)   // company-scoped: an id alone is not access
      .maybeSingle();
    if (error) throw error;
    if (!scan) return res.status(404).json({ error: 'Scan not found.' });
    if (scan.status !== 'completed') {
      return res.status(400).json({ error: 'This scan has not finished yet.' });
    }

    const brief = reportToBrief(scan.results?.report, scan.results?.company_data);
    if (!brief) return res.status(400).json({ error: 'This scan has no findings to act on.' });

    // Imported at call time — routes/ai.js imports aiActions.js, and this route is
    // mounted from the same graph; deferring keeps the cycle open.
    const { runAIChat } = await import('./ai.js');

    const actions = await proposeActions({
      runAIChat,
      companyId: req.companyId,
      userId: req.dbUser?.id,
      userRole: req.dbUser?.role,
      userEmail: req.dbUser?.email,
      userMessage:
        'Apply the findings of this brand scan to the company: fill in the settings it '
        + 'establishes (positioning, ICP, tone, competitors), and raise a task for each '
        + 'concrete piece of work it recommends. Do not invent anything the scan does not support.',
      assistantReply: brief,
    });

    res.json({
      actions: actions || [],
      descriptions: describeActions(actions || []),
      brief,
    });
  } catch (err) {
    console.error('[brandScans/actions]', err.message);
    res.status(500).json({ error: friendlyError(err) });
  }
});

// Map frontend status values → DB CHECK values
function mapStatusIn(status) {
  if (status === 'generating') return 'running';
  if (status === 'complete') return 'completed';
  if (status === 'completed') return 'completed';
  if (status === 'failed') return 'failed';
  return 'pending';
}

// Map DB status values → frontend values
function mapStatusOut(status) {
  if (status === 'running') return 'generating';
  if (status === 'completed') return 'complete';
  if (status === 'failed') return 'failed';
  return 'generating'; // pending → generating
}

// Flatten a DB row to the shape expected by the frontend
function toFrontend(row) {
  if (!row) return null;
  return {
    ...row,
    title: row.results?.title || row.domain || 'Brand Scan',
    company_data: row.results?.company_data || null,
    report: row.results?.report || null,
    status: mapStatusOut(row.status),
    created_date: row.created_at,
  };
}

// GET /api/brand-scans — list all for company
router.get('/', requireAuth, async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const { data, error } = await supabaseAdmin
      .from('brand_scans')
      .select('*')
      .eq('company_id', req.companyId)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);
    if (error) throw error;
    res.json((data || []).map(toFrontend));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/brand-scans/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('brand_scans')
      .select('*')
      .eq('id', req.params.id)
      .eq('company_id', req.companyId)
      .single();
    if (error) throw error;
    res.json(toFrontend(data));
  } catch (err) {
    res.status(404).json({ error: 'Brand scan not found' });
  }
});

// POST /api/brand-scans — create
router.post('/', requireAuth, async (req, res) => {
  try {
    const { title, status, company_data, report, ...rest } = req.body;
    const domain = rest.domain || company_data?.website || company_data?.name || 'scan';

    const payload = {
      company_id: req.companyId,
      domain,
      status: mapStatusIn(status || 'generating'),
      results: {
        ...(title ? { title } : {}),
        ...(company_data ? { company_data } : {}),
        ...(report ? { report } : {}),
      },
    };

    const { data, error } = await supabaseAdmin
      .from('brand_scans')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    res.json(toFrontend(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/brand-scans/:id — update
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const { title, status, company_data, report, ...rest } = req.body;

    // Fetch existing results to merge into
    const { data: existing, error: readErr } = await supabaseAdmin
      .from('brand_scans')
      .select('results')
      .eq('id', req.params.id)
      .eq('company_id', req.companyId)
      .single();

    // The whole report lives in this one JSONB blob and is replaced below, so
    // merging onto `{}` after a failed read would wipe a completed scan and
    // leave only the field being edited. Refuse instead.
    if (readErr) {
      console.error('[brandScans/patch] read failed, refusing to write:', readErr.message);
      return res.status(503).json({ error: 'Could not read the existing scan, so nothing was saved. Please try again.' });
    }

    const existingResults = existing?.results || {};
    const updatedResults = {
      ...existingResults,
      ...(title !== undefined ? { title } : {}),
      ...(company_data !== undefined ? { company_data } : {}),
      ...(report !== undefined ? { report } : {}),
    };

    const dbStatus = status ? mapStatusIn(status) : undefined;
    const payload = {
      results: updatedResults,
      ...(dbStatus ? { status: dbStatus } : {}),
      ...(dbStatus === 'completed' ? { completed_at: new Date().toISOString() } : {}),
    };

    const { data, error } = await supabaseAdmin
      .from('brand_scans')
      .update(payload)
      .eq('id', req.params.id)
      .eq('company_id', req.companyId)
      .select()
      .single();
    if (error) throw error;
    res.json(toFrontend(data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/brand-scans/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('brand_scans')
      .delete()
      .eq('id', req.params.id)
      .eq('company_id', req.companyId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
