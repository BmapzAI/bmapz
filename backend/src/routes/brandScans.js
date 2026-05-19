import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

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
    const { data: existing } = await supabaseAdmin
      .from('brand_scans')
      .select('results')
      .eq('id', req.params.id)
      .eq('company_id', req.companyId)
      .single();

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
