import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    let query = supabaseAdmin
      .from('workflows')
      .select('*', { count: 'exact' })
      .eq('company_id', req.companyId)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (status) query = query.eq('status', status);
    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ data, total: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('workflows')
      .insert({ ...req.body, company_id: req.companyId })
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/workflows/meta/node-templates — MUST be before /:id to avoid shadowing
router.get('/meta/node-templates', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('node_templates')
      .select('*')
      .order('category');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('workflows')
      .select('*')
      .eq('id', req.params.id)
      .eq('company_id', req.companyId)
      .single();
    if (error) throw error;
    res.json(data);
  } catch {
    res.status(404).json({ error: 'Workflow not found' });
  }
});

router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('workflows')
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

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('workflows')
      .delete()
      .eq('id', req.params.id)
      .eq('company_id', req.companyId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/workflows/:id/run — manually trigger a workflow run
router.post('/:id/run', requireAuth, async (req, res) => {
  try {
    const { data: workflow } = await supabaseAdmin
      .from('workflows')
      .select('*')
      .eq('id', req.params.id)
      .eq('company_id', req.companyId)
      .single();
    if (!workflow) return res.status(404).json({ error: 'Workflow not found' });

    // Create a run record
    const { data: run, error: runErr } = await supabaseAdmin
      .from('workflow_runs')
      .insert({
        workflow_id: workflow.id,
        company_id: req.companyId,
        status: 'active',
        context: req.body,
      })
      .select()
      .single();
    if (runErr) throw runErr;

    // For now: return the run record; actual step execution would be async
    // In production, dispatch to a job queue (BullMQ, etc.)
    res.json({ run_id: run.id, status: 'running', message: 'Workflow run started' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/workflow-runs — all runs for the company (used by WorkflowAnalytics)
// NOTE: This route is also mounted at /api/workflow-runs in index.js
export const workflowRunsRouter = Router();
workflowRunsRouter.get('/', requireAuth, async (req, res) => {
  try {
    const { workflow_id, company_id: _cid, status, limit = 200 } = req.query;
    let query = supabaseAdmin
      .from('workflow_runs')
      .select('*')
      .eq('company_id', req.companyId)
      .order('created_at', { ascending: false })
      .limit(Number(limit));
    if (workflow_id) query = query.eq('workflow_id', workflow_id);
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw error;
    res.json(data ?? []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

workflowRunsRouter.get('/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('workflow_runs')
      .select('*')
      .eq('id', req.params.id)
      .eq('company_id', req.companyId)
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(404).json({ error: 'Workflow run not found' });
  }
});

workflowRunsRouter.post('/', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('workflow_runs')
      .insert({ ...req.body, company_id: req.companyId })
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

workflowRunsRouter.patch('/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('workflow_runs')
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

// GET /api/workflows/:id/runs
router.get('/:id/runs', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('workflow_runs')
      .select('*')
      .eq('workflow_id', req.params.id)
      .eq('company_id', req.companyId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
